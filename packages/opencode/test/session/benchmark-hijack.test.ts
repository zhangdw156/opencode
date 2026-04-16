import { describe, expect, test } from "bun:test"
import { BenchmarkHijack } from "../../src/session/benchmark-hijack"

describe("BenchmarkHijack", () => {
  test("consumes reply by session id", async () => {
    const h = BenchmarkHijack.create(true)
    h.bindSession("s1")
    h.enqueueReply("s1", "hello")
    const stream = h.tryStream({ sessionID: "s1" } as any)
    expect(stream).not.toBeNull()
    // Collect all events
    const events = []
    for await (const e of stream!) events.push(e)
    expect(events.map(e => e.type)).toEqual(["start","start-step","text-start","text-delta","text-end","finish-step","finish"])
    const delta = events.find(e => e.type === "text-delta")
    expect(delta.text).toBe("hello")
  })

  test("does not leak queue across sessions", () => {
    const h = BenchmarkHijack.create(true)
    h.bindSession("a")
    h.bindSession("b")
    h.enqueueReply("a", "A")
    expect(h.tryStream({ sessionID: "b" } as any)).toBeNull()
  })

  test("returns null when not enabled", () => {
    const h = BenchmarkHijack.create(false)
    h.bindSession("s1")
    h.enqueueReply("s1", "x")
    expect(h.tryStream({ sessionID: "s1" } as any)).toBeNull()
  })

  test("unbindSession stops hijack", () => {
    const h = BenchmarkHijack.create(true)
    h.bindSession("s1")
    h.enqueueReply("s1", "x")
    h.unbindSession("s1")
    expect(h.tryStream({ sessionID: "s1" } as any)).toBeNull()
  })
})
