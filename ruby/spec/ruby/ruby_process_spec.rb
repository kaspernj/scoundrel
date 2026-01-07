require "spec_helper"

describe "RubyProcess" do
  let(:rp) { Scoundrel::Ruby::Client.new(debug: false).spawn_process }

  after do
    rp.destroy unless rp.destroyed?
  end

  it "should be able to do basic stuff" do
    proxyarr = rp.new(:Array)
    proxyarr << 1
    proxyarr << 3
    proxyarr << 5

    expect(proxyarr.__rp_marshal).to eq [1, 3, 5]
  end

  it "should be able to pass proxy-objects as arguments." do
    str = rp.new(:String, "/tmp/somefile")
    thread_id = Thread.current.__id__
    write_called = false

    rp.static(:File, :open, str, "w") do |fp|
      expect(thread_id).to eq Thread.current.__id__
      fp.write("Test!")
      write_called = true
    end

    expect(write_called).to eq true
    expect(File.read(str.__rp_marshal)).to eq "Test!"
  end

  it "should be able to write files" do
    fpath = "/tmp/ruby_process_file_write_test"
    fp = rp.static(:File, :open, fpath, "w")
    fp.write("Test!")
    fp.close

    expect(File.read(fpath)).to eq "Test!"
  end

  it "should do garbage collection" do
    GC.start
  end

  it "should be able to do static calls" do
    pid = rp.static(:Process, :pid).__rp_marshal
    expect(rp.finalize_count).to be <= 0 unless RUBY_ENGINE == "jruby"
    raise "Not a number" if !pid.is_a?(Integer)
  end

  it "should be able to handle blocking blocks" do
    run_count = 0
    fpath = "/tmp/ruby_process_file_write_test"
    rp.static(:File, :open, fpath, "w") do |fp|
      sleep 0.1
      run_count += 1
      fp.write("Test!!!")
    end

    expect(run_count).to be > 0
    expect(File.read(fpath)).to eq "Test!!!"
  end

  it "should be able to do slow block-results in JRuby." do
    rp.str_eval("
      class ::Kaspertest
        def self.kaspertest
          8.upto(12) do |i|
            yield(i)
            sleep 0.5
          end
        end
      end

      nil
    ")

    expected_value = 8
    rp.static("Kaspertest", "kaspertest", timeout: 10) do |count|
      expect(expected_value).to eq count.__rp_marshal
      expected_value += 1
    end

    expect(expected_value).to eq 13
  end

  it "should be able to handle large block-runs" do
    #Try to define an integer and run upto with a block.
    proxy_int = rp.numeric(5)

    expected_value = 5
    proxy_int.upto(250) do |i|
      expect(i.__rp_marshal).to eq expected_value
      expected_value += 1
    end

    #Ensure the expected has actually been increased by running the block.
    expect(expected_value).to eq 251
  end

  it "should handle stressed operations" do
    #Spawn a test-object - a string - with a variable-name.
    proxy_obj = rp.new(:String, "Kasper")
    expect(proxy_obj.__rp_marshal).to eq "Kasper"

    #Stress it a little by doing 500 calls.
    0.upto(500) do
      res = proxy_obj.slice(0, 3).__rp_marshal
      expect(res).to eq "Kas"
    end
  end

  it "should be thread-safe" do
    #Do a lot of calls at the same time to test thread-safety.
    proxy_obj = rp.new(:String, "Kasper")
    threads = []
    0.upto(5) do |thread_i|
      should_return = "Kasper".slice(0, thread_i)
      thread = Thread.new do
        begin
          0.upto(250) do |num_i|
            res = proxy_obj.slice(0, thread_i).__rp_marshal
            expect(res).to eq should_return
          end
        rescue => e
          Thread.current[:error] = e
        end
      end

      threads << thread
    end

    threads.each do |thread|
      thread.join
      raise thread[:error] if thread[:error]
    end
  end

  it "should be able to do evals" do
    res = rp.str_eval("return 10").__rp_marshal
    expect(res).to eq 10
  end

  it "reads instance variables via read_attribute" do
    rp.str_eval("
      class ::AttrTest
        def initialize
          @name = \"Ruby\"
        end
      end

      nil
    ")

    obj = rp.new(:AttrTest)

    expect(obj.read_attribute(:name).__rp_marshal).to eq "Ruby"
  end

  it "reads hash keys via read_attribute" do
    hash = rp.new(:Hash)
    hash[:foo] = "bar"

    expect(hash.read_attribute(:foo).__rp_marshal).to eq "bar"
    expect(hash.read_attribute("foo").__rp_marshal).to eq "bar"
  end

  it "should clean itself" do
    rp.garbage_collect
    GC.start
    rp.flush_finalized
    GC.start
    rp.flush_finalized
  end

  it "should be clean and not leaking" do
    GC.start
    rp.flush_finalized
    GC.start
    rp.flush_finalized

    answers = rp.instance_variable_get(:@answers)
    expect(answers).to be_empty

    objects = rp.instance_variable_get(:@objects)
    expect(objects).to be_empty
  end

  it "should be able to destroy itself" do
    rp.destroy
    expect(rp.destroyed?).to eq true
  end
end
