import {exec, spawn} from "child_process"
import {realpath} from "node:fs/promises"

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

    console.log("Spawning")
    const child = spawn("python3", [fileRealPath])

    console.log("Hooking output")
    child.stdout.on("data", this.onChildStdout)
    child.stderr.on("data", this.onChildStderr)

    console.log("Done")
  }

  onProcessExit = () => {
    if (this.pid) {
      this.close()
      console.log(`onProcessExit: Killing Python process with PID ${this.pid}`)
    } else {
      console.log("onProcessExit: No Python process to kill")
    }
  }

  onChildStderr = (data) => {
    console.log("onChildStderr")
    console.log(`stderr: ${data}`)
  }

  onChildStdout = (data) => {
    console.log("onChildStdout")
    console.log(`stdout: ${data}`)

    const match = (`${data}`).match(/^Started with PID (\d+)\n$/)

    if (match) {
      this.pid = match[1]

      console.log(`Python process was registered with PID ${this.pid}`)

      if (this.waitForPidResolve) {
        console.log("Resolving waitForPid")
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
