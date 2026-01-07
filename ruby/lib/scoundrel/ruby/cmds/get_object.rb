class Scoundrel::Ruby::Client
  #Fetches a constant by name and returns a proxy object.
  def get_object(name, *args)
    timeout, args = extract_timeout_from_args(args)
    raise ArgumentError, "Unexpected arguments: #{args.inspect}" unless args.empty?

    send(cmd: :get_object, name: name, timeout: timeout)
  end

  #Process-method for 'get_object'.
  def cmd_get_object(obj)
    name = obj.fetch(:name).to_s
    name = name.sub(/\A::/, "")
    raise ArgumentError, "Object name cannot be blank" if name.empty?

    const = name.split("::").inject(Object, :const_get)
    handle_return_object(const)
  end
end
