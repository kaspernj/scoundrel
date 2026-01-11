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
      expect(caughtError?.message).toBe("Cannot serialize non-plain object 'NonPlain' at value")
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

  it("serializes bigint values as numbers", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      serverClient.registerObject("bigIntObject", {count: 42n})

      const reference = await client.getObjectReference("bigIntObject")
      const result = await reference.serialize()

      expect(result).toEqual({count: 42})
    })
  })

  it("serializes a bigint reference value as a number", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class BigIntReturner {
        method() {
          return 7n
        }
      }

      serverClient.registerClass("BigIntReturner", BigIntReturner)

      const reference = await client.newObjectReference("BigIntReturner")
      const bigIntReference = await reference.callMethodReference("method")

      const result = await bigIntReference.serialize()

      expect(result).toBe(7)
    })
  })

  it("serializes date values", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      const createdAt = new Date("2024-01-02T03:04:05.000Z")
      serverClient.registerObject("dateObject", {createdAt})

      const reference = await client.getObjectReference("dateObject")
      const result = await reference.serialize()

      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.createdAt.toISOString()).toBe("2024-01-02T03:04:05.000Z")
    })
  })

  it("serializes regex values", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      serverClient.registerObject("regexObject", {matcher: /scoundrel/gi})

      const reference = await client.getObjectReference("regexObject")
      const result = await reference.serialize()

      expect(result.matcher).toBeInstanceOf(RegExp)
      expect(result.matcher.source).toBe("scoundrel")
      expect(result.matcher.flags).toBe("gi")
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
      expect(caughtError?.message).toBe("Cannot serialize function at value.nope")
    })
  })

  it("throws when the reference resolves to a function", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class FunctionReturner {
        method() {
          return () => "bad"
        }
      }

      serverClient.registerClass("FunctionReturner", FunctionReturner)

      const reference = await client.newObjectReference("FunctionReturner")
      const functionReference = await reference.callMethodReference("method")

      /** @type {Error | undefined} */
      let caughtError
      try {
        await functionReference.serialize()
      } catch (error) {
        caughtError = error instanceof Error ? error : new Error(String(error))
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError?.message).toBe("Cannot serialize function at value")
    })
  })
})
