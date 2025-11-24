import Logger from "../../../logger.js"

const logger = new Logger("Scoundrel WebSocket")

// logger.setDebug(true)

export default class WebSocket {
  constructor(ws) {
    this.ws = ws
    this.ws.addEventListener("error", this.onSocketError)
    this.ws.addEventListener("open", this.onSocketOpen)
    this.ws.addEventListener("message", this.onSocketMessage)

    this.commands = {}
    this.commandsCount = 0
  }

  async close() {
    await this.ws.close()
  }

  onCommand(callback) {
    this.onCommandCallback = callback
  }

  onSocketError = (event) => {
    logger.error(() => ["onSocketError", event])
  }

  onSocketMessage = (event) => {
    const data = JSON.parse(event.data)

    logger.log(() => ["Client::Connections::WebSocket onSocketMessage", data])
    this.onCommandCallback(data.command_id, data.data)
  }

  onSocketOpen = (_event) => {
    logger.log("onSocketOpen")
  }

  send(data) {
    const sendData = JSON.stringify(data)
    logger.log(() => ["Sending", sendData])
    this.ws.send(sendData)
  }

  waitForOpened = () => new Promise((resolve, reject) => {
    this.ws.addEventListener("open", resolve)
    this.ws.addEventListener("error", reject)
  })
}
