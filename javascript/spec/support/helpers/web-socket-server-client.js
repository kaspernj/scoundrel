// @ts-check

import Client from "../../../src/client/index.js"
import ClientWebSocket from "../../../src/client/connections/web-socket/index.js"
import Server from "../../../src/server/index.js"
import ServerWebSocket from "../../../src/server/connections/web-socket/index.js"
import {WebSocket, WebSocketServer} from "ws"

/**
 * Spins up a WebSocket server/client pair, runs the provided callback, and
 * handles teardown even if the callback rejects.
 *
 * @param {(context: {
 *   client: Client,
 *   clientWebSocket: ClientWebSocket,
 *   server: Server,
 *   serverClient: Client,
 *   serverWebSocket: ServerWebSocket,
 *   ws: WebSocket,
 *   wss: WebSocketServer,
 *   port: number
 * }) => Promise<void>} callback
 * @param {{enableServerControl?: boolean, port?: number}} [options]
 */
export async function runWithWebSocketServerClient(callback, options = {}) {
  const {enableServerControl = false, port = 0} = options
  const shared = /** @type {Partial<Awaited<Parameters<typeof callback>[0]>>} */ ({})

  try {
    shared.wss = new WebSocketServer({port})
    await new Promise((resolve, reject) => {
      shared.wss?.once("listening", resolve)
      shared.wss?.once("error", reject)
    })

    shared.serverWebSocket = new ServerWebSocket(shared.wss)
    shared.server = new Server(shared.serverWebSocket)

    const addressInfo = shared.wss.address()
    shared.port = typeof addressInfo === "object" && addressInfo ? addressInfo.port : undefined

    if (!shared.port) throw new Error(`Unable to determine server port from address info: ${addressInfo}`)

    shared.ws = new WebSocket(`http://localhost:${shared.port}`)
    shared.clientWebSocket = new ClientWebSocket(shared.ws)

    await shared.clientWebSocket.waitForOpened()

    shared.client = new Client(shared.clientWebSocket, {enableServerControl})
    shared.serverClient = shared.server.getClients()[0]

    if (!shared.serverClient) throw new Error("No client connected to server")

    await callback(
      /** @type {Awaited<Parameters<typeof callback>[0]>} */ ({
        client: shared.client,
        clientWebSocket: shared.clientWebSocket,
        server: shared.server,
        serverClient: shared.serverClient,
        serverWebSocket: shared.serverWebSocket,
        ws: shared.ws,
        wss: shared.wss,
        port: shared.port
      })
    )
  } finally {
    await shared.client?.close()
    await shared.server?.close()
  }
}
