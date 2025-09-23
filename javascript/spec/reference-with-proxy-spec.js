import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import referenceWithProxy from "../src/client/reference-proxy.js"
import Server from "../src/server/index.js"
import ServerWebSocket from "../src/server/connections/web-socket/index.js"
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

    const firstValue = await stringObject.readAttribute(0)
    const secondValue = await stringObject.readAttribute(1)

    expect(firstValue).toEqual("test1")
    expect(secondValue).toEqual("test2")
  })

  it("reads attributes from a reference", async () => {
    const testArray = await shared.client.newObjectWithReference("Array")

    await testArray.callMethod("push", "test1")
    await testArray.callMethod("push", "test2")

    const result = await testArray.serialize()

    expect(result).toEqual(["test1", "test2"])

    const firstValue = await testArray.readAttribute(0)
    const secondValue = await testArray.readAttribute(1)

    expect(firstValue).toEqual("test1")
    expect(secondValue).toEqual("test2")
  })
})
