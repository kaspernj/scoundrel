// @ts-check

/**
 * Safely stringifies JSON-friendly values while throwing descriptive errors for unsupported types.
 * @param {any} value Value to serialize
 * @returns {string} JSON string representation
 */
export default function safeJSONStringify(value) {
  if (typeof value === "undefined") return "null"

  const valueType = typeof value
  if (valueType === "function") throw new Error("Cannot serialize function at value")
  if (valueType === "symbol") throw new Error("Cannot serialize symbol at value")
  if (valueType === "bigint") throw new Error("Cannot serialize bigint at value")
  if (valueType === "number" && !Number.isFinite(value)) {
    throw new Error("Cannot serialize non-finite number at value")
  }

  if (value && valueType === "object") {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
      const constructorName = value.constructor && value.constructor.name ? value.constructor.name : "Object"
      throw new Error(`Cannot serialize non-plain object '${constructorName}' at value`)
    }
  }

  const pathMap = new WeakMap()

  if (value && typeof value === "object") {
    pathMap.set(value, "value")
  }

  const replacer = function(key, val) {
    const parentPath = pathMap.get(this) || "value"
    const currentPath = key === "" ? parentPath : Array.isArray(this) ? `${parentPath}[${key}]` : `${parentPath}.${key}`
    const valType = typeof val

    if (valType === "function") throw new Error(`Cannot serialize function at ${currentPath}`)
    if (valType === "symbol") throw new Error(`Cannot serialize symbol at ${currentPath}`)
    if (valType === "bigint") throw new Error(`Cannot serialize bigint at ${currentPath}`)
    if (valType === "number" && !Number.isFinite(val)) throw new Error(`Cannot serialize non-finite number at ${currentPath}`)

    if (val === null) return val

    if (Array.isArray(val)) {
      pathMap.set(val, currentPath)
      return val
    }

    if (valType === "object") {
      const prototype = Object.getPrototypeOf(val)
      if (prototype !== Object.prototype && prototype !== null) {
        const constructorName = val.constructor && val.constructor.name ? val.constructor.name : "Object"
        throw new Error(`Cannot serialize non-plain object '${constructorName}' at ${currentPath}`)
      }

      pathMap.set(val, currentPath)
      return val
    }

    return val
  }

  try {
    const json = JSON.stringify(value, replacer)
    return typeof json === "undefined" ? "null" : json
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error(String(error))
  }
}
