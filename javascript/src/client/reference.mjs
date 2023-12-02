export default class Reference {
  constructor(client, id) {
    this.client = client
    this.id = id

    if (!id) throw new Error(`Invalid ID given: ${id}`)
  }

  async callMethod(methodName, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, ...args)
  }

  async serialize() {
    return await this.client.serializeReference(this.id)
  }
}
