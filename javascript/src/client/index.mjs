import Logger from "../logger.mjs"
import Reference from "./reference.mjs"

const logger = new Logger("Scoundrel Client")

// logger.setDebug(true)

export default class Client {
  constructor(backend) {
    this.backend = backend
    this.references = {}
  }

  async close() {
    this.backend.close()
  }

  async callMethodOnReference(referenceId, methodName, ...args) {
    return await this.backend.send({
      args: this.parseArg(args),
      command: "call_method_on_reference",
      method_name: methodName,
      reference_id: referenceId,
      with: "result"
    })
  }

  async callMethodOnReferenceWithReference(referenceId, methodName, ...args) {
    const result = await this.backend.send({
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
    const result = await this.backend.send({
      command: "eval",
      eval_string: evalString,
      with_reference: true
    })
    const id = result.object_id

    return this.spawnReference(id)
  }

  async import(importName) {
    const result = await this.backend.send({
      command: "import",
      import_name: importName
    })

    logger.log(() => ["import", {result}])

    const id = result.object_id

    return this.spawnReference(id)
  }

  async newObjectWithReference(className, ...args) {
    const result = await this.backend.send({
      args: this.parseArg(args),
      command: "new_object_with_reference",
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    return this.spawnReference(id)
  }

  isPlainObject = (input) => {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return true
    }

    return false
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
    const result = await this.backend.send({
      command: "read_attribute",
      attribute_name: attributeName,
      reference_id: referenceId,
      with: "reference"
    })
    const id = result.response

    return this.spawnReference(id)
  }

  async serializeReference(referenceId) {
    const json = await this.backend.send({command: "serialize_reference", reference_id: referenceId})

    return JSON.parse(json)
  }

  spawnReference(id) {
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }
}
