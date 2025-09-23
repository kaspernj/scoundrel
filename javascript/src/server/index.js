import Client from "./client/index.js"

export default class ScoundrelServer {
  constructor(backend) {
    this.backend = backend
    this.backend.onNewClient(this.onNewClient)
    this.clients = []
    this._classes = {}
    this._objects = {}
  }

  close() { this.backend.close() }

  onNewClient = (clientBackend) => {
    const client = new Client(clientBackend, this)

    this.clients.push(client)
  }

  registerClass(className, classInstance) {
    if (className in this._classes) throw new Error(`Class already exists: ${className}`)

    this._classes[className] = classInstance
  }

  registerObject(objectName, objectInstance) {
    if (objectName in this._objects) throw new Error(`Object already exists: ${objectName}`)

    this._objects[objectName] = objectInstance
  }

  getClass(className) {
    return this._classes[className]
  }

  getObject(objectName) {
    return this._objects[objectName]
  }
}
