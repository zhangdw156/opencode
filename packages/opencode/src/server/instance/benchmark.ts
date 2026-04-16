import { Hono } from "hono"
import { Effect } from "effect"
import { AppRuntime } from "@/effect/app-runtime"
import { BenchmarkHijack } from "@/session/benchmark-hijack"

export const BenchmarkRoutes = () =>
  new Hono()
    .get("/status", async (c) => {
      const enabled = await AppRuntime.runPromise(
        BenchmarkHijack.Service.use((svc) => Effect.sync(() => svc.isEnabled())),
      )
      return c.json({ enabled })
    })
    .post("/bind/:sessionID", async (c) => {
      const sessionID = c.req.param("sessionID")
      await AppRuntime.runPromise(
        BenchmarkHijack.Service.use((svc) => Effect.sync(() => svc.bindSession(sessionID))),
      )
      return c.json({ ok: true })
    })
    .post("/unbind/:sessionID", async (c) => {
      const sessionID = c.req.param("sessionID")
      await AppRuntime.runPromise(
        BenchmarkHijack.Service.use((svc) => Effect.sync(() => svc.unbindSession(sessionID))),
      )
      return c.json({ ok: true })
    })
    .post("/enqueue/:sessionID", async (c) => {
      const sessionID = c.req.param("sessionID")
      const body = (await c.req.json()) as { reply: string }
      await AppRuntime.runPromise(
        BenchmarkHijack.Service.use((svc) => Effect.sync(() => svc.enqueueReply(sessionID, body.reply))),
      )
      return c.json({ ok: true })
    })
    .post("/clear/:sessionID", async (c) => {
      const sessionID = c.req.param("sessionID")
      await AppRuntime.runPromise(
        BenchmarkHijack.Service.use((svc) => Effect.sync(() => svc.clear(sessionID))),
      )
      return c.json({ ok: true })
    })
