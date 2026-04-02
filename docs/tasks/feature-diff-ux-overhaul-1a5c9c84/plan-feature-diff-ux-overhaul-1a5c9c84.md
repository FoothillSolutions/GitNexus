# feature: Diff UX Overhaul — Graph, File List, Diff View, Navigation

## Metadata
adw_id: `1a5c9c84`
issue_description: `Comprehensive UX overhaul of the GitNexus diff visualization: fix label overlaps, add node sizing by change magnitude, differentiate edge types, improve file list with sorting/filtering/tree view, enhance diff view with better syntax highlighting and navigation, fix header redundancies, add keyboard shortcuts, and improve visual design across all panels.`

## Description
The diff visualization feature (PR #2) works functionally but has significant UX issues across all panels: graph labels overlap in dense clusters, edges are indistinguishable, nodes don't convey change importance, the file list lacks sorting/filtering, the diff view needs better navigation, and keyboard shortcuts are minimal. This plan addresses the highest-impact improvements organized into 4 phases.

## Objective
Transform the diff visualization from functional to polished by implementing the 4 highest-impact improvements first (label overlaps, node sizing, graph-diff linking, keyboard shortcuts), then iterating through file list enhancements, diff view improvements, and visual design polish.

## Problem Statement
The current diff view has these core usability issues:
1. **Label collisions** — dense clusters make labels unreadable; Sigma's `labelDensity: 0.1` and `labelGridCellSize: 70` help but aren't enough for diff mode where many nodes cluster
2. **Uniform edges** — all edges are same color/weight, making it impossible to distinguish imports vs calls vs test deps
3. **Uniform node sizes** — no visual indication of which files changed most
4. **No bidirectional linking** — clicking a graph node doesn't reliably scroll the diff panel to that file
5. **Limited keyboard nav** — only j/k for hunks, no file navigation or panel switching
6. **File list is flat** — no tree view, no sorting, no filtering beyond search

## Solution Statement
Implement improvements in 4 phases, each independently shippable:
- **Phase 1 (Critical)**: Label collision avoidance + node sizing by change magnitude + edge type differentiation
- **Phase 2 (High)**: Bidirectional graph-diff linking + keyboard shortcuts + file list sort/filter
- **Phase 3 (Medium)**: Diff view improvements (syntax highlighting, hunk navigation, context expansion)
- **Phase 4 (Polish)**: Visual design (selected node glow, semantic zoom, minimap, header cleanup)

## Code Patterns to Follow
Reference implementations:
- **Node rendering**: `useSigma.ts` lines 200-350 — node reducer applies color/size/visibility per render
- **Edge rendering**: `useSigma.ts` lines 350-450 — edge reducer applies color/thickness/visibility
- **Diff state**: `useAppState.tsx` — `diffData`, `selectedDiffFile`, `diffChangedNodeIds`, `setDiffFocusedSymbolId`
- **Sigma config**: `useSigma.ts` lines 50-80 — label settings, edge programs, camera config
- **File list**: `DiffFileList.tsx` — current heat bar + status icon + intent label pattern
- **Keyboard shortcuts**: `App.tsx` lines 224-234 — diff view mode shortcuts (1/2/3)
- **Graph adapter**: `graph-adapter.ts` — `knowledgeGraphToGraphology()` sets initial positions and sizes

## Relevant Files
Use these files to complete the task:

- **`CLAUDE.md`** — Project conventions and architecture overview
- **`gitnexus-web/src/hooks/useSigma.ts`** — Sigma.js configuration, node/edge reducers, layout settings. Core file for label collision, node sizing, edge differentiation.
- **`gitnexus-web/src/components/GraphCanvas.tsx`** — Graph rendering, click/hover handlers, diff mode controls. Core file for bidirectional linking, selected node styling.
- **`gitnexus-web/src/hooks/useAppState.tsx`** — Central state. Add new state for sort mode, file filter, keyboard shortcut map.
- **`gitnexus-web/src/components/diff/DiffFileList.tsx`** — File list sidebar. Add sort dropdown, tree view toggle, filter chips.
- **`gitnexus-web/src/components/diff/DiffFileContent.tsx`** — File diff content. Improve syntax highlighting, hunk navigation.
- **`gitnexus-web/src/components/diff/DiffHunkView.tsx`** — Hunk rendering. Add context expansion, hunk counter.
- **`gitnexus-web/src/components/diff/DiffToolbar.tsx`** — Diff controls. Add keyboard shortcut hints, sort control.
- **`gitnexus-web/src/components/diff/DiffPanel.tsx`** — Diff container. Wire bidirectional linking, scrollTo on graph click.
- **`gitnexus-web/src/components/diff/DiffSummaryHeader.tsx`** — Summary header. Fix "unknowns" wording, deduplicate risk badge.
- **`gitnexus-web/src/components/Header.tsx`** — Header. Deduplicate risk badge, improve commit pills with hover messages.
- **`gitnexus-web/src/App.tsx`** — Layout. Add global keyboard shortcuts, panel switching.
- **`gitnexus-web/src/lib/constants.ts`** — Color constants, node sizes. Add edge type colors.
- **`gitnexus-web/src/lib/diff-utils.ts`** — Diff classification. Extend for file sorting comparators.
- **`gitnexus-web/src/types/diff.ts`** — Diff types. Extend for sort/filter state.
- **`gitnexus-web/src/lib/graph-adapter.ts`** — Graphology node sizing. Scale by change magnitude in diff mode.

### New Files
- **`docs/tasks/feature-diff-ux-overhaul-1a5c9c84/e2e-feature-diff-ux-overhaul-1a5c9c84.md`** — E2E test spec

## Implementation Plan

### Phase 1: Graph Readability (Critical)
Fix the three biggest graph issues: label collisions in diff mode, node sizing by change magnitude, and edge type color differentiation. These are all in `useSigma.ts` and `graph-adapter.ts`.

### Phase 2: Navigation & Interaction (High)
Add bidirectional graph-diff linking (click node → scroll to file, click file → focus node), comprehensive keyboard shortcuts (file nav, panel toggle, zoom), and file list sort/filter (by risk, change size, type).

### Phase 3: Diff View Polish (Medium)
Improve the diff reading experience: better syntax highlighting, hunk count indicator with jump shortcuts, expandable context lines, and fix the "unknowns" wording in summary.

### Phase 4: Visual Design & Headers (Polish)
Selected node glow effect, header cleanup (deduplicate risk badge, commit message previews on hover), dismissible sponsor banner, tooltip improvements for tabs and sidebar icons.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Node sizing by change magnitude in diff mode
- In `useSigma.ts` node reducer: when `isDiffMode` and node is in `diffChangedNodeIds`, scale size by the file's `additions + deletions`
- Access diff data from `useAppState` — build a `Map<nodeId, changeSize>` from `diffData.files`
- Size formula: `baseSize * (1 + Math.log2(1 + additions + deletions) * 0.3)` — capped at 3x base
- Files with 0 changes (context/neighbor nodes) keep base size
- Update `graph-adapter.ts` to expose a `setDiffSizes(diffData)` function that mutates node attributes

### 2. Label collision avoidance in diff mode
- In `useSigma.ts` Sigma config: when entering diff mode, adjust label settings:
  - Increase `labelGridCellSize` from 70 → 120 for diff mode
  - Set `labelRenderedSizeThreshold` to 12 (only show labels for larger/closer nodes)
  - Add hover-to-show-label behavior: in `defaultDrawNodeHover`, always render label even if grid-hidden
- In node reducer: for diff-changed nodes, set `forceLabel: true` on nodes with `changeSize > 50` (top changed files always visible)
- For remaining diff nodes: labels appear only on hover

### 3. Edge type differentiation
- In `constants.ts`: add `EDGE_TYPE_COLORS` map:
  - `CALLS` → `#f59e0b` (amber)
  - `IMPORTS` → `#3b82f6` (blue)
  - `EXTENDS/IMPLEMENTS` → `#a855f7` (purple)
  - `HAS_METHOD/HAS_PROPERTY` → `#6b7280` (gray, structural)
  - `CONTAINS` → `#374151` (dark gray, very subtle)
- In `useSigma.ts` edge reducer: read `edge.type` attribute and apply corresponding color
- In diff mode: override with amber for edges between changed nodes (existing behavior), but use type color for edges from changed to non-changed
- Add thin dashed rendering for `CONTAINS` edges (structural, low priority)

### 4. Bidirectional graph-diff linking
- **Graph → Diff**: In `GraphCanvas.tsx` `handleNodeClick`: when `isDiffMode`, find the file path from the clicked node's attributes, call `setSelectedDiffFile(filePath)`, and scroll the DiffPanel to that file
- **Diff → Graph**: In `DiffFileList.tsx`: when a file is clicked, find the corresponding graph node ID, call `setDiffFocusedSymbolId(nodeId)` which triggers camera focus in GraphCanvas
- In `GraphCanvas.tsx`: add a `useEffect` that watches `diffFocusedSymbolId` and calls `sigma.getCamera().animate()` to zoom to that node
- Highlight the focused file in DiffFileList with a distinct border color

### 5. Keyboard shortcuts
- In `App.tsx`: add a global `keydown` handler (guarded against input/textarea/select focus):
  - `[` / `]` — previous/next file in diff file list
  - `Escape` — exit diff mode (if in diff), close panels
  - `f` — toggle file list panel visibility
  - `g` — toggle graph panel (full-width diff vs split)
  - `?` — show keyboard shortcut cheat sheet overlay
- In `DiffToolbar.tsx`: show shortcut hints next to existing buttons (j/k already exist)
- Create a `KeyboardShortcutsDialog` component: simple modal listing all shortcuts, triggered by `?`

### 6. File list sort and filter
- In `useAppState.tsx`: add state `diffFileSortBy: 'risk' | 'changes' | 'alpha' | 'directory'` (default: `'changes'`)
- In `useAppState.tsx`: add state `diffFileFilter: string | null` (file type filter, e.g. `.py`, `.ts`)
- In `DiffFileList.tsx`: add a sort dropdown at the top (icon button with popover menu)
- In `DiffFileList.tsx`: add quick-filter chips for file extensions (already partially exists in DiffToolbar)
- In `diff-utils.ts`: add sort comparator functions:
  - `sortByChanges`: `(b.additions + b.deletions) - (a.additions + a.deletions)`
  - `sortByRisk`: compare `symbols.filter(s => s.changeScope === 'directly_changed').length`
  - `sortByAlpha`: `a.filePath.localeCompare(b.filePath)`
  - `sortByDirectory`: group by directory, then alpha within group

### 7. Fix summary wording and header redundancy
- In `DiffSummaryHeader.tsx`: replace "unknowns" with "symbols" in the summary text
- In `DiffSummaryHeader.tsx` or `Header.tsx`: remove the duplicate risk badge (keep only one)
- In the commit pills row: add `title` attribute with full commit message on hover (if available in `diffData`)

### 8. Selected node visual enhancement
- In `useSigma.ts` node reducer: when node is selected, apply:
  - Size multiplier: 1.8x (up from current subtle box outline)
  - Glow ring: draw a larger semi-transparent circle behind the node (in `defaultDrawNodeHover`)
  - Z-index boost to ensure it renders on top
- In `defaultDrawNodeHover`: increase contrast — use a brighter border (2px), stronger shadow

### 9. Sidebar icon tooltips
- In `GraphCanvas.tsx` controls section: add `title` attribute to every icon button (Zoom In, Zoom Out, Reset, Focus, Clear, Layout)
- Group buttons with visual dividers (already partially exists)

### 10. Create E2E test spec
- Create at `docs/tasks/feature-diff-ux-overhaul-1a5c9c84/e2e-feature-diff-ux-overhaul-1a5c9c84.md`
- **User Story**: As a developer reviewing a diff, I can instantly see which files changed most (node size), distinguish edge types by color, navigate between graph and diff bidirectionally, and use keyboard shortcuts for fast navigation.
- **Test Steps**:
  1. Connect to server, load a diff between two branches
  2. Verify nodes have different sizes (changed nodes larger than unchanged)
  3. **Screenshot**: Graph with sized nodes
  4. Verify edges show different colors for CALLS vs IMPORTS
  5. Click a node in the graph → verify diff panel scrolls to that file
  6. Click a file in the file list → verify graph zooms to that node
  7. **Screenshot**: Bidirectional linking working
  8. Press `[` and `]` → verify file navigation cycles through files
  9. Press `?` → verify shortcut dialog appears
  10. **Screenshot**: Keyboard shortcuts dialog
  11. Use sort dropdown in file list → verify files reorder
  12. **Screenshot**: Sorted file list
- **Success Criteria**: Node sizing reflects change magnitude, edges are color-coded by type, bidirectional linking works in both directions, keyboard shortcuts navigate files and toggle panels.

### 11. Run Validation Commands
- `cd gitnexus-web && npm run build` — frontend build check
- `cd gitnexus && npm test` — backend tests

## Testing Strategy

### Unit Tests
- **Sort comparators**: test each sort function in `diff-utils.ts` with mock file data
- **Edge color mapping**: test `EDGE_TYPE_COLORS` lookup for all edge types
- **Node size formula**: test `changeSize → nodeSize` scaling with edge cases (0 changes, 10000 changes)

### Edge Cases
- Graph with 0 changed files (identical refs) — no node sizing applied, labels at default density
- Graph with 1 changed file — that file should be largest, all others base size
- File with 10000+ additions — node size should cap at 3x, not explode
- Edge between two changed nodes — amber color (existing), not type color
- Keyboard shortcut pressed while typing in search input — should NOT trigger
- File list with 500+ files — sort should be instant (<16ms), no jank
- Split view + bidirectional linking — scroll position must account for split layout

## Acceptance Criteria
- [ ] Changed nodes in diff mode are visibly larger than unchanged nodes, scaled by additions+deletions
- [ ] Labels don't overlap in dense clusters; hover reveals hidden labels
- [ ] Edges have distinct colors by type (amber=CALLS, blue=IMPORTS, purple=EXTENDS)
- [ ] Clicking a graph node scrolls the diff panel to that file and highlights it
- [ ] Clicking a file in the diff list focuses the graph camera on that node
- [ ] `[`/`]` navigate between files, `?` shows shortcut dialog, `f` toggles file list
- [ ] File list has a sort dropdown (changes, risk, alpha, directory)
- [ ] Summary no longer says "unknowns" — says "symbols"
- [ ] Duplicate risk badge removed from header
- [ ] Selected node has strong glow/ring effect
- [ ] All sidebar icons have tooltips
- [ ] `cd gitnexus-web && npm run build` passes
- [ ] `cd gitnexus && npm test` passes

## Validation Commands
Execute every command to validate the work is complete with zero regressions.

- `cd /Users/qusaynaser/Desktop/Projects/GitNexus/gitnexus-web && npm run build` — frontend build check
- `cd /Users/qusaynaser/Desktop/Projects/GitNexus/gitnexus && npm test` — backend test suite

## Notes
- Sigma.js v3 uses WebGL rendering — custom node/edge programs can be added but the built-in reducers handle most cases via attribute manipulation
- `forceLabel: true` on node attributes forces Sigma to always render that label regardless of grid density — use sparingly (only top-changed files)
- The `@sigma/edge-curve` program is already loaded for curved edges — it supports color per edge via the edge reducer
- `react-virtuoso` is already used for large lists — file list sort/filter should maintain virtual scrolling
- The diff panel uses `scrollIntoView` already in some places — extend this for bidirectional linking
- ForceAtlas2 layout runs in a Web Worker — node size changes during diff mode need to refresh layout or apply after layout settles
- Consider debouncing keyboard shortcuts to prevent rapid-fire navigation
