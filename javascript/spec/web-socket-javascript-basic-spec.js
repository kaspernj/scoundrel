// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript - basic", () => {
  describe("server control disabled", () => {
    it("creates a server and connects to it with the client", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        await stringObject.callMethod("push", "test1")
        await stringObject.callMethod("push", "test2")

        const result = await stringObject.serialize()

        expect(result).toEqual(["test1", "test2"])
      })
    })

    it("returns a proxy by default for newObject", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const arrayProxy = await client.newObject("Array")

        // @ts-ignore
        await arrayProxy.push("test1")

        // @ts-ignore
        const length = await arrayProxy.length

        expect(length).toEqual(1)
      })
    })

    it("returns results from method calls", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        await stringObject.callMethod("push", "test1")
        await stringObject.callMethod("push", "test2")

        const result = await stringObject.callMethodResult("join", ", ")

        expect(result).toEqual("test1, test2")
      })
    })

    it("handles errors from method calls", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        /** @type {Error | null} */
        let caughtError = null

        try {
          await stringObject.callMethodResult("nonExistentMethod")
        } catch (error) {
          caughtError = error instanceof Error ? error : new Error(String(error))
        }

        expect(caughtError).not.toBeNull()
        expect(caughtError).toBeInstanceOf(Error)
        expect(caughtError && caughtError.message).toEqual("No method called 'nonExistentMethod' on a 'Array'")
      })
    })
  })
})
