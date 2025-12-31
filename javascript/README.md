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
const pi = await math.pi
const result = await (await math.cos(pi)).__serialize()

expect(result).toEqual(-1)

client.close()
pythonWebSocketRunner.close()
```

## Client and proxy examples

Create remote objects, call methods, and fetch attributes:

```js
const array = await client.newObject("Array")
await array.push("one")
await array.push("two")
const joined = await (await array.join(", ")).__serialize()
expect(joined).toEqual("one, two")

const length = await array.length
expect(length).toEqual(2)
```

`newObject`, `import`, and `getObject` return proxies by default; use `newObjectReference`/`newObjectResult`, `importReference`/`importResult`, and `getObjectReference`/`getObjectResult` when you need a `Reference` or serialized result.

```js
const arrayRef = await client.newObjectReference("Array")
const emptyArray = await client.newObjectResult("Array")
```

Read attributes directly or as proxies:

```js
const math = await client.import("math")
const pi = await math.pi
const e = await math.E
expect([pi, e].every((value) => typeof value === "number")).toEqual(true)
```

Reference variant (when you need to serialize):

```js
const math = await client.importReference("math")
const piRef = await math.readAttributeReference("pi")
const pi = await piRef.serialize()

const e = await math.readAttributeResult("E")
expect([pi, e].every((value) => typeof value === "number")).toEqual(true)
```

Fetch globally available or registered objects:

```js
client.registerObject("config", {mode: "test"})

const configProxy = await client.getObject("config")
const config = await configProxy.__serialize()
expect(config).toEqual({mode: "test"})

client.unregisterObject("config")
```

Reference/result variants:

```js
const configRef = await client.getObjectReference("config")
const config = await configRef.serialize()

const configResult = await client.getObjectResult("config")
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

You can ask for a proxy to a class (either globally available or registered with `registerClass`) and call its static methods:

```js
class TestMath {
  static add(a, b) { return a + b }
}

// Make the class available for lookups (for example, on a server-controlled client)
client.registerClass("TestMath", TestMath)

// Later, fetch the class proxy and call its static method
const testMathProxy = await client.getObject("TestMath")
const sum = await (await testMathProxy.add(2, 3)).__serialize()

expect(sum).toEqual(5)
```

## Manual proxy wrapping (optional)

The library returns proxies by default. If you need to wrap an existing `Reference`, you can use the helper directly:

```js
import referenceProxy from "scoundrel-remote-eval/src/client/reference-proxy.js"

const arrayRef = await client.newObjectReference("Array")
const array = referenceProxy(arrayRef)

await array.push("one")
await array.push("two")
const firstValue = await array[0]
const length = await array.length
```

## Chaining proxy calls

You can chain method calls on the same proxy and only `await` once (the last call's result is returned):

```js
const result = await array
  .__chain()
  .push("one")
  .push("two")
  .toString()

expect(result).toEqual("one,two")
```

## Explicit return helpers

Use the explicit helpers when you need a definite return type:

- `callMethod(...)`: proxy
- `callMethodReference(...)`: `Reference`
- `callMethodResult(...)`: raw result
- `readAttribute(...)`: proxy
- `readAttributeReference(...)`: `Reference`
- `readAttributeResult(...)`: raw result

Examples:

```js
const array = await client.newObject("Array")
const lengthProxy = await array.push("three")
const length = await lengthProxy.__serialize()

const arrayRef = await client.newObjectReference("Array")
const lengthRef = await arrayRef.callMethodReference("push", "four")
const lengthValue = await lengthRef.serialize()

const rawLength = await arrayRef.callMethodResult("push", "five")
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
const greetingProxy = await serverClient.eval("(() => { const greeter = new TestGreeter(testSettings.prefix); return greeter.greet('World') })()")
const greeting = await greetingProxy.__serialize()

expect(greeting).toEqual("Hello World")
```

You can unregister classes or objects to remove them from server-side lookups and `eval` scope:

```js
client.unregisterClass("TestGreeter")
client.unregisterObject("testSettings")
```

`eval` returns a proxy by default, but you can request the raw result or a reference:

```js
const proxyResult = await serverClient.eval("(() => ({value: 42}))()")
const value = await proxyResult.__serialize()

const result = await serverClient.evalResult("(() => 1 + 1)()")
expect(result).toEqual(2)
```

Use `evalReference` if you need a reference:

```js
const greetingRef = await serverClient.evalReference("(() => { return 'Hello' })()")
```
