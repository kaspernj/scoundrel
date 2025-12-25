// @ts-check

import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Server from "../src/server/index.js"
import ServerWebSocket from "../src/server/connections/web-socket/index.js"
import {WebSocket, WebSocketServer} from "ws"

class ExplodingClass {
  boom() {
    throw new Error("Kaboom from server")
  }
}

const shared = {}

describe("Client stack traces", () => {
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

    shared.serverClient.registerClass("ExplodingClass", ExplodingClass)
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

  it("preserves the caller stack when the server rejects a command", async () => {
    const reference = await shared.client.newObjectWithReference("ExplodingClass")
    const promise = reference.callMethod("boom")

    /** @type {Error | undefined} */
    let caughtError
    try {
      await promise
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(Error)
    expect(caughtError?.message).toContain("Kaboom from server")
    expect(caughtError?.stack).toContain("[SCOUNTDREL-SERVER]")
    expect(caughtError?.stack).toContain("[SCOUNDREL-CLIENT]")
    expect(caughtError?.stack).toContain("Command created at")
    expect(caughtError?.stack).toContain("ExplodingClass.boom")
    // Origin stack should reference this spec file (the command caller).
    expect(caughtError?.stack).toContain("client-stack-trace-spec.js")
  })
})
