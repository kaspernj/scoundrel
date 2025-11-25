import Logger from "../logger.js"
import Reference from "./reference.js"

const logger = new Logger("Scoundrel Client")

// logger.setDebug(true)

export default class Client {
  /**
   * Creates a new Scoundrel Client
   *
   * @param {any} backend The backend connection (e.g., WebSocket)
   */
  constructor(backend) {
    this.backend = backend
    this.backend.onCommand(this.onCommand)

    this.outgoingCommands = {}
    this.incomingCommands = {}
    this.outgoingCommandsCount = 0

    this._classes = {}
    this._objects = {}
    this.references = {}
    this.objects = {}
    this.objectsCount = 0
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
    const id = result.object_id

    return this.spawnReference(id)
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
   * @param {string} id
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

  isPlainObject(input) {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return true
    }

    return false
  }

  onCommand = ({command, command_id: commandID, data, error, errorStack, ...restArgs}) => {
    logger.log(() => ["onCommand", {command, commandID, data, error, errorStack, restArgs}])

    try {
      if (!command) {
        throw new Error(`No command key given in data: ${Object.keys(restArgs).join(", ")}`)
      } else if (command == "get_object") {
        const serverObject = this._getRegisteredObject(data.object_name)
        let object

        if (serverObject) {
          object = serverObject
        } else {
          object = global[data.object_name]

          if (!object) throw new Error(`No such object: ${data.object_name}`)
        }

        const objectId = ++this.objectsCount

        this.objects[objectId] = object
        this.respondToCommand(commandID, {object_id: objectId})
      } else if (command == "new_object_with_reference") {
        const className = data.class_name
        let object

        if (typeof className == "string") {
          const ClassInstance = this.getClass(className) || global[className]

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

        const response = method.call(object, ...data.args)

        this.respondToCommand(commandID, {response})
      } else if (command == "serialize_reference") {
        const referenceId = data.reference_id
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        this.respondToCommand(commandID, JSON.stringify(object))
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
      } else if (command == "command_response") {
        if (!(commandID in this.outgoingCommands)) {
          throw new Error(`Outgoing command ${commandID} not found: ${Object.keys(this.outgoingCommands).join(", ")}`)
        }

        const savedCommand = this.outgoingCommands[commandID]

        delete this.outgoingCommands[commandID]

        if (error) {
          const errorToThrow = new Error(error)

          if (errorStack) {
            errorToThrow.stack = `${errorStack}\n\n${errorToThrow.stack}`
          }

          savedCommand.reject(errorToThrow)
        } else {
          logger.log(() => [`Resolving command ${commandID} with data`, data])
          savedCommand.resolve(data.data)
        }
      } else {
        throw new Error(`Unknown command: ${command}`)
      }
    } catch (error) {
      this.send({command: "command_response", command_id: commandID, error: error.message, errorStack: error.stack})

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

  respondToCommand(commandId, data) {
    this.sendCommand("command_response", {command_id: commandId, data})
  }

  sendCommand(command, data) {
    return new Promise((resolve, reject) => {
      const outgoingCommandCount = ++this.outgoingCommandsCount
      const commandData = {
        command,
        command_id: outgoingCommandCount,
        data
      }

      this.outgoingCommands[outgoingCommandCount] = {resolve, reject}
      logger.log(() => ["Sending", commandData])
      this.send(commandData)
    })
  }

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
   * @returns {Promise<Reference>}
   */
  spawnReference(id) {
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }
}
