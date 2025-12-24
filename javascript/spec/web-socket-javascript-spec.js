// @ts-check

import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Server from "../src/server/index.js"
import ServerWebSocket from "../src/server/connections/web-socket/index.js"
import {WebSocket, WebSocketServer} from "ws"

const shared = {}
const defaultPort = 8080

describe("scoundrel - web-socket - javascript", () => {
  const setup = async ({enableServerControl = false} = {}) => {
    shared.wss = new WebSocketServer({port: defaultPort})
    shared.serverWebSocket = new ServerWebSocket(shared.wss)
    shared.server = new Server(shared.serverWebSocket)

    shared.ws = new WebSocket(`http://localhost:${defaultPort}`)
    shared.clientWebSocket = new ClientWebSocket(shared.ws)

    await shared.clientWebSocket.waitForOpened()

    shared.client = new Client(shared.clientWebSocket, {enableServerControl})
  }

  const teardown = async () => {
    await shared.client?.close()
    await shared.server?.close()
  }

  describe("server control disabled", () => {
    beforeEach(async () => {
      await setup()
    })

    afterEach(async () => {
      await teardown()
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

    it("handles errors from method calls", async () => {
      const stringObject = await shared.client.newObjectWithReference("Array")

      let caughtError = null

      try {
        await stringObject.callMethod("nonExistentMethod")
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError.message).toEqual("No method called 'nonExistentMethod' on a 'Array'")
    })

    it("rejects server control when not enabled on the client", async () => {
      const serverClient = shared.server.getClients()[0]

      if (!serverClient) throw new Error("No client connected to server")

      await expectAsync(serverClient.newObjectWithReference("Array")).toBeRejectedWithError("Server control is disabled")
    })
  })

  describe("server control enabled", () => {
    beforeEach(async () => {
      await setup({enableServerControl: true})
    })

    afterEach(async () => {
      await teardown()
    })

    it("lets the server eval code on the client", async () => {
      const serverClient = shared.server.getClients()[0]

      if (!serverClient) throw new Error("No client connected to server")

      const evaluatedArray = await serverClient.evalWithReference("(() => { const values = ['from client eval']; values.push('more values'); return values })()")

      await evaluatedArray.callMethod("push", "after eval")

      const result = await evaluatedArray.serialize()

      expect(result).toEqual(["from client eval", "more values", "after eval"])
    })
  })
})
