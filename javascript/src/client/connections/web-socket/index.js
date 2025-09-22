import Logger from "../../../logger.js"

export default class WebSocket {
  constructor(ws) {
    this.logger = new Logger("Scoundrel WebSocket")
    // this.logger.setDebug(true)

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

  onSocketError = (event) => {
    this.logger.error(() => ["onSocketError", event])
  }

  onSocketMessage = (event) => {
    const data = JSON.parse(event.data)
    const commandId = data.command_id

    if (!(commandId in this.commands)) throw new Error(`Command ${commandId} not found`)

    const command = this.commands[commandId]

    delete this.commands[commandId]

    if (data.error) {
      command.reject(new Error(data.error))
    } else {
      command.resolve(data.data)
    }
  }

  onSocketOpen = (event) => {
    this.logger.log(() =>"onSocketOpen")
  }

  send(data) {
    return new Promise((resolve, reject) => {
      const commandCount = ++this.commandsCount
      const sendData = JSON.stringify({
        command_id: commandCount,
        data
      })

      this.commands[commandCount] = {resolve, reject}
      this.logger.log(() => ["Sending", sendData])
      this.ws.send(sendData)
    })
  }

  waitForOpened = () => new Promise((resolve, reject) => {
    this.ws.addEventListener("open", resolve)
    this.ws.addEventListener("error", reject)
  })
}
