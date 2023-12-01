Gem::Specification.new do |s|
  s.name = "scoundrel_php"
  s.version = "0.0.1"

  s.required_rubygems_version = Gem::Requirement.new(">= 0") if s.respond_to? :required_rubygems_version=
  s.authors = ["Kasper Stöckel"]
  s.date = "2013-02-20"
  s.description = "Spawns a PHP process and proxies calls to it, making it possible to proxy objects and more."
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
    "VERSION",
    "examples/example_phpexcel.rb",
    "lib/php_process.rb",
    "lib/php_script.php",
    "php_process.gemspec",
    "spec/php_process_spec.rb",
    "spec/spec_helper.rb",
    "spec/strip_error_spec.rb"
  ]
  s.homepage = "http://github.com/kaspernj/scoundrel"
  s.licenses = ["MIT"]
  s.require_paths = ["lib"]
  s.rubygems_version = "1.8.25"
  s.summary = "Ruby-to-PHP bridge"

  s.specification_version = 3

  s.add_runtime_dependency "php-serialize4ruby"
  s.add_runtime_dependency "wref"
  s.add_runtime_dependency "tsafe"
  s.add_runtime_dependency "rspec"
  s.add_runtime_dependency "rdoc"
  s.add_runtime_dependency "bundler"
  s.add_runtime_dependency "string-cases"
end
