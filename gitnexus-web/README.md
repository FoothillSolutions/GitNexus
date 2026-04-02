# gitnexus-web

Installable web UI for [GitNexus](https://github.com/FoothillSolutions/GitNexus) — graph visualization, AI chat, and PR diff viewer. Runs standalone or embedded in other projects.

## Install as Package

```bash
# Build and pack
cd gitnexus-web
npm install
npm pack                          # creates gitnexus-web-1.0.0.tgz

# Install in your project
cd /path/to/your-project
npm install /path/to/gitnexus-web-1.0.0.tgz
```

The package ships only the built `dist/` directory — no source code, no dev dependencies.

### Embedded Mode

When serving under a subpath (e.g., `https://yourapp.com/gitnexus-web/`), build with embedded mode so asset paths are prefixed correctly:

```bash
npm run build:embedded            # builds with base path /gitnexus-web/
npm pack
```

Then serve `node_modules/gitnexus-web/dist/` from your backend at `/gitnexus-web/`.

### Standalone Mode

For local development or Vercel deployment:

```bash
npm run dev                       # Vite dev server at http://localhost:5173
npm run build                     # production build with base path /
npm run preview                   # preview production build
```

## Connecting to a Backend

The web UI needs a GitNexus backend server to query the knowledge graph:

```bash
# In your indexed repo
gitnexus serve --port 4747
```

Then connect from the web UI via the **Server** tab, or pass the URL as a query param:

```
http://localhost:5173?server=localhost:4747
```

### Auto-Diff via URL Params

Open a diff view automatically by passing branch params:

```
http://localhost:5173?server=localhost:4747&base=main&head=feature-branch
```

This auto-connects, skips the branch picker, and loads the diff immediately — useful for embedding in dashboards or CI tools.

## Features

### Knowledge Graph Visualization
- **WebGL rendering** — Sigma.js with Graphology for smooth interaction with 50k+ nodes
- **Community coloring** — Leiden clustering colors related symbols by functional area
- **File tree explorer** — Hierarchical file browser with node type and edge type filters
- **AI chat** — LangGraph agent with multi-provider LLM support (OpenAI, Anthropic, Gemini, Ollama)
- **Process viewer** — Trace execution flows from entry points through call chains

### PR Diff Visualization
- **Graph-annotated diffs** — Changed symbols highlighted amber on the knowledge graph, affected execution flows traced, risk assessed
- **Node sizing** — Nodes scaled by change magnitude (additions + deletions) so heavily changed files stand out
- **Edge type colors** — Imports (blue), calls (amber), extends/implements (purple), structural (gray)
- **Bidirectional linking** — Click a graph node to scroll to its diff; click a file in the diff list to zoom the graph to that node
- **3 view modes** — Focus (full diff panel), Structure (floating stats on graph), Review (side-by-side diff + graph)
- **Word-level diffs** — Inline highlighting with change classification (logic, naming, formatting)
- **AI summary** — Heuristic risk assessment with per-file intent labels and risk chips
- **Guided review** — Step-by-step review flow through high-risk changes first
- **Commit timeline** — Scrub through commits with play/pause
- **Minimap** — Viewport indicator with click-to-seek for long diffs

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `[` / `]` | Previous / next file |
| `j` / `k` | Previous / next hunk |
| `1` / `2` / `3` | Focus / Structure / Review view mode |
| `f` | Toggle diff file list panel |
| `?` | Show all keyboard shortcuts |
| `Escape` | Exit diff mode |

### File List
- **Sort dropdown** — Sort by change size, risk level, alphabetical, or directory grouping
- **Heat bars** — Visual change magnitude per file (green additions, red deletions)
- **Status icons** — Added, modified, deleted, renamed
- **Intent labels** — Per-file descriptions (e.g., "Modifies validateUser, refreshToken")
- **Risk badges** — Breaking changes, large files, high-impact symbols

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Graph | Sigma.js (WebGL) + Graphology |
| Database | LadybugDB WASM (in-memory) |
| Parsing | Tree-sitter WASM (13 languages) |
| Embeddings | HuggingFace Transformers.js (WebGPU/WASM) |
| Search | BM25 + semantic + RRF ranking |
| AI Agent | LangChain + LangGraph |
| Diff | `diff` library + custom word-level highlighter |
| Virtualization | react-virtuoso |

## Development

```bash
npm install
npm run dev                       # http://localhost:5173 with hot reload
npm run build                     # tsc + vite build
npm run build:embedded            # build for subpath serving
npm run preview                   # preview production build
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
