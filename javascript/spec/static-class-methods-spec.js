// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("static class methods", () => {
  it("calls static methods on a global class reference", async () => {
    await runWithWebSocketServerClient(async ({client}) => {
      const arrayClass = await client.getObject("Array")
      const isArray = await arrayClass.callMethod("isArray", [])

      expect(isArray).toEqual(true)
    })
  })

  it("calls static methods on a registered class reference", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class StaticClass {
        /** @param {string} name */
        static greet(name) { return `Hello ${name}` }
      }

      serverClient.registerClass("StaticClass", StaticClass)

      const staticClassReference = await client.getObject("StaticClass")
      const greeting = await staticClassReference.callMethod("greet", "World")

      expect(greeting).toEqual("Hello World")
    })
  })
})
