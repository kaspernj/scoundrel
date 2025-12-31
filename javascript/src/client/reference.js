// @ts-check

/** @typedef {import("./reference-proxy.js").Proxy} Proxy */

export default class Reference {
  /**
   * Creates a new Reference
   * @param {any} client The client instance
   * @param {string} id The reference ID
   */
  constructor(client, id) {
    this.client = client
    this.id = id

    if (!id) throw new Error(`Invalid ID given: ${id}`)
  }

  /**
   * Calls a method on the reference and returns a proxy
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Proxy>} Proxy to the return value
   */
  async callMethod(methodName, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, {proxy: true}, ...args)
  }

  /**
   * Calls a method on the reference and returns a reference
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference>} Reference to the return value
   */
  async callMethodReference(methodName, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, {reference: true}, ...args)
  }

  /**
   * Calls a method on the reference and returns the result directly
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  async callMethodResult(methodName, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, {result: true}, ...args)
  }

  /**
   * Reads an attribute from the reference and returns a proxy
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Proxy>} Proxy to the attribute value
   */
  async readAttribute(attributeName) {
    return await this.client.readAttributeOnReference(this.id, {proxy: true}, attributeName)
  }

  /**
   * Reads an attribute from the reference and returns a reference
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Reference>} Reference to the attribute value
   */
  async readAttributeReference(attributeName) {
    return await this.client.readAttributeOnReference(this.id, {reference: true}, attributeName)
  }

  /**
   * Reads an attribute from the reference and returns the result directly
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<any>} Attribute value
   */
  async readAttributeResult(attributeName) {
    return await this.client.readAttributeOnReference(this.id, {result: true}, attributeName)
  }

  /**
   * Serializes the reference and returns the result directly
   * @returns {Promise<any>} Parsed JSON representation
   */
  async serialize() {
    return await this.client.serializeReference(this.id)
  }
}
