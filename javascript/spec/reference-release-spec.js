// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("reference releases", () => {
  const canForceGc = () =>
    typeof globalThis.WeakRef === "function" &&
    typeof globalThis.FinalizationRegistry === "function" &&
    typeof globalThis.gc === "function"

  const waitForRelease = async (client, serverClient, objectId) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      globalThis.gc()
      await new Promise((resolve) => setImmediate(resolve))

      await client.getObjectResult("Math")

      if (!serverClient.objects[objectId]) return true

      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    return false
  }

  it("sends released reference ids with the next command", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      const arrayRef = await client.newObjectReference("Array")
      const objectId = arrayRef.id

      expect(serverClient.objects[objectId]).toBeDefined()

      client.queueReleasedReference(objectId)
      await client.getObjectResult("Math")

      expect(serverClient.objects[objectId]).toBeUndefined()
    })
  })

  it("releases references after GC when supported", async () => {
    if (!canForceGc()) return

    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      let objectId

      let arrayRef = await client.newObjectReference("Array")
      objectId = arrayRef.id
      arrayRef = null

      const churn = Array.from({length: 2000}, () => "x".repeat(512))

      const released = await waitForRelease(client, serverClient, objectId)

      expect(released).toBeTrue()
      expect(serverClient.objects[objectId]).toBeUndefined()
      expect(churn.length).toBe(2000)
    })
  })

  it("releases callback references after GC when supported", async () => {
    if (!canForceGc()) return

    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      const eventTarget = {
        listener: null,
        addEventListener(_name, callback) {
          this.listener = callback
        },
        removeEventListener() {
          this.listener = null
        }
      }

      serverClient.registerObject("eventTarget", eventTarget)

      const targetRef = await client.getObjectReference("eventTarget")
      const handler = () => {}

      await targetRef.callMethodResult("addEventListener", "onTestEvent", handler)

      const functionIds = Object.keys(client.objects).map((id) => Number(id))
      expect(functionIds.length).toBe(1)

      const functionId = functionIds[0]
      expect(client.objects[functionId]).toBeDefined()

      await targetRef.callMethodResult("removeEventListener", "onTestEvent")

      let released = false
      for (let attempt = 0; attempt < 20; attempt += 1) {
        globalThis.gc()
        await new Promise((resolve) => setImmediate(resolve))

        await serverClient.getObjectResult("Math")

        if (!client.objects[functionId]) {
          released = true
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 25))
      }

      expect(released).toBeTrue()
    })
  })
})
