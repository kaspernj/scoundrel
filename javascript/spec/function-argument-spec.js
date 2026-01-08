// @ts-check

import Reference from "../src/client/reference.js"
import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("function arguments", () => {
  it("passes callback arguments as references to the client", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      const eventTarget = {
        listeners: {},
        addEventListener(eventName, callback) {
          this.listeners[eventName] = callback
        },
        trigger(eventName, payload) {
          const callback = this.listeners[eventName]
          if (!callback) throw new Error(`No listener for ${eventName}`)
          return callback(payload)
        }
      }

      serverClient.registerObject("eventTarget", eventTarget)

      const targetRef = await client.getObjectReference("eventTarget")

      let receivedArg
      let resolveReceived
      const receivedPromise = new Promise((resolve) => {
        resolveReceived = resolve
      })

      const handler = (arg1) => {
        receivedArg = arg1
        resolveReceived()
      }

      await targetRef.callMethodResult("addEventListener", "onTestEvent", handler)

      await targetRef.callMethodResult("trigger", "onTestEvent", {name: "Test"})
      await receivedPromise

      expect(receivedArg).toBeInstanceOf(Reference)

      const serialized = await receivedArg.serialize()
      expect(serialized).toEqual({name: "Test"})
    })
  })
})
