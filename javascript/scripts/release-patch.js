#!/usr/bin/env node
import {execSync} from "node:child_process"

/**
 * Run a shell command and forward stdio to the terminal.
 * @param {string} command Shell command to execute.
 */
const run = (command) => {
  console.log(`$ ${command}`)
  execSync(command, {stdio: "inherit"})
}

/**
 * Read the current package version from npm.
 * @returns {string} Current package version.
 */
const readVersion = () => JSON.parse(execSync("npm pkg get version", {encoding: "utf8"}))

/**
 * Ensure npm has an authenticated user before publishing.
 * @returns {void}
 */
const ensureNpmLogin = () => {
  try {
    execSync("npm whoami", {stdio: "ignore"})
  } catch {
    run("npm login")
  }
}

// Bumps patch version, installs deps, runs checks/builds, and publishes to npm.
run("npm version patch --no-git-tag-version")
run("npm install")
run("npm run all-checks")

ensureNpmLogin()

const version = readVersion()
run("git add package.json package-lock.json")
run(`git commit -m "Release v${version}"`)
run("git push origin master")
run("npm publish")
