// @ts-check

export default class Reference {
  /**
   * Creates a new Reference
   *
   * @param {any} client The client instance
   * @param {string} id The reference ID
   */
  constructor(client, id) {
    this.client = client
    this.id = id

    if (!id) throw new Error(`Invalid ID given: ${id}`)
  }

  /**
   * Calls a method on the reference
   *
   * @param {string} methodName
   * @param  {...any} args
   * @returns {Promise<any>}
   */
  async callMethod(methodName, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, ...args)
  }

  /**
   * Calls a method on the reference using another reference as argument
   *
   * @param {string} methodName
   * @param  {...any} args
   * @returns {Promise<any>}
   */
  async callMethodWithReference(methodName, ...args) {
    return await this.client.callMethodOnReferenceWithReference(this.id, methodName, ...args)
  }

  /**
   * Reads an attribute from the reference
   *
   * @param {string} attributeName
   * @param  {...any} args
   * @returns {Promise<any>}
   */
  async readAttribute(attributeName, ...args) {
    return await this.client.readAttributeOnReference(this.id, attributeName, ...args)
  }

  /**
   * Reads an attribute from the reference using another reference as argument
   *
   * @param {string} attributeName
   * @param  {...any} args
   * @returns {Promise<any>}
   */
  async readAttributeWithReference(attributeName, ...args) {
    return await this.client.readAttributeOnReferenceWithReference(this.id, attributeName, ...args)
  }

  /**
   * Serializes the reference and returns the result directly
   *
   * @returns {Promise<any>}
   */
  async serialize() {
    return await this.client.serializeReference(this.id)
  }
}
