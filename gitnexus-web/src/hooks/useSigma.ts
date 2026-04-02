import { useRef, useEffect, useCallback, useState } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import EdgeCurveProgram from '@sigma/edge-curve';
import { SigmaNodeAttributes, SigmaEdgeAttributes } from '../lib/graph-adapter';
import type { NodeAnimation } from './useAppState';
import type { EdgeType } from '../lib/constants';
import { EDGE_TYPE_COLORS } from '../lib/constants';
// Helper: Parse hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 100, g: 100, b: 100 };
};

// Helper: RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// Dim a color by mixing with dark background (keeps color hint)
const dimColor = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex);
  const darkBg = { r: 18, g: 18, b: 28 }; // #12121c - dark background
  return rgbToHex(
    darkBg.r + (rgb.r - darkBg.r) * amount,
    darkBg.g + (rgb.g - darkBg.g) * amount,
    darkBg.b + (rgb.b - darkBg.b) * amount
  );
};

// Brighten a color (increase luminosity)
const brightenColor = (hex: string, factor: number): string => {
  const rgb = hexToRgb(hex);
  return rgbToHex(
    rgb.r + (255 - rgb.r) * (factor - 1) / factor,
    rgb.g + (255 - rgb.g) * (factor - 1) / factor,
    rgb.b + (255 - rgb.b) * (factor - 1) / factor
  );
};

interface UseSigmaOptions {
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onStageClick?: () => void;
  highlightedNodeIds?: Set<string>;
  blastRadiusNodeIds?: Set<string>;
  animatedNodes?: Map<string, NodeAnimation>;
  visibleEdgeTypes?: EdgeType[];
  diffNodeIds?: Set<string>;
  diffFocusedNodeId?: string | null;
  /** Map from node ID to change size (additions + deletions) for diff mode sizing */
  diffChangeSizeMap?: Map<string, number>;
}

interface UseSigmaReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  sigmaRef: React.RefObject<Sigma | null>;
  setGraph: (graph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  focusNode: (nodeId: string) => void;
  isLayoutRunning: boolean;
  startLayout: () => void;
  stopLayout: () => void;
  selectedNode: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  refreshHighlights: () => void;
}

// Noverlap for final cleanup - minimal since it starts with good positions
const NOVERLAP_SETTINGS = {
  maxIterations: 20,  // Reduced - less cleanup needed
  ratio: 1.1,
  margin: 10,
  expansion: 1.05,
};

// ForceAtlas2 settings - FAST convergence since nodes start near their parents
const getFA2Settings = (nodeCount: number) => {
  const isSmall = nodeCount < 500;
  const isMedium = nodeCount >= 500 && nodeCount < 2000;
  const isLarge = nodeCount >= 2000 && nodeCount < 10000;
  
  return {
    // Lower gravity allows folders to stay spread out
    gravity: isSmall ? 0.8 : isMedium ? 0.5 : isLarge ? 0.3 : 0.15,
    
    // Higher scaling ratio = more spread out overall
    scalingRatio: isSmall ? 15 : isMedium ? 30 : isLarge ? 60 : 100,
    
    // LOW slowDown = FASTER movement (converges quicker)
    slowDown: isSmall ? 1 : isMedium ? 2 : isLarge ? 3 : 5,
    
    // Barnes-Hut for performance - use it even on smaller graphs
    barnesHutOptimize: nodeCount > 200,
    barnesHutTheta: isLarge ? 0.8 : 0.6,  // Higher = faster but less accurate
    
    // These help with clustering while keeping spread
    strongGravityMode: false,
    outboundAttractionDistribution: true,
    linLogMode: false,
    adjustSizes: true,
    edgeWeightInfluence: 1,
  };
};

// Layout duration - let it run longer for better results
// Web Worker + WebGL means minimal system impact
const getLayoutDuration = (nodeCount: number): number => {
  if (nodeCount > 10000) return 45000;  // 45s for huge graphs
  if (nodeCount > 5000) return 35000;   // 35s
  if (nodeCount > 2000) return 30000;   // 30s
  if (nodeCount > 1000) return 30000;   // 30s
  if (nodeCount > 500) return 25000;    // 25s
  return 20000;                         // 20s for small graphs
};

export const useSigma = (options: UseSigmaOptions = {}): UseSigmaReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph<SigmaNodeAttributes, SigmaEdgeAttributes> | null>(null);
  const layoutRef = useRef<FA2Layout | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  const highlightedRef = useRef<Set<string>>(new Set());
  const blastRadiusRef = useRef<Set<string>>(new Set());
  const diffNodesRef = useRef<Set<string>>(new Set());
  const diffFocusedRef = useRef<string | null>(null);
  const diffChangeSizeMapRef = useRef<Map<string, number>>(new Map());
  const animatedNodesRef = useRef<Map<string, NodeAnimation>>(new Map());
  const hoveredNodeRef = useRef<string | null>(null);
  const visibleEdgeTypesRef = useRef<EdgeType[] | null>(null);
  const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [selectedNode, setSelectedNodeState] = useState<string | null>(null);

  useEffect(() => {
    highlightedRef.current = options.highlightedNodeIds || new Set();
    blastRadiusRef.current = options.blastRadiusNodeIds || new Set();
    diffNodesRef.current = options.diffNodeIds || new Set();
    diffFocusedRef.current = options.diffFocusedNodeId || null;
    diffChangeSizeMapRef.current = options.diffChangeSizeMap || new Map();
    animatedNodesRef.current = options.animatedNodes || new Map();
    visibleEdgeTypesRef.current = options.visibleEdgeTypes || null;
    sigmaRef.current?.refresh();
  }, [options.highlightedNodeIds, options.blastRadiusNodeIds, options.diffNodeIds, options.diffFocusedNodeId, options.diffChangeSizeMap, options.animatedNodes, options.visibleEdgeTypes]);

  // Step 2: Adjust label density settings when entering/exiting diff mode
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    const isDiffMode = (options.diffNodeIds?.size ?? 0) > 0;
    if (isDiffMode) {
      sigma.setSetting('labelGridCellSize', 120);
      sigma.setSetting('labelRenderedSizeThreshold', 12);
    } else {
      sigma.setSetting('labelGridCellSize', 70);
      sigma.setSetting('labelRenderedSizeThreshold', 8);
    }
  }, [options.diffNodeIds]);

  // Animation loop for node effects
  useEffect(() => {
    if (!options.animatedNodes || options.animatedNodes.size === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = () => {
      sigmaRef.current?.refresh();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [options.animatedNodes]);

  const setSelectedNode = useCallback((nodeId: string | null) => {
    selectedNodeRef.current = nodeId;
    setSelectedNodeState(nodeId);

    const sigma = sigmaRef.current;
    if (!sigma) return;

    // Immediate refresh to re-run nodeReducer with new selection
    sigma.refresh();

    // Tiny camera nudge to force edge/label cache invalidation
    const camera = sigma.getCamera();
    const currentRatio = camera.ratio;
    camera.animate(
      { ratio: currentRatio * 1.0001 },
      { duration: 50 }
    );
    // Second refresh after animation to ensure labels are fully updated
    setTimeout(() => sigma.refresh(), 60);
  }, []);

  // Initialize Sigma ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>();
    graphRef.current = graph;

    const sigma = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      labelFont: 'JetBrains Mono, monospace',
      labelSize: 11,
      labelWeight: '500',
      labelColor: { color: '#e4e4ed' },
      labelRenderedSizeThreshold: 8,
      labelDensity: 0.1,
      labelGridCellSize: 70,
      
      defaultNodeColor: '#6b7280',
      defaultEdgeColor: '#2a2a3a',
      
      defaultEdgeType: 'curved',
      edgeProgramClasses: {
        curved: EdgeCurveProgram,
      },
      
      // Custom hover renderer - dark background instead of white
      // Also serves as the selected node glow renderer (Step 8)
      defaultDrawNodeHover: (context, data, settings) => {
        const label = data.label;
        if (!label) return;

        const size = settings.labelSize || 11;
        const font = settings.labelFont || 'JetBrains Mono, monospace';
        const weight = settings.labelWeight || '500';

        context.font = `${weight} ${size}px ${font}`;
        const textWidth = context.measureText(label).width;

        const nodeSize = data.size || 8;
        const nodeColor = data.color || '#6366f1';
        const x = data.x;
        const y = data.y - nodeSize - 10;
        const paddingX = 8;
        const paddingY = 5;
        const height = size + paddingY * 2;
        const width = textWidth + paddingX * 2;
        const radius = 4;

        // Dark background pill
        context.fillStyle = '#12121c';
        context.beginPath();
        context.roundRect(x - width / 2, y - height / 2, width, height, radius);
        context.fill();

        // Border matching node color - brighter for selected
        context.strokeStyle = brightenColor(nodeColor, 1.3);
        context.lineWidth = 2;
        context.stroke();

        // Label text - light color
        context.fillStyle = '#f5f5f7';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, x, y);

        // Outer glow ring (semi-transparent, larger)
        context.beginPath();
        context.arc(data.x, data.y, nodeSize + 8, 0, Math.PI * 2);
        context.strokeStyle = nodeColor;
        context.lineWidth = 2;
        context.globalAlpha = 0.2;
        context.stroke();
        context.globalAlpha = 1;

        // Inner glow ring around the node - brighter border
        context.beginPath();
        context.arc(data.x, data.y, nodeSize + 4, 0, Math.PI * 2);
        context.strokeStyle = brightenColor(nodeColor, 1.4);
        context.lineWidth = 2.5;
        context.globalAlpha = 0.6;
        context.stroke();
        context.globalAlpha = 1;
      },
      
      minCameraRatio: 0.002,
      maxCameraRatio: 50,
      hideEdgesOnMove: true,
      zIndex: true,
      
      nodeReducer: (node, data) => {
        const res = { ...data };

        if (data.hidden) {
          res.hidden = true;
          return res;
        }

        const currentSelected = selectedNodeRef.current;
        const highlighted = highlightedRef.current;
        const blastRadius = blastRadiusRef.current;
        const diffNodes = diffNodesRef.current;
        const animatedNodes = animatedNodesRef.current;
        const hasHighlights = highlighted.size > 0;
        const hasBlastRadius = blastRadius.size > 0;
        const hasDiffNodes = diffNodes.size > 0;
        const isQueryHighlighted = highlighted.has(node);
        const isBlastRadiusNode = blastRadius.has(node);
        const isDiffNode = diffNodes.has(node);

        // Apply animation effects FIRST (before other highlighting)
        const animation = animatedNodes.get(node);
        if (animation) {
          const now = Date.now();
          const elapsed = now - animation.startTime;
          const progress = Math.min(elapsed / animation.duration, 1);

          // Calculate animation phase (0-1-0-1... oscillation)
          const phase = (Math.sin(progress * Math.PI * 4) + 1) / 2;

          if (animation.type === 'pulse') {
            // Cyan pulse for search results
            const sizeMultiplier = 1.5 + phase * 0.8;
            res.size = (data.size || 8) * sizeMultiplier;
            res.color = phase > 0.5 ? '#06b6d4' : brightenColor('#06b6d4', 1.3);
            res.zIndex = 5;
            res.highlighted = true;
          } else if (animation.type === 'ripple') {
            // Red ripple for blast radius
            const sizeMultiplier = 1.3 + phase * 1.2;
            res.size = (data.size || 8) * sizeMultiplier;
            res.color = phase > 0.5 ? '#ef4444' : '#f87171';
            res.zIndex = 5;
            res.highlighted = true;
          } else if (animation.type === 'glow') {
            // Purple glow for highlight
            const sizeMultiplier = 1.4 + phase * 0.6;
            res.size = (data.size || 8) * sizeMultiplier;
            res.color = phase > 0.5 ? '#a855f7' : '#c084fc';
            res.zIndex = 5;
            res.highlighted = true;
          }

          return res;
        }

        // Diff mode highlighting (amber) with change-magnitude sizing (Step 1)
        if (hasDiffNodes && !currentSelected) {
          const changeSizeMap = diffChangeSizeMapRef.current;
          if (isDiffNode) {
            res.color = '#f59e0b'; // Amber for changed symbols
            // Scale size by change magnitude: baseSize * (1 + log2(1 + additions + deletions) * 0.3), capped at 3x
            const changeSize = changeSizeMap.get(node) || 0;
            const baseSize = data.size || 8;
            const sizeMultiplier = changeSize > 0
              ? Math.min(3, 1 + Math.log2(1 + changeSize) * 0.3)
              : 1.6;
            res.size = baseSize * sizeMultiplier;
            res.zIndex = 3;
            res.highlighted = true;
            // Force labels on heavily changed nodes (Step 2)
            if (changeSize > 50) {
              res.forceLabel = true;
            }
          } else if (isBlastRadiusNode) {
            res.color = '#ef4444';
            res.size = (data.size || 8) * 1.4;
            res.zIndex = 2;
            res.highlighted = true;
          } else if (isQueryHighlighted) {
            res.color = '#06b6d4';
            res.size = (data.size || 8) * 1.2;
            res.zIndex = 1;
            res.highlighted = true;
          } else {
            res.color = dimColor(data.color, 0.15);
            res.size = (data.size || 8) * 0.4;
            res.zIndex = 0;
          }
          return res;
        }

        // Blast radius takes priority (red highlighting)
        if (hasBlastRadius && !currentSelected) {
          if (isBlastRadiusNode) {
            res.color = '#ef4444'; // Red for blast radius
            res.size = (data.size || 8) * 1.8;
            res.zIndex = 3;
            res.highlighted = true;
          } else if (isQueryHighlighted) {
            // Regular cyan highlight for non-blast-radius nodes
            res.color = '#06b6d4';
            res.size = (data.size || 8) * 1.4;
            res.zIndex = 2;
            res.highlighted = true;
          } else {
            res.color = dimColor(data.color, 0.15);
            res.size = (data.size || 8) * 0.4;
            res.zIndex = 0;
          }
          return res;
        }

        if (hasHighlights && !currentSelected) {
          if (isQueryHighlighted) {
            res.color = '#06b6d4';
            res.size = (data.size || 8) * 1.6;
            res.zIndex = 2;
            res.highlighted = true;
          } else {
            res.color = dimColor(data.color, 0.2);
            res.size = (data.size || 8) * 0.5;
            res.zIndex = 0;
          }
          return res;
        }
        
        if (currentSelected) {
          const graph = graphRef.current;
          if (graph) {
            const isSelected = node === currentSelected;
            const isNeighbor = graph.hasEdge(node, currentSelected) || graph.hasEdge(currentSelected, node);

            if (isSelected) {
              // Step 8: Enhanced selected node glow - 1.8x size, brighter color
              res.color = brightenColor(data.color, 1.3);
              res.size = (data.size || 8) * 1.8;
              res.zIndex = 3;
              res.highlighted = true;
              res.forceLabel = true;
            } else if (isNeighbor) {
              res.color = data.color;
              res.size = (data.size || 8) * 1.3;
              res.zIndex = 1;
              res.forceLabel = true;
            } else {
              res.hidden = true;
            }
          }
        }
        
        // Hovered node always on top
        if (hoveredNodeRef.current === node) {
          res.zIndex = 10;
        }

        return res;
      },

      edgeReducer: (edge, data) => {
        const res = { ...data };

        // Check edge type visibility first
        const visibleTypes = visibleEdgeTypesRef.current;
        if (visibleTypes && data.relationType) {
          if (!visibleTypes.includes(data.relationType as EdgeType)) {
            res.hidden = true;
            return res;
          }
        }

        const currentSelected = selectedNodeRef.current;
        const highlighted = highlightedRef.current;
        const blastRadius = blastRadiusRef.current;
        const diffNodes = diffNodesRef.current;
        const hasDiffNodes = diffNodes.size > 0;
        const hasHighlights = highlighted.size > 0 || blastRadius.size > 0 || hasDiffNodes;

        if (hasHighlights && !currentSelected) {
          const graph = graphRef.current;
          if (graph) {
            const [source, target] = graph.extremities(edge);

            // Check if nodes are in ANY active set
            const isSourceDiff = diffNodes.has(source);
            const isTargetDiff = diffNodes.has(target);
            const isSourceActive = highlighted.has(source) || blastRadius.has(source) || isSourceDiff;
            const isTargetActive = highlighted.has(target) || blastRadius.has(target) || isTargetDiff;

            const bothHighlighted = isSourceActive && isTargetActive;
            const oneHighlighted = isSourceActive || isTargetActive;

            if (bothHighlighted) {
              // Color by highest-priority set both ends share
              if (isSourceDiff && isTargetDiff) {
                res.color = '#f59e0b'; // Amber for changed-to-changed edges
              } else if (blastRadius.has(source) && blastRadius.has(target)) {
                res.color = '#ef4444';
              } else if (hasDiffNodes && (isSourceDiff || isTargetDiff)) {
                // Step 3: Use edge type color for edges from changed to non-changed in diff mode
                const edgeTypeColor = data.relationType ? EDGE_TYPE_COLORS[data.relationType] : null;
                res.color = edgeTypeColor || '#06b6d4';
              } else {
                res.color = '#06b6d4';
              }
              res.size = Math.max(2, (data.size || 1) * 3);
              res.zIndex = 2;
            } else if (oneHighlighted) {
              // Step 3: Use dimmed edge type color when one end is highlighted
              if (hasDiffNodes && data.relationType) {
                const edgeTypeColor = EDGE_TYPE_COLORS[data.relationType];
                res.color = edgeTypeColor ? dimColor(edgeTypeColor, 0.4) : dimColor('#06b6d4', 0.4);
              } else {
                res.color = dimColor('#06b6d4', 0.4);
              }
              res.size = 1;
              res.zIndex = 1;
            } else {
              res.color = dimColor(data.color, 0.08);
              res.size = 0.2;
              res.zIndex = 0;
            }
          }
          return res;
        }

        // Step 3: In non-highlight mode, apply edge type colors in diff mode
        if (hasDiffNodes && !currentSelected && data.relationType) {
          const edgeTypeColor = EDGE_TYPE_COLORS[data.relationType];
          if (edgeTypeColor) {
            res.color = edgeTypeColor;
          }
          return res;
        }
        
        if (currentSelected) {
          const graph = graphRef.current;
          if (graph) {
            const [source, target] = graph.extremities(edge);
            const isConnected = source === currentSelected || target === currentSelected;
            
            if (isConnected) {
              res.color = brightenColor(data.color, 1.5);
              res.size = Math.max(3, (data.size || 1) * 4);
              res.zIndex = 2;
            } else {
              res.color = dimColor(data.color, 0.1);
              res.size = 0.3;
              res.zIndex = 0;
            }
          }
        }
        
        return res;
      },
    });

    sigmaRef.current = sigma;
    // Expose for testing/debugging
    (window as any).__SIGMA__ = sigma;

    sigma.on('clickNode', ({ node }) => {
      setSelectedNode(node);
      options.onNodeClick?.(node);
    });

    sigma.on('clickStage', () => {
      setSelectedNode(null);
      options.onStageClick?.();
    });

    sigma.on('enterNode', ({ node }) => {
      hoveredNodeRef.current = node;
      options.onNodeHover?.(node);
      sigma.refresh();
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
    });

    sigma.on('leaveNode', () => {
      hoveredNodeRef.current = null;
      options.onNodeHover?.(null);
      sigma.refresh();
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    });

    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
      layoutRef.current?.kill();
      sigma.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
  }, []);

  // Run ForceAtlas2 layout
  const runLayout = useCallback((graph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>) => {
    const nodeCount = graph.order;
    if (nodeCount === 0) return;

    // Kill existing
    if (layoutRef.current) {
      layoutRef.current.kill();
      layoutRef.current = null;
    }
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
      layoutTimeoutRef.current = null;
    }

    // Get settings
    const inferredSettings = forceAtlas2.inferSettings(graph);
    const customSettings = getFA2Settings(nodeCount);
    const settings = { ...inferredSettings, ...customSettings };
    
    const layout = new FA2Layout(graph, { settings });
    
    layoutRef.current = layout;
    layout.start();
    setIsLayoutRunning(true);

    const duration = getLayoutDuration(nodeCount);
    
    layoutTimeoutRef.current = setTimeout(() => {
      if (layoutRef.current) {
        layoutRef.current.stop();
        layoutRef.current = null;
        
        // Light noverlap cleanup
        noverlap.assign(graph, NOVERLAP_SETTINGS);
        sigmaRef.current?.refresh();
        
        setIsLayoutRunning(false);
      }
    }, duration);
  }, []);

  const setGraph = useCallback((newGraph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>) => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    if (layoutRef.current) {
      layoutRef.current.kill();
      layoutRef.current = null;
    }
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
      layoutTimeoutRef.current = null;
    }

    graphRef.current = newGraph;
    sigma.setGraph(newGraph);
    setSelectedNode(null);

    runLayout(newGraph);
    sigma.getCamera().animatedReset({ duration: 500 });
  }, [runLayout, setSelectedNode]);

  const focusNode = useCallback((nodeId: string) => {
    const sigma = sigmaRef.current;
    const graph = graphRef.current;
    if (!sigma || !graph || !graph.hasNode(nodeId)) return;

    const alreadySelected = selectedNodeRef.current === nodeId;

    // Update selection
    selectedNodeRef.current = nodeId;
    setSelectedNodeState(nodeId);

    // Immediate refresh to clear old neighbor labels and set new ones
    sigma.refresh();

    // Animate camera to new node (keep current zoom or zoom to 0.4, whichever is closer)
    if (!alreadySelected) {
      const nodeAttrs = graph.getNodeAttributes(nodeId);
      const currentRatio = sigma.getCamera().ratio;
      const targetRatio = Math.min(currentRatio, 0.4);
      sigma.getCamera().animate(
        { x: nodeAttrs.x, y: nodeAttrs.y, ratio: targetRatio },
        { duration: 400 }
      );
    }
    // Post-animation refresh to ensure labels are fully updated
    setTimeout(() => sigma.refresh(), 420);
  }, []);

  const zoomIn = useCallback(() => {
    sigmaRef.current?.getCamera().animatedZoom({ duration: 200 });
  }, []);

  const zoomOut = useCallback(() => {
    sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 });
  }, []);

  const resetZoom = useCallback(() => {
    sigmaRef.current?.getCamera().animatedReset({ duration: 300 });
    setSelectedNode(null);
  }, [setSelectedNode]);

  const startLayout = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || graph.order === 0) return;
    runLayout(graph);
  }, [runLayout]);

  const stopLayout = useCallback(() => {
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
      layoutTimeoutRef.current = null;
    }
    if (layoutRef.current) {
      layoutRef.current.stop();
      layoutRef.current = null;
      
      const graph = graphRef.current;
      if (graph) {
        noverlap.assign(graph, NOVERLAP_SETTINGS);
        sigmaRef.current?.refresh();
      }
      
      setIsLayoutRunning(false);
    }
  }, []);

  const refreshHighlights = useCallback(() => {
    sigmaRef.current?.refresh();
  }, []);

  return {
    containerRef,
    sigmaRef,
    setGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    isLayoutRunning,
    startLayout,
    stopLayout,
    selectedNode,
    setSelectedNode,
    refreshHighlights,
  };
};
