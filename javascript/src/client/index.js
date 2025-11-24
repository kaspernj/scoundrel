import Logger from "../logger.js"
import Reference from "./reference.js"

const logger = new Logger("Scoundrel Client")

// logger.setDebug(true)

export default class Client {
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

  async close() {
    this.backend.close()
  }

  async callMethodOnReference(referenceId, methodName, ...args) {
    const result = await this.sendCommand({
      args: this.parseArg(args),
      command: "call_method_on_reference",
      method_name: methodName,
      reference_id: referenceId,
      with: "result"
    })

    return result.response
  }

  async callMethodOnReferenceWithReference(referenceId, methodName, ...args) {
    const result = await this.sendCommand({
      args: this.parseArg(args),
      command: "call_method_on_reference",
      method_name: methodName,
      reference_id: referenceId,
      with: "reference"
    })
    const id = result.response

    return this.spawnReference(id)
  }

  async evalWithReference(evalString) {
    const result = await this.sendCommand({
      command: "eval",
      eval_string: evalString,
      with_reference: true
    })
    const id = result.object_id

    return this.spawnReference(id)
  }

  async import(importName) {
    const result = await this.sendCommand({
      command: "import",
      import_name: importName
    })

    logger.log(() => ["import", {result}])

    const id = result.object_id

    return this.spawnReference(id)
  }

  async getObject(objectName) {
    const result = await this.sendCommand({
      command: "get_object",
      object_name: objectName
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    return this.spawnReference(id)
  }

  async newObjectWithReference(className, ...args) {
    const result = await this.sendCommand({
      args: this.parseArg(args),
      command: "new_object_with_reference",
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    return this.spawnReference(id)
  }

  isPlainObject(input) {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return true
    }

    return false
  }

  onCommand = (commandId, data) => {
    try {
      if (data.command == "get_object") {
        const serverObject = this.getObject(data.object_name)
        let object

        if (serverObject) {
          object = serverObject
        } else {
          object = global[data.object_name]

          if (!object) throw new Error(`No such object: ${data.object_name}`)
        }

        const objectId = ++this.objectsCount

        this.objects[objectId] = object
        this.respondToCommand(commandId, {object_id: objectId})
      } else if (data.command == "new_object_with_reference") {
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
        this.respondToCommand(commandId, {object_id: objectId})
      } else if (data.command == "call_method_on_reference") {
        const referenceId = data.reference_id
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        const method = object[data.method_name]

        if (!method) throw new Error(`No method called '${data.method_name}' on a '${object.constructor.name}'`)

        const response = method.call(object, ...data.args)

        this.respondToCommand(commandId, {response})
      } else if (data.command == "serialize_reference") {
        const referenceId = data.reference_id
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        this.respondToCommand(commandId, JSON.stringify(object))
      } else if (data.command == "read_attribute") {
        const attributeName = data.attribute_name
        const referenceId = data.reference_id
        const returnWith = data.with
        const object = this.objects[referenceId]

        if (!object) throw new Error(`No object by that ID: ${referenceId}`)

        const attribute = object[attributeName]

        if (returnWith == "reference") {
          const objectId = ++this.objectsCount

          this.objects[objectId] = attribute
          this.respondToCommand(commandId, {response: objectId})
        } else {
          this.respondToCommand(commandId, {response: attribute})
        }
      } else if (data.command == "command_response") {
        if (!(commandId in this.outgoingCommands)) throw new Error(`Outgoing command ${commandId} not found`)

        const command = this.outgoingCommands[commandId]

        delete this.outgoingCommands[commandId]

        if (data.error) {
          const error = new Error(data.error)

          if (data.errorStack) {
            error.stack = `${data.errorStack}\n\n${error.stack}`
          }

          command.reject()
        } else {
          command.resolve(data.data)
        }
      } else {
        throw new Error(`Unknown command: ${data.command}`)
      }
    } catch (error) {
      this.send({command: "command_response", command_id: commandId, error: `Unknown command: ${error.message}`, errorStack: error.stack})

      console.error(error)
    }
  }

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

  async readAttributeOnReferenceWithReference(referenceId, attributeName) {
    const result = await this.sendCommand({
      command: "read_attribute",
      attribute_name: attributeName,
      reference_id: referenceId,
      with: "reference"
    })
    const id = result.response

    return this.spawnReference(id)
  }

  async readAttributeOnReference(referenceId, attributeName) {
    const result = await this.sendCommand({
      command: "read_attribute",
      attribute_name: attributeName,
      reference_id: referenceId,
      with: "result"
    })
    return result.response
  }

  registerClass(className, classInstance) {
    if (className in this._classes) throw new Error(`Class already exists: ${className}`)

    this._classes[className] = classInstance
  }

  getClass(className) {
    return this._classes[className]
  }

  registerObject(objectName, objectInstance) {
    if (objectName in this._objects) throw new Error(`Object already exists: ${objectName}`)

    this._objects[objectName] = objectInstance
  }

  getObject(objectName) {
    return this._objects[objectName]
  }

  respondToCommand(commandId, data) {
    this.sendCommand({command: "command_response", command_id: commandId, data})
  }

  sendCommand(data) {
    return new Promise((resolve, reject) => {
      const outgoingCommandCount = ++this.outgoingCommandsCount
      const commandData = {
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

  async serializeReference(referenceId) {
    const json = await this.sendCommand({command: "serialize_reference", reference_id: referenceId})

    return JSON.parse(json)
  }

  spawnReference(id) {
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }
}
