# GitNexus

Graph-powered code intelligence platform. Builds a knowledge graph of any codebase and exposes it through MCP tools, CLI, and a web UI for AI agents and developers to understand, analyze, and navigate code.

## Architecture

```
gitnexus/          CLI + MCP server + HTTP API (Node.js/TypeScript)
gitnexus-web/      Web UI — graph visualization + diff viewer (React/Vite)
gitnexus-claude-plugin/   Claude Code MCP hooks & skills
gitnexus-cursor-integration/  Cursor editor integration
eval/              SWE-bench evaluation framework (Python)
```

The three runtimes:
- **CLI** (`gitnexus analyze/serve/mcp/...`) — indexes repos, serves API, runs MCP
- **Web UI** (`gitnexus-web/`) — connects to CLI's HTTP server OR runs standalone with WASM
- **MCP server** (`gitnexus mcp`) — exposes tools to AI editors via stdio

Data flow: `gitnexus analyze` → Tree-sitter AST → knowledge graph in LadybugDB → `.gitnexus/` directory → queried by MCP/CLI/Web

## Monorepo Structure

Each package has its own `package.json` and builds independently. No workspace manager — just `cd` into the directory and `npm install`.

### Backend (`gitnexus/`)

| Directory | Purpose |
|-----------|---------|
| `src/cli/` | Commander.js CLI commands (analyze, serve, mcp, wiki, setup, clean, tool) |
| `src/core/ingestion/` | 6-phase indexing pipeline — structure, parsing, resolution, clustering, processes, search |
| `src/core/ingestion/type-extractors/` | Language-specific AST extractors (13 languages, 20-40KB each) |
| `src/core/ingestion/resolvers/` | Language-specific import resolution |
| `src/core/tree-sitter/` | Tree-sitter parser loader (lazy, 13 grammars) |
| `src/core/lbug/` | LadybugDB graph database adapter |
| `src/core/search/` | BM25 + semantic hybrid search with RRF ranking |
| `src/core/embeddings/` | HuggingFace Transformers.js embeddings |
| `src/mcp/` | MCP server — tools, resources, staleness detection |
| `src/mcp/local/` | Multi-repo backend — `local-backend.ts` (query engine), `tools.ts` (64KB, all tool logic) |
| `src/server/` | Express HTTP API for web UI connection |
| `src/storage/` | Repository registry + git integration |

Key files:
- `src/core/ingestion/pipeline.ts` — main indexing orchestrator (Kahn's topological sort for parallel processing)
- `src/mcp/local/tools.ts` — all MCP tool implementations (impact, rename, detect_changes, etc.)
- `src/server/api.ts` — HTTP endpoints including `/api/diff` and `/api/branches`

### Frontend (`gitnexus-web/`)

| Directory | Purpose |
|-----------|---------|
| `src/components/` | React components — GraphCanvas (Sigma.js/WebGL), DiffPanel, Header, FileTree, etc. |
| `src/components/diff/` | Diff viewer — file list, hunk view, split view, minimap, AI summary, guided review |
| `src/hooks/` | State management — `useAppState.tsx` is the central state hook |
| `src/core/` | Browser-side ingestion pipeline (WASM versions of backend modules) |
| `src/core/llm/` | LLM integration — LangGraph agent, multi-provider support |
| `src/services/` | API clients — `backend.ts` (REST), `server-connection.ts` (auto-detect) |
| `src/lib/` | Utilities — `diff-utils.ts` (classification, word-diff, risk chips) |

Key files:
- `src/App.tsx` — root component, auto-connect via `?server` param, auto-diff via `?base&head`
- `src/hooks/useAppState.tsx` — all app state + actions (1400+ lines)
- `src/components/GraphCanvas.tsx` — Sigma.js WebGL graph rendering with diff highlighting

## Supported Languages

TypeScript, JavaScript, Python, Java, Kotlin, C#, Go, Rust, PHP, Ruby, C, C++, Swift

Each language has a type extractor in `src/core/ingestion/type-extractors/` and an import resolver in `src/core/ingestion/resolvers/`.

## Knowledge Graph Schema

**Nodes**: File, Folder, Function, Class, Interface, Method, CodeElement, Community, Process, Struct, Enum, Trait, Impl, Module, Namespace, and more

**Relations**: CALLS, IMPORTS, EXTENDS, IMPLEMENTS, HAS_METHOD, HAS_PROPERTY, OVERRIDES, ACCESSES, CONTAINS, MEMBER_OF

**Confidence**: CALLS/IMPORTS 0.9, HAS_METHOD/PROPERTY 0.95, EXTENDS/IMPLEMENTS 0.85, ACCESSES 0.8

## Commands

```bash
# Backend
cd gitnexus
npm install
npm run build          # TypeScript → dist/
npm run dev            # tsx watch mode
npm test               # Vitest (all tests)
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage  # Coverage report

# Frontend
cd gitnexus-web
npm install
npm run dev            # Vite dev server (hot reload)
npm run build          # tsc + vite build
npm run preview        # Serve production build

# CLI usage
gitnexus analyze [path]     # Index a repository
gitnexus serve              # HTTP server for web UI (default port 4747)
gitnexus mcp                # Start MCP server (stdio)
gitnexus setup              # Configure MCP for editors
gitnexus status             # Show index stats
gitnexus clean              # Delete index
gitnexus wiki [path]        # Generate LLM-powered wiki
```

## Critical Rules

NEVER:
- Edit a type extractor without running its test suite — extractors are 20-40KB each and tightly coupled to Tree-sitter queries
- Modify `pipeline.ts` phases without understanding the dependency order — phase 3 (resolution) depends on phase 2 (parsing), phase 5 (processes) depends on phase 4 (clustering)
- Change the LadybugDB schema without a migration — existing indexes will break
- Modify MCP tool response formats without checking all consumers (CLI, web UI, plugins)
- Add synchronous file I/O in the ingestion pipeline — it runs parallel workers via Kahn's topological sort
- Hardcode language-specific logic in shared code — use the extractor/resolver pattern

ALWAYS:
- Run `npm test` in `gitnexus/` before committing backend changes
- Run `npm run build` in `gitnexus-web/` before committing frontend changes
- Keep the dual-runtime parity — if you add a feature to `gitnexus/src/core/`, check if `gitnexus-web/src/core/` needs the same change (WASM version)
- Use Tree-sitter queries from `tree-sitter-queries.ts` — don't write raw AST traversals
- Follow the extractor pattern when adding language support: create `type-extractors/{lang}.ts` + `resolvers/{lang}.ts` + register in `supported-languages.ts`
- Keep MCP tool responses under 50KB — truncate with `... (truncated)` hints

## Code Patterns

### Adding a new MCP tool
1. Define the tool schema in `src/mcp/tools.ts`
2. Implement the logic in `src/mcp/local/tools.ts`
3. Register the handler in `src/mcp/server.ts`
4. Add next-step hints so agents know what to do after calling the tool

### Adding a new language
1. Add the language to `src/config/supported-languages.ts`
2. Create `src/core/ingestion/type-extractors/{lang}.ts` extending the shared base
3. Create `src/core/ingestion/resolvers/{lang}.ts` implementing import resolution
4. Add Tree-sitter queries to `tree-sitter-queries.ts`
5. Add parser grammar to dependencies
6. Write tests in `test/unit/` covering symbol extraction, imports, and calls

### Web UI state management
- All state lives in `useAppState.tsx` — don't create separate stores
- `commitServerConnection()` builds the graph and transitions to exploring view
- `pendingServerResult` holds server data between connect and commit phases
- `startDiff(base, head)` triggers diff mode — calls `/api/diff` on the backend

## Indexing Pipeline

6 phases, executed in dependency order via Kahn's topological sort:

1. **Structure** — walk filesystem, build file/folder tree (respects `.gitignore`, `.gitnexusignore`)
2. **Parsing** — Tree-sitter AST extraction, symbol table construction (parallel by dependency level)
3. **Resolution** — resolve imports, function calls, inheritance chains, MRO computation
4. **Clustering** — Leiden community detection to identify functional areas
5. **Processes** — trace execution flows from entry points (main, routes, handlers, tests)
6. **Search** — build BM25 full-text index + optional semantic embeddings

Performance: chunk-based parsing (20MB per chunk), AST LRU cache (50 trees), LadybugDB connection pool (5 concurrent, 5-min timeout).

## Storage

- **Per-repo**: `.gitnexus/` directory (gitignored) — `meta.json`, `*.lbug`, `fts.json`, `vectors.json`
- **Global**: `~/.gitnexus/registry.json` (indexed repo paths), `~/.gitnexus/config.json` (settings)

## Testing

Backend tests are in `gitnexus/test/`:
- `test/unit/` — 62 test files covering extractors, resolvers, call routing, search, tools
- `test/integration/` — 28 test files for pipeline, MCP, server
- `test/fixtures/` — sample code in 8 languages
- Runner: Vitest

Frontend E2E tests are in `gitnexus-web/e2e/`:
- `diff-ux.spec.ts` — diff panel UX (collapse, shortcuts, depth slider)
- `diff-visualization.spec.ts` — backend API + frontend diff flow
- Runner: Playwright

## Web UI Connection Modes

1. **Server mode**: `gitnexus serve` runs locally, web UI connects via `?server=localhost:4747`
2. **Upload mode**: drag-and-drop a zip file, web UI processes it entirely in-browser (WASM)
3. **Auto-diff**: `?server=X&base=main&head=feature` auto-connects and opens diff view

## Deployment

- **Web UI**: Vercel (`gitnexus.vercel.app`)
- **CLI/MCP**: npm package (`npm install -g gitnexus`)
- **Plugins**: Installed via `gitnexus setup` which auto-configures MCP for Claude Code, Cursor, OpenCode, Codex

## MCP Tools

| Tool | Purpose |
|------|---------|
| `list_repos` | Discover indexed repositories |
| `query` | Process-grouped hybrid search (BM25 + semantic + RRF) |
| `context` | 360-degree symbol view — callers, callees, process participation |
| `impact` | Blast radius analysis with depth grouping (d=1 WILL BREAK, d=2 LIKELY, d=3 MAY) |
| `detect_changes` | Git-diff scope check — what symbols and flows changed |
| `rename` | Graph-aware multi-file rename (dry_run first) |
| `cypher` | Raw Cypher queries against the knowledge graph |

## MCP Resources

```
gitnexus://repos                          List all indexed repos
gitnexus://repo/{name}/context            Codebase stats, index freshness
gitnexus://repo/{name}/clusters           Functional areas (Leiden communities)
gitnexus://repo/{name}/processes          All execution flows
gitnexus://repo/{name}/process/{name}     Step-by-step execution trace
gitnexus://repo/{name}/schema             Graph schema for Cypher queries
```
