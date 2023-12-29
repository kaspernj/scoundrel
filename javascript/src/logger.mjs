export default class Logger {
  constructor(scopeName) {
    this.debug = false
    this.scopeName = scopeName
  }

  setDebug(newValue) {
    this.debug = newValue
  }

  log(...args) {
    if (!this.debug) {
      return
    }

    if (args.length == 1 && typeof args[0] == "function") {
      const callbackArgs = args[0]()

      if (Array.isArray(callbackArgs)) {
        console.log(this.scopeName, ...callbackArgs)
      } else {
        console.log(this.scopeName, callbackArgs)
      }
    } else {
      console.log(this.scopeName, ...args)
    }
  }
}
