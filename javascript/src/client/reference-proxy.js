// @ts-check

/**
 * @param {import("./reference.js").default} reference Reference to proxy
 * @param {string} prop Property name to call
 * @returns {(...args: any[]) => Promise<any>} Function that forwards calls
 */
const proxyMethodSpawner = (reference, prop) => (...args) => reference.callMethodWithReference(prop, ...args)

const proxyObjectHandler = {
  /**
   * @param {import("./reference.js").default|(() => import("./reference.js").default)} reference Reference instance or factory
   * @param {string} prop Property name to resolve
   * @returns {any} Proxy value for the property
   */
  get(reference, prop) {
    if (typeof reference == "function") reference = reference()

    if (prop == "__serialize") {
      const method = reference.serialize
      const boundMethod = method.bind(reference)

      return boundMethod
    }

    return proxyMethodSpawner(reference, prop)
  },

  /**
   * @param {import("./reference.js").default|(() => import("./reference.js").default)} receiver Proxy receiver
   * @param {string} prop Property name being set
   * @param {any} newValue New value for the property
   */
  set(receiver, prop, newValue) {
    void receiver
    void prop
    void newValue
    throw new Error("set property isn't supported yet")
  }
}

/**
 * @param {any} wrappedObject Target to wrap in a proxy
 * @returns {Proxy} Proxy that forwards to references
 */
const referenceProxy = (wrappedObject) => new Proxy(wrappedObject, proxyObjectHandler)

export default referenceProxy
