require "spec_helper"

describe "RubyProcess" do
  it "should be able to do basic stuff" do
    Scoundrel::Ruby::Client.new.spawn_process do |sp|
      sp.new(:String, "Wee")
      ts = []

      1.upto(50) do |tcount|
        ts << Thread.new do
          1.upto(250) do
            str = sp.new(:String, "Kasper Johansen")

            expect(str.__rp_marshal).to eq "Kasper Johansen"
            str << " More"

            expect(str.__rp_marshal).to include "Johansen"
            str << " Even more"

            expect(str.__rp_marshal).not_to include "Christina"
            str << " Much more"

            expect(str.__rp_marshal).to eq "Kasper Johansen More Even more Much more"
          end
        end
      end

      ts.each do |t|
        t.join
      end
    end
  end
end
