// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("static class methods", () => {
  it("calls static methods on a global class reference", async () => {
    await runWithWebSocketServerClient(async ({client}) => {
      const arrayClass = await client.getObjectReference("Array")
      const isArray = await arrayClass.callMethodResult("isArray", [])

      expect(isArray).toEqual(true)
    })
  })

  it("calls static methods on a registered class reference", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class StaticClass {
        /**
         * @param {string} name Name to greet
         * @returns {string} Greeting message
         */
        static greet(name) { return `Hello ${name}` }
      }

      serverClient.registerClass("StaticClass", StaticClass)

      const staticClassReference = await client.getObjectReference("StaticClass")
      const greeting = await staticClassReference.callMethodResult("greet", "World")

      expect(greeting).toEqual("Hello World")
    })
  })
})
