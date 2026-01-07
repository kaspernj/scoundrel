# Scoundrel Python

Python server that powers Scoundrel remote evaluations over WebSockets.

## Install

```bash
python3 -m pip install -e ".[dev]"
```

## Run the server

```bash
python server/web-socket.py --host 127.0.0.1 --port 53874
```

The server prints a startup line with its PID and listening address.

## Protocol overview

The server accepts JSON WebSocket messages with a `command` and `command_id`:

```json
{
  "command": "read_attribute",
  "command_id": 1,
  "data": {
    "reference_id": 7,
    "attribute_name": "name",
    "with": "result"
  }
}
```

Supported commands include:

- `new_object_with_reference`
- `call_method_on_reference`
- `read_attribute`
- `serialize_reference`
- `import`

References are tracked by object IDs and include instance IDs to avoid cross-process collisions.

## Testing

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest
```
