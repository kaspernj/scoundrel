import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Logger from "../src/logger.js"
import PythonWebSocketRunner from "../src/python-web-socket-runner.js"
import {WebSocket} from "ws"

const shared = {}
const logger = new Logger("Scoundrel WebSocket Python Spec")

describe("scoundrel - web-socket - python", () => {
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

  it("creates a server and connects to it with the client", async () => {
    const stringObject = await shared.client.newObjectWithReference("[]")

    await stringObject.callMethod("append", "test1")
    await stringObject.callMethod("append", "test2")

    const result = await stringObject.serialize()

    expect(result).toEqual(["test1", "test2"])
  })

  it("imports classes and uses them", async () => {
    const math = await shared.client.import("math")
    const pi = await math.readAttributeWithReference("pi")
    const cosOfPi = await math.callMethodWithReference("cos", pi)
    const result = await cosOfPi.serialize()

    expect(result).toEqual(-1)
  })
})
