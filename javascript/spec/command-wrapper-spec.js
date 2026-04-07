// @ts-check

import {runWithWebSocketServerClient} from "./support/helpers/web-socket-server-client.js"

describe("scoundrel - command wrapper", () => {
  it("stores the wrapper function", async () => {
    await runWithWebSocketServerClient(async ({client}) => {
      /**
       * @param {() => Promise<any>} callback The method execution callback.
       * @returns {Promise<any>} The callback result.
       */
      const wrapper = async (callback) => await callback()

      client.setCommandWrapper(wrapper)

      expect(client._commandWrapper).toBe(wrapper)
    })
  })

  it("wraps method calls through the wrapper when set on the receiving side", async () => {
    await runWithWebSocketServerClient(
      async ({client, serverClient}) => {
        const calls = /** @type {string[]} */ ([])

        client.setCommandWrapper(async (callback) => {
          calls.push("before")
          const result = await callback()
          calls.push("after")

          return result
        })

        const arrayRef = await serverClient.newObjectReference("Array")

        await arrayRef.callMethodResult("push", "test1")
        await arrayRef.callMethodResult("push", "test2")

        expect(calls).toEqual(["before", "after", "before", "after"])
      },
      {enableServerControl: true}
    )
  })

  it("passes the actual method execution as the callback to the wrapper", async () => {
    await runWithWebSocketServerClient(
      async ({client, serverClient}) => {
        /** @type {any} */
        let capturedCallback = null

        client.setCommandWrapper(async (callback) => {
          capturedCallback = callback
          return await callback()
        })

        const arrayRef = await serverClient.newObjectReference("Array")
        const length = await arrayRef.callMethodResult("push", "hello")

        expect(length).toEqual(1)
        expect(typeof capturedCallback).toEqual("function")
      },
      {enableServerControl: true}
    )
  })

  it("allows the wrapper to modify execution context around the method call", async () => {
    await runWithWebSocketServerClient(
      async ({client, serverClient}) => {
        const executionLog = /** @type {string[]} */ ([])

        client.setCommandWrapper(async (callback) => {
          executionLog.push("wrapper-start")
          const result = await callback()
          executionLog.push("wrapper-end")

          return result
        })

        class TestService {
          /** @returns {string} Greeting message. */
          greet() {
            return "hello"
          }
        }

        client.registerClass("TestService", TestService)

        const serviceRef = await serverClient.newObjectReference("TestService")
        const result = await serviceRef.callMethodResult("greet")

        expect(result).toEqual("hello")
        expect(executionLog).toEqual(["wrapper-start", "wrapper-end"])
      },
      {enableServerControl: true}
    )
  })

  it("executes methods directly without a wrapper (backward compatible)", async () => {
    await runWithWebSocketServerClient(async ({client}) => {
      const arrayRef = await client.newObjectReference("Array")

      await arrayRef.callMethod("push", "test1")
      await arrayRef.callMethod("push", "test2")

      const result = await arrayRef.serialize()

      expect(result).toEqual(["test1", "test2"])
    })
  })

  it("wraps async method calls through the wrapper", async () => {
    await runWithWebSocketServerClient(
      async ({client, serverClient}) => {
        const executionLog = /** @type {string[]} */ ([])

        client.setCommandWrapper(async (callback) => {
          executionLog.push("wrapper-start")
          const result = await callback()
          executionLog.push("wrapper-end")

          return result
        })

        class AsyncService {
          /**
           * @param {string} name Name to greet
           * @returns {Promise<string>} Greeting message
           */
          async greet(name) {
            await Promise.resolve()
            return `Hello ${name}`
          }
        }

        client.registerClass("AsyncService", AsyncService)

        const serviceRef = await serverClient.newObjectReference("AsyncService")
        const greeting = await serviceRef.callMethodResult("greet", "World")

        expect(greeting).toEqual("Hello World")
        expect(executionLog).toEqual(["wrapper-start", "wrapper-end"])
      },
      {enableServerControl: true}
    )
  })
})
