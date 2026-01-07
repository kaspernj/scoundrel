// @ts-check

import Client from "../src/client/index.js"
import ClientWebSocket from "../src/client/connections/web-socket/index.js"
import Logger from "../src/logger.js"
import PythonWebSocketRunner from "../src/python-web-socket-runner.js"
import referenceWithProxy from "../src/client/reference-proxy.js"
import {WebSocket} from "ws"

const shared = {}
const logger = new Logger("Scoundrel WebSocket Python Proxy Spec")

describe("scoundrel - web-socket - python - reference proxies", () => {
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

  it("creates a reference with a proxy", async () => {
    const listReference = await shared.client.newObjectReference("[]")
    const listProxy = referenceWithProxy(listReference)

    // @ts-ignore
    await listProxy.append("test1")
    // @ts-ignore
    await listProxy.append("test2")

    // @ts-ignore
    const result = await listProxy.__serialize()

    expect(result).toEqual(["test1", "test2"])
  })

  it("reads attributes from a reference", async () => {
    const listReference = await shared.client.newObjectReference("[]")

    await listReference.callMethodResult("append", "test1")
    await listReference.callMethodResult("append", "test2")

    const result = await listReference.serialize()

    expect(result).toEqual(["test1", "test2"])

    const firstValue = await listReference.readAttributeResult(0)
    const secondValue = await listReference.readAttributeResult(1)

    expect(firstValue).toEqual("test1")
    expect(secondValue).toEqual("test2")

    const lengthValue = await listReference.readAttributeResult("length")
    expect(lengthValue).toEqual(2)
  })

  it("awaits attributes via the proxy", async () => {
    const listReference = await shared.client.newObjectReference("[]")
    const listProxy = referenceWithProxy(listReference)

    // @ts-ignore
    await listProxy.append("test1")
    // @ts-ignore
    await listProxy.append("test2")

    // @ts-ignore
    const firstValue = await listProxy[0]
    // @ts-ignore
    const lengthValue = await listProxy.length

    expect(firstValue).toEqual("test1")
    expect(lengthValue).toEqual(2)
  })

  it("awaits method results via the proxy", async () => {
    const listReference = await shared.client.newObjectReference("[]")
    const listProxy = referenceWithProxy(listReference)

    // @ts-ignore
    await listProxy.append("test1")
    // @ts-ignore
    await listProxy.append("test2")

    // @ts-ignore
    const lastValue = await (await listProxy.pop()).__serialize()
    // @ts-ignore
    const remainingLength = await listProxy.length

    expect(lastValue).toEqual("test2")
    expect(remainingLength).toEqual(1)
  })

  it("chains proxy calls with a single await", async () => {
    const listReference = await shared.client.newObjectReference("[]")
    const listProxy = referenceWithProxy(listReference)

    // @ts-ignore
    const result = await listProxy
      .__chain()
      .append("test1")
      .append("test2")
      .__len__()

    expect(result).toEqual(2)
  })
})
