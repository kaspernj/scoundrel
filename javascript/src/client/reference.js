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
   * Calls a method on the reference (reference => Reference, result => result)
   * @overload
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  /**
   * Calls a method on the reference
   * @overload
   * @param {string} methodName Method name to invoke
   * @param {{reference?: boolean, result?: false, proxy?: boolean}} options Options for the call
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the return value
   */
  /**
   * Calls a method on the reference
   * @overload
   * @param {string} methodName Method name to invoke
   * @param {{result: true, reference?: false, proxy?: boolean}} options Options for the call
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  /**
   * Calls a method on the reference
   * @param {string} methodName Method name to invoke
   * @param {any} [optionsOrArg] Options for the call or first argument
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference | Proxy | any>} Result or reference from the method call
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
    return await this.client.callMethodOnReference(this.id, methodName, {reference: true}, ...args)
  }

  /**
   * Reads an attribute from the reference
   * @overload
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<any>} Attribute value
   */
  /**
   * Reads an attribute from the reference
   * @overload
   * @param {{reference?: boolean, result?: false, proxy?: boolean}} options Options for the read
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the attribute value
   */
  /**
   * Reads an attribute from the reference
   * @overload
   * @param {{result: true, reference?: false, proxy?: boolean}} options Options for the read
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<any>} Attribute value
   */
  /**
   * Reads an attribute from the reference
   * @param {string | number | {reference?: boolean, result?: boolean, proxy?: boolean}} attributeNameOrOptions Attribute name or options
   * @param {string | number} [attributeName] Attribute name when using options
   * @returns {Promise<Reference | Proxy | any>} Attribute value or reference
   */
  async readAttribute(attributeNameOrOptions, attributeName) {
    if (this.client.isPlainObject(attributeNameOrOptions)) {
      return await this.client.readAttributeOnReference(this.id, attributeNameOrOptions, attributeName)
    }

    return await this.client.readAttributeOnReference(this.id, attributeNameOrOptions)
  }

  /**
   * Reads an attribute from the reference using another reference as argument
   * @overload
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Reference>} Reference to the attribute value
   */
  /**
   * Reads an attribute from the reference using another reference as argument
   * @overload
   * @param {string | number} attributeName Attribute name to read
   * @param {{reference?: boolean, result?: false, proxy?: boolean}} options Options for the read
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the attribute value
   */
  /**
   * Reads an attribute from the reference using another reference as argument
   * @overload
   * @param {string | number} attributeName Attribute name to read
   * @param {{result: true, reference?: false, proxy?: boolean}} options Options for the read
   * @returns {Promise<any>} Attribute value
   */
  /**
   * Reads an attribute from the reference using another reference as argument
   * @param {string | number} attributeName Attribute name to read
   * @param {any} [optionsOrArg] Options for the read
   * @returns {Promise<Reference | Proxy | any>} Attribute value or reference
   */
  async readAttributeWithReference(attributeName, optionsOrArg) {
    if (typeof optionsOrArg === "undefined") {
      return await this.readAttribute({reference: true}, attributeName)
    }

    if (this.client.isPlainObject(optionsOrArg)) {
      const allowedOptions = new Set(["reference", "result", "proxy"])
      const optionKeys = Object.keys(optionsOrArg)
      const hasOptionKey = optionKeys.some((key) => allowedOptions.has(key))

      if (!hasOptionKey) {
        throw new Error("readAttributeWithReference does not accept positional arguments")
      }

      return await this.readAttribute(optionsOrArg, attributeName)
    }

    throw new Error("readAttributeWithReference does not accept positional arguments")
  }

  /**
   * Serializes the reference and returns the result directly
   * @returns {Promise<any>} Parsed JSON representation
   */
  async serialize() {
    return await this.client.serializeReference(this.id)
  }
}
