# Changelog

## Unreleased
- Improve CI test output formatting for easier timeout diagnosis.
- Add instance IDs for Ruby references and ignore mismatched references.
- Add per-call timeout support for PHP client requests.
- Add per-call timeout support for Ruby client requests.
- Ensure PHP fatal errors surface before destroyed errors in Ruby clients.
- Add Ruby proxy attribute reads to match JavaScript reference support.
- Add Ruby get_object to fetch constants by name, matching JavaScript getObject.
- Add Scoundrel JSON serialization with Date/Regexp support and extensible type handlers.
