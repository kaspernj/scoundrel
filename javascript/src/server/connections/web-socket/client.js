export default class WebSocketClient {
  constructor(ws) {
    this.ws = ws

    ws.on("error", this.onError)
    ws.on("message", this.onMessage)
  }

  onCommand(callback) {
    this.onCommandCallback = callback
  }

  onError = (error) => {
    console.error("WebSocketClient error", error)
  }

  onMessage = (rawData) => {
    const data = JSON.parse(rawData)

    if (!this.onCommandCallback) throw new Error("Command callback hasn't been set")

    this.onCommandCallback(data)
  }

  async send(data) {
    await this.ws.send(JSON.stringify(data))
  }
}
