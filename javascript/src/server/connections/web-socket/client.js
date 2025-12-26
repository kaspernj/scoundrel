// @ts-check

export default class WebSocketClient {
  /**
   * Creates a new WebSocketClient
   * @param {import("ws").WebSocket} ws The WebSocket instance
   */
  constructor(ws) {
    this.ws = ws

    ws.on("error", this.onError)
    ws.on("message", this.onMessage)
  }

  /**
   * @param {(data: any) => void} callback Handler for incoming commands
   */
  onCommand(callback) {
    this.onCommandCallback = callback
  }

  /**
   * @param {Error} error WebSocket error
   */
  onError = (error) => {
    console.error("WebSocketClient error", error)
  }

  /**
   * @param {string} rawData Raw message payload
   */
  onMessage = (rawData) => {
    const data = JSON.parse(rawData)

    if (!this.onCommandCallback) throw new Error("Command callback hasn't been set")

    this.onCommandCallback(data)
  }

  /**
   * @param {any} data Payload to send
   */
  async send(data) {
    await this.ws.send(JSON.stringify(data))
  }
}
