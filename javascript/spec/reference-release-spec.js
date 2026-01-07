// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("reference releases", () => {
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
})
