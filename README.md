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

### Server-to-client control (JavaScript)

By default, a client refuses server-initiated commands. Enable it by passing `enableServerControl: true` when constructing the client:

```js
const client = new Client(clientWebSocket, {enableServerControl: true})
```

If you want to explicitly disable server control (the default), pass `enableServerControl: false` or omit the option:

```js
const client = new Client(clientWebSocket, {enableServerControl: false})
// equivalent to: new Client(clientWebSocket)
```

Registered objects and classes are available inside `evalWithReference`:

```js
const client = new Client(clientWebSocket, {enableServerControl: true})

class TestGreeter {
  constructor(prefix) {
    this.prefix = prefix
  }

  greet(name) {
    return `${this.prefix} ${name}`
  }
}

client.registerClass("TestGreeter", TestGreeter)
client.registerObject("testSettings", {prefix: "Hello"})

const serverClient = server.getClients()[0] // from your ScoundrelServer instance
const greetingRef = await serverClient.evalWithReference("(() => { const greeter = new TestGreeter(testSettings.prefix); return greeter.greet('World') })()")
const greeting = await greetingRef.serialize()

expect(greeting).toEqual("Hello World")
```
