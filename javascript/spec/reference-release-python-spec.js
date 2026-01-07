// @ts-check

import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Logger from "../src/logger.js"
import PythonWebSocketRunner from "../src/python-web-socket-runner.js"
import {WebSocket} from "ws"

const shared = {}
const logger = new Logger("Scoundrel WebSocket Python Release Spec")

describe("scoundrel - web-socket - python - reference release", () => {
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

  it("drops released references on the Python server", async () => {
    const listRef = await shared.client.newObjectReference("[]")
    const objectId = listRef.id

    await listRef.callMethodResult("append", "test1")

    shared.client.queueReleasedReference(objectId)
    await shared.client.newObjectReference("[]")

    let errorMessage
    try {
      await listRef.readAttributeResult(0)
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error)
    }

    expect(errorMessage).toBeTruthy()
  })
})
