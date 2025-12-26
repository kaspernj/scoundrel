// @ts-check

import Client from "../client/index.js"
import EventEmitter from "events"
import SingleEventEmitter from "../utils/single-event-emitter.js"

export default class ScoundrelServer {
  /**
   * Creates a new Scoundrel server
   * @param {import("./connections/web-socket/index.js").default} backend The backend connection handler
   */
  constructor(backend) {
    this.backend = backend
    this.backend.onNewClient(this.onNewClientFromBackend)

    /** @type {Client[]} */
    this.clients = []

    this.events = new EventEmitter()

    /** @type {SingleEventEmitter<(client: Client) => void>} */
    this.onNewClientEventEmitter = new SingleEventEmitter()
    this.onNewClient = this.onNewClientEventEmitter.connector()
  }

  /** @returns {void} No return value */
  close() { this.backend.close() }

  /** @returns {Client[]} Connected clients */
  getClients() { return this.clients }

  /**
   * @param {import("./connections/web-socket/client.js").default} clientBackend Backend client connection
   * @returns {void} No return value
   */
  onNewClientFromBackend = (clientBackend) => {
    const client = new Client(clientBackend, {enableServerControl: true})

    this.clients.push(client)
    this.events.emit("newClient", client)

    this.onNewClientEventEmitter.emit([client])
  }
}
