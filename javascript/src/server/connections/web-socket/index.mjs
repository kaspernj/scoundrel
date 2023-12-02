import WebSocketClient from "./client.mjs"

export default class WebSocket {
  constructor(webSocketServer) {
    this.wss = webSocketServer
    this.wss.on("connection", this.onConnection)
  }

  onConnection = (ws) => {
    console.log("New connection")

    if (!this.onNewClientCallback) throw new Error("'onNewClient' hasn't been called")

    this.onNewClientCallback(new WebSocketClient(ws))
  }

  onNewClient = (callback) => {
    console.log("onNewClient called")

    if (!callback) throw new Error("No callback was given")

    this.onNewClientCallback = callback
  }
}
