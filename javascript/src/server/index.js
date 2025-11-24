import Client from "../client/index.js"
import EventEmitter from "events"

export default class ScoundrelServer {
  constructor(backend) {
    this.backend = backend
    this.backend.onNewClient(this.onNewClient)
    this.clients = []
    this.events = new EventEmitter()
  }

  close() { this.backend.close() }
  getClients() { return this.clients }

  onNewClient = (clientBackend) => {
    const client = new Client(clientBackend)

    this.clients.push(client)
    this.events.emit("newClient", client)
  }
}
