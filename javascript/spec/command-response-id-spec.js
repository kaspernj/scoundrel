// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("command responses", () => {
  it("responds using the incoming command ID even after server-initiated commands", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      await expectAsync(serverClient.sendCommand("get_object", {object_name: "Math"})).toBeRejected()

      const arrayReference = await client.newObjectWithReference("Array")
      const length = await arrayReference.readAttribute("length")

      expect(length).toEqual(0)
    })
  })
})
