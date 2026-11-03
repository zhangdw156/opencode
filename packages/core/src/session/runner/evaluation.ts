export * as Evaluation from "./evaluation.js"

import type { LLMEvent } from "@opencode/ai/effect"
import type { StreamOptions } from "@opencode/ai/route"
import type { Model } from "@opencode/schema/model"
import { Cause, Effect, Stream } from "effect"
import { HttpClientRequest, HttpClientResponse } from "effect/http"

export const enabled = Boolean(process.env.GLITTER_OPENCODE_ADAPTER)

interface Scope {
  sessionID: string
  model: Model.Ref
  kind: string
}

interface Adapter {
  names: string[]
  system: string
  boundary(): Promise<string[]>
  stopped(): Promise<boolean>
  allowTool(name: string): Promise<boolean>
  begin(scope: Scope, request: unknown): Promise<string>
  transportEnd(id: string, error?: string): Promise<void>
  event(event: LLMEvent): void
  settled(error?: string): Promise<void>
}

const loaded = enabled
  ? import(process.env.GLITTER_OPENCODE_ADAPTER!).then((module) => module.default as Adapter)
  : undefined

export const adapter = Effect.promise(() => {
  if (!loaded) throw new Error("Evaluation adapter is disabled")
  return loaded
})

// Own the whole response scope, including failure before headers and cancellation while reading.
export const transport =
  (scope: Scope): NonNullable<StreamOptions["http"]> =>
  (request, handler) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const hooks = yield* adapter
        const web = yield* HttpClientRequest.toWeb(request)
        const body = yield* Effect.promise(() => web.json())
        const id = yield* Effect.promise(() => hooks.begin(scope, body))
        const response = yield* restore(handler(request)).pipe(
          Effect.onError((cause) => Effect.promise(() => hooks.transportEnd(id, Cause.pretty(cause)))),
        )
        const stream = response.stream.pipe(Stream.ensuring(Effect.promise(() => hooks.transportEnd(id))))
        return HttpClientResponse.fromWeb(
          request,
          new Response(yield* Stream.toReadableStreamEffect(stream), {
            status: response.status,
            headers: response.headers,
          }),
        )
      }),
    )
