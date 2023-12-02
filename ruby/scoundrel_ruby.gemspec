Gem::Specification.new do |s|
  s.name = "scoundrel_ruby"
  s.version = "0.0.1"

  s.required_rubygems_version = Gem::Requirement.new(">= 0") if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib"]
  s.authors = ["Kasper Stöckel"]
  s.date = "2013-02-20"
  s.description = "A framework for spawning and communicating with other Ruby-processes"
  s.email = "k@spernj.org"
  s.extra_rdoc_files = [
    "LICENSE.txt",
    "README.md"
  ]
  s.homepage = "http://github.com/kaspernj/ruby_process"
  s.licenses = ["MIT"]
  s.rubygems_version = "2.4.0"
  s.summary = "A framework for spawning and communicating with other Ruby-processes"

  s.specification_version = 4

  s.add_dependency "bundler"
  s.add_dependency "php-serialize4ruby"
  s.add_dependency "string-cases"
  s.add_dependency "rspec"
  s.add_dependency "rdoc"
  s.add_dependency "tsafe"
  s.add_dependency "wref"
end
