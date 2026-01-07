// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("serialize reference", () => {
  it("serializes plain objects and arrays", async () => {
    await runWithWebSocketServerClient(async ({client}) => {
      const arrayRef = await client.newObjectReference("Array")
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

      const reference = await client.newObjectReference("NonPlain")

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

  it("serializes undefined reference values as null", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class UndefinedReturner {
        method() {
          return undefined
        }
      }

      serverClient.registerClass("UndefinedReturner", UndefinedReturner)

      const reference = await client.newObjectReference("UndefinedReturner")
      const undefinedReference = await reference.callMethodReference("method")

      const result = await undefinedReference.serialize()

      expect(result).toBeNull()
    })
  })

  it("throws on unsupported types inside plain objects", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      serverClient.registerObject("objectWithFunction", {ok: true, nope: () => "bad"})

      const reference = await client.getObjectReference("objectWithFunction")

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
