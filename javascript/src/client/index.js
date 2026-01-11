// @ts-check

import Logger from "../logger.js"
import Reference from "./reference.js"
import referenceProxy from "./reference-proxy.js"
import safeJSONStringify from "../utils/safe-json-stringify.js"
import {parseScoundrelJSON} from "../utils/scoundrel-json.js"

const logger = new Logger("Scoundrel Client")
const generateInstanceId = () => {
  const randomUUID = globalThis.crypto?.randomUUID
  if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto)
  return `scoundrel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** @typedef {import("./reference-proxy.js").Proxy} Proxy */

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

    /** @type {Record<string, Reference | WeakRef<Reference>>} */
    this.references = {}

    /** @type {Record<number, any>} */
    this.objects = {}

    this.objectsCount = 0
    this.instanceId = generateInstanceId()
    this.supportsWeakReferences = typeof globalThis.WeakRef === "function" && typeof globalThis.FinalizationRegistry === "function"
    this.referenceReleaseRegistry = this.supportsWeakReferences
      ? new FinalizationRegistry((referenceId) => this.queueReleasedReference(referenceId))
      : null
    this.pendingReferenceReleases = new Set()

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
      methodArgs = args
    } else if (this.isPlainObject(optionsOrArg)) {
      const optionKeys = Object.keys(optionsOrArg)
      const hasOptionKey = optionKeys.some((key) => allowedOptions.has(key))

      if (hasOptionKey) {
        const unknownOptions = optionKeys.filter((key) => !allowedOptions.has(key))
        if (unknownOptions.length === 0) {
          const optionValuesAreBoolean = optionKeys
            .filter((key) => allowedOptions.has(key))
            .every((key) => typeof optionsOrArg[key] === "boolean")

          if (optionValuesAreBoolean) {
            options = /** @type {ReturnOptions} */ (optionsOrArg)
            methodArgs = args
          } else {
            methodArgs = [optionsOrArg, ...args]
          }
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
    const returnFlags = [returnReference, returnResult, returnProxy].filter(Boolean).length

    if (returnFlags > 1) {
      throw new Error("callMethodOnReference options reference, result, and proxy are mutually exclusive")
    }

    const withReference = returnReference || returnProxy
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

      const spawnedReference = this.spawnReference(objectId, result.instance_id)
      return returnProxy ? referenceProxy(spawnedReference) : spawnedReference
    }

    return result.response
  }

  /**
   * Calls a function reference and returns the result directly
   * @param {number} referenceId Reference identifier
   * @param  {...any} args Arguments to pass to the function
   * @returns {Promise<any>} Result from the function call
   */
  async callFunctionOnReference(referenceId, ...args) {
    const result = await this.sendCommand("call_function_on_reference", {
      args: this.parseFunctionArgs(args),
      reference_id: referenceId,
      with: "result"
    })

    if (!result) throw new Error("Blank result given")

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
   * Evaluates a string and returns a proxy
   * @param {string} evalString Code to evaluate
   * @returns {Promise<Proxy>} Proxy to the evaluated value
   */
  async eval(evalString) {
    if (typeof evalString !== "string") {
      throw new Error("eval requires an eval string")
    }

    const result = await this.sendCommand("eval", {
      eval_string: evalString,
      with_reference: true
    })

    if (!result) throw new Error("Blank result given")

    const objectId = result.object_id

    if (!objectId) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    const spawnedReference = this.spawnReference(objectId, result.instance_id)
    return referenceProxy(spawnedReference)
  }

  /**
   * Evaluates a string and returns a reference
   * @param {string} evalString Code to evaluate
   * @returns {Promise<Reference>} Reference to the evaluated value
   */
  async evalReference(evalString) {
    if (typeof evalString !== "string") {
      throw new Error("evalReference requires an eval string")
    }

    const result = await this.sendCommand("eval", {
      eval_string: evalString,
      with_reference: true
    })

    if (!result) throw new Error("Blank result given")

    const objectId = result.object_id

    if (!objectId) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    return this.spawnReference(objectId, result.instance_id)
  }

  /**
   * Evaluates a string and returns the result directly
   * @param {string} evalString Code to evaluate
   * @returns {Promise<any>} Evaluated result
   */
  async evalResult(evalString) {
    if (typeof evalString !== "string") {
      throw new Error("evalResult requires an eval string")
    }

    const result = await this.sendCommand("eval", {
      eval_string: evalString,
      with_reference: false
    })

    if (!result) throw new Error("Blank result given")
    if (!("response" in result)) throw new Error(`No response given in result: ${JSON.stringify(result)}`)

    return result.response
  }

  /**
   * Imports a module and returns a proxy to it
   * @param {string} importName Module name to import
   * @returns {Promise<Proxy>} Proxy to the module
   */
  async import(importName) {
    if (typeof importName !== "string") throw new Error("import requires a module name")

    const result = await this.sendCommand("import", {
      import_name: importName
    })

    logger.log(() => ["import", {result}])

    if (!result) throw new Error("No result given")
    if (!result.object_id) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    const id = result.object_id
    const spawnedReference = this.spawnReference(id, result.instance_id)

    return referenceProxy(spawnedReference)
  }

  /**
   * Imports a module and returns a reference to it
   * @param {string} importName Module name to import
   * @returns {Promise<Reference>} Reference to the module
   */
  async importReference(importName) {
    if (typeof importName !== "string") throw new Error("importReference requires a module name")

    const result = await this.sendCommand("import", {
      import_name: importName
    })

    logger.log(() => ["import", {result}])

    if (!result) throw new Error("No result given")
    if (!result.object_id) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    const id = result.object_id

    return this.spawnReference(id, result.instance_id)
  }

  /**
   * Imports a module and returns the serialized result
   * @param {string} importName Module name to import
   * @returns {Promise<any>} Serialized result for the module
   */
  async importResult(importName) {
    const reference = await this.importReference(importName)
    return await reference.serialize()
  }

  /**
   * Gets a registered object by name and returns a proxy
   * @param {string} objectName Registered object name
   * @returns {Promise<Proxy>} Proxy to the object
   */
  async getObject(objectName) {
    const reference = await this.getObjectReference(objectName)
    return referenceProxy(reference)
  }

  /**
   * Gets a registered object by name and returns a reference
   * @param {string} objectName Registered object name
   * @returns {Promise<Reference>} Reference to the object
   */
  async getObjectReference(objectName) {
    if (typeof objectName !== "string") throw new Error("getObjectReference requires an object name")

    const result = await this.sendCommand("get_object", {
      object_name: objectName
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    return this.spawnReference(id, result.instance_id)
  }

  /**
   * Gets a registered object by name and returns the serialized result
   * @param {string} objectName Registered object name
   * @returns {Promise<any>} Serialized result for the object
   */
  async getObjectResult(objectName) {
    const reference = await this.getObjectReference(objectName)
    return await reference.serialize()
  }

  /**
   * Spawns a new reference to an object and returns a proxy
   * @param {string} className Class name to construct
   * @param  {...any} args Constructor arguments
   * @returns {Promise<Proxy>} Proxy to the new instance
   */
  async newObject(className, ...args) {
    if (typeof className !== "string") throw new Error("newObject requires a class name")

    const result = await this.sendCommand("new_object_with_reference", {
      args: this.parseArg(args),
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    if (!id) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    const spawnedReference = this.spawnReference(id, result.instance_id)

    return referenceProxy(spawnedReference)
  }

  /**
   * Spawns a new reference to an object and returns a reference
   * @param {string} className Class name to construct
   * @param  {...any} args Constructor arguments
   * @returns {Promise<Reference>} Reference to the new instance
   */
  async newObjectReference(className, ...args) {
    if (typeof className !== "string") throw new Error("newObjectReference requires a class name")

    const result = await this.sendCommand("new_object_with_reference", {
      args: this.parseArg(args),
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    if (!id) throw new Error(`No object ID given in result: ${JSON.stringify(result)}`)

    return this.spawnReference(id, result.instance_id)
  }

  /**
   * Spawns a new reference to an object and returns the serialized result
   * @param {string} className Class name to construct
   * @param  {...any} args Constructor arguments
   * @returns {Promise<any>} Serialized result for the new instance
   */
  async newObjectResult(className, ...args) {
    const reference = await this.newObjectReference(className, ...args)
    return await reference.serialize()
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
   * @param {number[]} [args.released_reference_ids] Reference IDs released by the peer
   */
  onCommand = ({command, command_id: commandID, data, error, errorStack, released_reference_ids: releasedReferenceIds, ...restArgs}) => {
    logger.log(() => ["onCommand", {command, commandID, data, error, errorStack, restArgs}])

    try {
      this.releaseReferences(releasedReferenceIds)

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
      } else if (command == "call_function_on_reference") {
        const referenceId = data.reference_id
        const func = this.objects[referenceId]

        if (!Object.prototype.hasOwnProperty.call(this.objects, referenceId)) {
          throw new Error(`No object by that ID: ${referenceId}`)
        }

        if (typeof func !== "function") {
          throw new Error(`No function by that ID: ${referenceId}`)
        }

        const respondWithValue = (responseValue) => {
          if (data.with == "reference") {
            const objectId = ++this.objectsCount

            this.objects[objectId] = responseValue
            this.respondToCommand(commandID, {response: objectId, instance_id: this.instanceId})
          } else {
            this.respondToCommand(commandID, {response: responseValue})
          }
        }

        const parsedArgs = this.parseIncomingArgs(data.args, {allowRemoteReferences: true})
        const response = func(...parsedArgs)

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
        this.respondToCommand(commandID, {object_id: objectId, instance_id: this.instanceId})
      } else if (command == "new_object_with_reference") {
        const className = data.class_name
        let object

        if (typeof className == "string") {
          const ClassInstance = this.getClass(className) || globalThis[className]

          if (!ClassInstance) throw new Error(`No such class: ${className}`)

          object = new ClassInstance(...this.parseIncomingArgs(data.args))
        } else {
          throw new Error(`Don't know how to handle class name: ${typeof className}`)
        }

        const objectId = ++this.objectsCount

        this.objects[objectId] = object
        this.respondToCommand(commandID, {object_id: objectId, instance_id: this.instanceId})
      } else if (command == "call_method_on_reference") {
        const referenceId = data.reference_id
        const object = this.objects[referenceId]

        if (!Object.prototype.hasOwnProperty.call(this.objects, referenceId)) {
          throw new Error(`No object by that ID: ${referenceId}`)
        }

        const method = object[data.method_name]

        if (!method) throw new Error(`No method called '${data.method_name}' on a '${object.constructor.name}'`)

        const respondWithValue = (responseValue) => {
          if (data.with == "reference") {
            const objectId = ++this.objectsCount

            this.objects[objectId] = responseValue
            this.respondToCommand(commandID, {response: objectId, instance_id: this.instanceId})
          } else {
            this.respondToCommand(commandID, {response: responseValue})
          }
        }

        const parsedArgs = this.parseIncomingArgs(data.args)
        const response = method.call(object, ...parsedArgs)

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

        if (!Object.prototype.hasOwnProperty.call(this.objects, referenceId)) {
          throw new Error(`No object by that ID: ${referenceId}`)
        }

        const serialized = safeJSONStringify(object)
        this.respondToCommand(commandID, serialized)
      } else if (command == "read_attribute") {
        const attributeName = data.attribute_name
        const referenceId = data.reference_id
        const returnWith = data.with
        const object = this.objects[referenceId]

        if (!Object.prototype.hasOwnProperty.call(this.objects, referenceId)) {
          throw new Error(`No object by that ID: ${referenceId}`)
        }

        const attribute = object[attributeName]

        if (returnWith == "reference") {
          const objectId = ++this.objectsCount

          this.objects[objectId] = attribute
          this.respondToCommand(commandID, {response: objectId, instance_id: this.instanceId})
        } else {
          this.respondToCommand(commandID, {response: attribute})
        }
      } else if (command == "eval") {
        const respondWithResult = (evalResult) => {
          if (data.with_reference) {
            const objectId = ++this.objectsCount

            this.objects[objectId] = evalResult
            this.respondToCommand(commandID, {object_id: objectId, instance_id: this.instanceId})
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
        const evalArgs = scopeKeys.map((key) => scope[key])
        const evalString = `(async () => {\n${data.eval_string}\n})()`
        const evalResult = evaluator(evalString, ...evalArgs)

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
    } else if (typeof arg === "function") {
      const functionId = ++this.objectsCount

      this.objects[functionId] = arg

      return {
        __scoundrel_function_id: functionId,
        __scoundrel_instance_id: this.instanceId,
        __scoundrel_type: "function"
      }
    } else if (arg instanceof Reference) {
      /** @type {Record<string, any>} */
      const referencePayload = {
        __scoundrel_object_id: arg.id,
        __scoundrel_type: "reference"
      }

      if (arg.instanceId) {
        referencePayload.__scoundrel_instance_id = arg.instanceId
      }

      return referencePayload
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
   * Parses an argument payload received from the server
   * @param {any} arg Argument to parse
   * @param {{allowRemoteReferences?: boolean}} [options] Parsing options
   * @returns {any} Parsed argument
   */
  parseIncomingArg(arg, options = {}) {
    if (Array.isArray(arg)) {
      return arg.map((argInArray) => this.parseIncomingArg(argInArray, options))
    } else if (this.isPlainObject(arg)) {
      if (arg.__scoundrel_type === "reference") {
        const instanceId = arg.__scoundrel_instance_id
        const referenceId = arg.__scoundrel_object_id

        if (instanceId === undefined || instanceId === this.instanceId) {
          if (Object.prototype.hasOwnProperty.call(this.objects, referenceId)) {
            return this.objects[referenceId]
          }

          return arg
        }

        if (options.allowRemoteReferences) {
          return this.spawnReference(referenceId, instanceId)
        }

        return arg
      }

      if (arg.__scoundrel_type === "function") {
        const functionId = arg.__scoundrel_function_id
        const functionWrapper = (...args) => this.callFunctionOnReference(functionId, ...args)

        this.trackFunctionWrapper(functionWrapper, functionId)

        return functionWrapper
      }

      /** @type {Record<any, any>} */
      const newObject = {}

      for (const key in arg) {
        newObject[key] = this.parseIncomingArg(arg[key], options)
      }

      return newObject
    }

    return arg
  }

  /**
   * Parses an arguments array received from the server
   * @param {any[]} args Arguments to parse
   * @param {{allowRemoteReferences?: boolean}} [options] Parsing options
   * @returns {any[]} Parsed arguments
   */
  parseIncomingArgs(args, options) {
    if (!Array.isArray(args)) return []

    return args.map((arg) => this.parseIncomingArg(arg, options))
  }

  /**
   * Serializes arguments for a function callback
   * @param {any[]} args Arguments to serialize
   * @returns {any[]} Serialized arguments
   */
  parseFunctionArgs(args) {
    return args.map((arg) => this.parseFunctionArg(arg))
  }

  /**
   * Serializes an argument for a function callback
   * @param {any} arg Argument to serialize
   * @returns {any} Serialized argument payload
   */
  parseFunctionArg(arg) {
    if (arg === null || arg === undefined) return arg

    if (arg instanceof Reference) {
      return this.parseArg(arg)
    }

    if (typeof arg === "object" || typeof arg === "function") {
      const objectId = ++this.objectsCount
      this.objects[objectId] = arg

      return {
        __scoundrel_object_id: objectId,
        __scoundrel_instance_id: this.instanceId,
        __scoundrel_type: "reference"
      }
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
   * @param {ReturnReferenceOptions} optionsOrArg Options for the read
   * @returns {Promise<Reference | Proxy>} Reference or proxy to the attribute value
   */
  /**
   * Reads an attribute on a reference and returns the result directly
   * @overload
   * @param {number} referenceId Reference identifier
   * @param {string | number} attributeName Attribute name to read
   * @param {ReturnResultOptions} optionsOrArg Options for the read
   * @returns {Promise<any>} Attribute value
   */
  /**
   * Reads an attribute on a reference and returns a new reference
   * @param {number} referenceId Reference identifier
   * @param {string | number} attributeName Attribute name to read
   * @param {ReturnOptions} [optionsOrArg] Options for the read
   * @returns {Promise<Reference | Proxy | any>} Reference, proxy, or result
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
            || Object.prototype.hasOwnProperty.call(optionsOrArg, "proxy")
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

    const returnReference = options?.reference === true
    const returnResult = options?.result === true
    const returnProxy = options?.proxy === true
    const returnFlags = [returnReference, returnResult, returnProxy].filter(Boolean).length

    if (returnFlags > 1) {
      throw new Error("readAttributeOnReferenceWithReference options reference, result, and proxy are mutually exclusive")
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
    const returnFlags = [returnReference, returnResult, returnProxy].filter(Boolean).length

    if (returnFlags > 1) {
      throw new Error("readAttributeOnReference options reference, result, and proxy are mutually exclusive")
    }

    const withReference = returnReference || returnProxy
    const result = await this.sendCommand("read_attribute", {
      attribute_name: targetAttributeName,
      reference_id: referenceId,
      with: withReference ? "reference" : "result"
    })

    if (!withReference) return result.response

    const id = result.response
    const spawnedReference = this.spawnReference(id, result.instance_id)

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
    if (data && typeof data === "object") {
      const releasedIds = this.takeReleasedReferenceIds()
      if (releasedIds.length > 0) data.released_reference_ids = releasedIds
    }

    this.backend.send(data)
  }

  /**
   * Serializes a reference and returns the result directly
   * @param {number} referenceId Reference identifier
   * @returns {Promise<any>} Parsed JSON representation
   */
  async serializeReference(referenceId) {
    const json = await this.sendCommand("serialize_reference", {reference_id: referenceId})

    return parseScoundrelJSON(json)
  }

  /**
   * Spawns a new reference to an object
   * @param {string} id Reference identifier
   * @param {string | undefined} [instanceId] Owning instance identifier
   * @returns {Reference} Reference instance
   */
  spawnReference(id, instanceId) {
    const reference = new Reference(this, id, instanceId)

    this.trackReference(reference)

    return reference
  }

  trackReference(reference) {
    if (this.supportsWeakReferences) {
      this.references[reference.id] = new WeakRef(reference)
      this.referenceReleaseRegistry?.register(reference, reference.id)
    } else {
      this.references[reference.id] = reference
    }
  }

  trackFunctionWrapper(functionWrapper, functionId) {
    if (!this.supportsWeakReferences) return
    if (functionId === undefined || functionId === null) return

    this.referenceReleaseRegistry?.register(functionWrapper, functionId)
  }

  queueReleasedReference(referenceId) {
    if (!this.supportsWeakReferences) return
    if (referenceId === undefined || referenceId === null) return
    this.pendingReferenceReleases.add(referenceId)
  }

  takeReleasedReferenceIds() {
    if (!this.supportsWeakReferences) return []
    if (this.pendingReferenceReleases.size === 0) return []

    const ids = Array.from(this.pendingReferenceReleases)
    this.pendingReferenceReleases.clear()
    return ids
  }

  releaseReferences(referenceIds) {
    if (!Array.isArray(referenceIds) || referenceIds.length === 0) return

    for (const referenceId of referenceIds) {
      delete this.objects[referenceId]
    }
  }

  enableServerControl() {
    this.serverControlEnabled = true
  }
}
