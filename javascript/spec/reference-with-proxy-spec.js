// @ts-check

import referenceWithProxy from "../src/client/reference-proxy.js"
import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("referenceWithProxy", () => {
  describe("server control disabled", () => {
    it("creates a reference with a proxy", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObjectReference = await client.newObjectReference("Array")
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
        const testArray = await client.newObjectReference("Array")

        await testArray.callMethod("push", "test1")
        await testArray.callMethod("push", "test2")

        const result = await testArray.serialize()

        expect(result).toEqual(["test1", "test2"])

        const firstValue = await testArray.readAttributeResult(0)
        const secondValue = await testArray.readAttributeResult(1)

        expect(firstValue).toEqual("test1")
        expect(secondValue).toEqual("test2")
      })
    })

    it("awaits attributes via the proxy", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const arrayReference = await client.newObjectReference("Array")
        const arrayProxy = referenceWithProxy(arrayReference)

        // @ts-ignore
        await arrayProxy.push("test1")

        // @ts-ignore
        await arrayProxy.push("test2")

        // @ts-ignore
        const firstValue = await arrayProxy[0]

        // @ts-ignore
        const lengthValue = await arrayProxy.length

        expect(firstValue).toEqual("test1")
        expect(lengthValue).toEqual(2)
      })
    })

    it("awaits method results via the proxy", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const arrayReference = await client.newObjectReference("Array")
        const arrayProxy = referenceWithProxy(arrayReference)

        // @ts-ignore
        await arrayProxy.push("test1")

        // @ts-ignore
        await arrayProxy.push("test2")

        // @ts-ignore
        const lastValue = await (await arrayProxy.pop()).__serialize()

        // @ts-ignore
        const remainingLength = await arrayProxy.length

        expect(lastValue).toEqual("test2")
        expect(remainingLength).toEqual(1)
      })
    })

    it("chains proxy calls with a single await", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const arrayReference = await client.newObjectReference("Array")
        const arrayProxy = referenceWithProxy(arrayReference)

        // @ts-ignore
        const result = await arrayProxy
          .__chain()
          .push("test1")
          .push("test2")
          .join(",")

        expect(result).toEqual("test1,test2")
      })
    })

    it("calls methods", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObjectReference = await client.newObjectReference("Array")
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
          const stringObjectReference = await serverClient.newObjectReference("Array")
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
