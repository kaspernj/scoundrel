// @ts-check

import {serializeScoundrelJSON} from "./scoundrel-json.js"

/**
 * Safely stringifies JSON-friendly values while throwing descriptive errors for unsupported types.
 * @param {any} value Value to serialize
 * @returns {string} JSON string representation
 */
export default function safeJSONStringify(value) {
  return serializeScoundrelJSON(value)
}
