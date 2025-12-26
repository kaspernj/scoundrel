// @ts-check

/**
 * SingleEventEmitter: one listener at a time, strongly typed via JSDoc.
 * @template {(...args: any[]) => any} Listener
 */
export default class SingleEventEmitter {
  /** @type {Listener | null} */
  #listener = null

  /** @type {boolean} */
  #strict

  /**
   * @param {{ strict?: boolean }=} options Configuration options
   *  - strict (default true): throw if a listener is already connected
   */
  constructor(options) {
    this.#strict = options?.strict ?? true
  }

  /**
   * Connect a listener (type-checked).
   * @param {Listener} listener Listener to connect
   * @returns {void} No return value
   */
  connect(listener) {
    if (this.#listener && this.#strict) {
      throw new Error("SingleEventEmitter already has a listener connected")
    }
    this.#listener = listener
  }

  /**
   * Disconnect only if the same listener is currently connected.
   * @param {Listener} listener Listener to disconnect
   * @returns {void} No return value
   */
  disconnect(listener) {
    if (this.#listener === listener) this.#listener = null
  }

  /** @returns {void} No return value */
  clear() {
    this.#listener = null
  }

  /** @returns {boolean} True when a listener is connected */
  hasListener() {
    return this.#listener !== null
  }

  /**
   * Emit the event to the connected listener (if any).
   * Arguments are type-checked against Listener parameters.
   * @param {...Parameters<Listener>} args Arguments for the listener
   * @returns {boolean} True if a listener was called
   */
  emit(...args) {
    const fn = this.#listener
    if (!fn) return false
    fn(...args)
    return true
  }

  /**
   * Create a "connect method" you can expose as `onNewClient` etc.
   * The returned function is type-checked as (listener: Listener) => void.
   * @returns {(listener: Listener) => void} Function that connects a listener
   */
  connector() {
    // bind() keeps `this`, and the return type is enforced by the JSDoc above
    return this.connect.bind(this)
  }
}
