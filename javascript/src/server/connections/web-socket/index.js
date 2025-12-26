// @ts-check

import WebSocketClient from "./client.js"

export default class WebSocket {
  /**
   * Creates a new WebSocket connection handler
   * @param {import("ws").Server} webSocketServer The WebSocket server instance
   */
  constructor(webSocketServer) {
    this.wss = webSocketServer
    this.wss.on("connection", this.onConnection)
  }

  close() { this.wss.close() }

  /**
   * @param {import("ws").WebSocket} ws New WebSocket connection
   */
  onConnection = (ws) => {
    if (!this.onNewClientCallback) throw new Error("'onNewClient' hasn't been called")

    this.onNewClientCallback(new WebSocketClient(ws))
  }

  /**
   * @param {(client: import("./client.js").default) => void} callback Handler for new clients
   */
  onNewClient(callback) {
    if (!callback) throw new Error("No callback was given")

    this.onNewClientCallback = callback
  }
}
