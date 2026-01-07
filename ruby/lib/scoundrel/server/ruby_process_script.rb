#!/usr/bin/env ruby1.9

require "base64"
require "#{__dir__}/../../scoundrel.rb"

$stdin.sync = true
$stdout.sync = true
$stderr.sync = true

debug = false
pid = nil
instance_id = nil

ARGV.each do |arg|
  if arg == "--debug"
    debug = true
  elsif match = arg.match(/--pid=(\d+)$/)
    pid = match[1].to_i
  elsif match = arg.match(/--instance-id=(.+)$/)
    instance_id = match[1]
  elsif match = arg.match(/--title=(.+)$/)
    #ignore - its for finding process via 'ps aux'.
  else
    raise "Unknown argument: '#{arg}'."
  end
end

debug = true if ARGV.index("--debug") != nil
raise "No PID given of parent process." unless pid

rps = Scoundrel::Ruby::Client.new(
  in: $stdin,
  out: $stdout,
  err: $stderr,
  debug: debug,
  pid: pid,
  instance_id: instance_id
)
rps.listen
$stdout.puts("ruby_process_started")
rps.join
