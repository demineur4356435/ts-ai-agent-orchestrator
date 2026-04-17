# ts-ai-agent-orchestrator

**TypeScript multi-agent orchestration with DAG scheduling**

Define agents with [Zod](https://zod.dev/) input/output schemas, wire dependencies, and run independent steps in parallel. LLM calls use the [Vercel AI SDK](https://sdk.vercel.ai/docs) (`generateText` / `streamText` with structured `Output.object`).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-6.x-black)](https://sdk.vercel.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

## What is this?

`ts-ai-agent-orchestrator` is a small, type-safe library for teams of LLM “agents” that run as a **directed acyclic graph (DAG)**. A scheduler topologically sorts agents, executes each **layer** in parallel, merges dependency outputs into the next agent’s input, and optionally streams text deltas while structured output is parsed.

**Good fits:** research pipelines, multi-step Q&A, document workflows, code-review chains.

## Features

| Feature | Description |
|--------|-------------|
| DAG workflow | `dependsOn` defines edges; cycles are rejected at build time. |
| Parallel layers | Agents in the same topological layer run concurrently. |
| Structured I/O | Zod schemas for each agent’s input and output. |
| Streaming | `runStream()` emits `agent-start`, `token`, `agent-complete`, and `error` events. |
| Providers | `openai/*`, `anthropic/*`, `ollama/*` (OpenAI-compatible local API). |
| Hooks | Optional `onAgentStart` / `onAgentComplete` / `onAgentError` on `workflow.run()` and `workflow.runStream()`. |

## Requirements

- **Node.js 20+** (22+ recommended)
- An API key for your provider (e.g. `OPENAI_API_KEY`), unless you only use local Ollama.

## Installation

```bash
cd ts-ai-agent-orchestrator
npm install
```

### Use as a library

After `npm run build`, import from the package root (see `package.json` `exports`):

```typescript
import { createAgent, createWorkflow } from "ts-ai-agent-orchestrator";
```

During development with `tsx`, import from `./src/orchestrator/index.ts` (or `index.js` if you compile with `tsc` first).

The package also exports **`resolveModel`** (provider string → language model) and **`topologicalLayers`** (DAG layers) for advanced or testing use.

## Quick start

### 1. Environment

Copy `.env.example` to `.env.local` and set keys:

```env
OPENAI_API_KEY=sk-...
# Optional — Anthropic
# ANTHROPIC_API_KEY=

# Optional — Ollama (OpenAI-compatible)
# OLLAMA_BASE_URL=http://localhost:11434/v1
```

### 2. Example workflow

See `src/workflows/research.ts`: a `searcher` agent produces `facts`, then a `summarizer` (depending on `searcher`) produces `summary`.

### 3. Run

```bash
npm run dev -- --workflow=src/workflows/research.ts --query "Latest trends in TypeScript AI agents"
```

Stream tokens to stdout (structured parsing still runs in the SDK):

```bash
npm run dev -- --workflow=src/workflows/research.ts --query "Hello" --stream
```

### 4. REPL

```bash
npm run repl
> load src/workflows/research.ts
> run TypeScript 2026 trends
```

## Model IDs

Use the form `provider/model-name`:

| Prefix | Env / notes |
|--------|-------------|
| `openai/` | `OPENAI_API_KEY` |
| `anthropic/` | `ANTHROPIC_API_KEY` |
| `ollama/` | Optional `OLLAMA_BASE_URL` (default `http://localhost:11434/v1`) |

Example: `openai/gpt-4o-mini`, `ollama/llama3.2`.

## Architecture

```
Request
   → Scheduler (topological layers)
   → Executor (parallel per layer)
   → State (outputs per agent name)
   → Merged object from all agent outputs (last key wins on collision)
```

## API

### `createAgent(config)`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique agent id |
| `model` | `string` | e.g. `openai/gpt-4o-mini` |
| `system` | `string` | System prompt |
| `input` | `z.ZodType` | Parsed input (entry agents receive `payload.input`) |
| `output` | `z.ZodType` | Structured output via AI SDK `Output.object` |
| `dependsOn?` | `string[]` | Prerequisite agent names |
| `tools?` | `Tool[]` | From `ai` / `tool()`; exposed as `tool_0`, `tool_1`, … |

### `createWorkflow(config)`

| Field | Type | Description |
|-------|------|-------------|
| `agents` | Agent definitions | All agents in the workflow |
| `entryPoints?` | `string[]` | Agents with no `dependsOn` (default: all such agents) |

### `workflow.run({ input })`

Runs the DAG. Returns a **single merged object**: non-object outputs are keyed by agent name; object outputs have their fields merged (later agents overwrite keys on conflict).

For agents with `dependsOn`, upstream outputs are merged with `Object.assign` when they are plain objects (not arrays). Prefer object-shaped outputs so the next agent’s Zod `input` schema can consume them.

### `workflow.runStream({ input })`

Async generator of events:

- `{ type: 'agent-start', agentName }`
- `{ type: 'token', agentName, token }` — text deltas when available
- `{ type: 'agent-complete', agentName, output }`
- `{ type: 'error', agentName?, error }` — `agentName` is set when a specific agent fails during streaming.

For the final merged record, use `run()` or merge `agent-complete` outputs yourself.

### Tools

Use the AI SDK `tool()` helper and pass an array into `createAgent({ tools: [...] })`.

## Ollama (Docker)

```bash
docker compose up -d ollama
# Pull a model, then e.g.:
npm run dev -- --workflow=src/workflows/research.ts --query "test"
```

Point models at Ollama with `ollama/<model>` in `createAgent` and ensure the model is pulled in Ollama.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | CLI: `--workflow`, `--query`, `--stream` |
| `npm run repl` | Interactive loader |
| `npm run build` | `tsc` → `dist/` |
| *(lifecycle)* `prepublishOnly` | Runs `npm run build` before `npm publish` |
| `npm start` | Runs **compiled** `dist/cli/dev.js` — pass args after `--`, e.g. `npm start -- --workflow=dist/workflows/research.js --query "hi"` (requires `npm run build` first) |
| `npm test` | Unit tests (`scheduler`, `workflow` mocks only) |
| `npm run test:watch` | Same files as `npm test`, in watch mode |
| `npm run test:integration` | Live LLM test against `src/workflows/research.ts` (skipped without `OPENAI_API_KEY`) |

## Project layout

```
ts-ai-agent-orchestrator/
├── src/
│   ├── env.ts          # shared `.env` / `.env.local` loader (CLI + tests)
│   ├── orchestrator/   # scheduler, workflow, model resolver, execution
│   ├── workflows/      # examples
│   └── cli/            # dev, REPL, dynamic workflow import
├── tests/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── vitest.config.ts
├── package.json
├── LICENSE
└── tsconfig.json
```

## Troubleshooting

- **`Missing OPENAI_API_KEY`** — Create `.env.local` from `.env.example` and set the key for your `provider/model` (or use `ollama/...` with Docker and no cloud key).
- **`Invalid model id`** — Use `provider/model` with a supported prefix: `openai/`, `anthropic/`, or `ollama/`.
- **Workflow module error** — The file passed to `--workflow` / `load` must export `default` or `workflow` with both `.run()` and `.runStream()` (see `src/workflows/research.ts`).

## License

[MIT](LICENSE)

## Acknowledgements

Built with TypeScript, the Vercel AI SDK, and Zod.
