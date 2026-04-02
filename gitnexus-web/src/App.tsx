import { useCallback, useEffect, useRef, useState } from 'react';
import { AppStateProvider, useAppState } from './hooks/useAppState';
import { DropZone } from './components/DropZone';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Header } from './components/Header';
import { GraphCanvas, GraphCanvasHandle } from './components/GraphCanvas';
import { RightPanel } from './components/RightPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { FileTreePanel } from './components/FileTreePanel';
import { CodeReferencesPanel } from './components/CodeReferencesPanel';
import { DiffPanel } from './components/diff';
import { DiffStructureOverlay } from './components/diff/DiffStructureOverlay';
import { BranchDiffDialog } from './components/BranchDiffDialog';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { FileEntry } from './services/zip';
import { getActiveProviderConfig } from './core/llm/settings-service';
import { createKnowledgeGraph } from './core/graph/graph';
import { connectToServer, fetchRepos, normalizeServerUrl, type ConnectToServerResult } from './services/server-connection';

const AppContent = () => {
  const {
    viewMode,
    setViewMode,
    setGraph,
    setFileContents,
    setProgress,
    setProjectName,
    progress,
    isRightPanelOpen,
    runPipeline,
    runPipelineFromFiles,
    isSettingsPanelOpen,
    setSettingsPanelOpen,
    refreshLLMSettings,
    initializeAgent,
    startEmbeddings,
    embeddingStatus,
    codeReferences,
    selectedNode,
    isCodePanelOpen,
    serverBaseUrl,
    setServerBaseUrl,
    availableRepos,
    setAvailableRepos,
    switchRepo,
    hydrateWorkerFromServer,
    isDiffMode,
    diffData,
    diffLoading,
    diffError,
    diffViewMode,
    setDiffViewMode,
    setPendingServerResult,
    isDiffPanelCollapsed,
    toggleDiffPanel,
    startDiff,
    commitServerConnection,
    setDiffGraphFilter,
    pendingServerResult,
    selectedDiffFile,
    setSelectedDiffFile,
    exitDiffMode,
  } = useAppState();

  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    const projectName = file.name.replace('.zip', '');
    setProjectName(projectName);
    setProgress({ phase: 'extracting', percent: 0, message: 'Starting...', detail: 'Preparing to extract files' });
    setViewMode('loading');

    try {
      const result = await runPipeline(file, (progress) => {
        setProgress(progress);
      });

      setGraph(result.graph);
      setFileContents(result.fileContents);
      setViewMode('exploring');

      // Initialize (or re-initialize) the agent AFTER a repo loads so it captures
      // the current codebase context (file contents + graph tools) in the worker.
      if (getActiveProviderConfig()) {
        initializeAgent(projectName);
      }

      // Auto-start embeddings pipeline in background
      // Uses WebGPU if available, falls back to WASM
      startEmbeddings().catch((err) => {
        if (err?.name === 'WebGPUNotAvailableError' || err?.message?.includes('WebGPU')) {
          startEmbeddings('wasm').catch(console.warn);
        } else {
          console.warn('Embeddings auto-start failed:', err);
        }
      });
    } catch (error) {
      console.error('Pipeline error:', error);
      setProgress({
        phase: 'error',
        percent: 0,
        message: 'Error processing file',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
      setTimeout(() => {
        setViewMode('onboarding');
        setProgress(null);
      }, 3000);
    }
  }, [setViewMode, setGraph, setFileContents, setProgress, setProjectName, runPipeline, startEmbeddings, initializeAgent]);

  const handleGitClone = useCallback(async (files: FileEntry[]) => {
    const firstPath = files[0]?.path || 'repository';
    const projectName = firstPath.split('/')[0].replace(/-\d+$/, '') || 'repository';

    setProjectName(projectName);
    setProgress({ phase: 'extracting', percent: 0, message: 'Starting...', detail: 'Preparing to process files' });
    setViewMode('loading');

    try {
      const result = await runPipelineFromFiles(files, (progress) => {
        setProgress(progress);
      });

      setGraph(result.graph);
      setFileContents(result.fileContents);
      setViewMode('exploring');

      if (getActiveProviderConfig()) {
        initializeAgent(projectName);
      }

      startEmbeddings().catch((err) => {
        if (err?.name === 'WebGPUNotAvailableError' || err?.message?.includes('WebGPU')) {
          startEmbeddings('wasm').catch(console.warn);
        } else {
          console.warn('Embeddings auto-start failed:', err);
        }
      });
    } catch (error) {
      console.error('Pipeline error:', error);
      setProgress({
        phase: 'error',
        percent: 0,
        message: 'Error processing repository',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
      setTimeout(() => {
        setViewMode('onboarding');
        setProgress(null);
      }, 3000);
    }
  }, [setViewMode, setGraph, setFileContents, setProgress, setProjectName, runPipelineFromFiles, startEmbeddings, initializeAgent]);

  const handleServerConnect = useCallback((result: ConnectToServerResult) => {
    // Store result and set project name (needed for fetchBranches), then show branch picker
    const repoPath = result.repoInfo.repoPath;
    const pName = result.repoInfo.name || repoPath.split('/').pop() || 'server-project';
    setProjectName(pName);
    setPendingServerResult(result);
    setProgress(null);
    setViewMode('branch-picker');
  }, [setViewMode, setProjectName, setProgress, setPendingServerResult]);

  // Auto-connect when ?server query param is present (bookmarkable shortcut)
  const autoConnectRan = useRef(false);
  const pendingAutoDiff = useRef<{ base: string; head?: string } | null>(null);
  useEffect(() => {
    if (autoConnectRan.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('server')) return;
    autoConnectRan.current = true;

    const autoDiffBase = params.get('base');
    const autoDiffHead = params.get('head');
    if (autoDiffBase) {
      pendingAutoDiff.current = { base: autoDiffBase, head: autoDiffHead || undefined };
    }

    // Clean the URL so a refresh won't re-trigger
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);

    setProgress({ phase: 'extracting', percent: 0, message: 'Connecting to server...', detail: 'Validating server' });
    setViewMode('loading');

    const serverUrl = params.get('server') || window.location.origin;

    const baseUrl = normalizeServerUrl(serverUrl);

    connectToServer(serverUrl, (phase, downloaded, total) => {
      if (phase === 'validating') {
        setProgress({ phase: 'extracting', percent: 5, message: 'Connecting to server...', detail: 'Validating server' });
      } else if (phase === 'downloading') {
        const pct = total ? Math.round((downloaded / total) * 90) + 5 : 50;
        const mb = (downloaded / (1024 * 1024)).toFixed(1);
        setProgress({ phase: 'extracting', percent: pct, message: 'Downloading graph...', detail: `${mb} MB downloaded` });
      } else if (phase === 'extracting') {
        setProgress({ phase: 'extracting', percent: 97, message: 'Processing...', detail: 'Extracting file contents' });
      }
    }).then(async (result) => {
      handleServerConnect(result);

      // Store server URL and fetch available repos for the repo switcher
      setServerBaseUrl(baseUrl);
      try {
        const repos = await fetchRepos(baseUrl);
        setAvailableRepos(repos);
      } catch (e) {
        console.warn('Failed to fetch repo list:', e);
      }
    }).catch((err) => {
      console.error('Auto-connect failed:', err);
      setProgress({
        phase: 'error',
        percent: 0,
        message: 'Failed to connect to server',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
      setTimeout(() => {
        setViewMode('onboarding');
        setProgress(null);
      }, 3000);
    });
  }, [handleServerConnect, setProgress, setViewMode, setServerBaseUrl, setAvailableRepos]);

  // Auto-diff: when branch-picker shows and we have pending auto-diff params, skip it
  // Must wait for pendingServerResult so commitServerConnection has the data it needs
  useEffect(() => {
    if (viewMode !== 'branch-picker' || !pendingAutoDiff.current || !pendingServerResult) return;
    const { base, head } = pendingAutoDiff.current;
    pendingAutoDiff.current = null;
    commitServerConnection();
    setDiffGraphFilter('impacted');
    startDiff(base, head);
  }, [viewMode, pendingServerResult, commitServerConnection, setDiffGraphFilter, startDiff]);

  const handleFocusNode = useCallback((nodeId: string) => {
    graphCanvasRef.current?.focusNode(nodeId);
  }, []);

  // Handle settings saved - refresh and reinitialize agent
  // NOTE: Must be defined BEFORE any conditional returns (React hooks rule)
  const handleSettingsSaved = useCallback(() => {
    refreshLLMSettings();
    initializeAgent();
  }, [refreshLLMSettings, initializeAgent]);

  // View mode keyboard shortcuts (1/2/3) — must be before conditional returns
  useEffect(() => {
    if (!isDiffMode) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '1') setDiffViewMode('focus');
      else if (e.key === '2') setDiffViewMode('structure');
      else if (e.key === '3') setDiffViewMode('review');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDiffMode, setDiffViewMode]);

  // Step 5: Global keyboard shortcuts for diff navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // ? — show keyboard shortcuts dialog (works always)
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsDialogOpen(prev => !prev);
        return;
      }

      // Escape — close shortcuts dialog first, then exit diff mode
      if (e.key === 'Escape') {
        if (isShortcutsDialogOpen) {
          setIsShortcutsDialogOpen(false);
          return;
        }
        if (isDiffMode) {
          exitDiffMode();
          return;
        }
      }

      if (!isDiffMode || !diffData) return;

      // [ — previous file
      if (e.key === '[') {
        const idx = diffData.files.findIndex(f => f.filePath === selectedDiffFile);
        if (idx > 0) {
          setSelectedDiffFile(diffData.files[idx - 1].filePath);
        }
        return;
      }

      // ] — next file
      if (e.key === ']') {
        const idx = diffData.files.findIndex(f => f.filePath === selectedDiffFile);
        if (idx < diffData.files.length - 1) {
          setSelectedDiffFile(diffData.files[idx + 1].filePath);
        }
        return;
      }

      // f — toggle diff panel (file list)
      if (e.key === 'f') {
        toggleDiffPanel();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDiffMode, diffData, selectedDiffFile, setSelectedDiffFile, exitDiffMode, toggleDiffPanel, isShortcutsDialogOpen]);

  const isFocusMode = isDiffMode && diffViewMode === 'focus';
  const isStructureMode = isDiffMode && diffViewMode === 'structure';

  // Render based on view mode
  if (viewMode === 'onboarding') {
    return (
      <DropZone
        onFileSelect={handleFileSelect}
        onGitClone={handleGitClone}
        onServerConnect={async (result, serverUrl) => {
          handleServerConnect(result);
          if (serverUrl) {
            const baseUrl = normalizeServerUrl(serverUrl);
            setServerBaseUrl(baseUrl);
            try {
              const repos = await fetchRepos(baseUrl);
              setAvailableRepos(repos);
            } catch (e) {
              console.warn('Failed to fetch repo list:', e);
            }
          }
        }}
      />
    );
  }

  if (viewMode === 'loading' && progress) {
    return <LoadingOverlay progress={progress} />;
  }

  if (viewMode === 'branch-picker') {
    return <BranchDiffDialog />;
  }

  // Exploring view
  return (
    <div className="flex flex-col h-screen bg-void overflow-hidden">
      <Header onFocusNode={handleFocusNode} availableRepos={availableRepos} onSwitchRepo={switchRepo} />

      <main className="flex-1 flex min-h-0">
        {/* Left Panel - File Tree (hidden in focus mode) */}
        {!isFocusMode && <FileTreePanel onFocusNode={handleFocusNode} />}

        {/* Graph area - takes remaining space */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          {/* Graph (hidden in focus mode) */}
          {!isFocusMode && <GraphCanvas ref={graphCanvasRef} />}

          {/* Diff Panel */}
          {isDiffMode && (diffData || diffLoading || diffError) ? (
            isFocusMode ? (
              // Focus mode: DiffPanel fills entire area
              <DiffPanel onFocusNode={handleFocusNode} fullWidth />
            ) : isStructureMode ? (
              // Structure mode: floating stats overlay on graph
              <div className="absolute top-4 left-4 z-30 pointer-events-auto">
                <DiffStructureOverlay />
              </div>
            ) : (
              // Review mode: collapsible overlay on left side of graph
              <>
                <div
                  className="absolute inset-y-0 left-0 z-30 pointer-events-auto transition-transform duration-300 ease-in-out"
                  style={{ transform: isDiffPanelCollapsed ? 'translateX(-100%)' : 'translateX(0)' }}
                >
                  <DiffPanel onFocusNode={handleFocusNode} />
                </div>
                {isDiffPanelCollapsed && (
                  <button
                    onClick={toggleDiffPanel}
                    className="absolute left-0 top-4 z-30 w-7 h-20 flex items-center justify-center bg-surface/90 border border-l-0 border-border-subtle rounded-r-lg text-text-secondary hover:bg-hover hover:text-amber-300 transition-colors pointer-events-auto backdrop-blur-sm"
                    title="Expand diff panel"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                )}
              </>
            )
          ) : (
            /* Code References Panel (overlay) - does NOT resize the graph, it overlaps on top */
            isCodePanelOpen && (codeReferences.length > 0 || !!selectedNode) && (
              <div className="absolute inset-y-0 left-0 z-30 pointer-events-auto">
                <CodeReferencesPanel onFocusNode={handleFocusNode} />
              </div>
            )
          )}
        </div>

        {/* Right Panel - Code & Chat (hidden in focus mode) */}
        {!isFocusMode && isRightPanelOpen && <RightPanel />}
      </main>

      <StatusBar />

      {/* Settings Panel (modal) */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* Step 5: Keyboard shortcuts dialog */}
      <KeyboardShortcutsDialog
        isOpen={isShortcutsDialogOpen}
        onClose={() => setIsShortcutsDialogOpen(false)}
      />

    </div>
  );
};

function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;
