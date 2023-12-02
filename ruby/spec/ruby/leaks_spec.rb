require "spec_helper"

describe "RubyProcess" do
  it "should be able to clean up after itself when timeout" do
    require "timeout"

    Scoundrel::Ruby::ClassProxy.run do |data|
      sp = data[:subproc]

      begin
        Timeout.timeout(1) do
          sp.static(:Object, :sleep, 2)
        end

        raise "Expected timeout to be raised."
      rescue Timeout::Error
        #ignore.
      end

      answers = sp.instance_variable_get(:@answers)
      answers.should be_empty
    end
  end
end
