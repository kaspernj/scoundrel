// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("Client stack traces", () => {
  it("preserves the caller stack when the server rejects a command", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class ExplodingClass {
        boom() {
          throw new Error("Kaboom from server")
        }
      }

      serverClient.registerClass("ExplodingClass", ExplodingClass)

      const reference = await client.newObjectWithReference("ExplodingClass")
      const promise = reference.callMethod("boom")

      /** @type {Error | undefined} */
      let caughtError
      try {
        await promise
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError?.message).toContain("Kaboom from server")
      expect(caughtError?.stack).toContain("[SCOUNTDREL-SERVER]")
      expect(caughtError?.stack).toContain("[SCOUNDREL-CLIENT]")
      expect(caughtError?.stack).toContain("Command created at")
      expect(caughtError?.stack).toContain("ExplodingClass.boom")
      // Origin stack should reference this spec file (the command caller).
      expect(caughtError?.stack).toContain("client-stack-trace-spec.js")
    })
  })
})
