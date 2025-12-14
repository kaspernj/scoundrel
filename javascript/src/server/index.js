// @ts-check

import Client from "../client/index.js"
import EventEmitter from "events"

export default class ScoundrelServer {
  /**
   * Creates a new Scoundrel server
   * @param {import("./connections/web-socket/index.js").default} backend The backend connection handler
   */
  constructor(backend) {
    this.backend = backend
    this.backend.onNewClient(this.onNewClient)

    /** @type {Client[]} */
    this.clients = []

    this.events = new EventEmitter()
  }

  close() { this.backend.close() }
  getClients() { return this.clients }

  /**
   * @param {import("./connections/web-socket/client.js").default} clientBackend
   */
  onNewClient = (clientBackend) => {
    const client = new Client(clientBackend)

    this.clients.push(client)
    this.events.emit("newClient", client)
  }
}
