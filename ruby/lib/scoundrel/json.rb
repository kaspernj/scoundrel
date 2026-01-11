# frozen_string_literal: true

require 'json'
require 'time'
require 'date'

module Scoundrel
  # Scoundrel JSON serialization helpers.
  # rubocop:disable Metrics/ModuleLength
  module Json
    TYPE_KEY = '__scoundrel_type__'
    VALUE_KEY = 'value'

    TypeHandler = Struct.new(:type, :test, :serialize, :deserialize)

    @type_handlers = []

    def self.register_type(type:, test:, serialize:, deserialize:)
      raise ArgumentError, 'Scoundrel type handler must include a type' if type.to_s.empty?

      handler = TypeHandler.new(type.to_s, test, serialize, deserialize)
      index = @type_handlers.index { |existing| existing.type == type.to_s }
      if index
        @type_handlers[index] = handler
      else
        @type_handlers << handler
      end
    end

    def self.dump(value)
      JSON.generate(encode(value, 'value', {}.compare_by_identity))
    end

    def self.load(raw)
      decode(JSON.parse(raw))
    end

    # rubocop:disable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength
    def self.encode(value, path, seen)
      handler = find_handler_for_value(value)
      if handler
        serialized = ensure_serialized_hash(handler, handler.serialize.call(value), path)
        return encode_hash(serialized, path, seen)
      end

      case value
      when nil, true, false, Integer, String
        value
      when Float
        raise ArgumentError, "Cannot serialize non-finite number at #{path}" unless value.finite?

        value
      when Symbol
        value.to_s
      when Array
        track_circular(value, path, seen)
        value.map.with_index do |item, index|
          encode(item, "#{path}[#{index}]", seen)
        end
      when Hash
        encode_hash(value, path, seen)
      else
        raise TypeError, "Cannot serialize non-plain object '#{value.class}' at #{path}"
      end
    end
    # rubocop:enable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength

    def self.decode(value)
      return value.map { |item| decode(item) } if value.is_a?(Array)

      if value.is_a?(Hash)
        type = value[TYPE_KEY]
        handler = type && find_handler_for_type(type.to_s)
        return handler.deserialize.call(value) if handler

        return value.transform_values do |val|
          decode(val)
        end
      end

      value
    end

    def self.find_handler_for_value(value)
      @type_handlers.find { |handler| handler.test.call(value) }
    end

    def self.find_handler_for_type(type)
      @type_handlers.find { |handler| handler.type == type }
    end

    def self.ensure_serialized_hash(handler, payload, path)
      raise TypeError, "Scoundrel type '#{handler.type}' must serialize to a hash at #{path}" unless payload.is_a?(Hash)

      payload[TYPE_KEY] = handler.type unless payload.key?(TYPE_KEY)
      payload
    end

    def self.track_circular(value, path, seen)
      raise ArgumentError, "Cannot serialize circular reference at #{path}" if seen.key?(value)

      seen[value] = path
    end

    def self.encode_hash(value, path, seen)
      track_circular(value, path, seen)
      value.each_with_object({}) do |(key, val), encoded|
        key_str = key.to_s
        encoded[key_str] = encode(val, "#{path}.#{key_str}", seen)
      end
    end

    def self.parse_regex(raw)
      match = raw.match(%r{\A/(.*)/([a-z]*)\z})
      raise ArgumentError, 'Invalid regex payload' unless match

      pattern = match[1]
      flags = match[2]
      options = 0
      options |= Regexp::IGNORECASE if flags.include?('i')
      options |= Regexp::MULTILINE if flags.include?('m')
      options |= Regexp::EXTENDED if flags.include?('x')
      Regexp.new(pattern, options)
    end

    register_type(
      type: 'date',
      test: ->(value) { value.is_a?(Time) || value.is_a?(Date) || value.is_a?(DateTime) },
      serialize: ->(value) { { TYPE_KEY => 'date', VALUE_KEY => value.iso8601 } },
      deserialize: ->(payload) { Time.iso8601(payload[VALUE_KEY].to_s) }
    )

    register_type(
      type: 'regex',
      test: ->(value) { value.is_a?(Regexp) },
      serialize: ->(value) { { TYPE_KEY => 'regex', VALUE_KEY => value.inspect } },
      deserialize: ->(payload) { parse_regex(payload[VALUE_KEY].to_s) }
    )
  end
  # rubocop:enable Metrics/ModuleLength
end
