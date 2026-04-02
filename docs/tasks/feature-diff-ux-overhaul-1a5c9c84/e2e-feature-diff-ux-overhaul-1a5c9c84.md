# E2E: Diff UX Overhaul

## User Story
As a developer reviewing a diff, I can instantly see which files changed most (node size), distinguish edge types by color, navigate between graph and diff bidirectionally, sort/filter the file list, and use keyboard shortcuts for fast navigation.

## Test Steps

### Scenario 1: Node sizing and edge colors
1. Connect to server, load a diff between two branches with multiple changed files
2. Verify changed nodes are visibly larger than unchanged neighbor nodes
3. Verify edges between changed nodes are amber
4. Verify edges from changed to unchanged nodes use type-based colors (blue for imports, amber for calls)
5. **Screenshot**: Graph with sized nodes and colored edges

### Scenario 2: Bidirectional graph-diff linking
1. Click a changed node in the graph
2. Verify the diff panel scrolls to that file and highlights it in the file list
3. Click a different file in the file list
4. Verify the graph camera animates to focus on that file's node
5. **Screenshot**: Graph focused on selected node with file highlighted in list

### Scenario 3: Keyboard shortcuts
1. Press `]` → verify next file is selected in diff panel
2. Press `[` → verify previous file is selected
3. Press `?` → verify keyboard shortcuts dialog appears
4. Verify dialog lists shortcuts organized by section (Navigation, View Modes, Panels)
5. Press Escape → verify dialog closes
6. Press Escape again → verify diff mode exits
7. **Screenshot**: Keyboard shortcuts dialog open

### Scenario 4: File list sorting
1. Open a diff with multiple files
2. Click the sort dropdown in the file list header
3. Select "Alphabetical" → verify files reorder A-Z
4. Select "Most changes" → verify files reorder by additions+deletions descending
5. Select "By directory" → verify files group by directory
6. **Screenshot**: Sorted file list with sort dropdown visible

### Scenario 5: Label readability
1. Load a diff with many changed files (dense graph)
2. Verify labels don't visually overlap — only top-changed files show persistent labels
3. Hover over a node without a visible label → verify label appears on hover
4. **Screenshot**: Dense graph with readable labels

### Scenario 6: Selected node glow
1. Click a node in the graph
2. Verify it has a visible glow ring effect (double ring, brighter color)
3. Verify it appears larger than unselected nodes of the same type
4. **Screenshot**: Selected node with glow effect

## Success Criteria
- Changed nodes are 1.3-3x larger than base size depending on change magnitude
- Edges use distinct colors by type (amber=CALLS, blue=IMPORTS, purple=EXTENDS)
- Clicking graph node → diff panel scrolls to file; clicking file → graph zooms to node
- `[`/`]` cycle through files, `?` opens shortcuts dialog, `f` toggles panel, `Escape` exits
- Sort dropdown reorders files correctly for all 4 modes
- Labels don't collide in dense areas; hover reveals hidden labels
- Selected node has prominent glow ring

## Screenshot Capture Points
1. Graph with sized nodes and colored edges
2. Bidirectional linking (graph focused + file highlighted)
3. Keyboard shortcuts dialog
4. Sorted file list
5. Dense graph with readable labels
6. Selected node with glow effect
