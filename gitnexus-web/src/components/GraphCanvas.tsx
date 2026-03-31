import { useEffect, useCallback, useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Focus, RotateCcw, Play, Pause, Lightbulb, LightbulbOff } from 'lucide-react';
import { useSigma } from '../hooks/useSigma';
import { useAppState } from '../hooks/useAppState';
import { knowledgeGraphToGraphology, filterGraphByDepth, getNodesWithinHops, SigmaNodeAttributes, SigmaEdgeAttributes } from '../lib/graph-adapter';
import { QueryFAB } from './QueryFAB';
import Graph from 'graphology';

export interface GraphCanvasHandle {
  focusNode: (nodeId: string) => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle>((_, ref) => {
  const {
    graph,
    setSelectedNode,
    selectedNode: appSelectedNode,
    visibleLabels,
    visibleEdgeTypes,
    openCodePanel,
    depthFilter,
    highlightedNodeIds,
    setHighlightedNodeIds,
    aiCitationHighlightedNodeIds,
    aiToolHighlightedNodeIds,
    blastRadiusNodeIds,
    isAIHighlightsEnabled,
    toggleAIHighlights,
    animatedNodes,
    isDiffMode,
    diffChangedNodeIds,
    diffData,
    setSelectedDiffFile,
    diffFocusedSymbolId,
    setDiffFocusedSymbolId,
    diffGraphFilter,
    diffGraphDepth,
    setDiffGraphFilter,
    setDiffGraphDepth,
  } = useAppState();
  const [hoveredNodeName, setHoveredNodeName] = useState<string | null>(null);

  // Diff mode nodes (amber highlighting)
  const effectiveDiffNodeIds = useMemo(() => {
    if (!isDiffMode) return new Set<string>();
    return diffChangedNodeIds;
  }, [isDiffMode, diffChangedNodeIds]);

  const effectiveHighlightedNodeIds = useMemo(() => {
    if (!isAIHighlightsEnabled) return highlightedNodeIds;
    const next = new Set(highlightedNodeIds);
    for (const id of aiCitationHighlightedNodeIds) next.add(id);
    for (const id of aiToolHighlightedNodeIds) next.add(id);
    // Note: blast radius nodes are handled separately with red color
    return next;
  }, [highlightedNodeIds, aiCitationHighlightedNodeIds, aiToolHighlightedNodeIds, isAIHighlightsEnabled]);

  // Blast radius nodes (only when AI highlights enabled)
  const effectiveBlastRadiusNodeIds = useMemo(() => {
    if (!isAIHighlightsEnabled) return new Set<string>();
    return blastRadiusNodeIds;
  }, [blastRadiusNodeIds, isAIHighlightsEnabled]);

  // Animated nodes (only when AI highlights enabled)
  const effectiveAnimatedNodes = useMemo(() => {
    if (!isAIHighlightsEnabled) return new Map();
    return animatedNodes;
  }, [animatedNodes, isAIHighlightsEnabled]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!graph) return;

    const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();

    // Handle injected diff file nodes (not in knowledge graph)
    if (isDiffMode && diffData && nodeId.startsWith('diff_file_')) {
      const filePath = nodeId.replace('diff_file_', '').replace(/\\/g, '/');
      const targetFile = diffData.files.find(f => norm(f.filePath) === filePath);
      if (targetFile) {
        setSelectedDiffFile(targetFile.filePath);
        setDiffFocusedSymbolId(nodeId);
      }
      return;
    }

    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Graph → Diff: if in diff mode, navigate to the file for this node
    if (isDiffMode && diffData) {
      // Match by symbol ID
      let targetFile = diffData.files.find(f =>
        f.symbols.some(s => s.id === nodeId)
      );
      // Match File nodes by path (exact, suffix, filename)
      if (!targetFile && node.label === 'File' && node.properties.filePath) {
        const nodePath = norm(node.properties.filePath);
        const nodeName = nodePath.split('/').pop() || '';
        targetFile = diffData.files.find(f => norm(f.filePath) === nodePath)
          || diffData.files.find(f => norm(f.filePath).endsWith(nodePath) || nodePath.endsWith(norm(f.filePath)))
          || diffData.files.find(f => norm(f.filePath).split('/').pop() === nodeName);
      }
      if (targetFile) {
        setSelectedDiffFile(targetFile.filePath);
        setDiffFocusedSymbolId(nodeId);
        return;
      }
    }

    setSelectedNode(node);
    openCodePanel();
  }, [graph, setSelectedNode, openCodePanel, isDiffMode, diffData, setSelectedDiffFile, setDiffFocusedSymbolId]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    if (!nodeId || !graph) {
      setHoveredNodeName(null);
      return;
    }
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      setHoveredNodeName(node.properties.name);
    }
  }, [graph]);

  const handleStageClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const {
    containerRef,
    sigmaRef,
    setGraph: setSigmaGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    isLayoutRunning,
    startLayout,
    stopLayout,
    selectedNode: sigmaSelectedNode,
    setSelectedNode: setSigmaSelectedNode,
  } = useSigma({
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onStageClick: handleStageClick,
    highlightedNodeIds: effectiveHighlightedNodeIds,
    blastRadiusNodeIds: effectiveBlastRadiusNodeIds,
    animatedNodes: effectiveAnimatedNodes,
    visibleEdgeTypes,
    diffNodeIds: effectiveDiffNodeIds,
    diffFocusedNodeId: diffFocusedSymbolId,
  });

  // Expose focusNode to parent via ref
  useImperativeHandle(ref, () => ({
    focusNode: (nodeId: string) => {
      if (graph) {
        const node = graph.nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          openCodePanel();
        } else {
          // Injected diff node — clear app selection so stale state doesn't interfere
          setSelectedNode(null);
        }
      }
      focusNode(nodeId);
    }
  }), [focusNode, graph, setSelectedNode, openCodePanel]);

  // Update Sigma graph when KnowledgeGraph changes
  useEffect(() => {
    if (!graph) return;

    // Build communityMemberships map from MEMBER_OF relationships
    // MEMBER_OF edges: nodeId -> communityId (stored as targetId)
    const communityMemberships = new Map<string, number>();
    graph.relationships.forEach(rel => {
      if (rel.type === 'MEMBER_OF') {
        // Find the community node to get its index
        const communityNode = graph.nodes.find(n => n.id === rel.targetId && n.label === 'Community');
        if (communityNode) {
          // Extract community index from id (e.g., "comm_5" -> 5)
          const communityIdx = parseInt(rel.targetId.replace('comm_', ''), 10) || 0;
          communityMemberships.set(rel.sourceId, communityIdx);
        }
      }
    });

    const sigmaGraph = knowledgeGraphToGraphology(graph, communityMemberships);
    setSigmaGraph(sigmaGraph);
  }, [graph, setSigmaGraph]);

  // Update node visibility when filters change (skip in diff mode — diff filter owns visibility)
  useEffect(() => {
    if (isDiffMode) return;
    const sigma = sigmaRef.current;
    if (!sigma) return;

    const sigmaGraph = sigma.getGraph() as Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;
    if (sigmaGraph.order === 0) return;

    filterGraphByDepth(sigmaGraph, appSelectedNode?.id || null, depthFilter, visibleLabels);
    sigma.refresh();
  }, [isDiffMode, visibleLabels, depthFilter, appSelectedNode, sigmaRef]);

  // Track injected diff nodes so we can clean them up
  const injectedDiffNodesRef = useRef<Set<string>>(new Set());

  // Diff mode: hide non-impacted nodes when filter is 'impacted',
  // and inject temporary File nodes for diff files missing from the graph
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    const sigmaGraph = sigma.getGraph() as Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;
    if (sigmaGraph.order === 0 && !isDiffMode) return;

    // Clean up previously injected nodes
    for (const id of injectedDiffNodesRef.current) {
      if (sigmaGraph.hasNode(id)) sigmaGraph.dropNode(id);
    }
    injectedDiffNodesRef.current.clear();

    // Inject missing diff file nodes into the sigma graph
    if (isDiffMode && diffData) {
      const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
      // Build set of file paths already in sigma graph
      const existingPaths = new Set<string>();
      sigmaGraph.forEachNode((_, attrs) => {
        if (attrs.nodeType === 'File' && attrs.filePath) {
          existingPaths.add(norm(attrs.filePath));
        }
      });

      // Spread new nodes around center
      let angle = 0;
      const radius = 50;
      for (const file of diffData.files) {
        const fp = norm(file.filePath);
        const fileName = file.filePath.split('/').pop() || file.filePath;
        // Check if any existing node matches this file
        const hasMatch = existingPaths.has(fp)
          || [...existingPaths].some(ep => ep.endsWith(fp) || fp.endsWith(ep))
          || [...existingPaths].some(ep => ep.split('/').pop() === fp.split('/').pop());
        if (!hasMatch) {
          const nodeId = `diff_file_${fp}`;
          if (!sigmaGraph.hasNode(nodeId)) {
            sigmaGraph.addNode(nodeId, {
              x: Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
              y: Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
              size: 6,
              color: '#f59e0b',
              label: fileName,
              nodeType: 'File' as any,
              filePath: file.filePath,
              hidden: false,
            });
            injectedDiffNodesRef.current.add(nodeId);
            angle += (Math.PI * 2) / Math.max(diffData.files.length, 1);
          }
        }
      }
    }

    const allDiffIds = new Set([...diffChangedNodeIds, ...injectedDiffNodesRef.current]);

    if (isDiffMode && diffGraphFilter === 'impacted' && allDiffIds.size > 0) {
      // Build full set of visible node IDs: changed + injected + optional neighbors
      const visibleNodes = new Set<string>();
      for (const nodeId of allDiffIds) {
        if (sigmaGraph.hasNode(nodeId)) {
          if (diffGraphDepth === 0) {
            visibleNodes.add(nodeId);
          } else {
            const reachable = getNodesWithinHops(sigmaGraph, nodeId, diffGraphDepth);
            for (const id of reachable) visibleNodes.add(id);
          }
        }
      }
      sigmaGraph.forEachNode((nodeId, attrs) => {
        const isLabelVisible = visibleLabels.includes(attrs.nodeType);
        sigmaGraph.setNodeAttribute(nodeId, 'hidden', !visibleNodes.has(nodeId) || !isLabelVisible);
      });
    } else if (isDiffMode && diffGraphFilter === 'all') {
      sigmaGraph.forEachNode((nodeId, attrs) => {
        const isLabelVisible = visibleLabels.includes(attrs.nodeType);
        sigmaGraph.setNodeAttribute(nodeId, 'hidden', !isLabelVisible);
      });
    }
    sigma.refresh();
  }, [isDiffMode, diffData, diffGraphFilter, diffGraphDepth, diffChangedNodeIds, visibleLabels, sigmaRef]);

  // Sync app selected node with sigma (skip null sync in diff mode — focusNode drives selection)
  useEffect(() => {
    if (appSelectedNode) {
      setSigmaSelectedNode(appSelectedNode.id);
    } else if (!isDiffMode) {
      setSigmaSelectedNode(null);
    }
  }, [appSelectedNode, setSigmaSelectedNode, isDiffMode]);

  // Focus on selected node
  const handleFocusSelected = useCallback(() => {
    if (appSelectedNode) {
      focusNode(appSelectedNode.id);
    }
  }, [appSelectedNode, focusNode]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNode(null);
    setSigmaSelectedNode(null);
    resetZoom();
  }, [setSelectedNode, setSigmaSelectedNode, resetZoom]);

  return (
    <div className="relative w-full h-full bg-void">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.03) 0%, transparent 70%),
              linear-gradient(to bottom, #06060a, #0a0a10)
            `
          }}
        />
      </div>

      {/* Sigma container */}
      <div
        ref={containerRef}
        className="sigma-container w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Hovered node tooltip - only show when NOT selected */}
      {hoveredNodeName && !sigmaSelectedNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-elevated/95 border border-border-subtle rounded-lg backdrop-blur-sm z-20 pointer-events-none animate-fade-in">
          <span className="font-mono text-sm text-text-primary">{hoveredNodeName}</span>
        </div>
      )}

      {/* Selection info bar */}
      {sigmaSelectedNode && appSelectedNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-accent/20 border border-accent/30 rounded-xl backdrop-blur-sm z-20 animate-slide-up">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-sm text-text-primary">
            {appSelectedNode.properties.name}
          </span>
          <span className="text-xs text-text-muted">
            ({appSelectedNode.label})
          </span>
          <button
            onClick={handleClearSelection}
            className="ml-2 px-2 py-0.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Graph Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetZoom}
          className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-px bg-border-subtle my-1" />

        {/* Focus on selected */}
        {appSelectedNode && (
          <button
            onClick={handleFocusSelected}
            className="w-9 h-9 flex items-center justify-center bg-accent/20 border border-accent/30 rounded-md text-accent hover:bg-accent/30 transition-colors"
            title="Focus on Selected Node"
          >
            <Focus className="w-4 h-4" />
          </button>
        )}

        {/* Clear selection */}
        {sigmaSelectedNode && (
          <button
            onClick={handleClearSelection}
            className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
            title="Clear Selection"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Divider */}
        <div className="h-px bg-border-subtle my-1" />

        {/* Layout control */}
        <button
          onClick={isLayoutRunning ? stopLayout : startLayout}
          className={`
            w-9 h-9 flex items-center justify-center border rounded-md transition-all
            ${isLayoutRunning
              ? 'bg-accent border-accent text-white shadow-glow animate-pulse'
              : 'bg-elevated border-border-subtle text-text-secondary hover:bg-hover hover:text-text-primary'
            }
          `}
          title={isLayoutRunning ? 'Stop Layout' : 'Run Layout Again'}
        >
          {isLayoutRunning ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Layout running indicator */}
      {isLayoutRunning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full backdrop-blur-sm z-10 animate-fade-in">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          <span className="text-xs text-emerald-400 font-medium">Layout optimizing...</span>
        </div>
      )}

      {/* Query FAB */}
      <QueryFAB />

      {/* AI Highlights toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => {
            // If turning off, also clear process highlights
            if (isAIHighlightsEnabled) {
              setHighlightedNodeIds(new Set());
            }
            toggleAIHighlights();
          }}
          className={
            isAIHighlightsEnabled
              ? 'w-10 h-10 flex items-center justify-center bg-cyan-500/15 border border-cyan-400/40 rounded-lg text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-300/60 transition-colors'
              : 'w-10 h-10 flex items-center justify-center bg-elevated border border-border-subtle rounded-lg text-text-muted hover:bg-hover hover:text-text-primary transition-colors'
          }
          title={isAIHighlightsEnabled ? 'Turn off all highlights' : 'Turn on AI highlights'}
        >
          {isAIHighlightsEnabled ? <Lightbulb className="w-4 h-4" /> : <LightbulbOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Diff Mode: Centered banner when showing impacted only */}
      {isDiffMode && diffGraphFilter === 'impacted' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-amber-500/15 border border-amber-500/30 rounded-xl backdrop-blur-sm z-20 animate-fade-in">
          <div className="w-2 h-2 bg-amber-400 rounded-full" />
          <span className="text-xs text-amber-300 font-medium">Showing impacted nodes only</span>
          <button
            onClick={() => setDiffGraphFilter('all')}
            className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded-md text-xs font-medium text-amber-200 hover:bg-amber-500/30 transition-colors"
          >
            Show All Nodes
          </button>
        </div>
      )}

      {/* Diff Mode Graph Controls */}
      {isDiffMode && (
        <div className="absolute top-16 right-4 z-20 flex flex-col gap-1.5 animate-fade-in">
          {/* Only Impacted toggle */}
          <button
            onClick={() => setDiffGraphFilter(diffGraphFilter === 'all' ? 'impacted' : 'all')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              diffGraphFilter === 'impacted'
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                : 'bg-elevated border-border-subtle text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="9" y="12" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/></svg>
            {diffGraphFilter === 'impacted' ? 'Show All Nodes' : 'Only Impacted'}
          </button>

          {/* Depth slider */}
          {diffGraphFilter === 'impacted' && (
            <div className="px-3 py-2 bg-elevated border border-border-subtle rounded-lg">
              <div className="text-[10px] text-text-muted mb-1">{diffGraphDepth === 0 ? 'Changed only' : `Depth: ${diffGraphDepth} hop${diffGraphDepth > 1 ? 's' : ''}`}</div>
              <input
                type="range"
                min={0}
                max={3}
                value={diffGraphDepth}
                onChange={e => setDiffGraphDepth(Number(e.target.value))}
                className="w-full h-1 accent-amber-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
