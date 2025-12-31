// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript - return options", () => {
  describe("server control disabled", () => {
    it("returns a proxy when callMethod is used", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        const lengthProxy = await stringObject.callMethod("push", "test1")
        const length = await lengthProxy.__serialize()

        expect(length).toEqual(1)
      })
    })

    it("returns a reference when callMethodReference is used", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        const lengthRef = await stringObject.callMethodReference("push", "test1")
        const length = await lengthRef.serialize()

        expect(length).toEqual(1)
      })
    })

    it("returns a result when callMethodResult is used", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        const length = await stringObject.callMethodResult("push", "test1")

        expect(length).toEqual(1)
      })
    })

    it("returns a proxy when readAttribute is used", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        await stringObject.callMethodResult("push", "test1")

        const valueProxy = await stringObject.readAttribute(0)
        const upper = await (await valueProxy.toUpperCase()).__serialize()

        expect(upper).toEqual("TEST1")
      })
    })

    it("returns a reference when readAttributeReference is used", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        await stringObject.callMethodResult("push", "test1")

        const valueRef = await stringObject.readAttributeReference(0)
        const value = await valueRef.serialize()

        expect(value).toEqual("test1")
      })
    })

    it("returns a result when readAttributeResult is used", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectReference("Array")

        await stringObject.callMethodResult("push", "test1")

        const value = await stringObject.readAttributeResult(0)

        expect(value).toEqual("test1")
      })
    })
  })
})
