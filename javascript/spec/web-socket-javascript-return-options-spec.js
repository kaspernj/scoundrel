// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript - return options", () => {
  describe("server control disabled", () => {
    it("returns a reference when callMethod reference is true", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        const lengthRef = await stringObject.callMethod("push", {reference: true}, "test1")
        const length = await lengthRef.serialize()

        expect(length).toEqual(1)
      })
    })

    it("returns a proxy when callMethod reference and proxy are true", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        const lengthProxy = await stringObject.callMethod("push", {reference: true, proxy: true}, "test1")

        // @ts-ignore
        const asString = await lengthProxy.toString()

        expect(asString).toEqual("1")
      })
    })

    it("returns a result when callMethod result is true", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        const length = await stringObject.callMethod("push", {result: true}, "test1")

        expect(length).toEqual(1)
      })
    })

    it("rejects unknown callMethod options", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await expectAsync(
          stringObject.callMethod("push", {reference: true, unknownOption: true}, "test1")
        ).toBeRejectedWithError("Unknown callMethodOnReference options: unknownOption")
      })
    })

    it("rejects callMethod proxy without reference", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await expectAsync(
          stringObject.callMethod("push", {proxy: true}, "test1")
        ).toBeRejectedWithError("callMethodOnReference option proxy requires reference to be true")
      })
    })

    it("returns a proxy when readAttribute reference and proxy are true", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")

        const valueProxy = await stringObject.readAttribute({reference: true, proxy: true}, 0)

        // @ts-ignore
        const upper = await valueProxy.toUpperCase()

        expect(upper).toEqual("TEST1")
      })
    })

    it("returns a result when readAttribute result is true", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")

        const firstValue = await stringObject.readAttribute({result: true}, 0)

        expect(firstValue).toEqual("test1")
      })
    })

    it("rejects unknown readAttribute options", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")

        await expectAsync(
          stringObject.readAttribute({reference: true, unknownOption: true}, 0)
        ).toBeRejectedWithError("Unknown readAttributeOnReference options: unknownOption")
      })
    })

    it("rejects readAttribute proxy without reference", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")

        await expectAsync(
          stringObject.readAttribute({result: true, proxy: true}, 0)
        ).toBeRejectedWithError("readAttributeOnReference option proxy requires reference to be true")
      })
    })
  })
})
