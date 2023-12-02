import Client from "../src/client/index.mjs"
import ClientWebSocket from "../src/client/connections/web-socket/index.mjs"
import Server from "../src/server/index.mjs"
import ServerWebSocket from "../src/server/connections/web-socket/index.mjs"
import {WebSocket, WebSocketServer} from "ws"

describe("scoundrel", () => {
  it("creates a server and connects to it with the client", async () => {
    const wss = new WebSocketServer({port: 8080})
    const serverWebSocket = new ServerWebSocket(wss)
    const server = new Server(serverWebSocket)

    const ws = new WebSocket("http://localhost:8080")
    const clientWebSocket = new ClientWebSocket(ws)

    await clientWebSocket.waitForOpened()

    const client = new Client(clientWebSocket)
    const stringObject = await client.newObjectWithReference("Object")

    await stringObject.callMethod("replace", "st", "ster")

    const result = await stringObject.serialize()

    expect(result).toEqual("tester")
  })
})
