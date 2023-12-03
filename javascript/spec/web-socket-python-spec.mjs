import Client from "../src/client/index.mjs"
import ClientWebSocket from "../src/client/connections/web-socket/index.mjs"
import PythonWebSocketRunner from "../src/python-web-socket-runner.mjs"
import {WebSocket} from "ws"

const wait = (time) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

describe("scoundrel - web-socket - python", () => {
  fit("creates a server and connects to it with the client", async () => {
    const pythonWebSocketRunner = new PythonWebSocketRunner()

    await pythonWebSocketRunner.runAndWaitForPid()
    await wait(500)

    const ws = new WebSocket("http://localhost:8080")
    const clientWebSocket = new ClientWebSocket(ws)

    await clientWebSocket.waitForOpened()

    const client = new Client(clientWebSocket)
    const stringObject = await client.newObjectWithReference("Array")

    await stringObject.callMethod("push", "test1")
    await stringObject.callMethod("push", "test2")

    const result = await stringObject.serialize()

    expect(result).toEqual(["test1", "test2"])
  })
})
