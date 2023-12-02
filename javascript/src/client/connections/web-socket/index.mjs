export default class WebSocket {
  constructor(ws) {
    this.ws = ws
    this.ws.addEventListener("error", this.onSocketError)
    this.ws.addEventListener("open", this.onSocketOpen)
    this.ws.addEventListener("message", this.onSocketMessage)

    this.commands = {}
    this.commandsCount = 0
  }

  waitForOpened = () => new Promise((resolve, reject) => {
    this.ws.addEventListener("open", resolve)
    this.ws.addEventListener("error", reject)
  })

  onSocketError = (event) => {
    console.log("onSocketError", event)
  }

  onSocketMessage = (event) => {
    console.log("onSocketMessage", event.data)

    const data = JSON.parse(event.data)
    const commandId = data.command_id

    if (!(commandId in this.commands)) throw new Error(`Command ${commandId} not found`)

    const command = this.commands[commandId]

    delete this.commands[commandId]

    if (data.error) {
      command.reject(data.error)
    } else {
      console.log(`Resolving command ${commandId} with`, data.data)
      command.resolve(data.data)
    }
  }

  onSocketOpen = (event) => {
    console.log("onSocketOpen")
  }

  send(data) {
    return new Promise((resolve, reject) => {
      const commandCount = ++this.commandsCount

      this.commands[commandCount] = {resolve, reject}

      this.ws.send(JSON.stringify({
        command_id: commandCount,
        data
      }))
    })
  }
}
