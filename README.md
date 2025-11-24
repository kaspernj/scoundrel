# Scoundrel

Evaluate code in sub processes using several different languages.

## Install

### JavaScript

```bash
npm install scoundrel-remote-eval
```

## Usage

### JavaScript

```js
import Client from "scoundrel-remote-eval/src/client/index.js"
import ClientWebSocket from "scoundrel-remote-eval/src/client/connections/web-socket/index.js"
import PythonWebSocketRunner from "scoundrel-remote-eval/src/python-web-socket-runner.js"

const pythonWebSocketRunner = new PythonWebSocketRunner()
const ws = new WebSocket("ws://localhost:53874")
const clientWebSocket = new ClientWebSocket(ws)

await clientWebSocket.waitForOpened()

const client = new Client(clientWebSocket)

const math = await client.import("math")
const pi = await math.readAttributeWithReference("pi")
const cosOfPi = await math.callMethodWithReference("cos", pi)
const result = await cosOfPi.serialize()

expect(result).toEqual(-1)

client.close()
pythonWebSocketRunner.close()
```
