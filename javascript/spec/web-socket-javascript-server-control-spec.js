// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - web-socket - javascript - server control", () => {
  describe("server control disabled", () => {
    it("rejects server control when not enabled on the client", async () => {
        await runWithWebSocketServerClient(async ({serverClient}) => {
          await expectAsync(serverClient.newObjectReference("Array")).toBeRejectedWithError("Server control is disabled")
        })
    })
  })

  describe("server control enabled", () => {
    it("lets the server eval code on the client", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const evaluatedArray = await serverClient.eval("(() => { const values = ['from client eval']; values.push('more values'); return values })()")

          await evaluatedArray.push("after eval")

          const result = await evaluatedArray.__serialize()

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

          const result = await serverClient.evalResult(
            "(() => { const greeter = new TestGreeter(testSettings.prefix); return greeter.greet('World') })()"
          )

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

    it("returns results when evalResult is used", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const result = await serverClient.evalResult("(() => 1 + 1)()")

          expect(result).toEqual(2)
        },
        {enableServerControl: true}
      )
    })

    it("supports raw eval blocks that return a value", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const result = await serverClient.evalResult(`
            const value = 5
            return value * 2
          `)

          expect(result).toEqual(10)
        },
        {enableServerControl: true}
      )
    })

    it("awaits async eval blocks and returns the resolved value", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const result = await serverClient.evalResult(`
            const value = await Promise.resolve(7)
            return value + 1
          `)

          expect(result).toEqual(8)
        },
        {enableServerControl: true}
      )
    })

    it("supports async eval blocks with return values when using eval", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const evaluatedArray = await serverClient.eval(`
            const values = await Promise.resolve(["from client eval"])
            values.push("after await")
            return values
          `)

          const result = await evaluatedArray.__serialize()

          expect(result).toEqual(["from client eval", "after await"])
        },
        {enableServerControl: true}
      )
    })

    it("returns references when evalReference is used", async () => {
      await runWithWebSocketServerClient(
        async ({serverClient}) => {
          const evaluated = await serverClient.evalReference("(() => ({value: 123}))()")
          const result = await evaluated.serialize()

          expect(result).toEqual({value: 123})
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

          const reference = await serverClient.newObjectReference("AsyncGreeter")
          const greeting = await reference.callMethodResult("customMethod", "World")

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

          const mathRef = await serverClient.getObjectReference("TestMath")
          const sum = await mathRef.callMethodResult("add", 1, 2)
          expect(sum).toEqual(3)

          const settingsRef = await serverClient.getObjectReference("testSettings")
          const settings = await settingsRef.serialize()
          expect(settings).toEqual({value: 42})

          client.unregisterClass("TestMath")
          client.unregisterObject("testSettings")

          await expectAsync(serverClient.getObjectReference("TestMath")).toBeRejectedWithError("No such object: TestMath")
          await expectAsync(serverClient.getObjectReference("testSettings")).toBeRejectedWithError("No such object: testSettings")
        },
        {enableServerControl: true}
      )
    })
  })
})
