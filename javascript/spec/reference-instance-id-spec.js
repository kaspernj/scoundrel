// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("reference instance ids", () => {
  it("tracks the owning instance id for references", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      const reference = await client.newObjectReference("Array")

      expect(reference.instanceId).toEqual(serverClient.instanceId)
    })
  })
})
