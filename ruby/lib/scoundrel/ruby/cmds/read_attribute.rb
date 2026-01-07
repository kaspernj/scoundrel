class Scoundrel::Ruby::Client
  #Reads an attribute or hash key on a proxied object.
  def cmd_obj_read_attribute(obj)
    myobj = proxyobj_object(obj.fetch(:id))
    attribute = read_args(obj.fetch(:attribute))

    value = if myobj.is_a?(Hash)
      if myobj.key?(attribute)
        myobj[attribute]
      elsif attribute.is_a?(String) && myobj.key?(attribute.to_sym)
        myobj[attribute.to_sym]
      elsif attribute.is_a?(Symbol) && myobj.key?(attribute.to_s)
        myobj[attribute.to_s]
      else
        raise KeyError, "No such key: #{attribute.inspect}"
      end
    else
      attribute_name = attribute.to_s
      attribute_name = "@#{attribute_name}" unless attribute_name.start_with?("@")
      attribute_key = attribute_name.to_sym

      unless myobj.instance_variable_defined?(attribute_key)
        raise NameError, "No such attribute: #{attribute_name}"
      end

      myobj.instance_variable_get(attribute_key)
    end

    return handle_return_object(value)
  end
end
