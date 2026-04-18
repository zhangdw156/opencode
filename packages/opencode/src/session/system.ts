import { Context, Effect, Layer } from "effect"

import { Instance } from "../project/instance"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_GPT from "./prompt/gpt.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"

import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"

import { Flag } from "@/flag/flag"

const BENCHMARK_PROMPT = [
  "You are a conversational memory assistant. Your role is to answer questions by recalling information from previous conversations stored in your memory system.",
  "",
  "CRITICAL RULES:",
  "- You MUST use the memory tools (e.g. brv_query, mem0_search, or similar) provided by plugins to search for relevant information before answering ANY question.",
  "- Do NOT search the filesystem, run shell commands, or use grep/glob/bash/read tools. You have no access to those tools.",
  "- Do NOT ask the user clarifying questions. Answer directly based on what you find in memory.",
  "- If your memory search returns no relevant results, say so clearly — do not fabricate an answer.",
  "- Always search memory FIRST, then answer based on the retrieved context.",
].join("\n")

export namespace SystemPrompt {
  export function provider(model: Provider.Model) {
    if (Flag.OPENCODE_BENCHMARK_MODE) return [BENCHMARK_PROMPT]
    if (model.api.id.includes("gpt-4") || model.api.id.includes("o1") || model.api.id.includes("o3"))
      return [PROMPT_BEAST]
    if (model.api.id.includes("gpt")) {
      if (model.api.id.includes("codex")) {
        return [PROMPT_CODEX]
      }
      return [PROMPT_GPT]
    }
    if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
    if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
    if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
    if (model.api.id.toLowerCase().includes("kimi")) return [PROMPT_KIMI]
    return [PROMPT_DEFAULT]
  }

  export interface Interface {
    readonly environment: (model: Provider.Model) => string[]
    readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
  }

  export class Service extends Context.Service<Service, Interface>()("@opencode/SystemPrompt") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const skill = yield* Skill.Service

      return Service.of({
        environment(model) {
          if (Flag.OPENCODE_BENCHMARK_MODE) {
            return [
              `You are powered by the model named ${model.api.id}.`,
              `Today's date: ${new Date().toDateString()}`,
            ]
          }
          const project = Instance.project
          return [
            [
              `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
              `Here is some useful information about the environment you are running in:`,
              `<env>`,
              `  Working directory: ${Instance.directory}`,
              `  Workspace root folder: ${Instance.worktree}`,
              `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
              `  Platform: ${process.platform}`,
              `  Today's date: ${new Date().toDateString()}`,
              `</env>`,
            ].join("\n"),
          ]
        },

        skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
          if (Permission.disabled(["skill"], agent.permission).has("skill")) return

          const list = yield* skill.available(agent)

          return [
            "Skills provide specialized instructions and workflows for specific tasks.",
            "Use the skill tool to load a skill when a task matches its description.",
            // the agents seem to ingest the information about skills a bit better if we present a more verbose
            // version of them here and a less verbose version in tool description, rather than vice versa.
            Skill.fmt(list, { verbose: true }),
          ].join("\n")
        }),
      })
    }),
  )

  export const defaultLayer = layer.pipe(Layer.provide(Skill.defaultLayer))
}
