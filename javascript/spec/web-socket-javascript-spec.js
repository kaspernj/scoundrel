import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Server from "../src/server/index.js"
import ServerWebSocket from "../src/server/connections/web-socket/index.js"
import {WebSocket, WebSocketServer} from "ws"

const shared = {}

describe("scoundrel - web-socket - javascript", () => {
  beforeEach(async () => {
    shared.wss = new WebSocketServer({port: 8080})
    shared.serverWebSocket = new ServerWebSocket(shared.wss)
    shared.server = new Server(shared.serverWebSocket)

    shared.ws = new WebSocket("http://localhost:8080")
    shared.clientWebSocket = new ClientWebSocket(shared.ws)

    await shared.clientWebSocket.waitForOpened()

    shared.client = new Client(shared.clientWebSocket)
  })

  afterEach(async () => {
    await shared.client.close()
    await shared.server.close()
  })

  it("creates a server and connects to it with the client", async () => {
    const stringObject = await shared.client.newObjectWithReference("Array")

    await stringObject.callMethod("push", "test1")
    await stringObject.callMethod("push", "test2")

    const result = await stringObject.serialize()

    expect(result).toEqual(["test1", "test2"])
  })

  it("returns results from method calls", async () => {
    const stringObject = await shared.client.newObjectWithReference("Array")

    await stringObject.callMethod("push", "test1")
    await stringObject.callMethod("push", "test2")

    const result = await stringObject.callMethod("join", ", ")

    expect(result).toEqual("test1, test2")
  })
})
