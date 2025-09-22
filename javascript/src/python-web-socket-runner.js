import {exec, spawn} from "child_process"
import Logger from "./logger.js"
import {realpath} from "node:fs/promises"

const logger = new Logger("Scoundrel PythonWebSocketRunner")

export default class PythonWebSocketRunner {
  constructor() {
    process.on("exit", this.onProcessExit)
  }

  runAndWaitForPid() {
    return new Promise((resolve) => {
      this.waitForPidResolve = resolve
      this.run()
    })
  }

  async run() {
    const filePath = `${process.cwd()}/../python/server/web-socket.py`
    const fileRealPath = await realpath(filePath)
    const child = spawn("python3", [fileRealPath])
    child.stdout.on("data", this.onChildStdout)
    child.stderr.on("data", this.onChildStderr)
  }

  onProcessExit = () => {
    if (this.pid) {
      this.close()
      logger.log(() => `onProcessExit: Killing Python process with PID ${this.pid}`)
    }
  }

  onChildStderr = (data) => {
    logger.log(() => `stderr: ${data}`)
  }

  onChildStdout = (data) => {
    logger.log(() => `stdout: ${data}`)

    const match = (`${data}`).match(/^Started with PID (\d+) on (.+):(.+)\n$/)

    if (match) {
      this.pid = match[1]

      logger.log(() => `Registered PID ${this.pid}`)

      if (this.waitForPidResolve) {
        this.waitForPidResolve()
        this.waitForPidResolve = undefined
      }
    }
  }

  close() {
    if (this.pid) {
      exec(`kill ${this.pid}`)
    }
  }
}
