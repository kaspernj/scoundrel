import Reference from "./reference.mjs"

export default class Client {
  constructor(backend) {
    this.backend = backend
    this.references = {}
  }

  async callMethodOnReference(referenceId, methodName, ...args) {
    return await this.backend.send({
      args,
      command: "call_method_on_reference",
      method_name: methodName,
      reference_id: referenceId
    })
  }

  async newObjectWithReference(className, ...args) {
    const result = await this.backend.send({
      args,
      command: "new_object_with_reference",
      class_name: className
    })

    if (!result) throw new Error("Blank result given")

    const id = result.object_id
    const reference = new Reference(this, id)

    this.references[id] = reference

    return reference
  }

  async serializeReference(referenceId) {
    const json = await this.backend.send({command: "serialize_reference", reference_id: referenceId})

    return JSON.parse(json)
  }
}
