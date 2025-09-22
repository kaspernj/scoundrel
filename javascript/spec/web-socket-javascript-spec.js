import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Server from "../src/server/index.js"
import ServerWebSocket from "../src/server/connections/web-socket/index.js"
import {WebSocket, WebSocketServer} from "ws"

describe("scoundrel - web-socket - javascript", () => {
  it("creates a server and connects to it with the client", async () => {
    const wss = new WebSocketServer({port: 8080})
    const serverWebSocket = new ServerWebSocket(wss)
    const server = new Server(serverWebSocket)

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
