// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript - server control", () => {
  describe("server control disabled", () => {
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
          const evaluatedArray = await serverClient.eval("(() => { const values = ['from client eval']; values.push('more values'); return values })()")

          await evaluatedArray.callMethod("push", "after eval")

          const result = await evaluatedArray.serialize()

          expect(result).toEqual(["from client eval", "more values", "after eval"])
        },
        {enableServerControl: true}
      )
    })

    it("makes registered objects and classes available inside eval", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          class TestGreeter {
            /** @param {string} prefix Greeting prefix */
            constructor(prefix) {
              this.prefix = prefix
            }

            /**
             * @param {string} name Name to greet
             * @returns {string} Greeting message
             */
            greet(name) {
              return `${this.prefix} ${name}`
            }
          }

          client.registerClass("TestGreeter", TestGreeter)
          client.registerObject("testSettings", {prefix: "Hello"})

          const evaluated = await serverClient.eval("(() => { const greeter = new TestGreeter(testSettings.prefix); return greeter.greet('World') })()")
          const result = await evaluated.serialize()

          expect(result).toEqual("Hello World")
        },
        {enableServerControl: true}
      )
    })

    it("rejects invalid scope names so eval fails loudly", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          client.registerObject("bad-name", {value: 123})
          client.registerObject("eval", {value: "shadow"})
          client.registerObject("this", {value: "also shadow"})
          await expectAsync(serverClient.eval("(() => 1 + 1)()")).toBeRejectedWithError(
            "Invalid registered identifier(s): bad-name, eval, this"
          )
        },
        {enableServerControl: true}
      )
    })

    it("returns results when eval result is true", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const result = await serverClient.eval({result: true}, "(() => 1 + 1)()")

          expect(result).toEqual(2)
        },
        {enableServerControl: true}
      )
    })

    it("returns references when eval reference is true", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const evaluated = await serverClient.eval({reference: true}, "(() => ({value: 123}))()")
          const result = await evaluated.serialize()

          expect(result).toEqual({value: 123})
        },
        {enableServerControl: true}
      )
    })

    it("rejects unknown eval options", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          await expectAsync(serverClient.eval(/** @type {any} */ ({unknownOption: true}), "(() => 1 + 1)()")).toBeRejectedWithError(
            "Unknown eval options: unknownOption"
          )
        },
        {enableServerControl: true}
      )
    })

    it("warns when using evalWithReference", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const warnSpy = spyOn(console, "warn")
          const evaluated = await serverClient.evalWithReference("(() => ({value: 10}))()")
          const result = await evaluated.serialize()

          expect(result).toEqual({value: 10})
          expect(warnSpy).toHaveBeenCalledWith("Scoundrel Client", "evalWithReference is deprecated; use eval instead.")
        },
        {enableServerControl: true}
      )
    })

    it("awaits async methods when calling them", async () => {
      await runWithWebSocketServerClient(
        async ({client, serverClient}) => {
          class AsyncGreeter {
            /**
             * @param {string} name Name to greet
             * @returns {Promise<string>} Greeting message
             */
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
            /**
             * @param {number} a First operand
             * @param {number} b Second operand
             * @returns {number} Sum of operands
             */
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
