import Client from "./client/index.mjs"

export default class ScoundrelServer {
  constructor(backend) {
    this.backend = backend
    this.backend.onNewClient(this.onNewClient)
    this.clients = []
  }

  close = () => this.backend.close()

  onNewClient = (clientBackend) => {
    const client = new Client(clientBackend)

    this.clients.push(client)
  }
}
