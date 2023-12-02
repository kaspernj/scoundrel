class Scoundrel::Ruby::Client
  #Calls a block by its block-ID with given arguments.
  def cmd_block_call(obj)
    raise "Invalid block-ID: '#{obj}'." if obj.fetch(:block_id).to_i <= 0
    block_ele = @proxy_objs[obj.fetch(:block_id)]
    raise "No block by that ID: '#{obj.fetch(:block_id)}'." unless block_ele
    raise "Not a block? '#{block_ele.class.name}'." unless block_ele.respond_to?(:call)
    debug "Calling block #{obj.fetch(:block_id)}: #{obj}\n" if @debug

    answer_id = obj[:answer_id]
    raise "No ':answer_id' was given (#{obj})." unless answer_id

    if answer = @answers[answer_id]
      #Use a queue to sleep thread until the block has been executed.
      queue = Queue.new
      answer.push(type: :proxy_block_call, block: block_ele, args: read_args(obj[:args]), queue: queue)
      res = queue.pop
      raise "Expected true but didnt get that: '#{res}'." unless res == true
    else
      block_ele.call(*read_args(obj[:args]))
    end

    return nil
  end

  #Spawns a block and returns its ID.
  def cmd_spawn_proxy_block(obj)
    block = proc{
      send(cmd: :block_call, block_id: obj.fetch(:id), answer_id: obj.fetch(:answer_id))
    }

    id = block.__id__
    raise "ID already exists: '#{id}'." if @objects.key?(id)
    @objects[id] = block

    return {id: id}
  end

  #Dynamically creates a block with a certain arity. If sub-methods measure arity, they will get the correct one from the other process.
  def block_with_arity(args, &block)
    eval_str = "proc{"
    eval_argsarr = "\t\tblock.call("

    if args[:arity] > 0
      eval_str << "|"
      1.upto(args.fetch(:arity)) do |i|
        if i > 1
          eval_str << ","
          eval_argsarr << ","
        end

        eval_str << "arg#{i}"
        eval_argsarr << "arg#{i}"
      end

      eval_str << "|\n"
      eval_argsarr << ")\n"
    end

    eval_full = eval_str + eval_argsarr
    eval_full << "}"

    debug "Block eval: #{eval_full}\n" if @debug
    dynamic_proc = eval(eval_full)

    return dynamic_proc
  end
end
