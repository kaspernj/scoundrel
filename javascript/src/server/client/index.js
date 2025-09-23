export default class ServerClient {
  constructor(clientBackend, server) {
    this.clientBackend = clientBackend
    this.clientBackend.onCommand(this.onCommand)
    this.objects = {}
    this.objectsCount = 0
    this.server = server
  }

  onCommand = (commandId, data) => {
    try {
      if (data.command == "get_object") {
        const serverObject = this.server.getObject(data.object_name)
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
          const ServerClassInstance = this.server.getClass(className)

          if (ServerClassInstance) {
            object = new ServerClassInstance(...data.args)
          } else {
            const classInstance = global[className]

            if (!classInstance) throw new Error(`No such class: ${className}`)

            object = new global[className](...data.args)
          }
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
      } else {
        this.clientBackend.send({type: "command_response", command_id: commandId, error: `Unknown command: ${data.command}`})
      }
    } catch (error) {
      this.clientBackend.send({type: "command_response", command_id: commandId, error: `Unknown command: ${error.message}`})

      console.error(error)
    }
  }

  respondToCommand(commandId, data) {
    this.clientBackend.send({type: "command_response", command_id: commandId, data})
  }
}
