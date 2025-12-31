// @ts-check

import Logger from "../logger.js"
import Reference from "./reference.js"
import referenceProxy from "./reference-proxy.js"
import safeJSONStringify from "../utils/safe-json-stringify.js"

const logger = new Logger("Scoundrel Client")

// logger.setDebug(true)

/**
 * @typedef {{reference?: boolean, result?: boolean, proxy?: boolean}} ReturnOptions
 * @typedef {ReturnOptions & {result?: false}} ReturnReferenceOptions
 * @typedef {ReturnOptions & {result: true, reference?: false}} ReturnResultOptions
 */
export default class Client {
  /**
   * Creates a new Scoundrel Client
   * @param {any} backend The backend connection (e.g., WebSocket)
   * @param {{enableServerControl?: boolean}} [options] Client configuration options
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
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  /**
   * Calls a method on a reference and returns a new reference
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string} methodName Method name to invoke
   * @param {ReturnReferenceOptions} options Options for the call
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the returned value
   */
  /**
   * Calls a method on a reference and returns the result directly
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string} methodName Method name to invoke
   * @param {ReturnResultOptions} options Options for the call
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<any>} Result from the method call
   */
  /**
   * Calls a method on a reference and returns the result directly
   * @param {number} referenceId Reference identifier
   * @param {string} methodName Method name to invoke
   * @param {ReturnOptions | any} [optionsOrArg] Options for the call or first argument
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference | Proxy | any>} Result or reference from the method call
   */
  async callMethodOnReference(referenceId, methodName, optionsOrArg, ...args) {
    const allowedOptions = new Set(["reference", "result", "proxy"])
    /** @type {ReturnOptions | undefined} */
    let options
    /** @type {any[]} */
    let methodArgs

    if (typeof optionsOrArg === "undefined") {
      methodArgs = []
    } else if (this.isPlainObject(optionsOrArg)) {
      const optionKeys = Object.keys(optionsOrArg)
      const hasOptionKey = optionKeys.some((key) => allowedOptions.has(key))

      if (hasOptionKey) {
        const unknownOptions = optionKeys.filter((key) => !allowedOptions.has(key))
        if (unknownOptions.length === 0) {
          options = /** @type {ReturnOptions} */ (optionsOrArg)
          methodArgs = args
        } else {
          throw new Error(`Unknown callMethodOnReference options: ${unknownOptions.join(", ")}`)
        }
      } else {
        methodArgs = [optionsOrArg, ...args]
      }
    } else {
      methodArgs = [optionsOrArg, ...args]
    }

    const returnReference = options?.reference === true
    const returnResult = options?.result === true
    const returnProxy = options?.proxy === true

    if (returnReference && returnResult) {
      throw new Error("callMethodOnReference options reference and result cannot both be true")
    }
    if (returnProxy && !returnReference) {
      throw new Error("callMethodOnReference option proxy requires reference to be true")
    }

    const withReference = returnReference
    const result = await this.sendCommand("call_method_on_reference", {
      args: this.parseArg(methodArgs),
      method_name: methodName,
      reference_id: referenceId,
      with: withReference ? "reference" : "result"
    })

    if (!result) throw new Error("Blank result given")

    if (withReference) {
      const objectId = result.response

      if (!objectId) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

      const spawnedReference = this.spawnReference(objectId)
      return returnProxy ? referenceProxy(spawnedReference) : spawnedReference
    }

    return result.response
  }

  /**
   * Calls a method on a reference and returns a new reference
   * @param {number} referenceId Reference identifier
   * @param {string} methodName Method name to invoke
   * @param  {...any} args Arguments to pass to the method
   * @returns {Promise<Reference>} Reference to the return value
   */
  async callMethodOnReferenceWithReference(referenceId, methodName, ...args) {
    console.warn("Scoundrel Client", "callMethodOnReferenceWithReference is deprecated; use callMethodOnReference with reference instead.")
    return this.callMethodOnReference(referenceId, methodName, {reference: true}, ...args)
  }

  /**
   * Evaluates a string and returns a reference or result
   * @overload
   * @param {string} evalString Code to evaluate
   * @returns {Promise<Reference>} Reference to the evaluated value
   */
  /**
   * Evaluates a string and returns a reference or result
   * @overload
   * @param {ReturnReferenceOptions} options Eval options
   * @param {string} evalString Code to evaluate
   * @returns {Promise<Reference>} Reference to the evaluated value
   */
  /**
   * Evaluates a string and returns a reference or result
   * @overload
   * @param {ReturnResultOptions} options Eval options
   * @param {string} evalString Code to evaluate
   * @returns {Promise<any>} Evaluated result
   */
  /**
   * Evaluates a string and returns a reference or result
   * @param {string | ReturnOptions} optionsOrEvalString Options or code to evaluate
   * @param {string} [evalString] Code to evaluate
   * @returns {Promise<Reference | any>} Reference or evaluated result
   */
  async eval(optionsOrEvalString, evalString) {
    const allowedOptions = new Set(["reference", "result"])
    /** @type {ReturnOptions} */
    let options = {}
    /** @type {string | undefined} */
    let targetEvalString = evalString

    if (typeof evalString === "undefined") {
      if (this.isPlainObject(optionsOrEvalString)) {
        throw new Error("eval requires an eval string when options are provided")
      }

      targetEvalString = /** @type {string} */ (optionsOrEvalString)
    } else {
      options = /** @type {ReturnOptions} */ (optionsOrEvalString ?? {})

      if (!this.isPlainObject(options)) {
        throw new Error("eval options must be a plain object")
      }
    }

    const unknownOptions = Object.keys(options).filter((key) => !allowedOptions.has(key))
    if (unknownOptions.length > 0) {
      throw new Error(`Unknown eval options: ${unknownOptions.join(", ")}`)
    }

    const returnReference = options.reference === true
    const returnResult = options.result === true

    if (returnReference && returnResult) {
      throw new Error("eval options reference and result cannot both be true")
    }

    const withReference = returnReference || !returnResult
    const result = await this.sendCommand("eval", {
      eval_string: targetEvalString,
      with_reference: withReference
    })

    if (!result) throw new Error("Blank result given")

    if (withReference) {
      const objectId = result.object_id

      if (!objectId) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

      return this.spawnReference(objectId)
    }

    if (!("response" in result)) throw new Error(`No response given in result: ${JSON.stringify(result)}`)

    return result.response
  }

  /**
   * Evaluates a string and returns a new reference
   * @param {string} evalString Code to evaluate
   * @returns {Promise<Reference>} Reference to the evaluated value
   */
  async evalWithReference(evalString) {
    console.warn("Scoundrel Client", "evalWithReference is deprecated; use eval instead.")
    return this.eval({reference: true}, evalString)
  }

  /**
   * Imports a module and returns a reference to it
   * @param {string} importName Module name to import
   * @returns {Promise<Reference>} Reference to the module
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
   * @param {string} objectName Registered object name
   * @returns {Promise<Reference>} Reference to the object
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
   * @param {string} className Class name to construct
   * @param  {...any} args Constructor arguments
   * @returns {Promise<Reference>} Reference to the new instance
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
   * @param {any} input Value to inspect
   * @returns {boolean} True when the value is a plain object
   */
  isPlainObject(input) {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return true
    }

    return false
  }

  /**
   * Handles an incoming command from the backend
   * @param {object} args Command payload
   * @param {string} args.command Command name
   * @param {number} args.command_id Command identifier
   * @param {any} args.data Command data
   * @param {string} [args.error] Error message from the backend
   * @param {string} [args.errorStack] Error stack from the backend
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
              .filter((line) => !/(?:^|\()node:internal\//.test(line))
              .filter((line) => !/(?:^|\()internal\//.test(line))
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
          /^(?:[$_]|\p{ID_Start})(?:[$_]|\p{ID_Continue})*$/u.test(name) && !reservedIdentifiers.has(name)

        const scopeKeys = Object.keys(scope)
        const invalidKeys = scopeKeys.filter((key) => !isValidIdentifier(key))

        if (invalidKeys.length > 0) {
          throw new Error(`Invalid registered identifier(s): ${invalidKeys.join(", ")}`)
        }

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
   * @param {any} arg Argument to serialize for transport
   * @returns {any} Serialized argument payload
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
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Reference>} Reference to the attribute value
   */
  /**
   * Reads an attribute on a reference and returns a new reference
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string | number} attributeName Attribute name to read
   * @param {ReturnReferenceOptions} options Options for the read
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the attribute value
   */
  /**
   * Reads an attribute on a reference and returns the result directly
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string | number} attributeName Attribute name to read
   * @param {ReturnResultOptions} options Options for the read
   * @returns {Promise<any>} Attribute value
   */
  async readAttributeOnReferenceWithReference(referenceId, attributeName, optionsOrArg) {
    const allowedOptions = new Set(["reference", "result", "proxy"])
    /** @type {ReturnOptions} */
    let options = {reference: true}

    if (typeof optionsOrArg === "undefined") {
      options = {reference: true}
    } else if (this.isPlainObject(optionsOrArg)) {
      const optionKeys = Object.keys(optionsOrArg)
      const hasOptionKey = optionKeys.some((key) => allowedOptions.has(key))

      if (hasOptionKey) {
        const unknownOptions = optionKeys.filter((key) => !allowedOptions.has(key))
        if (unknownOptions.length === 0) {
          const hasExplicitReturn = Object.prototype.hasOwnProperty.call(optionsOrArg, "reference")
            || Object.prototype.hasOwnProperty.call(optionsOrArg, "result")
          options = /** @type {ReturnOptions} */ ({
            ...(hasExplicitReturn ? {} : {reference: true}),
            ...optionsOrArg
          })
        } else {
          throw new Error(`Unknown readAttributeOnReferenceWithReference options: ${unknownOptions.join(", ")}`)
        }
      } else {
        throw new Error("readAttributeOnReferenceWithReference does not accept positional arguments")
      }
    } else {
      throw new Error("readAttributeOnReferenceWithReference does not accept positional arguments")
    }

    return this.readAttributeOnReference(referenceId, options, attributeName)
  }

  /**
   * Reads an attribute on a reference and returns the result directly
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<any>} Attribute value
   */
  /**
   * Reads an attribute on a reference and returns a new reference
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {ReturnReferenceOptions} options Options for the read
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the attribute value
   */
  /**
   * Reads an attribute on a reference and returns a result or reference
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {ReturnOptions} options Options for the read
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<Reference | Proxy | any>} Attribute value or reference
   */
  /**
   * Reads an attribute on a reference and returns the result directly
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {ReturnResultOptions} options Options for the read
   * @param {string | number} attributeName Attribute name to read
   * @returns {Promise<any>} Attribute value
   */
  /**
   * Reads an attribute on a reference and returns the result directly
   * @param {number} referenceId Reference identifier
   * @param {string | number | ReturnOptions} attributeNameOrOptions Attribute name or options
   * @param {string | number} [attributeName] Attribute name when using options
   * @returns {Promise<Reference | Proxy | any>} Attribute value or reference
   */
  async readAttributeOnReference(referenceId, attributeNameOrOptions, attributeName) {
    const allowedOptions = new Set(["reference", "result", "proxy"])
    /** @type {ReturnOptions | undefined} */
    let options
    /** @type {string | number | undefined} */
    let targetAttributeName = attributeName

    if (this.isPlainObject(attributeNameOrOptions)) {
      const optionKeys = Object.keys(attributeNameOrOptions)
      const hasOptionKey = optionKeys.some((key) => allowedOptions.has(key))

      if (hasOptionKey) {
        const unknownOptions = optionKeys.filter((key) => !allowedOptions.has(key))
        if (unknownOptions.length === 0) {
          options = /** @type {ReturnOptions} */ (attributeNameOrOptions)
        } else {
          throw new Error(`Unknown readAttributeOnReference options: ${unknownOptions.join(", ")}`)
        }
      } else {
        targetAttributeName = /** @type {string | number} */ (attributeNameOrOptions)
      }
    } else {
      targetAttributeName = /** @type {string | number} */ (attributeNameOrOptions)
    }

    if (typeof targetAttributeName === "undefined") {
      throw new Error("readAttributeOnReference requires an attribute name")
    }

    const returnReference = options?.reference === true
    const returnResult = options?.result === true
    const returnProxy = options?.proxy === true

    if (returnReference && returnResult) {
      throw new Error("readAttributeOnReference options reference and result cannot both be true")
    }
    if (returnProxy && !returnReference) {
      throw new Error("readAttributeOnReference option proxy requires reference to be true")
    }

    const withReference = returnReference
    const result = await this.sendCommand("read_attribute", {
      attribute_name: targetAttributeName,
      reference_id: referenceId,
      with: withReference ? "reference" : "result"
    })

    if (!withReference) return result.response

    const id = result.response
    const spawnedReference = this.spawnReference(id)

    return returnProxy ? referenceProxy(spawnedReference) : spawnedReference
  }

  /**
   * Registers a class by name
   * @param {string} className Class name to register
   * @param {any} classInstance Class constructor or instance
   */
  registerClass(className, classInstance) {
    if (className in this._classes) throw new Error(`Class already exists: ${className}`)

    this._classes[className] = classInstance
  }

  /**
   * Unregisters a class by name
   * @param {string} className Class name to remove
   */
  unregisterClass(className) {
    if (!(className in this._classes)) throw new Error(`Class does not exist: ${className}`)

    delete this._classes[className]
  }

  /**
   * Gets a registered class by name
   * @param {string} className Class name to look up
   * @returns {any} Registered class or undefined
   */
  _getRegisteredClass(className) {
    return this._classes[className]
  }

  /**
   * Gets a registered class by name
   * @param {string} className Class name to look up
   * @returns {any} Registered class or undefined
   */
  getClass(className) {
    return this._classes[className]
  }

  /**
   * Registers an object by name
   * @param {string} objectName Object name to register
   * @param {any} objectInstance Object instance
   */
  registerObject(objectName, objectInstance) {
    if (objectName in this._objects) throw new Error(`Object already exists: ${objectName}`)

    this._objects[objectName] = objectInstance
  }

  /**
   * Unregisters an object by name
   * @param {string} objectName Object name to remove
   */
  unregisterObject(objectName) {
    if (!(objectName in this._objects)) throw new Error(`Object does not exist: ${objectName}`)

    delete this._objects[objectName]
  }

  /**
   * Gets a registered object by name
   * @param {string} objectName Object name to look up
   * @returns {any} Registered object or undefined
   */
  _getRegisteredObject(objectName) {
    return this._objects[objectName]
  }

  /**
   * Responds to a command from the backend
   * @param {number} commandId Command identifier
   * @param {any} data Response payload
   */
  respondToCommand(commandId, data) {
    this.send({command: "command_response", command_id: commandId, data: {command_id: commandId, data}})
  }

  /**
   * Sends a command to the backend and returns a promise that resolves with the response
   * @param {string} command Command name
   * @param {any} data Command payload
   * @returns {Promise<any>} Response from the backend
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
   * @param {any} data Payload to send
   */
  send(data) {
    this.backend.send(data)
  }

  /**
   * Serializes a reference and returns the result directly
   * @param {number} referenceId Reference identifier
   * @returns {Promise<any>} Parsed JSON representation
   */
  async serializeReference(referenceId) {
    const json = await this.sendCommand("serialize_reference", {reference_id: referenceId})

    return JSON.parse(json)
  }

  /**
   * Spawns a new reference to an object
   * @param {string} id Reference identifier
   * @returns {Reference} Reference instance
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
