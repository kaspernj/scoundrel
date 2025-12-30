// @ts-check

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
   * Calls a method on the reference
   * @overload
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  /**
   * Calls a method on the reference
   * @overload
   * @param {string} methodName Method name to invoke
   * @param {{returnReference?: boolean, returnResult?: false}} options Options for the call
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference>} Reference to the return value
   */
  /**
   * Calls a method on the reference
   * @overload
   * @param {string} methodName Method name to invoke
   * @param {{returnResult: true, returnReference?: false}} options Options for the call
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  /**
   * Calls a method on the reference
   * @param {string} methodName Method name to invoke
   * @param {any} [optionsOrArg] Options for the call or first argument
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference | any>} Result or reference from the method call
   */
  async callMethod(methodName, optionsOrArg, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, optionsOrArg, ...args)
  }

  /**
   * Calls a method on the reference using another reference as argument
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  async callMethodWithReference(methodName, ...args) {
    return await this.client.callMethodOnReference(this.id, methodName, {returnReference: true}, ...args)
  }

  /**
   * Reads an attribute from the reference
   * @param {string} attributeName Attribute name to read
   * @param  {...any} args Additional arguments
   * @returns {Promise<any>} Attribute value
   */
  async readAttribute(attributeName, ...args) {
    return await this.client.readAttributeOnReference(this.id, attributeName, ...args)
  }

  /**
   * Reads an attribute from the reference using another reference as argument
   * @param {string} attributeName Attribute name to read
   * @param  {...any} args Additional arguments
   * @returns {Promise<any>} Attribute value
   */
  async readAttributeWithReference(attributeName, ...args) {
    return await this.client.readAttributeOnReferenceWithReference(this.id, attributeName, ...args)
  }

  /**
   * Serializes the reference and returns the result directly
   * @returns {Promise<any>} Parsed JSON representation
   */
  async serialize() {
    return await this.client.serializeReference(this.id)
  }
}
