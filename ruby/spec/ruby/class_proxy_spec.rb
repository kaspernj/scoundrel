require "spec_helper"

describe "Scoundrel::Ruby::ClassProxy" do
  it "should be able to do quick in-and-outs without leaking" do
    ts = []

    1.upto(2) do |tcount|
      ts << Thread.new do
        1.upto(10) do
          Scoundrel::Ruby::ClassProxy.run do
            str = Scoundrel::Ruby::ClassProxy.subproc.new(:String, "Wee")
            expect(str.__rp_marshal).to eq "Wee"
          end
        end
      end
    end

    ts.each do |thread|
      thread.join
    end
  end

  it "should be able to do basic stuff" do
    require "stringio"

    Scoundrel::Ruby::ClassProxy.run do
      Scoundrel::Ruby::ClassProxy.subproc.static(:Object, :require, "rubygems")
      Scoundrel::Ruby::ClassProxy.subproc.static(:Object, :require, "rexml/document")

      doc = Scoundrel::Ruby::ClassProxy::REXML::Document.new
      doc.add_element("test")

      strio = StringIO.new
      doc.write(strio)

      expect(Kernel.const_defined?(:REXML)).to be false
      expect(strio.string).to eq "<test/>"
    end
  end

  unless RUBY_ENGINE == "jruby"
    it "prepares for leak test by spawning a ton of string objects" do
      require "digest"

      str = nil

      1000.times do
        str = "#{Digest::MD5.hexdigest(Time.now.to_f.to_s)}".clone
        str = nil
      end

      sleep 0.1
      GC.enable
      GC.start
      sleep 0.1
    end

    it "has cleaned up and process objects" do
      sleep 0.1
      GC.enable
      GC.start
      sleep 0.1

      count_processes = 0
      ObjectSpace.each_object(Scoundrel::Ruby::Client) do |obj|
        count_processes += 1
      end

      expect(count_processes).to eq 0

      count_proxy_objs = 0
      ObjectSpace.each_object(Scoundrel::Ruby::ProxyObject) do |obj|
        count_proxy_objs += 1
      end

      expect(count_proxy_objs).to eq 0

      expect(Scoundrel::Ruby::ClassProxy.constants.empty?).to be true
    end
  end
end
