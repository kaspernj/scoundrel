const proxyMethodSpawner = (reference, prop) => (...args) => reference.callMethodWithReference(prop, ...args)

const proxyObjectHandler = {
  get(reference, prop) {
    if (typeof reference == "function") reference = reference()

    if (prop == "__serialize") {
      const method = reference.serialize
      const boundMethod = method.bind(reference)

      return boundMethod
    }

    return proxyMethodSpawner(reference, prop)
  },

  set(receiver, prop, newValue) {
    throw new Error("set property isn't supported yet")

    if (typeof receiver == "function") receiver = receiver()
    if (!(prop in receiver)) throw new PropertyNotFoundError(`Property not found: ${prop}`)

    return Reflect.set(receiver, prop, newValue)
  }
}

const referenceProxy = (wrappedObject) => new Proxy(wrappedObject, proxyObjectHandler)

export default referenceProxy
