#!/usr/bin/env bun
/**
 * Minimal entry point for running opencode server in benchmark mode.
 * Avoids importing TUI/react dependencies.
 */
import { Server } from "./src/server/server"

const hostname = process.argv.find((a) => a.startsWith("--hostname="))?.split("=")[1] ?? "127.0.0.1"
const port = parseInt(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "4096", 10)

const server = await Server.listen({ hostname, port })
console.log(`opencode server listening on http://${server.hostname}:${server.port}`)

// Keep alive until killed
await new Promise(() => {})
