// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("serialize reference", () => {
  it("serializes plain objects and arrays", async () => {
    await runWithWebSocketServerClient(async ({client}) => {
      const arrayRef = await client.newObjectWithReference("Array")
      await arrayRef.callMethod("push", {foo: ["bar", 1, false]})

      const result = await arrayRef.serialize()

      expect(result).toEqual([{foo: ["bar", 1, false]}])
    })
  })

  it("throws on non-plain objects", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class NonPlain {
        constructor() {
          this.message = "nope"
        }
      }

      serverClient.registerClass("NonPlain", NonPlain)

      const reference = await client.newObjectWithReference("NonPlain")

      /** @type {Error | undefined} */
      let caughtError
      try {
        await reference.serialize()
      } catch (error) {
        caughtError = error instanceof Error ? error : new Error(String(error))
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError?.message).toContain("NonPlain")
      expect(caughtError?.message).toContain("non-plain object")
    })
  })

  it("throws on unsupported types inside plain objects", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      serverClient.registerObject("objectWithFunction", {ok: true, nope: () => "bad"})

      const reference = await client.getObject("objectWithFunction")

      /** @type {Error | undefined} */
      let caughtError
      try {
        await reference.serialize()
      } catch (error) {
        caughtError = error instanceof Error ? error : new Error(String(error))
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError?.message).toContain("function")
      expect(caughtError?.message).toContain("value.nope")
    })
  })
})
