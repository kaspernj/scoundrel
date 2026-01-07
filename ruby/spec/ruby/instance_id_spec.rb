require "spec_helper"

describe "Scoundrel::Ruby::Client instance IDs" do
  it "does not resolve proxy objects from other instances" do
    client = Scoundrel::Ruby::Client.new
    reference = {type: :proxy_obj, id: 123, pid: Process.pid, instance_id: "other-instance"}

    result = client.__send__(:read_args, reference)

    expect(result).to eq reference
  end
end
