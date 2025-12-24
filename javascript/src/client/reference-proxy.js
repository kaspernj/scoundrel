// @ts-check

/**
 * @param {import("./reference.js").default} reference
 * @param {string} prop
 * @returns {(...args: any[]) => Promise<any>}
 */
const proxyMethodSpawner = (reference, prop) => (...args) => reference.callMethodWithReference(prop, ...args)

const proxyObjectHandler = {
  /**
   * @param {import("./reference.js").default|(() => import("./reference.js").default)} reference
   * @param {string} prop
   * @returns {any}
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
   * @param {import("./reference.js").default|(() => import("./reference.js").default)} receiver
   * @param {string} prop
   * @param {any} newValue
   */
  set(receiver, prop, newValue) {
    void receiver
    void prop
    void newValue
    throw new Error("set property isn't supported yet")
  }
}

/**
 * @param {any} wrappedObject
 * @returns {Proxy}
 */
const referenceProxy = (wrappedObject) => new Proxy(wrappedObject, proxyObjectHandler)

export default referenceProxy
