// @ts-check

const TYPE_KEY = "__scoundrel_type__"
const VALUE_KEY = "value"
const OMIT_VALUE = Symbol("omit_value")

/** @typedef {{type: string, canSerialize: (value: any) => boolean, serialize: (value: any) => Record<string, any>, deserialize: (payload: Record<string, any>) => any}} ScoundrelTypeHandler */

/** @type {ScoundrelTypeHandler[]} */
const typeHandlers = []

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const findHandlerForValue = (value) => typeHandlers.find((handler) => handler.canSerialize(value))
const findHandlerForType = (type) => typeHandlers.find((handler) => handler.type === type)

/**
 * Registers a new scoundrel type handler.
 * @param {ScoundrelTypeHandler} handler Handler to register
 */
export function registerScoundrelType(handler) {
  if (!handler || typeof handler.type !== "string") {
    throw new Error("Scoundrel type handler must include a type string")
  }
  if (typeof handler.canSerialize !== "function" || typeof handler.serialize !== "function" || typeof handler.deserialize !== "function") {
    throw new Error(`Scoundrel type handler '${handler.type}' must define canSerialize, serialize, and deserialize`)
  }

  const existingIndex = typeHandlers.findIndex((existing) => existing.type === handler.type)
  if (existingIndex >= 0) {
    typeHandlers[existingIndex] = handler
  } else {
    typeHandlers.push(handler)
  }
}

const ensureSerializableObject = (handler, serialized, path) => {
  if (!isPlainObject(serialized)) {
    throw new Error(`Scoundrel type '${handler.type}' must serialize to a plain object at ${path}`)
  }

  if (!Object.prototype.hasOwnProperty.call(serialized, TYPE_KEY)) {
    serialized[TYPE_KEY] = handler.type
  }

  return serialized
}

const encodeValue = (value, path, seen) => {
  if (typeof value === "undefined") {
    return path === "value" ? null : OMIT_VALUE
  }

  const handler = findHandlerForValue(value)
  if (handler) {
    const serialized = ensureSerializableObject(handler, handler.serialize(value), path)
    return encodeObject(serialized, path, seen)
  }

  const valueType = typeof value

  if (valueType === "function") throw new Error(`Cannot serialize function at ${path}`)
  if (valueType === "symbol") throw new Error(`Cannot serialize symbol at ${path}`)
  if (valueType === "number" && !Number.isFinite(value)) {
    throw new Error(`Cannot serialize non-finite number at ${path}`)
  }
  if (valueType === "bigint") {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) {
      throw new Error(`Cannot serialize non-finite number at ${path}`)
    }
    return numberValue
  }

  if (value === null || valueType !== "object") return value

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error(`Cannot serialize circular reference at ${path}`)
    seen.set(value, path)
    return value.map((item, index) => {
      const encoded = encodeValue(item, `${path}[${index}]`, seen)
      return encoded === OMIT_VALUE ? null : encoded
    })
  }

  if (!isPlainObject(value)) {
    const constructorName = value.constructor && value.constructor.name ? value.constructor.name : "Object"
    throw new Error(`Cannot serialize non-plain object '${constructorName}' at ${path}`)
  }

  return encodeObject(value, path, seen)
}

const encodeObject = (value, path, seen) => {
  if (seen.has(value)) throw new Error(`Cannot serialize circular reference at ${path}`)
  seen.set(value, path)

  /** @type {Record<string, any>} */
  const encoded = {}

  for (const key of Object.keys(value)) {
    const childPath = `${path}.${key}`
    const childValue = encodeValue(value[key], childPath, seen)
    if (childValue !== OMIT_VALUE) {
      encoded[key] = childValue
    }
  }

  return encoded
}

const decodeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => decodeValue(item))
  }

  if (value && typeof value === "object") {
    const type = value[TYPE_KEY]
    if (typeof type === "string") {
      const handler = findHandlerForType(type)
      if (handler) {
        return handler.deserialize(value)
      }
    }

    /** @type {Record<string, any>} */
    const decoded = {}
    for (const key of Object.keys(value)) {
      decoded[key] = decodeValue(value[key])
    }
    return decoded
  }

  return value
}

/**
 * Serializes a value using Scoundrel JSON rules.
 * @param {any} value Value to serialize
 * @returns {string} JSON string representation
 */
export function serializeScoundrelJSON(value) {
  const encoded = encodeValue(value, "value", new WeakMap())
  return JSON.stringify(encoded)
}

/**
 * Parses a JSON payload using Scoundrel JSON rules.
 * @param {string} raw JSON string payload
 * @returns {any} Parsed value
 */
export function parseScoundrelJSON(raw) {
  return decodeValue(JSON.parse(raw))
}

registerScoundrelType({
  type: "date",
  canSerialize: (value) => value instanceof Date,
  serialize: (value) => ({[TYPE_KEY]: "date", [VALUE_KEY]: value.toISOString()}),
  deserialize: (payload) => new Date(payload[VALUE_KEY])
})

registerScoundrelType({
  type: "regex",
  canSerialize: (value) => value instanceof RegExp,
  serialize: (value) => ({[TYPE_KEY]: "regex", [VALUE_KEY]: value.toString()}),
  deserialize: (payload) => {
    const raw = payload[VALUE_KEY]
    if (typeof raw !== "string") throw new Error("Invalid regex payload")
    const match = raw.match(/^\/(.*)\/([a-z]*)$/i)
    if (!match) throw new Error("Invalid regex payload")
    return new RegExp(match[1], match[2])
  }
})

