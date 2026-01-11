# frozen_string_literal: true

# Scoundrel namespace for language clients and helpers.
module Scoundrel
  autoload :Json, "#{__dir__}/scoundrel/json"
  autoload :Php, "#{__dir__}/scoundrel/php"
  autoload :Ruby, "#{__dir__}/scoundrel/ruby"
end
