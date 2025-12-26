# Scoundrel JavaScript

JavaScript client for running remote evaluations with Scoundrel.

## Install

```bash
npm install scoundrel-remote-eval
```

## Usage

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

## Serialization

`Reference#serialize()` only supports JSON-safe values (strings, numbers, booleans, null, plain objects, and arrays). It throws an error if the value contains functions, symbols, bigints, class instances/non-plain objects, circular references, non-finite numbers, or other unsupported types.

## Stack trace sanitization

When a command fails, Scoundrel combines the server and client stacks into a single error. Some frames are filtered to keep the combined stack readable:

- Frames from the WebSocket client library (`node_modules/ws`)
- Node internals (`node:` URLs and `internal/` frames)
- The leading `Error:` line from nested stacks

Application frames, including paths that contain `/internal/` within your project, are preserved.

## Calling static methods on classes

You can ask for a reference to a class (either globally available or registered with `registerClass`) and call its static methods:

```js
class TestMath {
  static add(a, b) { return a + b }
}

// Make the class available for lookups (for example, on a server-controlled client)
client.registerClass("TestMath", TestMath)

// Later, fetch the class reference and call its static method
const testMath = await client.getObject("TestMath")
const sum = await testMath.callMethod("add", 2, 3)

expect(sum).toEqual(5)
```

## Server-to-client control

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

You can unregister classes or objects to remove them from server-side lookups and `evalWithReference` scope:

```js
client.unregisterClass("TestGreeter")
client.unregisterObject("testSettings")
```
