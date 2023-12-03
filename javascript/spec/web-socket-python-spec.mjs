import Client from "../src/client/index.mjs"
import ClientWebSocket from "../src/client/connections/web-socket/index.mjs"
import PythonWebSocketRunner from "../src/python-web-socket-runner.mjs"
import {WebSocket} from "ws"

describe("scoundrel - web-socket - python", () => {
  it("creates a server and connects to it with the client", async () => {
    const pythonWebSocketRunner = new PythonWebSocketRunner()

    await pythonWebSocketRunner.runAndWaitForPid()

    const ws = new WebSocket("http://localhost:8080")
    const clientWebSocket = new ClientWebSocket(ws)

    await clientWebSocket.waitForOpened()

    const client = new Client(clientWebSocket)
    const stringObject = await client.newObjectWithReference("[]")

    await stringObject.callMethod("append", "test1")
    await stringObject.callMethod("append", "test2")

    const result = await stringObject.serialize()

    expect(result).toEqual(["test1", "test2"])
  })
})
