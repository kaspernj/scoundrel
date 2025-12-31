// @ts-check

/**
 * @typedef {Record<string, any> & {__serialize: () => Promise<any>}} ReferenceProxy
 * @typedef {ReferenceProxy} Proxy
 * @typedef {object} ProxyPromiseMethods
 * @property {(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => Promise<any>} then Promise-style then handler
 * @property {(onrejected?: (reason: any) => any) => Promise<any>} catch Promise-style catch handler
 * @property {(onfinally?: () => any) => Promise<any>} finally Promise-style finally handler
 */

/**
 * @param {import("./reference.js").default} reference Reference to proxy
 * @param {string} prop Property name to resolve
 * @returns {((...args: any[]) => Promise<any>) & ProxyPromiseMethods} Callable proxy for method or attribute
 */
const proxyPropertySpawner = (reference, prop) => {
  /** @type {((...args: any[]) => Promise<any>) & ProxyPromiseMethods} */
  const methodProxy = /** @type {any} */ ((...args) => reference.callMethod(prop, ...args))

  Object.defineProperties(methodProxy, {
    then: {
      value: (resolve, reject) => reference.readAttributeResult(prop).then(resolve, reject),
      enumerable: false
    },
    catch: {
      value: (reject) => reference.readAttributeResult(prop).catch(reject),
      enumerable: false
    },
    finally: {
      value: (callback) => reference.readAttributeResult(prop).finally(callback),
      enumerable: false
    }
  })

  return methodProxy
}

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

    if (prop == "then" || prop == "catch" || prop == "finally") return undefined
    if (prop == "asymmetricMatch" || prop == "jasmineToString") return undefined

    if (typeof prop !== "string") return undefined

    return proxyPropertySpawner(reference, prop)
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
