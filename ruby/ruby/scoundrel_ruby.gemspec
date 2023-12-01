Gem::Specification.new do |s|
  s.name = "scoundrel_ruby"
  s.version = "0.0.13"

  s.required_rubygems_version = Gem::Requirement.new(">= 0") if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib"]
  s.authors = ["Kasper Stöckel"]
  s.date = "2015-04-06"
  s.description = "A framework for spawning and communicating with other Ruby-processes"
  s.email = "k@spernj.org"
  s.extra_rdoc_files = [
    "LICENSE.txt",
    "README.md"
  ]
  s.files = [
    ".document",
    ".rspec",
    "Gemfile",
    "LICENSE.txt",
    "README.md",
    "Rakefile",
    "RubyProcess.gemspec",
    "VERSION",
    "cmds/blocks.rb",
    "cmds/marshal.rb",
    "cmds/new.rb",
    "cmds/numeric.rb",
    "cmds/static.rb",
    "cmds/str_eval.rb",
    "cmds/system.rb",
    "examples/example_csv.rb",
    "examples/example_file_write.rb",
    "examples/example_knj_db_dump.rb",
    "examples/example_strscan.rb",
    "include/args_handeling.rb",
    "lib/ruby_process.rb",
    "lib/ruby_process/class_proxy.rb",
    "lib/ruby_process/proxy_object.rb",
    "ruby_process.gemspec",
    "scripts/ruby_process_script.rb",
    "shippable.yml",
    "spec/class_proxy_spec.rb",
    "spec/hard_load_spec.rb",
    "spec/leaks_spec.rb",
    "spec/ruby_process_spec.rb",
    "spec/spec_helper.rb"
  ]
  s.homepage = "http://github.com/kaspernj/ruby_process"
  s.licenses = ["MIT"]
  s.rubygems_version = "2.4.0"
  s.summary = "A framework for spawning and communicating with other Ruby-processes"

  s.specification_version = 4

  s.add_runtime_dependency "wref", ">= 0"
  s.add_runtime_dependency "tsafe", ">= 0"
  s.add_runtime_dependency "string-cases", ">= 0"
  s.add_runtime_dependency "rspec", ">= 2.8", "< 3.13"
  s.add_runtime_dependency "rdoc", "~> 3.12"
  s.add_runtime_dependency "bundler", ">= 1.0.0"
end
