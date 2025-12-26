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
        caughtError = error instanceof Error ? error : new Error(String(error))
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

  it("keeps non-ws node_modules frames in the combined stack", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class ExplodingClass {
        boom() {
          const error = new Error("Kaboom from server")
          error.stack = [
            "Error: Kaboom from server",
            "    at someLibrary (/home/dev/Development/scoundrel/javascript/node_modules/should-stay/lib.js:1:1)",
            "    at ExplodingClass.boom (/home/dev/Development/scoundrel/javascript/spec/client-stack-trace-spec.js:0:0)"
          ].join("\n")
          throw error
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
        caughtError = error instanceof Error ? error : new Error(String(error))
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError?.stack).toContain("node_modules/should-stay/lib.js")
    })
  })

  it("preserves application frames that include /internal/ while filtering node internals", async () => {
    await runWithWebSocketServerClient(async ({client, serverClient}) => {
      class ExplodingClass {
        boom() {
          const error = new Error("Kaboom from server")
          error.stack = [
            "Error: Kaboom from server",
            "    at internalHelper (/home/dev/Development/scoundrel/javascript/src/internal/helpers.js:12:3)",
            "    at nodeInternals (node:internal/process/task_queues:95:5)",
            "    at processTicksAndRejections (internal/process/task_queues.js:95:5)",
            "    at ExplodingClass.boom (/home/dev/Development/scoundrel/javascript/spec/client-stack-trace-spec.js:0:0)"
          ].join("\n")
          throw error
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
        caughtError = error instanceof Error ? error : new Error(String(error))
      }

      expect(caughtError).toBeInstanceOf(Error)
      expect(caughtError?.stack).toContain("src/internal/helpers.js")
      expect(caughtError?.stack).not.toContain("node:internal/process/task_queues")
      expect(caughtError?.stack).not.toContain("internal/process/task_queues.js")
    })
  })
})
