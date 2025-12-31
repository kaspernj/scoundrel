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
const pi = await math.readAttribute({reference: true}, "pi")
const cosOfPi = await math.callMethod("cos", {reference: true}, pi)
const result = await cosOfPi.serialize()

expect(result).toEqual(-1)

client.close()
pythonWebSocketRunner.close()
```

## Client and reference examples

Create remote objects, call methods, and fetch attributes:

```js
const arrayRef = await client.newObjectWithReference("Array")
await arrayRef.callMethod("push", "one", "two")
const joined = await arrayRef.callMethod("join", ", ")
expect(joined).toEqual("one, two")

const lengthRef = await arrayRef.callMethod("push", {reference: true}, "three")
const length = await lengthRef.serialize()
expect(length).toEqual(3)
```

Read attributes directly or as references:

```js
const math = await client.import("math")
const piRef = await math.readAttribute({reference: true}, "pi")
const pi = await piRef.serialize()

const e = await math.readAttribute("E")
expect([pi, e].every((value) => typeof value === "number")).toEqual(true)
```

You can also return proxies directly when you want proxy behavior:

```js
const math = await client.import("math")
const piProxy = await math.readAttribute({reference: true, proxy: true}, "pi")

// @ts-ignore
const pi = await piProxy.valueOf()
```

Fetch globally available or registered objects:

```js
client.registerObject("config", {mode: "test"})

const configRef = await client.getObject("config")
const config = await configRef.serialize()
expect(config).toEqual({mode: "test"})

client.unregisterObject("config")
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

## Reference proxy access

Wrap a reference with the proxy helper to access remote methods and attributes with a more native feel:

```js
import referenceProxy from "scoundrel-remote-eval/src/client/reference-proxy.js"

const arrayRef = await client.newObjectWithReference("Array")
const array = referenceProxy(arrayRef)

// @ts-ignore
await array.push("one")

// @ts-ignore
await array.push("two")

// @ts-ignore
const firstValue = await array[0]

// @ts-ignore
const length = await array.length
```

## Return options for reference calls

For `callMethod` and `readAttribute`, you can request a reference or a result explicitly:

- `{reference: true}`: return a `Reference`
- `{result: true}`: return the raw value
- `{proxy: true}`: return a proxy (requires `{reference: true}`)

Examples:

```js
const lengthRef = await arrayRef.callMethod("push", {reference: true}, "three")
const length = await lengthRef.serialize()

const lengthValue = await arrayRef.callMethod("push", {result: true}, "four")

const lengthProxy = await arrayRef.callMethod("push", {reference: true, proxy: true}, "five")
// @ts-ignore
const asString = await lengthProxy.toString()
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

You can also enable it after construction:

```js
client.enableServerControl()
```

Registered objects and classes are available inside `eval`:

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
const greetingRef = await serverClient.eval("(() => { const greeter = new TestGreeter(testSettings.prefix); return greeter.greet('World') })()")
const greeting = await greetingRef.serialize()

expect(greeting).toEqual("Hello World")
```

You can unregister classes or objects to remove them from server-side lookups and `eval` scope:

```js
client.unregisterClass("TestGreeter")
client.unregisterObject("testSettings")
```

`eval` defaults to returning a reference, but you can request the raw result:

```js
const result = await serverClient.eval({result: true}, "(() => 1 + 1)()")
expect(result).toEqual(2)
```

Use `eval` with `reference` if you need to be explicit:

```js
const greetingRef = await serverClient.eval({reference: true}, "(() => { return 'Hello' })()")
```
