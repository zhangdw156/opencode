import { Context, Effect, Layer } from "effect"
import type { LLM } from "./llm"

type QueueMap = Map<string, string[]>
type SessionSet = Set<string>

function* chunks(text: string, size = 256) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size)
  if (text.length === 0) yield ""
}

export namespace BenchmarkHijack {
  export interface Interface {
    isEnabled(): boolean
    bindSession(sessionID: string): void
    unbindSession(sessionID: string): void
    enqueueReply(sessionID: string, reply: string): void
    clear(sessionID: string): void
    tryStream(input: Pick<LLM.StreamInput, "sessionID" | "small" | "agent">): AsyncGenerator<LLM.Event> | null
  }

  export class Service extends Context.Service<Service, Interface>()("@opencode/BenchmarkHijack") {}

  export function create(enabled = process.env.OPENCODE_BENCHMARK_MODE === "true"): Interface {
    const bound: SessionSet = new Set()
    const queues: QueueMap = new Map()

    return {
      isEnabled: () => enabled,
      bindSession(sessionID) {
        bound.add(sessionID)
        if (!queues.has(sessionID)) queues.set(sessionID, [])
      },
      unbindSession(sessionID) {
        bound.delete(sessionID)
        queues.delete(sessionID)
      },
      enqueueReply(sessionID, reply) {
        const q = queues.get(sessionID)
        if (!q) throw new Error(`BenchmarkHijack session not bound: ${sessionID}`)
        q.push(reply)
      },
      clear(sessionID) {
        queues.set(sessionID, [])
      },
      tryStream(input) {
        if (!enabled || !bound.has(input.sessionID) || input.small) return null
        // Let compaction run against the real LLM so it produces a genuine summary
        if (input.agent?.name === "compaction") return null
        const q = queues.get(input.sessionID)
        if (!q || q.length === 0) return null
        const text = q.shift()!
        return (async function* () {
          yield { type: "start" } as LLM.Event
          yield { type: "start-step" } as LLM.Event
          yield { type: "text-start", id: "bench-text" } as LLM.Event
          for (const part of chunks(text)) {
            yield { type: "text-delta", id: "bench-text", text: part } as LLM.Event
          }
          yield { type: "text-end", id: "bench-text" } as LLM.Event
          yield {
            type: "finish-step",
            finishReason: "stop",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            providerMetadata: undefined,
          } as LLM.Event
          yield { type: "finish" } as LLM.Event
        })()
      },
    }
  }

  export const layer = Layer.effect(
    Service,
    Effect.sync(() => create()),
  )

  export const defaultLayer = Layer.suspend(() => layer)
}
