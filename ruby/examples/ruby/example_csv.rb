#!/usr/bin/env ruby

require "rubygems"
require "ruby_process"

Scoundrel::Ruby::Client.new.spawn_process do |rp|
  rp.static(:Object, :require, "csv")

  rp.static(:CSV, :open, "test.csv", "w") do |csv|
    csv << ["ID", "Name"]
    csv << [1, "Kasper"]
  end
end
