// @ts-check

/**
 * @typedef {any} Proxy
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
  /**
   * @param {...any} args Arguments forwarded to the remote method
   * @returns {Promise<any>} Remote method result
   */
  const callableProxy = (...args) => reference.callMethod(prop, ...args)
  /** @type {((...args: any[]) => Promise<any>) & ProxyPromiseMethods} */
  const methodProxy = /** @type {any} */ (callableProxy)

  /**
   * @param {(value: any) => any} [resolve]
   *   Promise resolution handler.
   * @param {(reason: any) => any} [reject]
   *   Promise rejection handler.
   * @returns {Promise<any>} Promise-like resolution
   */
  const thenProxy = (resolve, reject) => reference.readAttributeResult(prop).then(resolve, reject)
  /**
   * @param {(reason: any) => any} [reject]
   *   Promise rejection handler.
   * @returns {Promise<any>} Promise-like rejection handling
   */
  const catchProxy = (reject) => reference.readAttributeResult(prop).catch(reject)
  /**
   * @param {() => any} [callback]
   *   Callback invoked after settlement.
   * @returns {Promise<any>} Promise-like finally handling
   */
  const finallyProxy = (callback) => reference.readAttributeResult(prop).finally(callback)

  Object.defineProperties(methodProxy, {
    then: {
      value: thenProxy,
      enumerable: false
    },
    catch: {
      value: catchProxy,
      enumerable: false
    },
    finally: {
      value: finallyProxy,
      enumerable: false
    }
  })

  return methodProxy
}

/**
 * @param {import("./reference.js").default} reference Reference to chain
 * @returns {Proxy} Chainable proxy that executes on await
 */
const createChainProxy = (reference) => {
  const state = {
    reference,
    /** @type {Array<{method: string, args: any[]}>} */
    steps: []
  }

  /** @returns {Promise<any>} Resolved chain result. */
  const executeChain = async () => {
    const baseReference = state.reference

    if (state.steps.length === 0) {
      return await referenceProxy(baseReference).__serialize()
    }

    for (let index = 0; index < state.steps.length; index += 1) {
      const step = state.steps[index]
      const isLast = index === state.steps.length - 1

      if (isLast) {
        return await baseReference.callMethodResult(step.method, ...step.args)
      }

      await baseReference.callMethodResult(step.method, ...step.args)
    }
  }

  /**
   * @param {(value: any) => any} [resolve]
   *   Promise resolution handler.
   * @param {(reason: any) => any} [reject]
   *   Promise rejection handler.
   * @returns {Promise<any>} Promise-like resolution
   */
  const thenChain = (resolve, reject) => executeChain().then(resolve, reject)
  /**
   * @param {(reason: any) => any} [reject]
   *   Promise rejection handler.
   * @returns {Promise<any>} Promise-like rejection handling
   */
  const catchChain = (reject) => executeChain().catch(reject)
  /**
   * @param {() => any} [callback]
   *   Callback invoked after settlement.
   * @returns {Promise<any>} Promise-like finally handling
   */
  const finallyChain = (callback) => executeChain().finally(callback)

  const handler = {
    /**
     * @param {Record<string, unknown>} target Proxy target
     * @param {string | symbol} prop Property being accessed
     * @returns {any} Proxy value for the property
     */
    get(target, prop) {
      void target

      if (prop === "__execChain") return executeChain
      if (prop === "then") return thenChain
      if (prop === "catch") return catchChain
      if (prop === "finally") return finallyChain

      if (typeof prop !== "string") return undefined

      /**
       * @param {...any} args Arguments to append to the chain step
       * @returns {Proxy} The same chain proxy for further chaining
       */
      return (...args) => {
        state.steps.push({method: prop, args})
        return chainProxy
      }
    }
  }

  const chainProxy = new Proxy({}, handler)
  return /** @type {Proxy} */ (chainProxy)
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

    if (prop == "__chain") {
      return () => createChainProxy(reference)
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
