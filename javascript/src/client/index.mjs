import Reference from "./reference.mjs"

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
      args,
      command: "call_method_on_reference",
      method_name: methodName,
      reference_id: referenceId,
      with: "result"
    })
  }

  async callMethodOnReferenceWithReference(referenceId, methodName, ...args) {
    return await this.backend.send({
      args,
      command: "call_method_on_reference",
      method_name: methodName,
      reference_id: referenceId,
      with: "reference"
    })
  }

  async evalWithReference(evalString) {
    const result = await this.backend.send({
      command: "eval",
      eval_string: evalString,
      with_reference: true
    })
    const id = result.object_id
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }

  async import(importName) {
    const result = await this.backend.send({
      command: "import",
      import_name: importName
    })
    const id = result.object_id
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }

  async newObjectWithReference(className, ...args) {
    const result = await this.backend.send({
      args,
      command: "new_object_with_reference",
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id

    return this.spawnReference(id)
  }

  async readAttributeOnReferenceWithReference(referenceId, attributeName) {
    const result = await this.backend.send({
      command: "read_attribute",
      attribute_name: attributeName,
      reference_id: referenceId,
      with: "reference"
    })
    const id = result.response

    console.log({id})

    return this.spawnReference(id)
  }

  async serializeReference(referenceId) {
    const json = await this.backend.send({command: "serialize_reference", reference_id: referenceId})

    return JSON.parse(json)
  }

  spawnReference(id) {
    console.log("spawnReference", {id})

    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }
}
