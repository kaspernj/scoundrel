import {exec, spawn} from "child_process"
import Logger from "./logger.js"
import {realpath} from "node:fs/promises"

const logger = new Logger("Scoundrel PythonWebSocketRunner")

// logger.setDebug(true)

export default class PythonWebSocketRunner {
  constructor() {
    process.on("exit", this.onProcessExit)
  }

  runAndWaitForPid() {
    return new Promise((resolve, reject) => {
      this.waitForPidResolve = resolve
      this.waitForPidReject = reject
      this.run()
    })
  }

  async run() {
    const filePath = `${process.cwd()}/../python/server/web-socket.py`
    const fileRealPath = await realpath(filePath)
    const child = spawn("python3", [fileRealPath])

    child.on("exit", this.onChildExit)
    child.stdout.on("data", this.onChildStdout)
    child.stderr.on("data", this.onChildStderr)
  }

  onProcessExit = () => {
    if (this.pid) {
      this.close()
      logger.log(() => `onProcessExit: Killing Python process with PID ${this.pid}`)
    }
  }

  onChildExit = (code, signal) => {
    logger.log(() => `Child process exited with code ${code} and signal ${signal}`)

    if (this.waitForPidRejectError) {
      this.waitForPidReject(this.waitForPidRejectError)
      this.waitForPidResolve = null
      this.waitForPidReject = null
      this.waitForPidRejectError = null
    } else if (this.waitForPidReject) {
      this.waitForPidReject(new Error(`Python process exited before PID was received (code: ${code}, signal: ${signal})`))
      this.waitForPidResolve = null
      this.waitForPidReject = null
      this.waitForPidRejectError = null
    }
  }

  onChildStderr = (data) => {
    logger.error(() => `stderr: ${data}`)

    if (this.waitForPidReject) {
      this.waitForPidRejectError = new Error(`Python process stderr before PID was received: ${data}`)
    }
  }

  onChildStdout = (data) => {
    logger.log(() => `stdout: ${data}`)

    const match = (`${data}`).match(/^Started with PID (\d+) on (.+):(.+)\n$/)

    if (match) {
      this.pid = match[1]

      logger.log(() => `Registered PID ${this.pid}`)

      if (this.waitForPidResolve) {
        this.waitForPidResolve()
        this.waitForPidResolve = null
        this.waitForPidReject = null
        this.waitForPidRejectError = null
      }
    }
  }

  close() {
    if (this.pid) {
      exec(`kill ${this.pid}`)
    }
  }
}
