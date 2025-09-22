export default class Logger {
  constructor(scopeName) {
    this.debug = false
    this.scopeName = scopeName
  }

  setDebug(newValue) {
    this.debug = newValue
  }

  error(...args) {
    return this._sendToConsole("error", ...args)
  }

  log(...args) {
    return this._sendToConsole("log", ...args)
  }

  _sendToConsole(logType, ...args) {
    if (!this.debug) {
      return
    }

    if (args.length == 1 && typeof args[0] == "function") {
      const callbackArgs = args[0]()

      if (Array.isArray(callbackArgs)) {
        console[logType](this.scopeName, ...callbackArgs)
      } else {
        console[logType](this.scopeName, callbackArgs)
      }
    } else {
      console[logType](this.scopeName, ...args)
    }
  }
}
