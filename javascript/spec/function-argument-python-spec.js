// @ts-check

import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Logger from "../src/logger.js"
import PythonWebSocketRunner from "../src/python-web-socket-runner.js"
import Reference from "../src/client/reference.js"
import {WebSocket} from "ws"

const shared = {}
const logger = new Logger("Scoundrel WebSocket Python Function Args Spec")

describe("scoundrel - web-socket - python - function args", () => {
  beforeEach(async () => {
    logger.log("Starting Python with client")
    shared.pythonWebSocketRunner = new PythonWebSocketRunner()

    logger.log("Running Python WebSocket runner and waiting for PID")
    await shared.pythonWebSocketRunner.runAndWaitForPid()

    logger.log("Starting WebSocket client connection")
    const ws = new WebSocket("ws://localhost:53874")

    logger.log("Creating ClientWebSocket")
    const clientWebSocket = new ClientWebSocket(ws)

    logger.log("Waiting for WebSocket to open")
    await clientWebSocket.waitForOpened()

    logger.log("Creating Scoundrel Client")
    shared.client = new Client(clientWebSocket)
  })

  afterEach(async () => {
    shared.client?.close()
    shared.pythonWebSocketRunner?.close()
  })

  it("passes callback arguments as references to the client", async () => {
    const targetRef = await shared.client.newObjectReference("CallbackTarget")

    let receivedArg
    let resolveReceived
    const receivedPromise = new Promise((resolve) => {
      resolveReceived = resolve
    })

    const handler = (arg1) => {
      receivedArg = arg1
      resolveReceived()
    }

    await targetRef.callMethodResult("addEventListener", "onTestEvent", handler)
    await targetRef.callMethodResult("trigger", "onTestEvent", {name: "Test"})
    await receivedPromise

    expect(receivedArg).toBeInstanceOf(Reference)

    const serialized = await receivedArg.serialize()
    expect(serialized).toEqual({name: "Test"})
  })
})
