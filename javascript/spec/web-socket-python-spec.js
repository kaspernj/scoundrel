import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import PythonWebSocketRunner from "../src/python-web-socket-runner.js"
import {WebSocket} from "ws"

const shared = {}

describe("scoundrel - web-socket - python", () => {
  beforeEach(async () => {
    shared.pythonWebSocketRunner = new PythonWebSocketRunner()

    await shared.pythonWebSocketRunner.runAndWaitForPid()

    const ws = new WebSocket("http://localhost:8081")
    const clientWebSocket = new ClientWebSocket(ws)

    await clientWebSocket.waitForOpened()

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
