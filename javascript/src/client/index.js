// @ts-check

import Logger from "../logger.js"
import Reference from "./reference.js"
import safeJSONStringify from "../utils/safe-json-stringify.js"

const logger = new Logger("Scoundrel Client")

// logger.setDebug(true)

export default class Client {
  /**
   * Creates a new Scoundrel Client
   *
   * @param {any} backend The backend connection (e.g., WebSocket)
   * @param {{enableServerControl?: boolean}} [options]
   */
  constructor(backend, options = {}) {
    this.backend = backend
    this.backend.onCommand(this.onCommand)

    /** @type {Record<number, any>} */
    this.outgoingCommands = {}
    this.incomingCommands = {}
    this.outgoingCommandsCount = 0

    /** @type {Record<string, any>} */
    this._classes = {}

    /** @type {Record<string, any>} */
    this._objects = {}

    /** @type {Record<string, Reference>} */
    this.references = {}

    /** @type {Record<number, any>} */
    this.objects = {}

    this.objectsCount = 0

    /** @type {boolean} */
    this.serverControlEnabled = Boolean(options.enableServerControl)
  }

  /**
   * Closes the client connection
   */
  async close() {
    this.backend.close()
  }

  /**
   * Calls a method on a reference and returns the result directly
   *
   * @param {number} referenceId
   * @param {string} methodName
   * @param  {...any} args
   * @returns {Promise<any>}
   */
  async callMethodOnReference(referenceId, methodName, ...args) {
    const result = await this.sendCommand("call_method_on_reference", {
      args: this.parseArg(args),
      method_name: methodName,
      reference_id: referenceId,
      with: "result"
    })

    return result.response
  }

  /**
   * Calls a method on a reference and returns a new reference
   *
   * @param {number} referenceId
   * @param {string} methodName
   * @param  {...any} args
   * @returns {Promise<Reference>}
   */
  async callMethodOnReferenceWithReference(referenceId, methodName, ...args) {
    const result = await this.sendCommand("call_method_on_reference", {
      args: this.parseArg(args),
      method_name: methodName,
      reference_id: referenceId,
      with: "reference"
    })
    const id = result.response

    return this.spawnReference(id)
  }

  /**
   * Evaluates a string and returns a new reference
   *
   * @param {string} evalString
   * @returns {Promise<Reference>}
   */
  async evalWithReference(evalString) {
    const result = await this.sendCommand("eval", {
      eval_string: evalString,
      with_reference: true
    })

    if (!result) throw new Error("Blank result given")

    const objectId = result.object_id

    if (!objectId) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    return this.spawnReference(objectId)
  }

  /**
   * Imports a module and returns a reference to it
   *
   * @param {string} importName
   * @returns {Promise<Reference>}
   */
  async import(importName) {
    const result = await this.sendCommand("import", {
      import_name: importName
    })

    logger.log(() => ["import", {result}])

    if (!result) throw new Error("No result given")
    if (!result.object_id) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    const id = result.object_id

    return this.spawnReference(id)
  }

  /**
   * Gets a registered object by name
   *
   * @param {string} objectName
   * @returns {Promise<Reference>}
   */
  async getObject(objectName) {
    const result = await this.sendCommand("get_object", {
      object_name: objectName
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    return this.spawnReference(id)
  }

  /**
   * Spawns a new reference to an object
   *
   * @param {string} className
   * @param  {...any} args
   * @returns {Promise<Reference>}
   */
  async newObjectWithReference(className, ...args) {
    const result = await this.sendCommand("new_object_with_reference", {
      args: this.parseArg(args),
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    if (!id) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    return this.spawnReference(id)
  }

  /**
   * Checks if the input is a plain object
   * @param {any} input
   * @returns {boolean}
   */
  isPlainObject(input) {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return true
    }

    return false
  }

  /**
   * Handles an incoming command from the backend
   * @param {object} args
   * @param {string} args.command
   * @param {number} args.command_id
   * @param {any} args.data
   * @param {string} [args.error]
   * @param {string} [args.errorStack]
   */
  onCommand = ({command, command_id: commandID, data, error, errorStack, ...restArgs}) => {
    logger.log(() => ["onCommand", {command, commandID, data, error, errorStack, restArgs}])

    try {
      if (!command) {
        throw new Error(`No command key given in data: ${Object.keys(restArgs).join(", ")}`)
      } else if (command == "command_response") {
        if (!(commandID in this.outgoingCommands)) {
          throw new Error(`Outgoing command ${commandID} not found: ${Object.keys(this.outgoingCommands).join(", ")}`)
        }

        const savedCommand = this.outgoingCommands[commandID]

        delete this.outgoingCommands[commandID]

        if (error) {
          const errorToThrow = new Error(error)
          const sanitizeStack = (stack) => {
            if (!stack) return []
            return stack
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line)
              .filter((line) => !/node_modules\/ws/.test(line))
              .filter((line) => !/(?:^|\()node:/.test(line))
              .filter((line) => !/(?:^|[\\/])internal\//.test(line))
              .filter((line) => !line.startsWith("Error:"))
          }

          const formatSection = (label, stack) => {
            const lines = sanitizeStack(stack)
            if (lines.length === 0) return []
            return [`${label} ${lines[0]}`, ...lines.slice(1)]
          }

          const combinedStack = [
            `Error: ${error}`,
            ...formatSection("[SCOUNTDREL-SERVER]", errorStack),
            ...formatSection("[SCOUNDREL-CLIENT]", errorToThrow.stack),
            ...formatSection("[SCOUNDREL-CLIENT]", savedCommand.originStack ? `Command created at:\n${savedCommand.originStack}` : null)
          ].join("\n")

          errorToThrow.stack = combinedStack

          savedCommand.reject(errorToThrow)
        } else {
          logger.log(() => [`Resolving command ${commandID} with data`, data])
          savedCommand.resolve(data.data)
        }
      } else if (!this.serverControlEnabled) {
        this.send({command: "command_response", command_id: commandID, error: "Server control is disabled"})
        return
      } else if (command == "get_object") {
        const serverObject = this._getRegisteredObject(data.object_name)
        const serverClass = this._getRegisteredClass(data.object_name)
        let object

        if (serverObject !== undefined) {
          object = serverObject
        } else if (serverClass !== undefined) {
          object = serverClass
        } else {
          object = globalThis[data.object_name]

          if (object === undefined) throw new Error(`No such object: ${data.object_name}`)
        }

        const objectId = ++this.objectsCount

        this.objects[objectId] = object
        this.respondToCommand(commandID, {object_id: objectId})
      } else if (command == "new_object_with_reference") {
        const className = data.class_name
        let object

        if (typeof className == "string") {
          const ClassInstance = this.getClass(className) || globalThis[className]

          if (!ClassInstance) throw new Error(`No such class: ${className}`)

          object = new ClassInstance(...data.args)
        } else {
          throw new Error(`Don't know how to handle class name: ${typeof className}`)
        }

        const objectId = ++this.objectsCount

        this.objects[objectId] = object
        this.respondToCommand(commandID, {object_id: objectId})
      } else if (command == "call_method_on_reference") {
        const referenceId = data.reference_id
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        const method = object[data.method_name]

        if (!method) throw new Error(`No method called '${data.method_name}' on a '${object.constructor.name}'`)

        const respondWithValue = (responseValue) => {
          if (data.with == "reference") {
            const objectId = ++this.objectsCount

            this.objects[objectId] = responseValue
            this.respondToCommand(commandID, {response: objectId})
          } else {
            this.respondToCommand(commandID, {response: responseValue})
          }
        }

        const response = method.call(object, ...data.args)

        if (response && typeof response.then == "function") {
          response.then(respondWithValue).catch((promiseError) => {
            if (promiseError instanceof Error) {
              this.send({command: "command_response", command_id: commandID, error: promiseError.message, errorStack: promiseError.stack})
            } else {
              this.send({command: "command_response", command_id: commandID, error: String(promiseError)})
            }
          })
        } else {
          respondWithValue(response)
        }
      } else if (command == "serialize_reference") {
        const referenceId = data.reference_id
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        const serialized = safeJSONStringify(object)
        this.respondToCommand(commandID, serialized)
      } else if (command == "read_attribute") {
        const attributeName = data.attribute_name
        const referenceId = data.reference_id
        const returnWith = data.with
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        const attribute = object[attributeName]

        if (returnWith == "reference") {
          const objectId = ++this.objectsCount

          this.objects[objectId] = attribute
          this.respondToCommand(commandID, {response: objectId})
        } else {
          this.respondToCommand(commandID, {response: attribute})
        }
      } else if (command == "eval") {
        const respondWithResult = (evalResult) => {
          if (data.with_reference) {
            const objectId = ++this.objectsCount

            this.objects[objectId] = evalResult
            this.respondToCommand(commandID, {object_id: objectId})
          } else {
            this.respondToCommand(commandID, {response: evalResult})
          }
        }

        const scope = {...this._objects, ...this._classes}
        const reservedIdentifiers = new Set([
          "break",
          "case",
          "catch",
          "class",
          "const",
          "continue",
          "debugger",
          "default",
          "delete",
          "do",
          "else",
          "export",
          "extends",
          "finally",
          "for",
          "function",
          "if",
          "import",
          "in",
          "instanceof",
          "new",
          "return",
          "super",
          "switch",
          "this",
          "throw",
          "try",
          "typeof",
          "var",
          "void",
          "while",
          "with",
          "yield",
          "let",
          "enum",
          "await",
          "implements",
          "package",
          "protected",
          "static",
          "interface",
          "private",
          "public",
          "eval"
        ])

        const isValidIdentifier = (name) =>
          /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !reservedIdentifiers.has(name)

        const scopeKeys = Object.keys(scope).filter((key) => isValidIdentifier(key))
        // Ensure registered objects/classes are available as locals inside the eval
        const evaluator = new Function("__evalString", ...scopeKeys, "return eval(__evalString)")
        const evalResult = evaluator(data.eval_string, ...scopeKeys.map((key) => scope[key]))

        if (evalResult && typeof evalResult.then == "function") {
          evalResult.then(respondWithResult).catch((promiseError) => {
            if (promiseError instanceof Error) {
              this.send({command: "command_response", command_id: commandID, error: promiseError.message, errorStack: promiseError.stack})
            } else {
              this.send({command: "command_response", command_id: commandID, error: String(promiseError)})
            }
          })
        } else {
          respondWithResult(evalResult)
        }
      } else {
        throw new Error(`Unknown command: ${command}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        this.send({command: "command_response", command_id: commandID, error: error.message, errorStack: error.stack})
      } else {
        this.send({command: "command_response", command_id: commandID, error: String(error)})
      }

      logger.error(error)
    }
  }

  /**
   * Parases an argument for sending to the server
   *
   * @param {any} arg
   * @returns {any}
   */
  parseArg(arg) {
    if (Array.isArray(arg)) {
      return arg.map((argInArray) => this.parseArg(argInArray))
    } else if (arg instanceof Reference) {
      return {
        __scoundrel_object_id: arg.id,
        __scoundrel_type: "reference"
      }
    } else if (this.isPlainObject(arg)) {
      /** @type {Record<any, any>} */
      const newObject = {}

      for (const key in arg) {
        const value = arg[key]

        newObject[key] = this.parseArg(value)
      }

      return newObject
    }

    return arg
  }

  /**
   * Reads an attribute on a reference and returns a new reference
   *
   * @param {number} referenceId
   * @param {string} attributeName
   * @returns {Promise<Reference>}
   */
  async readAttributeOnReferenceWithReference(referenceId, attributeName) {
    const result = await this.sendCommand("read_attribute", {
      attribute_name: attributeName,
      reference_id: referenceId,
      with: "reference"
    })
    const id = result.response

    return this.spawnReference(id)
  }

  /**
   * Reads an attribute on a reference and returns the result directly
   *
   * @param {number} referenceId
   * @param {string} attributeName
   * @returns {Promise<any>}
   */
  async readAttributeOnReference(referenceId, attributeName) {
    const result = await this.sendCommand("read_attribute", {
      attribute_name: attributeName,
      reference_id: referenceId,
      with: "result"
    })
    return result.response
  }

  /**
   * Registers a class by name
   *
   * @param {string} className
   * @param {any} classInstance
   */
  registerClass(className, classInstance) {
    if (className in this._classes) throw new Error(`Class already exists: ${className}`)

   this._classes[className] = classInstance
  }

  /**
   * Gets a registered class by name
   *
   * @param {string} className
   * @returns {any}
   */
  _getRegisteredClass(className) {
    return this._classes[className]
  }

  /**
   * Gets a registered class by name
   *
   * @param {string} className
   * @returns {any}
   */
  getClass(className) {
    return this._classes[className]
  }

  /**
   * Registers an object by name
   *
   * @param {string} objectName
   * @param {any} objectInstance
   */
  registerObject(objectName, objectInstance) {
    if (objectName in this._objects) throw new Error(`Object already exists: ${objectName}`)

    this._objects[objectName] = objectInstance
  }

  /**
   * Gets a registered object by name
   *
   * @param {string} objectName
   * @returns {any}
   */
  _getRegisteredObject(objectName) {
    return this._objects[objectName]
  }

  /**
   * Responds to a command from the backend
   * @param {number} commandId
   * @param {any} data
   */
  respondToCommand(commandId, data) {
    this.send({command: "command_response", command_id: commandId, data: {command_id: commandId, data}})
  }

  /**
   * Sends a command to the backend and returns a promise that resolves with the response
   * @param {string} command
   * @param {any} data
   * @returns {Promise<any>}
   */
  sendCommand(command, data) {
    return new Promise((resolve, reject) => {
      const outgoingCommandCount = ++this.outgoingCommandsCount
      const originError = new Error(`Command '${command}' dispatched`)
      // Strip the sendCommand frame to highlight the caller site.
      if (Error.captureStackTrace) Error.captureStackTrace(originError, this.sendCommand)
      const commandData = {
        command,
        command_id: outgoingCommandCount,
        data
      }

      this.outgoingCommands[outgoingCommandCount] = {resolve, reject, originStack: originError.stack}
      logger.log(() => ["Sending", commandData])
      this.send(commandData)
    })
  }

  /**
   * Sends data to the backend
   * @param {any} data
   */
  send(data) {
    this.backend.send(data)
  }

  /**
   * Serializes a reference and returns the result directly
   *
   * @param {number} referenceId
   * @returns {Promise<any>}
   */
  async serializeReference(referenceId) {
    const json = await this.sendCommand("serialize_reference", {reference_id: referenceId})

    return JSON.parse(json)
  }

  /**
   * Spawns a new reference to an object
   *
   * @param {string} id
   * @returns {Reference}
   */
  spawnReference(id) {
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }

  enableServerControl() {
    this.serverControlEnabled = true
  }
}
