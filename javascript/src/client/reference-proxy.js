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
    throw new Error("set property isn't supported yet")

    // @ts-expect-error
    if (typeof receiver == "function") receiver = receiver() // eslint-disable-line no-unreachable

    // @ts-expect-error
    if (!(prop in receiver)) throw new PropertyNotFoundError(`Property not found: ${prop}`) // eslint-disable-line no-undef

    return Reflect.set(receiver, prop, newValue)
  }
}

/**
 * @param {any} wrappedObject
 * @returns {Proxy}
 */
const referenceProxy = (wrappedObject) => new Proxy(wrappedObject, proxyObjectHandler)

export default referenceProxy
