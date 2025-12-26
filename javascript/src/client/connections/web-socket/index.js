// @ts-check

import Logger from "../../../logger.js"

const logger = new Logger("Scoundrel WebSocket")

// logger.setDebug(true)

export default class WebSocket {
  /**
   * Creates a new WebSocket connection handler
   * @param {WebSocket} ws The WebSocket instance
   */
  constructor(ws) {
    this.ws = ws

    // @ts-ignore
    this.ws.addEventListener("error", this.onSocketError)

    // @ts-ignore
    this.ws.addEventListener("open", this.onSocketOpen)

    // @ts-ignore
    this.ws.addEventListener("message", this.onSocketMessage)

    this.commands = {}
    this.commandsCount = 0
  }

  async close() {
    await this.ws.close()
  }

  /**
   * @param {(data: any) => void} callback Handler for incoming commands
   */
  onCommand(callback) {
    this.onCommandCallback = callback
  }

  /**
   * @param {Event} event WebSocket error event
   */
  onSocketError = (event) => {
    logger.error(() => ["onSocketError", event])
  }

  /**
   * @param {MessageEvent} event WebSocket message event
   */
  onSocketMessage = (event) => {
    const data = JSON.parse(event.data)

    logger.log(() => ["Client::Connections::WebSocket onSocketMessage", data])

    if (!this.onCommandCallback) {
      throw new Error("No onCommand callback set, ignoring message")
    }

    this.onCommandCallback(data)
  }

  /**
   * @param {Event} event WebSocket open event
   */
  onSocketOpen = (event) => {
    logger.log(() => ["onSocketOpen", event])
  }

  /**
   * @param {Record<string, any>} data Payload to send
   */
  send(data) {
    const sendData = JSON.stringify(data)
    logger.log(() => ["Sending", sendData])

    // @ts-ignore
    this.ws.send(sendData)
  }

  waitForOpened = () => new Promise((resolve, reject) => {
    // @ts-ignore
    this.ws.addEventListener("open", resolve)

    // @ts-ignore
    this.ws.addEventListener("error", reject)
  })
}
