# Changelog

## Unreleased
- Improve CI test output formatting for easier timeout diagnosis.
- Support passing function callbacks as reference arguments to remote methods.
- Release callback references when wrapper functions are garbage collected.
- Fix server-controlled references so falsy values (0, false, "", null) serialize correctly instead of raising missing ID errors.
- Add instance IDs to references so only the owning Scoundrel instance resolves them.
- Allow serializing reference values that resolve to undefined by returning null instead of throwing.
- Serialize bigint values as numbers when serializing references.
- Release remote references when proxies are garbage collected (when weak references are supported).
- Add Scoundrel JSON serialization with Date/RegExp support and extensible type handlers.
- Add JS release patch script and npm shortcut.
