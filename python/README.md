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

## JavaScript proxy compatibility

JavaScript proxy references expect to access list/tuple items by numeric index and read a `length` attribute for sequences and dictionaries. The Python server implements these behaviors so JS proxy tests can use `arrayProxy[0]` and `arrayProxy.length` against Python lists, tuples, and dicts.

## JavaScript client examples

These examples show the JS client talking to the Python server.

### Basic list proxy

```js
import Client from "scoundrel-remote-eval/src/client/index.js"
import ClientWebSocket from "scoundrel-remote-eval/src/client/connections/web-socket/index.js"
import PythonWebSocketRunner from "scoundrel-remote-eval/src/python-web-socket-runner.js"
import {WebSocket} from "ws"

const pythonWebSocketRunner = new PythonWebSocketRunner()
await pythonWebSocketRunner.runAndWaitForPid()

const ws = new WebSocket("ws://localhost:53874")
const clientWebSocket = new ClientWebSocket(ws)
await clientWebSocket.waitForOpened()

const client = new Client(clientWebSocket)

const listRef = await client.newObjectReference("[]")
await listRef.callMethodResult("append", "alpha")
await listRef.callMethodResult("append", "beta")

const result = await listRef.serialize()
console.log(result) // ["alpha", "beta"]

client.close()
pythonWebSocketRunner.close()
```

### Proxy access to attributes and indexes

```js
import referenceProxy from "scoundrel-remote-eval/src/client/reference-proxy.js"

const listRef = await client.newObjectReference("[]")
const list = referenceProxy(listRef)

// @ts-ignore
await list.append("one")
// @ts-ignore
await list.append("two")

// @ts-ignore
const first = await list[0]
// @ts-ignore
const length = await list.length

console.log(first) // "one"
console.log(length) // 2
```

### Method chaining with proxies

```js
// @ts-ignore
const count = await list
  .__chain()
  .append("three")
  .append("four")
  .__len__()

console.log(count) // 4
```

### Import modules and call methods

```js
const math = await client.importReference("math")
const pi = await math.readAttributeReference("pi")
const cosOfPi = await math.callMethodReference("cos", pi)
const result = await cosOfPi.serialize()

console.log(result) // -1
```

### Read raw values

```js
const listRef = await client.newObjectReference("[]")
await listRef.callMethodResult("append", "value")

const firstValue = await listRef.readAttributeResult(0)
console.log(firstValue) // "value"
```

## Testing

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest
mypy scoundrel_python server tests
ruff check .
```
