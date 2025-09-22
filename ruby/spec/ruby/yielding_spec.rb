require "spec_helper"

describe Scoundrel::Ruby::Client do
  it "yields results back to host process" do
    Scoundrel::Ruby::Client.new.spawn_process do |process|
      sp_array = process.str_eval("[1, 3, 5, 7]")

      expected_number = 1
      sp_array.each do |number|
        expect(number).to be_a Scoundrel::Ruby::ProxyObject
        expect(number.__rp_marshal).to eq expected_number
        expected_number += 2
      end
    end
  end
end
