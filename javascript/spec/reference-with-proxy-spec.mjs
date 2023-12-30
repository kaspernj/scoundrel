import Client from "../src/client/index.mjs"
import ClientWebSocket from "../src/client/connections/web-socket/index.mjs"
import referenceWithProxy from "../src/client/reference-proxy.mjs"
import Server from "../src/server/index.mjs"
import ServerWebSocket from "../src/server/connections/web-socket/index.mjs"
import {WebSocket, WebSocketServer} from "ws"

const shared = {}

describe("referenceWithProxy", () => {
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

  it("creates a reference with a proxy", async () => {
    const stringObjectReference = await shared.client.newObjectWithReference("Array")
    const stringObject = referenceWithProxy(stringObjectReference)

    await stringObject.push("test1")
    await stringObject.push("test2")

    const result = await stringObject.__serialize()

    expect(result).toEqual(["test1", "test2"])
  })
})
