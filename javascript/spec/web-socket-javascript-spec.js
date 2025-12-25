// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript", () => {
  describe("server control disabled", () => {
    it("creates a server and connects to it with the client", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")
        await stringObject.callMethod("push", "test2")

        const result = await stringObject.serialize()

        expect(result).toEqual(["test1", "test2"])
      })
    })

    it("returns results from method calls", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")
        await stringObject.callMethod("push", "test2")

        const result = await stringObject.callMethod("join", ", ")

        expect(result).toEqual("test1, test2")
      })
    })

    it("handles errors from method calls", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        let caughtError = null

        try {
          await stringObject.callMethod("nonExistentMethod")
        } catch (error) {
          caughtError = error
        }

        expect(caughtError).toBeInstanceOf(Error)
        expect(caughtError.message).toEqual("No method called 'nonExistentMethod' on a 'Array'")
      })
    })

    it("rejects server control when not enabled on the client", async () => {
      await runWithWebSocketServerClient(async ({serverClient}) => {
        await expectAsync(serverClient.newObjectWithReference("Array")).toBeRejectedWithError("Server control is disabled")
      })
    })
  })

  describe("server control enabled", () => {
    it("lets the server eval code on the client", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const evaluatedArray = await serverClient.evalWithReference("(() => { const values = ['from client eval']; values.push('more values'); return values })()")

          await evaluatedArray.callMethod("push", "after eval")

          const result = await evaluatedArray.serialize()

          expect(result).toEqual(["from client eval", "more values", "after eval"])
        },
        {enableServerControl: true}
      )
    })
  })
})
