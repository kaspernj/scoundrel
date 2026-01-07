$LOAD_PATH.unshift(File.join(__dir__, '..', 'lib'))
$LOAD_PATH.unshift(__dir__)
require 'rspec'
require 'scoundrel'
require 'timeout'

# Requires supporting files with custom matchers and macros, etc,
# in ./support/ and its subdirectories.
Dir["#{__dir__}/support/**/*.rb"].each {|f| require f}

RSpec.configure do |config|
end
