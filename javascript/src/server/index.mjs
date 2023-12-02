import Client from "./client/index.mjs"

export default class ScoundrelServer {
  constructor(backend) {
    console.log("Server started")

    this.backend = backend

    console.log("Connecting to onNewClient")
    this.backend.onNewClient(this.onNewClient)
    this.clients = []
  }

  onNewClient = (clientBackend) => {
    const client = new Client(clientBackend)

    this.clients.push(client)
  }
}
