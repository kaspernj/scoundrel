// @ts-check

import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Server from "../src/server/index.js"
import ServerWebSocket from "../src/server/connections/web-socket/index.js"
import {WebSocket, WebSocketServer} from "ws"

const shared = {}

describe("command responses", () => {
  const setup = async () => {
    shared.wss = new WebSocketServer({port: 0})
    await new Promise((resolve, reject) => {
      shared.wss.once("listening", resolve)
      shared.wss.once("error", reject)
    })

    shared.serverWebSocket = new ServerWebSocket(shared.wss)
    shared.server = new Server(shared.serverWebSocket)

    const addressInfo = shared.wss.address()
    const port = typeof addressInfo === "object" && addressInfo ? addressInfo.port : null

    if (!port) throw new Error(`Unable to determine server port from address info: ${addressInfo}`)

    shared.ws = new WebSocket(`http://localhost:${port}`)
    shared.clientWebSocket = new ClientWebSocket(shared.ws)

    await shared.clientWebSocket.waitForOpened()

    shared.client = new Client(shared.clientWebSocket)
    shared.serverClient = shared.server.getClients()[0]

    if (!shared.serverClient) {
      throw new Error("No client connected to server")
    }
  }

  const teardown = async () => {
    await shared.client?.close()
    await shared.server?.close()
  }

  beforeEach(async () => {
    await setup()
  })

  afterEach(async () => {
    await teardown()
  })

  it("responds using the incoming command ID even after server-initiated commands", async () => {
    await expectAsync(shared.serverClient.sendCommand("get_object", {object_name: "Math"})).toBeRejected()

    const arrayReference = await shared.client.newObjectWithReference("Array")
    const length = await arrayReference.readAttribute("length")

    expect(length).toEqual(0)
  })
})
