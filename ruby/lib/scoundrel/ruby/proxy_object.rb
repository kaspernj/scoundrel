#This class handels the calling of methods on objects in the other process seamlessly.
class Scoundrel::Ruby::ProxyObject
  #Hash that contains various information about the proxyobj.
  attr_reader :__rp_rp, :__rp_id, :__rp_pid

  #Constructor. This should not be called manually but through a running 'RubyProcess'.
  #===Examples
  # proxy_obj = rp.new(:String, "Kasper") #=> <RubyProcess::ProxyObject>
  # proxy_obj = rp.static(:File, :open, "/tmp/somefile") #=> <RubyProcess::ProxyObject>
  def initialize(rp, id, pid)
    @__rp_rp, @__rp_id, @__rp_pid = rp, id, pid
  end

  #Returns the object as the real object transfered by using the marshal-lib.
  #===Examples
  # str = rp.new(:String, "Kasper") #=> <RubyProcess::ProxyObject>
  # str.__rp_marshal #=> "Kasper"
  def __rp_marshal
    return Marshal.load(@__rp_rp.send(cmd: :obj_marshal, id: @__rp_id))
  end

  #Unsets all data on the object.
  def __rp_destroy
    @__rp_id = nil, @__rp_rp = nil, @__rp_pid = nil
  end

  #Overwrite certain convert methods.
  RUBY_METHODS = [:to_i, :to_s, :to_str, :to_f]
  RUBY_METHODS.each do |method_name|
    define_method(method_name) do |*args, &blk|
      return @__rp_rp.send(cmd: :obj_method, id: @__rp_id, method: method_name, args: args, &blk).__rp_marshal
    end
  end

  #Overwrite certain methods.
  PROXY_METHODS = [:send]
  PROXY_METHODS.each do |method_name|
    define_method(method_name) do |*args, &blk|
      self.method_missing(method_name, *args, &blk)
    end
  end

  #Proxies all calls to the process-object.
  #===Examples
  # str = rp.new(:String, "Kasper") #=> <RubyProcess::ProxyObject::1>
  # length_int = str.length #=> <RubyProcess::ProxyObject::2>
  # length_int.__rp_marshal #=> 6
  def method_missing(method, *args, &block)
    debug "Method-missing-args-before: #{args} (#{@__rp_pid})\n" if @debug
    real_args = @__rp_rp.parse_args(args)
    debug "Method-missing-args-after: #{real_args}\n" if @debug

    return @__rp_rp.send(cmd: :obj_method, id: @__rp_id, method: method, args: real_args, &block)
  end
end
