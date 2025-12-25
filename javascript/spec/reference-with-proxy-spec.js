// @ts-check

import referenceWithProxy from "../src/client/reference-proxy.js"
import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("referenceWithProxy", () => {
  describe("server control disabled", () => {
    it("creates a reference with a proxy", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObjectReference = await client.newObjectWithReference("Array")
        const stringObject = referenceWithProxy(stringObjectReference)

        // @ts-ignore
        await stringObject.push("test1")

        // @ts-ignore
        await stringObject.push("test2")

        // @ts-ignore
        const result = await stringObject.__serialize()

        expect(result).toEqual(["test1", "test2"])
      })
    })

    it("reads attributes from a reference", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const testArray = await client.newObjectWithReference("Array")

        await testArray.callMethod("push", "test1")
        await testArray.callMethod("push", "test2")

        const result = await testArray.serialize()

        expect(result).toEqual(["test1", "test2"])

        const firstValue = await testArray.readAttribute(0)
        const secondValue = await testArray.readAttribute(1)

        expect(firstValue).toEqual("test1")
        expect(secondValue).toEqual("test2")
      })
    })

    it("calls methods", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObjectReference = await client.newObjectWithReference("Array")
        const stringObject = referenceWithProxy(stringObjectReference)

        // @ts-ignore
        await stringObject.push("test1")

        // @ts-ignore
        await stringObject.push("test2")

        // @ts-ignore
        const result = await stringObject.__serialize()

        expect(result).toEqual(["test1", "test2"])
      })
    })
  })

  describe("server control enabled", () => {
    it("calls methods on the client from the server", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const stringObjectReference = await serverClient.newObjectWithReference("Array")
          const stringObject = referenceWithProxy(stringObjectReference)

          // @ts-ignore
          await stringObject.push("test1")

          // @ts-ignore
          await stringObject.push("test2")

          // @ts-ignore
          const result = await stringObject.__serialize()

          expect(result).toEqual(["test1", "test2"])
        },
        {enableServerControl: true}
      )
    })
  })
})
