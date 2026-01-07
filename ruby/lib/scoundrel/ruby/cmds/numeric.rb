class Scoundrel::Ruby::Client
  #Returns a numeric value like a integer. This methods exists because it isnt possible to do: "Integer.new(5)".
  #===Examples
  # proxy_int = rp.numeric(5)
  # proxy_int.__rp_marshal #=> 5
  def numeric(val, *args)
    timeout, args = extract_timeout_from_args(args)
    raise ArgumentError, "Unexpected arguments: #{args.inspect}" unless args.empty?

    return send(cmd: :numeric, val: val, timeout: timeout)
  end

  #Process-method for the 'numeric'-method.
  def cmd_numeric(obj)
    return handle_return_object(obj[:val].to_i)
  end
end
