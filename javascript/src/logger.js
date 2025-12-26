// @ts-check

export default class Logger {
  /**
   * Creates a new Logger instance
   * @param {string} scopeName The name of the scope for the logger
   */
  constructor(scopeName) {
    this.debug = false
    this.scopeName = scopeName
  }

  /**
   * Enables or disables debug logging
   * @param {boolean} newValue Whether debug logging is enabled
   */
  setDebug(newValue) {
    this.debug = newValue
  }

  /**
   * Logs an error message to the console if debug is enabled
   * @param  {...any} args Values to log
   * @returns {void} No return value
   */
  error(...args) {
    return this._sendToConsole("error", ...args)
  }

  /**
   * Logs a message to the console if debug is enabled
   * @param  {...any} args Values to log
   * @returns {void} No return value
   */
  log(...args) {
    return this._sendToConsole("log", ...args)
  }

  /**
   * Logs a warning message to the console if debug is enabled
   * @param  {...any} args Values to log
   * @returns {void} No return value
   */
  warn(...args) {
    return this._sendToConsole("warn", ...args)
  }

  /**
   * Sends the log message to the console
   * @param {string} logType Console method name
   * @param  {...any} args Values to log
   * @returns {void} No return value
   */
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
