# Changelog

## Unreleased
- Fix server-controlled references so falsy values (0, false, "", null) serialize correctly instead of raising missing ID errors.
- Add instance IDs to references so only the owning Scoundrel instance resolves them.
- Allow serializing reference values that resolve to undefined by returning null instead of throwing.
- Serialize bigint values as numbers when serializing references.
