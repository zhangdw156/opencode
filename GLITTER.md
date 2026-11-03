# Glitter evaluation adapter

The `glitter-evaluation` branch adds opt-in hooks for Glitter's native OpenCode backend. Normal OpenCode execution is unchanged when `GLITTER_OPENCODE_ADAPTER` is absent.

Glitter supplies the private adapter module and generated configuration in each trial home. The adapter only controls evaluation boundaries; OpenCode still performs prompt construction, model transport, streaming, retry decisions, MCP tool execution, durable session updates, and ACP translation.

When enabled:

- Configuration discovery uses the isolated global configuration directory. Project, system, Claude and agent configuration directories are excluded.
- Primary requests advertise the current scenario tool allowlist and use the scenario system context. Native HTTP transport wraps each attempt, including failures before headers and response-stream finalization. WebSocket transport is disabled for this integration.
- Model streams finish before scenario tools execute. Tool results retain their full native contents and settle durably before a successful wait/reply can stop continuation.
- Text notifications are admitted as native synthetic messages before request preparation; image notifications use native durable user inbox entries. The adapter checkpoints the SQLite database together with the paused ARE state before model transport starts.
- The configured retry allowance limits native retry decisions without replacing the retry policy.
- Automatic title calls and startup resumption are disabled. Glitter disables automatic compaction and warming through generated configuration; unexpected auxiliary requests fail closed. Explicit ACP resumption occurs only after Glitter verifies and restores both sides of the checkpoint.

Validation for this fork is recorded in Glitter's `docs/backends/opencode.md` and the feature PR. The integration uses Bun 1.4.4 and the current V2 core/CLI source entry point.
