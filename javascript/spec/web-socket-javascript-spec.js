// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript", () => {
  describe("server control disabled", () => {
    it("creates a server and connects to it with the client", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")
        await stringObject.callMethod("push", "test2")

        const result = await stringObject.serialize()

        expect(result).toEqual(["test1", "test2"])
      })
    })

    it("returns results from method calls", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        await stringObject.callMethod("push", "test1")
        await stringObject.callMethod("push", "test2")

        const result = await stringObject.callMethod("join", ", ")

        expect(result).toEqual("test1, test2")
      })
    })

    it("handles errors from method calls", async () => {
      await runWithWebSocketServerClient(async ({client}) => {
        const stringObject = await client.newObjectWithReference("Array")

        /** @type {Error | null} */
        let caughtError = null

        try {
          await stringObject.callMethod("nonExistentMethod")
        } catch (error) {
          caughtError = error instanceof Error ? error : new Error(String(error))
        }

        expect(caughtError).not.toBeNull()
        expect(caughtError).toBeInstanceOf(Error)
        expect(caughtError && caughtError.message).toEqual("No method called 'nonExistentMethod' on a 'Array'")
      })
    })

    it("rejects server control when not enabled on the client", async () => {
      await runWithWebSocketServerClient(async ({serverClient}) => {
        await expectAsync(serverClient.newObjectWithReference("Array")).toBeRejectedWithError("Server control is disabled")
      })
    })
  })

  describe("server control enabled", () => {
    it("lets the server eval code on the client", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const evaluatedArray = await serverClient.evalWithReference("(() => { const values = ['from client eval']; values.push('more values'); return values })()")

          await evaluatedArray.callMethod("push", "after eval")

          const result = await evaluatedArray.serialize()

          expect(result).toEqual(["from client eval", "more values", "after eval"])
        },
        {enableServerControl: true}
      )
    })

    it("makes registered objects and classes available inside evalWithReference", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          class TestGreeter {
            /** @param {string} prefix */
            constructor(prefix) {
              this.prefix = prefix
            }

            /** @param {string} name */
            greet(name) {
              return `${this.prefix} ${name}`
            }
          }

          client.registerClass("TestGreeter", TestGreeter)
          client.registerObject("testSettings", {prefix: "Hello"})

          const evaluated = await serverClient.evalWithReference("(() => { const greeter = new TestGreeter(testSettings.prefix); return greeter.greet('World') })()")
          const result = await evaluated.serialize()

          expect(result).toEqual("Hello World")
        },
        {enableServerControl: true}
      )
    })

    it("rejects invalid scope names so evalWithReference fails loudly", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          client.registerObject("bad-name", {value: 123})
          client.registerObject("eval", {value: "shadow"})
          client.registerObject("this", {value: "also shadow"})
          await expectAsync(serverClient.evalWithReference("(() => 1 + 1)()")).toBeRejectedWithError(
            "Invalid registered identifier(s): bad-name, eval, this"
          )
        },
        {enableServerControl: true}
      )
    })

    it("awaits async methods when calling them", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          class AsyncGreeter {
            /** @param {string} name */
            async customMethod(name) {
              await Promise.resolve()
              return `Hello ${name}`
            }
          }

          client.registerClass("AsyncGreeter", AsyncGreeter)

          const reference = await serverClient.newObjectWithReference("AsyncGreeter")
          const greeting = await reference.callMethod("customMethod", "World")

          expect(greeting).toEqual("Hello World")
        },
        {enableServerControl: true}
      )
    })

    it("unregisters classes and objects so they cannot be fetched", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          class TestMath {
            /** @param {number} a @param {number} b */
            static add(a, b) {
              return a + b
            }
          }

          client.registerClass("TestMath", TestMath)
          client.registerObject("testSettings", {value: 42})

          const mathRef = await serverClient.getObject("TestMath")
          const sum = await mathRef.callMethod("add", 1, 2)
          expect(sum).toEqual(3)

          const settingsRef = await serverClient.getObject("testSettings")
          const settings = await settingsRef.serialize()
          expect(settings).toEqual({value: 42})

          client.unregisterClass("TestMath")
          client.unregisterObject("testSettings")

          await expectAsync(serverClient.getObject("TestMath")).toBeRejectedWithError("No such object: TestMath")
          await expectAsync(serverClient.getObject("testSettings")).toBeRejectedWithError("No such object: testSettings")
        },
        {enableServerControl: true}
      )
    })
  })
})
