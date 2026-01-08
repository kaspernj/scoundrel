# Changelog

## Unreleased
- Align mypy target version with Python 3.8 support.
- Add type hints to the Python server classes and entrypoint.
- Add mypy and ruff checks for Python linting and type checking.
- Add instance IDs to references so only the owning Scoundrel instance resolves them.
- Add pip packaging metadata and pytest coverage for the Python server.
- Pass constructor args for new object references and validate command return types.
- Move Python server entrypoint to class-based API.
- Support list/dict indexing and length in read_attribute for JS proxy parity.
- Clean up server-side references when JS clients release them.
