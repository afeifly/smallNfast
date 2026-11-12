import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './ProcessScapeView.css';
import {
  ASSET_DEFS,
  EQUIPMENT_COLOR_THEMES,
  NOTE_OUTLINE_STYLES,
  LINE_STYLE_OPTIONS,
  NOTE_COLOR_PALETTE,
  SHAPE_FILL_PALETTE,
  SENSOR_CARD_TEMPLATES,
  PIPE_PRESETS,
  GUIDE_LINE_PRESETS
} from './engine/constants.js';
import {
  snap,
  pointsToPath,
  translatePath,
  getClosestPointOnPipe,
  getPointAlongPipe,
  rectsIntersect,
  getSnapOrthogonalPoint,
  getSnapExtensionPoint,
  getContentBounds,
  getElementBBox,
  getPipeBoundingBox,
  arePipesConnected,
  getConnectedPipeIds,
  expandConnectedPipes,
  resolvePipelineFlowDirections,
  getPipeLength,
  adjustPipeLength,
  distToSegment,
  resolveSensorCardAttachmentAfterDrag
} from './engine/pipeUtils.js';
import {
  svgEl,
  renderAssetNode,
  renderSensorCard,
  renderPipe,
  isSensorOrGateway,
  getCardChannels,
  getEquipmentTheme
} from './engine/illustrators.js';
import { renderAssetPaletteIcon } from './engine/paletteIcons.jsx';
import {
  getActiveScape,
  getActiveScapeId,
  setActiveScapeId,
  getAllScapes,
  saveScape,
  getSavedScapeView,
  saveScapeView,
  hasSavedLocations,
  DEFAULT_COMPRESSED_AIR_SCAPE
} from './engine/scapeStorage.js';
import { syncAllLocationsToScapes, getLocations, saveLocations } from './engine/sensorManagerStorage.js';
import ScapeManagerModal from './ScapeManagerModal.jsx';
import { useProcessScapeTelemetry } from './engine/useProcessScapeTelemetry.js';

const PALETTE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'piping', label: '➰ Pipes' },
  { id: 'sensors', label: 'Sensor & gateway' },
  { id: 'vessels', label: 'Tanks & Air' },
  { id: 'machines', label: 'Machines' },
  { id: 'others', label: 'Others' }
];

// Consistent SVG Vector Icons for HUD Controls
const HudIcons = {
  Select: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  ),
  Pan: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v4" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  ),
  Undo: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  Redo: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 14 20 9 15 4" />
      <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
    </svg>
  ),
  BringToFront: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="4" x2="20" y2="4" strokeWidth="2.5" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <polyline points="7 13 12 8 17 13" />
    </svg>
  ),
  SendToBack: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="20" y2="20" strokeWidth="2.5" />
      <line x1="12" y1="4" x2="12" y2="16" />
      <polyline points="7 11 12 16 17 11" />
    </svg>
  ),
  Delete: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  ZoomFit: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  ),
  ZoomIn: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  ZoomOut: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  Check: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Import: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  ExportJson: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  ExportPng: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  LiveDnd: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="13" height="13" rx="2" strokeWidth="1.8" />
      <circle cx="7" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <path d="M15 15l6 6m0 0v-4.5m0 4.5h-4.5" strokeWidth="2" />
    </svg>
  ),
  BoundsScale: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
      <rect x="2" y="2" width="4" height="4" fill="currentColor" />
      <rect x="18" y="2" width="4" height="4" fill="currentColor" />
      <rect x="18" y="18" width="4" height="4" fill="currentColor" />
      <rect x="2" y="18" width="4" height="4" fill="currentColor" />
    </svg>
  ),
  ScapeManager: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  DragHandle: () => (
    <svg width="12" height="15" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="3" r="1.3" />
      <circle cx="8.5" cy="3" r="1.3" />
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8.5" cy="8" r="1.3" />
      <circle cx="3.5" cy="13" r="1.3" />
      <circle cx="8.5" cy="13" r="1.3" />
    </svg>
  )
};

export default function ProcessScapeView({
  onBackToLanding,
  onRegisterActions,
  onStateChange,
  onOpenSensorManager,
  initialElements = [],
  initialPipes = [],
  initialMode,
  activeLocationId: initialActiveLocationId = null,
  onLocationChange = null,
  onDeviceConnected = null
}) {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const defaultMode = initialMode || (isTest ? 'editor' : 'runtime');
  const [scapeMode, setScapeMode] = useState(defaultMode); // 'runtime' | 'editor'
  const [activeLocationId, setActiveLocationId] = useState(initialActiveLocationId);

  const [isScapeManagerOpen, setIsScapeManagerOpen] = useState(false);
  const [isBannerMinimized, setIsBannerMinimized] = useState(false);

  // Load active scape from storage if custom elements/pipes not explicitly passed
  const [scapeVersion, setScapeVersion] = useState(0);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isBubbleDismissed, setIsBubbleDismissed] = useState(false);

  const activeScape = useMemo(() => {
    if (initialElements.length > 0 || initialPipes.length > 0) {
      return {
        id: 'scape_custom',
        title: 'ProcessScape',
        elements: initialElements,
        pipes: initialPipes,
        zones: []
      };
    }
    if (activeLocationId && activeLocationId !== 'example_demo') {
      const locs = getLocations();
      const curLoc = locs.find(l => l.id === activeLocationId);
      if (curLoc && !curLoc.scapeId) {
        return {
          id: '',
          title: 'ProcessScape',
          tempCanvasSize: { width: 1024, height: 800 },
          zones: [],
          elements: [],
          pipes: []
        };
      }
      if (curLoc?.scapeId) {
        const all = getAllScapes();
        const found = all.find(s => s.id === curLoc.scapeId);
        if (found) return found;
      }
    }
    return getActiveScape();
  }, [initialElements, initialPipes, activeLocationId, scapeVersion]);

  const [activeScapeId, setActiveScapeIdState] = useState(() => activeScape?.id || '');
  const [projectTitle, setProjectTitle] = useState(() => activeScape?.title || 'ProcessScape');
  const [screenSize, setScreenSize] = useState(() => (
    activeScape?.tempCanvasSize
      ? { w: activeScape.tempCanvasSize.width, h: activeScape.tempCanvasSize.height }
      : { w: 1024, h: 800 }
  ));
  const [zones, setZones] = useState(() => activeScape?.zones || []);
  const [pipes, setPipes] = useState(() => (initialPipes.length > 0 ? initialPipes : (activeScape?.pipes || [])));
  const [elements, setElements] = useState(() => (initialElements.length > 0 ? initialElements : (activeScape?.elements || [])));


  const resetTransientModeState = useCallback(({ clearHistory = false } = {}) => {
    setBoundsResizerMode(null);
    setIsLiveDndActive(false);
    setResizingBox(null);
    boundsBoxRef.current = null;
    setCurrentTool('select');
    setSelectedIds(new Set());
    setDockFlyGhost(null);
    setInspectorDockAnim(null);
    setIsDraggingInspector(false);
    setIsSpacePressed(false);
    isSpacePressedRef.current = false;

    if (runtimeToolsDragCleanupRef.current) {
      runtimeToolsDragCleanupRef.current();
      runtimeToolsDragCleanupRef.current = null;
    }
    setRuntimeToolsDragPos(null);
    suppressDragHandleClickRef.current = false;

    if (dragRef.current) {
      dragRef.current.isDragging = false;
      dragRef.current.isPanning = false;
      dragRef.current.didPan = false;
      dragRef.current.draggingAnchor = null;
      dragRef.current.draggingVertex = null;
      dragRef.current.extendingPipe = null;
      dragRef.current.drawingPipeStart = null;
      dragRef.current.isMarquee = false;
      dragRef.current.draggingLiveCard = null;
      dragRef.current.draggingBoundsHandle = null;
    }
    if (interactionLayerRef.current) {
      interactionLayerRef.current.innerHTML = '';
    }
    if (viewportRef.current) {
      viewportRef.current.classList.remove('panning', 'is-panning', 'drawing-pipe');
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.closest('.canvas-floating-hud, .ps-inspector')) {
        document.activeElement.blur();
      }
    }
    if (clearHistory) {
      historyRef.current = { undo: [], redo: [] };
      setHistoryVersion(v => v + 1);
    }
  }, []);

  const applyScapeToCanvas = useCallback((scape, resetModeToRuntime = false) => {
    resetTransientModeState({ clearHistory: true });
    if (!scape || !scape.id) {
      setActiveScapeIdState('');
      setProjectTitle('ProcessScape');
      setScreenSize({ w: 1024, h: 800 });
      setZones([]);
      setElements([]);
      setPipes([]);
      if (resetModeToRuntime) setScapeMode('runtime');
      setScapeVersion(v => v + 1);
      return;
    }
    setActiveScapeIdState(scape.id);
    setProjectTitle(scape.title || 'ProcessScape');
    setScreenSize(scape.tempCanvasSize ? { w: scape.tempCanvasSize.width, h: scape.tempCanvasSize.height } : { w: 1024, h: 800 });
    setZones(scape.zones || []);
    setElements(scape.elements || []);
    setPipes(scape.pipes || []);
    if (resetModeToRuntime) setScapeMode('runtime');
    setScapeVersion(v => v + 1);
    const saved = getSavedScapeView(scape.id);
    if (saved) {
      setView(saved);
    }
  }, [resetTransientModeState]);

  const handleSelectActiveScape = useCallback((scape) => {
    applyScapeToCanvas(scape, true);
  }, [applyScapeToCanvas]);

  const handleSelectScapeFromManager = useCallback((scape) => {
    if (activeLocationId && activeLocationId !== 'example_demo' && initialElements.length === 0 && initialPipes.length === 0) {
      const locs = getLocations();
      const curLoc = locs.find(l => l.id === activeLocationId);
      if (curLoc) {
        const nextScapeId = scape?.id || '';
        const updatedLocs = locs.map(l => (l.id === activeLocationId ? { ...l, scapeId: nextScapeId } : l));
        saveLocations(updatedLocs);
        syncAllLocationsToScapes(updatedLocs);
        if (nextScapeId) {
          setActiveScapeId(nextScapeId);
          const refreshed = getAllScapes().find(s => s.id === nextScapeId) || scape;
          applyScapeToCanvas(refreshed, true);
        } else {
          setActiveScapeId('');
          applyScapeToCanvas(null, true);
        }
        return;
      }
    }
    applyScapeToCanvas(scape, true);
  }, [activeLocationId, initialElements.length, initialPipes.length, applyScapeToCanvas]);

  const syncScapeForLocation = useCallback((locId) => {
    if (!locId || locId === 'example_demo') return;
    if (initialElements.length > 0 || initialPipes.length > 0) return;
    const locs = getLocations();
    const curLoc = locs.find(l => l.id === locId);
    if (!curLoc) return;
    const matchedScapeId = curLoc.scapeId || '';
    if (matchedScapeId) {
      const all = getAllScapes();
      const target = all.find(s => s.id === matchedScapeId);
      if (target) {
        setActiveScapeId(target.id);
        applyScapeToCanvas(target, false);
        return;
      }
    }
    setActiveScapeId('');
    applyScapeToCanvas(null, false);
  }, [initialElements.length, initialPipes.length, applyScapeToCanvas]);

  const prevInitialLocRef = useRef(initialActiveLocationId);
  useEffect(() => {
    if (initialActiveLocationId !== undefined) {
      setActiveLocationId(initialActiveLocationId);
      if (prevInitialLocRef.current !== initialActiveLocationId) {
        prevInitialLocRef.current = initialActiveLocationId;
        syncScapeForLocation(initialActiveLocationId);
      }
    }
  }, [initialActiveLocationId, syncScapeForLocation]);

  // Listen for locations changed in storage (e.g. from SensorManagerModal)
  useEffect(() => {
    const handleLocationsChanged = (e) => {
      const locs = e.detail || [];
      if (!Array.isArray(locs) || locs.length === 0) {
        // When all locations are removed, leave no active scape and clear canvas elements
        resetTransientModeState({ clearHistory: true });
        setActiveScapeId('');
        setActiveScapeIdState('');
        setZones([]);
        setElements([]);
        setPipes([]);
        setProjectTitle('ProcessScape');
        setScapeVersion(v => v + 1);
      } else {
        const curActiveId = getActiveScapeId();
        setActiveScapeIdState(curActiveId || '');
        setScapeVersion(v => v + 1);
      }
    };
    window.addEventListener('sensor-locations-changed', handleLocationsChanged);
    return () => window.removeEventListener('sensor-locations-changed', handleLocationsChanged);
  }, []);

  const STORAGE_KEY_RUNTIME_TOOLS_CORNER = 's4a_ps_runtime_tools_corner_v1';
  const STORAGE_KEY_RUNTIME_TOOLS_CONCISE = 's4a_ps_runtime_tools_concise_v1';
  const workbenchRef = useRef(null);
  const runtimeToolsRef = useRef(null);
  const runtimeToolsDragCleanupRef = useRef(null);
  const suppressDragHandleClickRef = useRef(false);

  const [runtimeToolsCorner, setRuntimeToolsCorner] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RUNTIME_TOOLS_CORNER);
      return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(saved) ? saved : 'top-right';
    } catch (_) {
      return 'top-right';
    }
  });
  const [isRuntimeToolsConcise, setIsRuntimeToolsConcise] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_RUNTIME_TOOLS_CONCISE) === 'true';
    } catch (_) {
      return false;
    }
  });
  const [runtimeToolsDragPos, setRuntimeToolsDragPos] = useState(null);

  useEffect(() => {
    return () => {
      if (runtimeToolsDragCleanupRef.current) {
        runtimeToolsDragCleanupRef.current();
        runtimeToolsDragCleanupRef.current = null;
      }
    };
  }, []);

  const handleToggleRuntimeToolsConcise = useCallback(() => {
    setIsRuntimeToolsConcise(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_RUNTIME_TOOLS_CONCISE, String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  const handleDragHandleClick = useCallback((e) => {
    e?.currentTarget?.blur?.();
    if (suppressDragHandleClickRef.current) {
      suppressDragHandleClickRef.current = false;
      return;
    }
    handleToggleRuntimeToolsConcise();
  }, [handleToggleRuntimeToolsConcise]);

  const handleRuntimeToolsMouseDown = useCallback((e) => {
    e.stopPropagation();
    const dragHandleClicked = !!e.target.closest('.ps-runtime-drag-handle');
    if (!dragHandleClicked && e.target.closest('button, select, option, input')) {
      return;
    }
    if (e.button !== 0) return;

    suppressDragHandleClickRef.current = false;
    if (runtimeToolsDragCleanupRef.current) {
      runtimeToolsDragCleanupRef.current();
      runtimeToolsDragCleanupRef.current = null;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const vpRect = viewportRef.current?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      width: window.innerWidth || 1024,
      height: window.innerHeight || 768
    };
    const hudEl = runtimeToolsRef.current || e.currentTarget;
    const hudRect = hudEl.getBoundingClientRect();
    const hasRealRect = vpRect.width > 0 && vpRect.height > 0;
    const vpW = hasRealRect ? vpRect.width : (window.innerWidth || 1024);
    const vpH = hasRealRect ? vpRect.height : (window.innerHeight || 768);
    const hudW = hudRect.width > 0 ? hudRect.width : 180;
    const hudH = hudRect.height > 0 ? hudRect.height : 36;
    const offsetX = hudRect.width > 0 ? (e.clientX - hudRect.left) : hudW / 2;
    const offsetY = hudRect.height > 0 ? (e.clientY - hudRect.top) : hudH / 2;

    let started = false;
    let latestCorner = runtimeToolsCorner;

    const computePosition = (clientX, clientY) => {
      let x = clientX - vpRect.left - offsetX;
      let y = clientY - vpRect.top - offsetY;
      if (hasRealRect) {
        x = Math.max(8, Math.min(Math.max(8, vpW - hudW - 8), x));
        y = Math.max(8, Math.min(Math.max(8, vpH - hudH - 8), y));
      }
      const cx = hasRealRect ? (x + hudW / 2) : (clientX - vpRect.left);
      const cy = hasRealRect ? (y + hudH / 2) : (clientY - vpRect.top);
      const vPart = cy < vpH / 2 ? 'top' : 'bottom';
      const hPart = cx < vpW / 2 ? 'left' : 'right';
      return { x, y, hoveredCorner: `${vPart}-${hPart}` };
    };

    const onMouseMove = (me) => {
      if (!started && Math.hypot(me.clientX - startX, me.clientY - startY) < 4) {
        return;
      }
      started = true;
      suppressDragHandleClickRef.current = true;
      const next = computePosition(me.clientX, me.clientY);
      latestCorner = next.hoveredCorner;
      setRuntimeToolsDragPos(next);
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      runtimeToolsDragCleanupRef.current = null;
    };

    const onMouseUp = () => {
      cleanup();
      if (started) {
        setRuntimeToolsCorner(latestCorner);
        try {
          localStorage.setItem(STORAGE_KEY_RUNTIME_TOOLS_CORNER, latestCorner);
        } catch (_) {}
      }
      setRuntimeToolsDragPos(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    runtimeToolsDragCleanupRef.current = cleanup;
  }, [runtimeToolsCorner]);

  const hasLocations = useMemo(() => hasSavedLocations(), [scapeVersion]);
  const runtimeLocationsList = useMemo(() => {
    try {
      return getLocations();
    } catch (_) {
      return [];
    }
  }, [scapeVersion, activeLocationId]);
  const handleRuntimeLocationSelect = useCallback((e) => {
    const locId = e.target.value;
    if (onLocationChange) {
      onLocationChange(locId);
    } else {
      setActiveLocationId(locId);
      syncScapeForLocation(locId);
    }
  }, [onLocationChange, syncScapeForLocation]);
  const isEmptyPage = scapeMode !== 'editor' && !hasLocations && (!activeScapeId || !activeScape?.id || activeScape.id === '');

  const isExampleShow = useMemo(() => {
    if (isBannerDismissed) return false;
    if (initialElements.length > 0 || initialPipes.length > 0) return false;
    if (hasSavedLocations()) return false;
    const all = getAllScapes();
    const hasRealScapes = all.some(s => !s.isExample && s.id !== 'scape_example_demo');
    if (hasRealScapes) return false;
    if (activeScape && !activeScape.isExample && activeScape.id !== 'scape_example_demo') return false;
    if (!activeScape?.id || activeScape.id === '') return false;
    return true;
  }, [isBannerDismissed, initialElements, initialPipes, activeScape, activeScapeId, scapeVersion]);

  useEffect(() => {
    setIsBubbleDismissed(false);
  }, [activeLocationId, activeScapeId]);

  const isEmptyScape = Boolean(
    scapeMode === 'runtime' &&
    !isExampleShow &&
    pipes.length === 0 &&
    elements.filter(el => el.type !== 'sensor_card').length === 0
  );

  const showEmptyScapeIndicator = isEmptyScape && !isBubbleDismissed && !isRuntimeToolsConcise;

  const isToolsTopCorner = runtimeToolsDragPos
    ? (runtimeToolsDragPos.y < (workbenchRef.current?.clientHeight || 600) / 2)
    : (runtimeToolsCorner === 'top-right' || runtimeToolsCorner === 'top-left');

  const bubblePlacement = isToolsTopCorner ? 'below' : 'above';


  const handleEditScapeFromManager = useCallback((scape) => {
    if (!scape || !scape.id) return;
    resetTransientModeState({ clearHistory: true });
    setActiveScapeIdState(scape.id);
    setProjectTitle(scape.title || 'ProcessScape');
    setScreenSize(scape.tempCanvasSize ? { w: scape.tempCanvasSize.width, h: scape.tempCanvasSize.height } : { w: 1024, h: 800 });
    setZones(scape.zones || []);
    setElements(scape.elements || []);
    setPipes(scape.pipes || []);
    setScapeMode('editor');
    setScapeVersion(v => v + 1);
  }, [resetTransientModeState]);

  const finishEditorAndRestore = useCallback(() => {
    const editedScapeId = activeScapeId;
    const locs = getLocations();
    const curLoc = (activeLocationId && activeLocationId !== 'example_demo')
      ? locs.find(l => l.id === activeLocationId)
      : null;
    const isEditingDifferentScape = Boolean(curLoc && (curLoc.scapeId || '') !== (editedScapeId || ''));

    saveScape({
      id: editedScapeId,
      title: projectTitle,
      tempCanvasSize: { width: screenSize.w, height: screenSize.h },
      zones,
      elements,
      pipes
    }, { setActive: !isEditingDifferentScape });

    // Ensure all location measurement points and sensor cards are preserved and synced
    syncAllLocationsToScapes();

    const allScapes = getAllScapes();
    if (isEditingDifferentScape) {
      const targetLocScapeId = curLoc.scapeId || '';
      setActiveScapeId(targetLocScapeId);
      const locScape = targetLocScapeId ? allScapes.find(s => s.id === targetLocScapeId) : null;
      applyScapeToCanvas(locScape || null, false);
      setScapeMode('runtime');
      if (typeof window !== 'undefined' && window.showAppNotification) {
        window.showAppNotification('Scape Saved', `"${projectTitle}" saved. Returned to ${curLoc.name || 'current location'}.`, 'success');
      }
      return;
    }

    const updatedScape = (editedScapeId ? allScapes.find(s => s.id === editedScapeId) : null) || getActiveScape();
    if (updatedScape && Array.isArray(updatedScape.elements)) {
      setElements(updatedScape.elements);
    }
    resetTransientModeState();
    setScapeMode('runtime');
    if (typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification('Scape Saved', `"${projectTitle}" updated and running live.`, 'success');
    }
  }, [activeScapeId, activeLocationId, projectTitle, screenSize, zones, elements, pipes, applyScapeToCanvas, resetTransientModeState]);

  const handleSaveAndExitEditor = useCallback(() => {
    finishEditorAndRestore();
  }, [finishEditorAndRestore]);

  const changeScapeMode = useCallback((newMode) => {
    if (newMode === 'runtime' && scapeMode === 'editor') {
      finishEditorAndRestore();
    } else {
      resetTransientModeState();
      setScapeMode(newMode);
    }
  }, [scapeMode, finishEditorAndRestore, resetTransientModeState]);

  // Dynamic real picture bounding box based on placed items with 16px margin to edge
  const contentBounds = useMemo(() => getContentBounds(elements, pipes, 16), [elements, pipes]);

  // --- Interaction & Tool State ---
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentTool, setCurrentTool] = useState('select'); // 'select' | 'pan' | 'draw_pipe'
  const [activePipeMedium, setActivePipeMedium] = useState('gas'); // 'gas' | 'liquid'
  const [view, setView] = useState(() => {
    const saved = getSavedScapeView(activeScape.id);
    if (saved) return saved;
    return { x: 20, y: 78, zoom: 1.0 };
  });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false);
  const [isInspectorPinned, setIsInspectorPinned] = useState(false);
  const [inspectorDockAnim, setInspectorDockAnim] = useState(null); // 'to-sidebar' | 'to-float' | null
  const [dockFlyGhost, setDockFlyGhost] = useState(null);
  const [isInspectorMin, setIsInspectorMin] = useState(() => {
    try {
      return localStorage.getItem('s4a_ps_inspector_min_v1') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('s4a_ps_inspector_min_v1', String(isInspectorMin));
    } catch { }
  }, [isInspectorMin]);
  const [inspectorPos, setInspectorPos] = useState(null);
  const [inspectorSize, setInspectorSize] = useState(null);
  const [benchSize, setBenchSize] = useState(null);
  const [isDraggingInspector, setIsDraggingInspector] = useState(false);
  const [sidebarFooterEl, setSidebarFooterEl] = useState(null);
  const sidebarRef = useRef(null);
  const inspectorElRef = useRef(null);
  const dockAnimTimerRef = useRef(null);
  const dockAnimRafRef = useRef(null);
  const inspectorDragRef = useRef({
    startMouseX: 0,
    startMouseY: 0,
    startLeft: 0,
    startTop: 0,
    benchWidth: 0,
    benchHeight: 0,
    inspectorWidth: 0,
    inspectorHeight: 0,
    didMove: false
  });
  const [activePaletteTab, setActivePaletteTab] = useState('all');
  const [wallPaletteOrientation, setWallPaletteOrientation] = useState('h');
  const [linePaletteOrientation, setLinePaletteOrientation] = useState('h');
  const [labelPaletteOrientation, setLabelPaletteOrientation] = useState('h');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => () => {
    if (dockAnimTimerRef.current) clearTimeout(dockAnimTimerRef.current);
    if (dockAnimRafRef.current) cancelAnimationFrame(dockAnimRafRef.current);
  }, []);

  // Mode-scoped Bounds Resizer state ('editor' | 'runtime' | null) so Modify & Live never share enabled state
  const [isLiveDndActive, setIsLiveDndActive] = useState(false);
  const [boundsResizerMode, setBoundsResizerMode] = useState(null);
  const isBoundsResizerActive = boundsResizerMode === scapeMode;
  const [resizingBox, setResizingBox] = useState(null);
  const boundsBoxRef = useRef(null);

  // Real device live telemetry hook - powers live numbers and dynamic pipe flow (paused during bounds resizing)
  const telemetry = useProcessScapeTelemetry({
    elements,
    pipes,
    setElements,
    setPipes,
    enabled: !isBoundsResizerActive,
    activeLocationId,
    onDeviceConnected
  });

  // --- SVG Viewport & Rendering Refs ---
  const viewportRef = useRef(null);
  const diagramLayerRef = useRef(null);
  const interactionLayerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Undo / Redo history
  const historyRef = useRef({ undo: [], redo: [] });
  const [historyVersion, setHistoryVersion] = useState(0);

  const canUndo = historyRef.current.undo.length > 0;
  const canRedo = historyRef.current.redo.length > 0;

  const saveHistory = useCallback((label = 'Change') => {
    historyRef.current.undo.push({
      elements: JSON.parse(JSON.stringify(elements)),
      pipes: JSON.parse(JSON.stringify(pipes)),
      zones: JSON.parse(JSON.stringify(zones)),
      screenSize: { ...screenSize },
      title: projectTitle
    });
    if (historyRef.current.undo.length > 30) historyRef.current.undo.shift();
    historyRef.current.redo = [];
    setHistoryVersion(v => v + 1);
  }, [elements, pipes, zones, screenSize, projectTitle]);

  const undo = () => {
    if (historyRef.current.undo.length === 0) return;
    const prev = historyRef.current.undo.pop();
    historyRef.current.redo.push({
      elements: JSON.parse(JSON.stringify(elements)),
      pipes: JSON.parse(JSON.stringify(pipes)),
      zones: JSON.parse(JSON.stringify(zones)),
      screenSize: { ...screenSize },
      title: projectTitle
    });
    setElements(prev.elements);
    setPipes(prev.pipes);
    setZones(prev.zones);
    setScreenSize(prev.screenSize);
    setProjectTitle(prev.title);
    setSelectedIds(new Set());
    setHistoryVersion(v => v + 1);
  };

  const redo = () => {
    if (historyRef.current.redo.length === 0) return;
    const next = historyRef.current.redo.pop();
    historyRef.current.undo.push({
      elements: JSON.parse(JSON.stringify(elements)),
      pipes: JSON.parse(JSON.stringify(pipes)),
      zones: JSON.parse(JSON.stringify(zones)),
      screenSize: { ...screenSize },
      title: projectTitle
    });
    setElements(next.elements);
    setPipes(next.pipes);
    setZones(next.zones);
    setScreenSize(next.screenSize);
    setProjectTitle(next.title);
    setSelectedIds(new Set());
    setHistoryVersion(v => v + 1);
  };

  // --- Center Diagram on Canvas ---
  const handleZoomFit = useCallback((targetElements, targetPipes, targetScreenSize) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const topOffset = 78; // Clearance to prevent overlap from floating top HUD
    const bottomOffset = 50; // Clearance for floating zoom HUD
    const vw = rect.width || 1024;
    const vh = rect.height || 800;
    const availH = Math.max(100, vh - topOffset - bottomOffset);
    const availW = Math.max(100, vw - 60);

    const els = targetElements !== undefined ? targetElements : elements;
    const pps = targetPipes !== undefined ? targetPipes : pipes;
    const cb = getContentBounds(els, pps, 32);

    let nextView;
    if (cb.hasContent && cb.width > 0 && cb.height > 0) {
      const scaleX = availW / cb.width;
      const scaleY = availH / cb.height;
      const zoom = Math.max(0.2, Math.min(scaleX, scaleY, 1.2));
      const x = (vw - cb.width * zoom) / 2 - cb.x * zoom;
      const y = topOffset + (availH - cb.height * zoom) / 2 - cb.y * zoom;
      nextView = { x: Math.round(x), y: Math.round(y), zoom: Number(zoom.toFixed(3)) };
    } else {
      const sw = targetScreenSize?.w || screenSize.w || 1024;
      const sh = targetScreenSize?.h || screenSize.h || 800;
      const scaleX = availW / sw;
      const scaleY = availH / sh;
      const zoom = Math.min(scaleX, scaleY, 1.2);
      const x = (vw - sw * zoom) / 2;
      const y = topOffset + (availH - sh * zoom) / 2;
      nextView = { x: Math.round(x), y: Math.round(y), zoom: Number(zoom.toFixed(3)) };
    }

    setView(nextView);
    if (activeScapeId) {
      saveScapeView(activeScapeId, nextView);
    }
    return nextView;
  }, [elements, pipes, screenSize.w, screenSize.h, activeScapeId]);

  // Viewport Zoom & Focus helpers
  const zoomAtPoint = useCallback((cx, cy, factor) => {
    setView(v => {
      const oldZoom = v.zoom;
      const newZoom = Math.max(0.2, Math.min(3.0, oldZoom * factor));
      const rect = viewportRef.current ? viewportRef.current.getBoundingClientRect() : { left: 0, top: 0 };
      const px = cx - rect.left;
      const py = cy - rect.top;

      const wx = (px - v.x) / oldZoom;
      const wy = (py - v.y) / oldZoom;

      return {
        zoom: newZoom,
        x: px - wx * newZoom,
        y: py - wy * newZoom
      };
    });
  }, []);

  const centerOnPoint = useCallback((wx, wy, zoomTarget) => {
    const vw = viewportRef.current?.clientWidth || 1000;
    const vh = viewportRef.current?.clientHeight || 800;
    setView(v => {
      const newZoom = zoomTarget ? Math.max(0.25, Math.min(3.0, zoomTarget)) : v.zoom;
      return {
        zoom: newZoom,
        x: vw / 2 - wx * newZoom,
        y: vh / 2 - wy * newZoom
      };
    });
  }, []);

  const resetView = useCallback(() => {
    setView(v => {
      const saved = activeScapeId ? getSavedScapeView(activeScapeId) : null;
      // If user had a saved custom view for this scape, restore it with 100% zoom
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        const nextView = { x: saved.x, y: saved.y, zoom: 1.0 };
        if (activeScapeId) saveScapeView(activeScapeId, nextView);
        return nextView;
      }

      const rect = viewportRef.current?.getBoundingClientRect();
      const vw = rect?.width || viewportRef.current?.clientWidth || 1000;
      const vh = rect?.height || viewportRef.current?.clientHeight || 800;

      // If user is currently viewing the canvas, zoom to 100% focused on current center point
      // without jumping to a far away offset
      if (v && typeof v.zoom === 'number' && v.zoom > 0) {
        const cx = vw / 2;
        const cy = vh / 2;
        const wx = (cx - v.x) / v.zoom;
        const wy = (cy - v.y) / v.zoom;
        const nextView = {
          zoom: 1.0,
          x: cx - wx * 1.0,
          y: cy - wy * 1.0
        };
        if (activeScapeId) saveScapeView(activeScapeId, nextView);
        return nextView;
      }

      const nextView = {
        zoom: 1.0,
        x: Math.max(10, (vw - screenSize.w) / 2),
        y: 78
      };
      if (activeScapeId) saveScapeView(activeScapeId, nextView);
      return nextView;
    });
  }, [activeScapeId, screenSize.w]);

  const focusSelectedOrCenter = useCallback(() => {
    if (selectedIds.size > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      selectedIds.forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) {
          const w = el.w || 80;
          const h = el.h || 60;
          minX = Math.min(minX, el.x - w / 2);
          maxX = Math.max(maxX, el.x + w / 2);
          minY = Math.min(minY, el.y - h / 2);
          maxY = Math.max(maxY, el.y + h / 2);
        }
        const pipe = pipes.find(p => p.id === id);
        if (pipe && pipe.points) {
          pipe.points.forEach(pt => {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
          });
        }
      });
      if (minX !== Infinity) {
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        centerOnPoint(midX, midY);
        return;
      }
    }
    handleZoomFit();
  }, [selectedIds, elements, pipes, centerOnPoint, handleZoomFit]);

  // Diagram Bounding Box Scaler & Pipe Extender Tool (Combined with Sensor Card Repositioning in Runtime)
  const handleToggleBoundsResizer = useCallback(() => {
    if (!isBoundsResizerActive) {
      const cb = getContentBounds(elements, pipes, 24);
      const initialBox = {
        x: snap(cb.x, 5),
        y: snap(cb.y, 5),
        w: Math.max(160, snap(cb.width, 5)),
        h: Math.max(120, snap(cb.height, 5))
      };
      boundsBoxRef.current = {
        origBox: { ...initialBox },
        currentBox: { ...initialBox },
        origElements: JSON.parse(JSON.stringify(elements)),
        origPipes: JSON.parse(JSON.stringify(pipes)),
        currentElements: JSON.parse(JSON.stringify(elements)),
        currentPipes: JSON.parse(JSON.stringify(pipes))
      };
      setResizingBox({ ...initialBox });
      setBoundsResizerMode(scapeMode);
      setIsLiveDndActive(scapeMode === 'runtime');
    } else {
      // Clicked again: Confirm, skip bounding box, apply new size, and fit screen!
      const currentBox = resizingBox || (boundsBoxRef.current ? boundsBoxRef.current.currentBox : null);
      if (currentBox) {
        const finalW = Math.max(1024, Math.round(currentBox.w + 64));
        const finalH = Math.max(800, Math.round(currentBox.h + 64));
        setScreenSize({ w: finalW, h: finalH });
        const finalElements = boundsBoxRef.current?.currentElements || elements;
        const finalPipes = boundsBoxRef.current?.currentPipes || pipes;
        if (activeScapeId) setActiveScapeId(activeScapeId);
        saveScape({
          id: activeScapeId,
          title: projectTitle,
          tempCanvasSize: { width: finalW, height: finalH },
          zones,
          elements: finalElements,
          pipes: finalPipes
        });
        if (activeScapeId) {
          saveScapeView(activeScapeId, view);
        }
      }
      setBoundsResizerMode(null);
      setIsLiveDndActive(false);
      setResizingBox(null);
      boundsBoxRef.current = null;
    }
  }, [isBoundsResizerActive, scapeMode, resizingBox, elements, pipes, activeScapeId, projectTitle, zones, view]);

  // Layer Stacking (Front / Back)
  const bringToFront = useCallback(() => {
    if (selectedIds.size === 0) return;
    let maxZ = 10;
    pipes.forEach(p => { if (p.zIndex != null && p.zIndex > maxZ) maxZ = p.zIndex; });
    elements.forEach(e => { if (e.zIndex != null && e.zIndex > maxZ) maxZ = e.zIndex; });
    saveHistory('Bring to Front');
    setPipes(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, zIndex: maxZ + 1 } : p));
    setElements(prev => prev.map(e => selectedIds.has(e.id) ? { ...e, zIndex: maxZ + 1 } : e));
  }, [selectedIds, pipes, elements, saveHistory]);

  const sendToBack = useCallback(() => {
    if (selectedIds.size === 0) return;
    let minZ = 10;
    pipes.forEach(p => { if (p.zIndex != null && p.zIndex < minZ) minZ = p.zIndex; });
    elements.forEach(e => { if (e.zIndex != null && e.zIndex < minZ) minZ = e.zIndex; });
    saveHistory('Send to Back');
    setPipes(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, zIndex: Math.max(1, minZ - 1) } : p));
    setElements(prev => prev.map(e => selectedIds.has(e.id) ? { ...e, zIndex: Math.max(1, minZ - 1) } : e));
  }, [selectedIds, pipes, elements, saveHistory]);

  // Convert screen coordinates to world SVG coordinates
  const clientToWorld = (cx, cy) => {
    const safeX = typeof cx === 'number' && !isNaN(cx) ? cx : 0;
    const safeY = typeof cy === 'number' && !isNaN(cy) ? cy : 0;
    const rect = viewportRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const zoom = view?.zoom || 1;
    const vx = view?.x || 0;
    const vy = view?.y || 0;
    return {
      x: (safeX - (rect.left || 0) - vx) / zoom,
      y: (safeY - (rect.top || 0) - vy) / zoom
    };
  };

  // --- Render Diagram Nodes into SVG ---
  useEffect(() => {
    const dLayer = diagramLayerRef.current;
    if (!dLayer) return;
    dLayer.innerHTML = '';

    // Unified z-ordered drawables
    const drawables = [
      ...pipes.map((p, idx) => ({ kind: 'pipe', item: p, z: p.zIndex != null ? p.zIndex : 10, origIdx: idx })),
      ...elements.map((e, idx) => {
        let defZ = 20;
        if (e.type === 'shape_rect' || e.type === 'shape_circle') defZ = 8;
        if (e.type === 'guide_line') defZ = 15;
        if (e.type === 'text_note') defZ = 30;
        if (e.type === 'sensor_card') defZ = 40;
        return { kind: 'element', item: e, z: e.zIndex != null ? e.zIndex : defZ, origIdx: idx };
      })
    ];

    drawables.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      return a.origIdx - b.origIdx;
    });

    const flowDirections = resolvePipelineFlowDirections(pipes);
    const activeSelectedIds = (scapeMode === 'editor') ? selectedIds : new Set();

    drawables.forEach(d => {
      if (d.kind === 'pipe') {
        dLayer.appendChild(renderPipe(d.item, activeSelectedIds, pipes, flowDirections));
      } else if (d.kind === 'element') {
        if (d.item.type === 'sensor_card') {
          if (scapeMode === 'editor') return; // Hide sensor mode card when editing scape
          if (activeLocationId && activeLocationId !== 'example_demo' && d.item.locationId && d.item.locationId !== activeLocationId) {
            return;
          }
          dLayer.appendChild(renderSensorCard(d.item, activeSelectedIds, elements, (scapeMode === 'runtime' && isLiveDndActive)));
        } else {
          dLayer.appendChild(renderAssetNode(d.item, activeSelectedIds, pipes, scapeMode === 'editor', elements));
        }
      }
    });
  }, [elements, pipes, selectedIds, scapeMode, isLiveDndActive, activeLocationId]);

  // --- Drag & Drop from Sidebar ---
  const handleDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.json') || file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const json = JSON.parse(ev.target.result);
            const res = loadProcessScapeConfig(json);
            if (res) {
              handleZoomFit(res.parsedElements, res.parsedPipes, res.targetScreenSize);
            }
          } catch (err) {
            console.error('Failed to parse dropped JSON:', err);
          }
        };
        reader.readAsText(file);
        return;
      }
    }
    let data = null;
    try {
      const rawData = e.dataTransfer ? (
        e.dataTransfer.getData('application/json') ||
        e.dataTransfer.getData('text/plain')
      ) : null;
      if (rawData) {
        data = JSON.parse(rawData);
      }
    } catch (_) { }
    if (!data && typeof window !== 'undefined' && window.__ps_active_drag) {
      data = window.__ps_active_drag;
    }
    if (!data) return;
    try {
      saveHistory('Add Item');
      const w = clientToWorld(e.clientX, e.clientY);
      const dropX = snap(w.x);
      const dropY = snap(w.y);

      if (data.kind === 'asset') {
        const def = ASSET_DEFS[data.key] || { w: 120, h: 120, defaultTag: data.key };
        const isWallAsset = data.key === 'wall_perimeter_h' || data.key === 'wall_perimeter_v';
        const newNode = {
          id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: data.key,
          tag: isWallAsset ? '' : def.defaultTag,
          x: dropX,
          y: dropY,
          w: def.w,
          h: def.h,
          ...(isWallAsset ? {} : { colorTheme: 'blue' }),
          zIndex: 20
        };
        setElements(prev => [...prev, newNode]);
        setSelectedIds(new Set([newNode.id]));
      } else if (data.kind === 'sensor_card') {
        const tpl = SENSOR_CARD_TEMPLATES[data.key] || SENSOR_CARD_TEMPLATES['sensor'];
        const channels = (tpl.channels || []).map((c, i) => ({
          id: `ch_${Date.now()}_${i}`,
          name: c.name,
          val: c.val,
          unit: c.unit,
          status: 'normal'
        }));
        const newCard = {
          id: `sensor_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'sensor_card',
          tag: tpl.tag,
          desc: tpl.desc,
          x: dropX,
          y: dropY,
          titlePosition: 'top',
          status: 'normal',
          channels: channels,
          zIndex: 40
        };
        // Check snap to closest item (sensor, machine, equipment, etc.)
        let closestTarget = null;
        let minD = 90;
        elements.forEach(other => {
          if (other.type !== 'sensor_card') {
            const d = Math.hypot(other.x - dropX, other.y - dropY);
            if (d < minD) {
              minD = d;
              closestTarget = other;
            }
          }
        });
        if (closestTarget) {
          newCard.attachedAssetId = closestTarget.id;
          newCard.targetOffsetX = dropX - closestTarget.x;
          newCard.targetOffsetY = dropY - closestTarget.y;
        }
        setElements(prev => [...prev, newCard]);
        setSelectedIds(new Set([newCard.id]));
      } else if (data.kind === 'pipe_preset') {
        const tpl = PIPE_PRESETS.find(p => p.id === data.key) || PIPE_PRESETS[0];
        const pts = tpl.points.map(pt => ({
          x: dropX + (pt.dx !== undefined ? pt.dx : (pt.x || 0)),
          y: dropY + (pt.dy !== undefined ? pt.dy : (pt.y || 0))
        }));
        const newPipe = {
          id: `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          medium: tpl.medium || 'gas',
          points: pts,
          d: pointsToPath(pts),
          w: tpl.w || 20,
          flow: tpl.flow || 'forward',
          label: tpl.label || '',
          zIndex: 10
        };
        saveHistory('Add Pipe Preset');
        setPipes(prev => [...prev, newPipe]);
        setSelectedIds(new Set([newPipe.id]));
      } else if (data.kind === 'guide_line') {
        const tpl = GUIDE_LINE_PRESETS.find(l => l.id === data.key || l.orientation === data.orientation) || GUIDE_LINE_PRESETS[0];
        const orientation = data.orientation === 'v' ? 'v' : (tpl.orientation || 'h');
        const newLine = {
          id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'guide_line',
          orientation,
          length: tpl.length || 220,
          strokeWidth: tpl.strokeWidth || 1,
          lineStyle: tpl.lineStyle || 'single',
          color: tpl.color || '#475569',
          x: dropX,
          y: dropY,
          zIndex: 15
        };
        saveHistory(`Add ${orientation === 'v' ? 'Vertical' : 'Horizontal'} Line`);
        setElements(prev => [...prev, newLine]);
        setSelectedIds(new Set([newLine.id]));
      } else if (data.kind === 'shape_rect' || data.kind === 'shape_circle') {
        const isCircle = data.kind === 'shape_circle';
        const newShape = {
          id: `${isCircle ? 'circle' : 'rect'}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: data.kind,
          w: isCircle ? 120 : 160,
          h: isCircle ? 120 : 100,
          fillColor: 'transparent',
          fillOpacity: 1,
          lineStyle: 'single',
          color: '#475569',
          strokeWidth: 1,
          x: dropX,
          y: dropY,
          zIndex: 8
        };
        saveHistory(`Add ${isCircle ? 'Circle' : 'Rectangle'}`);
        setElements(prev => [...prev, newShape]);
        setSelectedIds(new Set([newShape.id]));
      } else if (data.kind === 'text_note') {
        const orientation = (data.orientation === 'v' || data.key === 'text_note_v') ? 'v' : 'h';
        let newNote = {
          id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'text_note',
          text: 'Note:',
          orientation,
          outlineStyle: 'single',
          fontSize: 12,
          color: '#475569',
          x: dropX,
          y: dropY,
          zIndex: 30
        };
        saveHistory('Add Label');
        setElements(prev => [...prev, newNote]);
        setSelectedIds(new Set([newNote.id]));
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // --- Selection and Dragging State ---
  const dragRef = useRef({
    isDragging: false,
    isPanning: false,
    didPan: false,
    panStart: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 },
    origPositions: new Map(),
    draggingAnchor: null,
    draggingVertex: null,
    extendingPipe: null,
    drawingPipeStart: null,
    isMarquee: false,
    marqueeStart: { x: 0, y: 0 }
  });

  const clearTransientDragState = () => {
    dragRef.current.pointerDownHasButtons = false;
    dragRef.current.draggingLiveCard = null;
    dragRef.current.isDragging = false;
    dragRef.current.draggingAnchor = null;
    dragRef.current.draggingVertex = null;
    dragRef.current.draggingBoundsHandle = null;
    dragRef.current.isPanning = false;
    dragRef.current.isMarquee = false;
    if (viewportRef.current) {
      viewportRef.current.classList.remove('is-panning');
      viewportRef.current.querySelectorAll('.element-anchor-handle, .element-anchor-line').forEach(node => {
        node.style.display = '';
      });
    }
    if (interactionLayerRef.current) {
      interactionLayerRef.current.innerHTML = '';
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }
    if (e.target.closest('.canvas-floating-hud') || e.target.closest('.ps-inspector')) {
      return;
    }

    dragRef.current.pointerDownHasButtons = (e.buttons || 0) !== 0;
    const w = clientToWorld(e.clientX, e.clientY);

    // Bounding Box Handle Drag (works in runtime and editor modes)
    if (isBoundsResizerActive && resizingBox) {
      const handleEl = e.target.closest('.ps-bounds-handle');
      if (handleEl) {
        e.preventDefault();
        const handleType = handleEl.getAttribute('data-handle');
        dragRef.current.draggingBoundsHandle = {
          handleType,
          startMouse: { x: w.x, y: w.y },
          startBox: { ...resizingBox }
        };
        return;
      }
    }

    if (scapeMode === 'runtime') {
      if (isLiveDndActive) {
        // 1. Dragging anchor reticle on sensor card
        const anchorEl = e.target.closest('.element-anchor-handle');
        if (anchorEl) {
          e.preventDefault();
          const elId = anchorEl.getAttribute('data-element-id');
          dragRef.current.draggingAnchor = { elId, startW: { x: w.x, y: w.y } };
          anchorEl.style.display = 'none';
          anchorEl.closest('.sensor-badge-group, .plant-node')?.querySelectorAll('.element-anchor-line').forEach(l => {
            l.style.display = 'none';
          });
          return;
        }

        // 2. Dragging measurement point card
        const cardEl = e.target.closest('.sensor-badge-group');
        if (cardEl) {
          e.preventDefault();
          const cardId = cardEl.getAttribute('data-card-id');
          const targetCard = elements.find(item => item.id === cardId);
          if (targetCard) {
            dragRef.current.draggingLiveCard = {
              cardId,
              startMouse: { x: w.x, y: w.y },
              origPos: { x: targetCard.x, y: targetCard.y }
            };
            return;
          }
        }
      }

      // In runtime mode: The entire canvas position is completely fixed by default.
      // Dragging and moving the canvas is disabled unless the user clicks the bounds resizer tool.
      if (isBoundsResizerActive) {
        dragRef.current.isPanning = true;
        dragRef.current.didPan = false;
        dragRef.current.panStart = { x: e.clientX - view.x, y: e.clientY - view.y };
        if (viewportRef.current) viewportRef.current.classList.add('is-panning');
      }
      return;
    }

    // Workspace Pan (Only active in Pan Tool or Spacebar temporary pan — never when toolPan is unchecked)
    if (currentTool === 'pan' || isSpacePressedRef.current) {
      dragRef.current.isPanning = true;
      dragRef.current.didPan = false;
      dragRef.current.panStart = { x: e.clientX - view.x, y: e.clientY - view.y };
      if (viewportRef.current) viewportRef.current.classList.add('is-panning');
      return;
    }

    // 0. Dragging anchor reticle
    const anchorEl = e.target.closest('.element-anchor-handle');
    if (anchorEl) {
      const elId = anchorEl.getAttribute('data-element-id');
      dragRef.current.draggingAnchor = { elId, startW: { x: w.x, y: w.y } };
      anchorEl.style.display = 'none';
      anchorEl.closest('.plant-node, .plant-text-group')?.querySelectorAll('.element-anchor-line').forEach(l => {
        l.style.display = 'none';
      });

      // Immediately render the drag reticle at anchor's current position so it never jumps or flashes
      const iLayer = interactionLayerRef.current;
      const el = elements.find(item => item.id === elId);
      if (iLayer && el) {
        iLayer.innerHTML = '';
        const reticleG = svgEl('g', { transform: `translate(${el.x}, ${el.y})` });
        reticleG.appendChild(svgEl('circle', {
          class: 'anchor-handle-core',
          cx: 0, cy: 0, r: 8, fill: el.attachedPipeId ? '#00ac86' : '#0ea5e9', stroke: '#ffffff', 'stroke-width': 2.5
        }));
        reticleG.appendChild(svgEl('line', { x1: -4, y1: 0, x2: 4, y2: 0, stroke: '#ffffff', 'stroke-width': 1.5 }));
        reticleG.appendChild(svgEl('line', { x1: 0, y1: -4, x2: 0, y2: 4, stroke: '#ffffff', 'stroke-width': 1.5 }));
        iLayer.appendChild(reticleG);
      }
      return;
    }

    // 1. Pipe vertex drag handle (the blue circles on pipe endpoints / corners)
    const vertexEl = e.target.closest('.pipe-drag-handle');
    if (vertexEl) {
      const pId = vertexEl.getAttribute('data-pipe-id');
      const ptIdx = parseInt(vertexEl.getAttribute('data-point-idx'), 10);
      const targetP = pipes.find(p => p.id === pId);
      const origPt = (targetP && targetP.points && targetP.points[ptIdx]) ? { ...targetP.points[ptIdx] } : null;
      dragRef.current.draggingVertex = { pipeId: pId, idx: ptIdx, origPt };
      return;
    }

    // 2. Pipe extension handle (+)
    const extGroup = e.target.closest('.pipe-extend-group');
    if (extGroup) {
      const pId = extGroup.getAttribute('data-pipe-id');
      const end = extGroup.getAttribute('data-end');
      const p = pipes.find(item => item.id === pId);
      if (p && p.points && p.points.length >= 2) {
        setActivePipeMedium(p.medium || 'gas');
        dragRef.current.extendingPipe = { pipe: p, end };
        dragRef.current.drawingPipeStart = null;
        setCurrentTool('draw_pipe');
      }
      return;
    }

    // 3. Extending existing pipe committed on click
    if (dragRef.current.extendingPipe && dragRef.current.extendingPipe.pipe) {
      const extending = dragRef.current.extendingPipe;
      const snapPt = getSnapExtensionPoint(extending, { x: snap(w.x), y: snap(w.y) });
      const pipe = extending.pipe;
      const p0 = pipe.points[0];
      const p1 = pipe.points[pipe.points.length - 1];
      const isHoriz = Math.abs(p1.y - p0.y) <= Math.abs(p1.x - p0.x);
      const pAnchor = extending.end === 'end' ? p1 : p0;

      if (Math.hypot(snapPt.x - pAnchor.x, snapPt.y - pAnchor.y) >= 10) {
        saveHistory('Extend Pipeline');
        if (isHoriz) {
          if (snapPt.y === pAnchor.y) {
            // Straight horizontal extension
            const updatedPts = pipe.points.map(pt => ({ ...pt }));
            if (extending.end === 'end') {
              updatedPts[updatedPts.length - 1].x = snapPt.x;
            } else {
              updatedPts[0].x = snapPt.x;
            }
            const updatedPipes = pipes.map(p => p.id === pipe.id ? { ...p, points: updatedPts, d: pointsToPath(updatedPts) } : p);
            setPipes(updatedPipes);
            const connectedIds = getConnectedPipeIds(pipe.id, updatedPipes);
            setSelectedIds(new Set(connectedIds));
          } else {
            // Perpendicular vertical branch line (grouped into single pipeline entirety)
            const gId = pipe.groupId || `pipe_group_${Date.now()}`;
            const branchPts = [{ ...pAnchor }, { ...snapPt }];
            const vPipe = {
              id: `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              groupId: gId,
              medium: pipe.medium,
              points: branchPts,
              d: pointsToPath(branchPts),
              w: pipe.w || 20,
              flow: pipe.flow || 'forward',
              label: '',
              zIndex: 10
            };
            const updatedPipes = pipes.map(p => p.id === pipe.id ? { ...p, groupId: gId } : p).concat(vPipe);
            setPipes(updatedPipes);
            const connectedIds = getConnectedPipeIds(vPipe.id, updatedPipes);
            setSelectedIds(new Set(connectedIds));
          }
        } else {
          if (snapPt.x === pAnchor.x) {
            // Straight vertical extension
            const updatedPts = pipe.points.map(pt => ({ ...pt }));
            if (extending.end === 'end') {
              updatedPts[updatedPts.length - 1].y = snapPt.y;
            } else {
              updatedPts[0].y = snapPt.y;
            }
            const updatedPipes = pipes.map(p => p.id === pipe.id ? { ...p, points: updatedPts, d: pointsToPath(updatedPts) } : p);
            setPipes(updatedPipes);
            const connectedIds = getConnectedPipeIds(pipe.id, updatedPipes);
            setSelectedIds(new Set(connectedIds));
          } else {
            // Perpendicular horizontal branch line (grouped into single pipeline entirety)
            const gId = pipe.groupId || `pipe_group_${Date.now()}`;
            const branchPts = [{ ...pAnchor }, { ...snapPt }];
            const hPipe = {
              id: `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              groupId: gId,
              medium: pipe.medium,
              points: branchPts,
              d: pointsToPath(branchPts),
              w: pipe.w || 20,
              flow: pipe.flow || 'forward',
              label: '',
              zIndex: 10
            };
            const updatedPipes = pipes.map(p => p.id === pipe.id ? { ...p, groupId: gId } : p).concat(hPipe);
            setPipes(updatedPipes);
            const connectedIds = getConnectedPipeIds(hPipe.id, updatedPipes);
            setSelectedIds(new Set(connectedIds));
          }
        }
      }

      dragRef.current.extendingPipe = null;
      if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
      setCurrentTool('select');
      return;
    }

    // 4. Draw pipe tool
    if (currentTool === 'draw_pipe') {
      const rawSnap = { x: snap(w.x), y: snap(w.y) };
      if (!dragRef.current.drawingPipeStart) {
        dragRef.current.drawingPipeStart = rawSnap;
      } else {
        const pStart = dragRef.current.drawingPipeStart;
        const snapPt = getSnapOrthogonalPoint(pStart, rawSnap);
        if (Math.hypot(snapPt.x - pStart.x, snapPt.y - pStart.y) > 10) {
          saveHistory('Draw Pipe');
          let assignedGroupId = null;
          let matchedExistingPipe = null;
          for (const ep of pipes) {
            if (!ep.points || ep.points.length < 2) continue;
            const ends = [ep.points[0], ep.points[ep.points.length - 1]];
            const touchesEnd = ends.some(pt => Math.hypot(pt.x - pStart.x, pt.y - pStart.y) <= 20 || Math.hypot(pt.x - snapPt.x, pt.y - snapPt.y) <= 20);
            const pad = (ep.w || 20) / 2 + 8;
            let touchesBody = false;
            for (let i = 0; i < ep.points.length - 1; i++) {
              if (distToSegment(pStart, ep.points[i], ep.points[i + 1]) <= pad || distToSegment(snapPt, ep.points[i], ep.points[i + 1]) <= pad) {
                touchesBody = true;
                break;
              }
            }
            if (touchesEnd || touchesBody) {
              matchedExistingPipe = ep;
              assignedGroupId = ep.groupId || `pipe_group_${Date.now()}`;
              break;
            }
          }
          const newPipe = {
            id: `pipe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            groupId: assignedGroupId,
            medium: activePipeMedium,
            points: [pStart, snapPt],
            d: pointsToPath([pStart, snapPt]),
            w: 20,
            flow: 'forward',
            label: '',
            zIndex: 10
          };
          const updatedPipes = assignedGroupId
            ? pipes.map(p => (p.id === matchedExistingPipe?.id || (p.groupId && p.groupId === assignedGroupId)) ? { ...p, groupId: assignedGroupId } : p).concat(newPipe)
            : [...pipes, newPipe];
          setPipes(updatedPipes);
          const connectedIds = getConnectedPipeIds(newPipe.id, updatedPipes);
          setSelectedIds(new Set(connectedIds));
        }
        dragRef.current.drawingPipeStart = null;
        if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
        setCurrentTool('select');
      }
      return;
    }

    // 5. Clicked on an element
    const nodeEl = e.target.closest('.plant-node');
    const cardEl = e.target.closest('.sensor-badge-group');
    const textEl = e.target.closest('.plant-text-group');
    const pipeEl = e.target.closest('.plant-pipe-group');

    const clickedId = nodeEl?.getAttribute('data-node-id') ||
      cardEl?.getAttribute('data-card-id') ||
      textEl?.getAttribute('data-text-id') ||
      pipeEl?.getAttribute('data-pipe-id');

    if (clickedId) {
      let idsToSelect = [clickedId];
      if (pipeEl || pipes.some(p => p.id === clickedId)) {
        idsToSelect = getConnectedPipeIds(clickedId, pipes);
      }

      let nextSelectedIds;
      if (e.shiftKey) {
        nextSelectedIds = new Set(selectedIds);
        const allSelected = idsToSelect.every(id => nextSelectedIds.has(id));
        if (allSelected) {
          idsToSelect.forEach(id => nextSelectedIds.delete(id));
        } else {
          idsToSelect.forEach(id => nextSelectedIds.add(id));
        }
        setSelectedIds(nextSelectedIds);
      } else {
        const isAlreadySelected = idsToSelect.every(id => selectedIds.has(id));
        if (!isAlreadySelected) {
          nextSelectedIds = new Set(idsToSelect);
          setSelectedIds(nextSelectedIds);
        } else {
          nextSelectedIds = new Set(selectedIds);
        }
      }

      // If Shift+click toggled this target off, do not drag any remaining selected items
      if (!idsToSelect.some(id => nextSelectedIds.has(id))) {
        return;
      }

      dragRef.current.isDragging = true;
      dragRef.current.dragStart = { x: w.x, y: w.y };
      const origs = new Map();
      // Derive draggable IDs strictly from the updated selection (never stale selectedIds)
      const effectiveIds = nextSelectedIds;

      elements.forEach(el => {
        if (effectiveIds.has(el.id)) {
          origs.set(el.id, { kind: 'element', x: el.x, y: el.y });
        }
      });
      pipes.forEach(p => {
        if (effectiveIds.has(p.id)) {
          origs.set(p.id, {
            kind: 'pipe',
            points: JSON.parse(JSON.stringify(p.points || [])),
            d: p.d,
            labelX: p.labelX,
            labelY: p.labelY
          });
        }
      });
      // Also track any elements anchored to the pipes being moved
      const movingPipeIds = new Set(pipes.filter(p => effectiveIds.has(p.id)).map(p => p.id));
      if (movingPipeIds.size > 0) {
        elements.forEach(el => {
          if (!origs.has(el.id) && el.attachedPipeId && movingPipeIds.has(el.attachedPipeId)) {
            origs.set(el.id, { kind: 'element', x: el.x, y: el.y });
          }
        });
      }
      // Also track sensor cards attached to elements being moved
      const movingElementIds = new Set(elements.filter(el => effectiveIds.has(el.id)).map(el => el.id));
      if (movingElementIds.size > 0) {
        elements.forEach(el => {
          if (!origs.has(el.id) && el.type === 'sensor_card' && el.attachedAssetId && movingElementIds.has(el.attachedAssetId)) {
            origs.set(el.id, { kind: 'element', x: el.x, y: el.y });
          }
        });
      }
      dragRef.current.origPositions = origs;
      return;
    }

    // 6. Clicked empty canvas -> Marquee selection
    if (!e.shiftKey) {
      setSelectedIds(new Set());
    }
    dragRef.current.isMarquee = true;
    dragRef.current.marqueeStart = { x: w.x, y: w.y };
  };

  const handleMouseMove = (e) => {
    const hasActiveDrag = Boolean(
      dragRef.current.isPanning ||
      dragRef.current.draggingBoundsHandle ||
      dragRef.current.draggingLiveCard ||
      dragRef.current.draggingAnchor ||
      dragRef.current.isMarquee ||
      dragRef.current.draggingVertex ||
      dragRef.current.isDragging
    );
    if (hasActiveDrag && dragRef.current.pointerDownHasButtons && (e.buttons & 1) === 0) {
      handleMouseUp(e);
      return;
    }

    // Panning
    if (dragRef.current.isPanning) {
      dragRef.current.didPan = true;
      setView(v => ({
        ...v,
        x: e.clientX - dragRef.current.panStart.x,
        y: e.clientY - dragRef.current.panStart.y
      }));
      return;
    }

    const w = clientToWorld(e.clientX, e.clientY);

    // Bounding Box Handle Dragging (scales diagram pipes and elements proportionally)
    if (dragRef.current.draggingBoundsHandle && boundsBoxRef.current) {
      const { handleType, startMouse, startBox } = dragRef.current.draggingBoundsHandle;
      const dx = w.x - startMouse.x;
      const dy = w.y - startMouse.y;
      let newX = startBox.x;
      let newY = startBox.y;
      let newW = startBox.w;
      let newH = startBox.h;

      if (handleType.includes('e')) newW = Math.max(120, startBox.w + dx);
      if (handleType.includes('s')) newH = Math.max(100, startBox.h + dy);
      if (handleType.includes('w')) {
        const maxDx = startBox.w - 120;
        const clampedDx = Math.min(maxDx, dx);
        newX = startBox.x + clampedDx;
        newW = startBox.w - clampedDx;
      }
      if (handleType.includes('n')) {
        const maxDy = startBox.h - 100;
        const clampedDy = Math.min(maxDy, dy);
        newY = startBox.y + clampedDy;
        newH = startBox.h - clampedDy;
      }

      const updatedBox = { x: snap(newX, 5), y: snap(newY, 5), w: snap(newW, 5), h: snap(newH, 5) };
      setResizingBox(updatedBox);
      boundsBoxRef.current.currentBox = updatedBox;

      const origBox = boundsBoxRef.current.origBox;
      const origPipes = boundsBoxRef.current.origPipes;
      const origElements = boundsBoxRef.current.origElements;
      const sx = updatedBox.w / origBox.w;
      const sy = updatedBox.h / origBox.h;
      const shiftX = updatedBox.x - origBox.x;
      const shiftY = updatedBox.y - origBox.y;

      // 1. Proportional 2D affine scaling for all pipes
      // Scales all pipe points proportionally along both X (sx) and Y (sy) axes,
      // preserving 100% 90-degree orthogonality, horizontal and vertical segment alignment,
      // and maintaining seamless pipe-to-pipe junctions in grouped pipeline layouts.
      const updatedPipes = origPipes.map(p => {
        const newPoints = (p.points || []).map((pt) => {
          const px = Math.round(updatedBox.x + (pt.x - origBox.x) * sx);
          const py = Math.round(updatedBox.y + (pt.y - origBox.y) * sy);
          return { x: px, y: py };
        });

        return {
          ...p,
          points: newPoints,
          d: pointsToPath(newPoints)
        };
      });
      boundsBoxRef.current.currentPipes = updatedPipes;
      setPipes(updatedPipes);

      // 2. Reposition elements:
      // Elements anchored or attached to a pipe (e.g. sensors, transmitters, attached assets):
      // - Track their anchor point along the scaled pipe (maintaining proportional pipeT position)
      // - Maintain their exact relative offset from the pipe line
      //   (i.e. vertical distance from a horizontal pipe line does NOT drift when H grows!)
      const posMap = new Map();

      origElements.forEach(el => {
        if (el.type === 'sensor_card' && el.attachedAssetId) return; // Follows parent asset in pass 2

        let targetPipe = null;
        let tVal = null;
        let offX = 0;
        let offY = 0;

        if (el.attachedPipeId) {
          targetPipe = origPipes.find(p => p.id === el.attachedPipeId);
          if (targetPipe) {
            tVal = el.pipeT != null ? el.pipeT : null;
            if (tVal == null) {
              const cp = getClosestPointOnPipe(targetPipe, { x: el.x, y: el.y });
              if (cp) tVal = cp.t;
            }
            if (tVal != null) {
              const origContactPt = getPointAlongPipe(targetPipe, tVal);
              offX = el.pipeOffsetX !== undefined && el.pipeOffsetX !== null ? el.pipeOffsetX : (origContactPt ? el.x - origContactPt.x : 0);
              offY = el.pipeOffsetY !== undefined && el.pipeOffsetY !== null ? el.pipeOffsetY : (origContactPt ? el.y - origContactPt.y : 0);
            }
          }
        }

        // If not explicitly attached, check if sensor or equipment is close / anchored to a nearby pipe
        if (!targetPipe && origPipes.length > 0) {
          let minD = 48;
          origPipes.forEach(p => {
            const cp = getClosestPointOnPipe(p, { x: el.x, y: el.y });
            if (cp && cp.distance < minD) {
              minD = cp.distance;
              targetPipe = p;
              tVal = cp.t;
              offX = el.x - cp.point.x;
              offY = el.y - cp.point.y;
            }
          });
        }

        const updatedPipe = targetPipe ? updatedPipes.find(p => p.id === targetPipe.id) : null;
        if (updatedPipe && tVal != null) {
          const newContactPt = getPointAlongPipe(updatedPipe, tVal);
          if (newContactPt) {
            posMap.set(el.id, {
              x: Math.round(newContactPt.x + offX),
              y: Math.round(newContactPt.y + offY)
            });
            return;
          }
        }

        const newX = Math.round(updatedBox.x + (el.x - origBox.x) * sx);
        const newY = Math.round(updatedBox.y + (el.y - origBox.y) * sy);
        posMap.set(el.id, { x: newX, y: newY });
      });

      // Second pass: sensor cards attached to assets follow their parent asset exactly
      origElements.forEach(el => {
        if (el.type === 'sensor_card' && el.attachedAssetId) {
          const parentOrig = origElements.find(item => item.id === el.attachedAssetId);
          const parentNew = posMap.get(el.attachedAssetId);
          if (parentOrig && parentNew) {
            const offX = el.x - parentOrig.x;
            const offY = el.y - parentOrig.y;
            posMap.set(el.id, {
              x: Math.round(parentNew.x + offX),
              y: Math.round(parentNew.y + offY)
            });
            return;
          }
        }
        if (!posMap.has(el.id)) {
          posMap.set(el.id, {
            x: Math.round(updatedBox.x + (el.x - origBox.x) * sx),
            y: Math.round(updatedBox.y + (el.y - origBox.y) * sy)
          });
        }
      });

      const updatedElements = origElements.map(el => {
        const pos = posMap.get(el.id);
        if (!pos) return el;
        if (el.type === 'guide_line') {
          const factor = el.orientation === 'v' ? sy : sx;
          return {
            ...el,
            x: pos.x,
            y: pos.y,
            length: Math.max(20, Math.round((Number(el.length) || 220) * factor))
          };
        }
        if (el.type === 'shape_rect' || el.type === 'shape_circle') {
          const defW = el.type === 'shape_circle' ? 120 : 160;
          const defH = el.type === 'shape_circle' ? 120 : 100;
          return {
            ...el,
            x: pos.x,
            y: pos.y,
            w: Math.max(20, Math.round((Number(el.w) || defW) * sx)),
            h: Math.max(20, Math.round((Number(el.h) || defH) * sy))
          };
        }
        return { ...el, x: pos.x, y: pos.y };
      });
      boundsBoxRef.current.currentElements = updatedElements;
      setElements(updatedElements);
      return;
    }

    // Live DND Measurement Point dragging in runtime mode
    if (dragRef.current.draggingLiveCard) {
      const { cardId, startMouse, origPos } = dragRef.current.draggingLiveCard;
      const dx = snap(w.x - startMouse.x, 2);
      const dy = snap(w.y - startMouse.y, 2);
      setElements(prev => prev.map(el => {
        if (el.id === cardId) {
          return { ...el, x: origPos.x + dx, y: origPos.y + dy };
        }
        return el;
      }));
      return;
    }

    if (scapeMode === 'runtime' && !dragRef.current.draggingAnchor) return;

    // Marquee Selection Box
    if (dragRef.current.isMarquee) {
      const mStart = dragRef.current.marqueeStart;
      const x1 = Math.min(mStart.x, w.x);
      const y1 = Math.min(mStart.y, w.y);
      const x2 = Math.max(mStart.x, w.x);
      const y2 = Math.max(mStart.y, w.y);
      const mw = x2 - x1;
      const mh = y2 - y1;

      const iLayer = interactionLayerRef.current;
      if (iLayer) {
        iLayer.innerHTML = '';
        if (mw > 2 || mh > 2) {
          iLayer.appendChild(svgEl('rect', {
            x: x1,
            y: y1,
            width: mw,
            height: mh,
            fill: 'rgba(0, 172, 134, 0.12)',
            stroke: '#00ac86',
            'stroke-width': 1.5,
            'stroke-dasharray': '5 3',
            rx: 2
          }));
        }
      }
      return;
    }

    // Live dragging specific pipe vertex (stretches pipe and keeps junction connected)
    if (dragRef.current.draggingVertex) {
      const { pipeId, idx, origPt } = dragRef.current.draggingVertex;
      const newX = snap(w.x);
      const newY = snap(w.y);

      const targetP = pipes.find(p => p.id === pipeId);
      if (!targetP || !targetP.points || !targetP.points[idx]) return;

      let finalPt = { x: newX, y: newY };
      const pts = targetP.points;
      if (pts.length === 2) {
        const otherIdx = 1 - idx;
        const isH = Math.abs(pts[0].y - pts[1].y) <= Math.abs(pts[0].x - pts[1].x);
        if (isH) {
          finalPt = { x: newX, y: pts[otherIdx].y };
        } else {
          finalPt = { x: pts[otherIdx].x, y: newY };
        }
      }

      setPipes(prev => prev.map(pipe => {
        if (!pipe.points) return pipe;
        if (pipe.id === pipeId) {
          const updatedPts = pipe.points.map((pt, i) => i === idx ? { ...finalPt } : { ...pt });
          return { ...pipe, points: updatedPts, d: pointsToPath(updatedPts) };
        }
        if (origPt) {
          let touched = false;
          const updatedPts = pipe.points.map(pt => {
            if (Math.hypot(pt.x - origPt.x, pt.y - origPt.y) <= 15) {
              touched = true;
              return { ...finalPt };
            }
            return { ...pt };
          });
          if (touched) {
            return { ...pipe, points: updatedPts, d: pointsToPath(updatedPts) };
          }
        }
        return pipe;
      }));
      return;
    }

    // Live preview for extending an existing pipe
    if (dragRef.current.extendingPipe && dragRef.current.extendingPipe.pipe) {
      const extending = dragRef.current.extendingPipe;
      const curPt = getSnapExtensionPoint(extending, { x: snap(w.x), y: snap(w.y) });
      const pipe = extending.pipe;
      const pAnchor = extending.end === 'end' ? pipe.points[pipe.points.length - 1] : pipe.points[0];
      const previewPts = [pAnchor, curPt];
      const pipeColor = pipe.medium === 'liquid' ? '#0284c7' : '#94a3b8';
      const iLayer = interactionLayerRef.current;
      if (iLayer) {
        iLayer.innerHTML = '';
        iLayer.appendChild(svgEl('path', {
          d: pointsToPath(previewPts),
          fill: 'none', stroke: pipeColor, 'stroke-width': pipe.w || 20,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.7
        }));
        iLayer.appendChild(svgEl('path', {
          d: pointsToPath(previewPts),
          fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '5 5'
        }));
        previewPts.forEach(pt => {
          iLayer.appendChild(svgEl('circle', {
            cx: pt.x, cy: pt.y, r: 4, fill: '#ffffff', stroke: pipeColor, 'stroke-width': 1.5
          }));
        });
      }
      return;
    }

    // Live preview for drawing a new pipe
    if (currentTool === 'draw_pipe' && dragRef.current.drawingPipeStart) {
      const pStart = dragRef.current.drawingPipeStart;
      const curPt = getSnapOrthogonalPoint(pStart, { x: snap(w.x), y: snap(w.y) });
      const allPreviewPts = [pStart, curPt];
      const pipeColor = activePipeMedium === 'liquid' ? '#0284c7' : '#94a3b8';
      const iLayer = interactionLayerRef.current;
      if (iLayer) {
        iLayer.innerHTML = '';
        iLayer.appendChild(svgEl('path', {
          d: pointsToPath(allPreviewPts),
          fill: 'none', stroke: pipeColor, 'stroke-width': 20,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.7
        }));
        iLayer.appendChild(svgEl('path', {
          d: pointsToPath(allPreviewPts),
          fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '5 5'
        }));
        allPreviewPts.forEach(pt => {
          iLayer.appendChild(svgEl('circle', {
            cx: pt.x, cy: pt.y, r: 4, fill: '#ffffff', stroke: pipeColor, 'stroke-width': 1.5
          }));
        });
      }
      return;
    }

    // Dragging elements
    if (dragRef.current.isDragging) {
      const dx = snap(w.x - dragRef.current.dragStart.x);
      const dy = snap(w.y - dragRef.current.dragStart.y);

      setElements(prev => prev.map(el => {
        const orig = dragRef.current.origPositions.get(el.id);
        if (!orig || orig.kind !== 'element') return el;
        return { ...el, x: orig.x + dx, y: orig.y + dy };
      }));

      setPipes(prev => prev.map(p => {
        const orig = dragRef.current.origPositions.get(p.id);
        if (!orig || orig.kind !== 'pipe') return p;
        const newPts = orig.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
        return {
          ...p,
          points: newPts,
          d: pointsToPath(newPts),
          labelX: orig.labelX !== undefined ? orig.labelX + dx : undefined,
          labelY: orig.labelY !== undefined ? orig.labelY + dy : undefined
        };
      }));
      return;
    }

    // Dragging anchor
    if (dragRef.current.draggingAnchor) {
      const iLayer = interactionLayerRef.current;
      if (!iLayer) return;
      iLayer.innerHTML = '';
      const el = elements.find(item => item.id === dragRef.current.draggingAnchor.elId);
      if (!el) return;

      const targetX = snap(w.x);
      const targetY = snap(w.y);

      if (el.type === 'sensor_card') {
        // Find closest equipment / machine / tank / wall (any item except pipes and other sensor cards)
        let closestTarget = null;
        let minD = 90;
        elements.forEach(other => {
          if (other.id !== el.id && other.type !== 'sensor_card') {
            const d = Math.hypot(other.x - targetX, other.y - targetY);
            if (d < minD) {
              minD = d;
              closestTarget = other;
            }
          }
        });

        const anchorPt = closestTarget ? { x: closestTarget.x, y: closestTarget.y } : { x: targetX, y: targetY };
        iLayer.appendChild(svgEl('line', {
          x1: el.x, y1: el.y, x2: anchorPt.x, y2: anchorPt.y,
          stroke: closestTarget ? '#00a876' : '#64748b', 'stroke-width': 2.5, 'stroke-dasharray': '5 3'
        }));
        iLayer.appendChild(svgEl('circle', {
          cx: anchorPt.x, cy: anchorPt.y, r: closestTarget ? 14 : 8,
          fill: closestTarget ? 'rgba(0, 168, 118, 0.25)' : 'rgba(2, 132, 199, 0.25)',
          stroke: closestTarget ? '#00a876' : '#0284c7', 'stroke-width': 2.5
        }));
        iLayer.appendChild(svgEl('circle', {
          cx: anchorPt.x, cy: anchorPt.y, r: 4, fill: closestTarget ? '#00a876' : '#0284c7'
        }));
      } else {
        // Equipment / Label: snap anchor to a pipe branch
        const distFromOrigin = Math.hypot(w.x - el.x, w.y - el.y);
        let closestPipe = null;
        let closestData = null;
        let minD = 18;
        if (distFromOrigin > 10) {
          pipes.forEach(p => {
            const snapD = (p.w ? p.w / 2 : 10) + 8;
            const res = getClosestPointOnPipe(p, { x: targetX, y: targetY });
            if (res && res.distance < snapD && res.distance < minD) {
              minD = res.distance;
              closestPipe = p;
              closestData = res;
            }
          });
        }
        const isSnapped = Boolean(closestPipe && closestData);
        const anchorPt = (closestPipe && closestData) ? closestData.point : { x: targetX, y: targetY };

        // Dynamic dashed connection line
        iLayer.appendChild(svgEl('line', {
          x1: el.x, y1: el.y, x2: anchorPt.x, y2: anchorPt.y,
          stroke: isSnapped ? '#00ac86' : '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '5 3'
        }));

        // Moving anchor reticle following cursor / snapped contact
        const reticleG = svgEl('g', { transform: `translate(${anchorPt.x}, ${anchorPt.y})` });
        reticleG.appendChild(svgEl('circle', {
          class: 'anchor-handle-core',
          cx: 0, cy: 0, r: 8,
          fill: isSnapped ? '#00ac86' : '#0284c7', stroke: '#ffffff', 'stroke-width': 2.5
        }));
        reticleG.appendChild(svgEl('line', { x1: -4, y1: 0, x2: 4, y2: 0, stroke: '#ffffff', 'stroke-width': 1.5 }));
        reticleG.appendChild(svgEl('line', { x1: 0, y1: -4, x2: 0, y2: 4, stroke: '#ffffff', 'stroke-width': 1.5 }));
        iLayer.appendChild(reticleG);
      }
    }
  };

  const handleMouseUp = (e) => {
    dragRef.current.pointerDownHasButtons = false;

    if (dragRef.current.isPanning) {
      dragRef.current.isPanning = false;
      if (viewportRef.current) {
        viewportRef.current.classList.remove('is-panning');
        if (currentTool !== 'pan' && !isSpacePressedRef.current) {
          viewportRef.current.classList.remove('panning');
        }
      }
      if (dragRef.current.didPan && activeScapeId) {
        saveScapeView(activeScapeId, view);
      }
    }

    if (dragRef.current.draggingBoundsHandle) {
      dragRef.current.draggingBoundsHandle = null;
    }

    if (scapeMode !== 'runtime' && dragRef.current.draggingLiveCard) {
      dragRef.current.draggingLiveCard = null;
    }

    if (scapeMode === 'runtime') {
      if (dragRef.current.draggingLiveCard) {
        const { cardId, origPos } = dragRef.current.draggingLiveCard;
        dragRef.current.draggingLiveCard = null;
        setElements(prev => {
          const movedCard = prev.find(el => el.id === cardId);
          if (!movedCard || (origPos && movedCard.x === origPos.x && movedCard.y === origPos.y)) {
            return prev;
          }
          const updated = prev.map(el => (
            el.id === cardId
              ? resolveSensorCardAttachmentAfterDrag(el, prev, { markUserPositioned: true })
              : el
          ));
          if (boundsBoxRef.current) {
            boundsBoxRef.current.origElements = JSON.parse(JSON.stringify(updated));
            boundsBoxRef.current.currentElements = JSON.parse(JSON.stringify(updated));
          }
          saveScape({
            id: activeScapeId,
            title: projectTitle,
            tempCanvasSize: { width: screenSize.w, height: screenSize.h },
            zones,
            elements: updated,
            pipes
          });
          return updated;
        });
      }

      if (dragRef.current.draggingAnchor) {
        const w = clientToWorld(e.clientX, e.clientY);
        const targetX = snap(w.x);
        const targetY = snap(w.y);
        const elId = dragRef.current.draggingAnchor.elId;

        let closestTarget = null;
        let minD = 90;
        elements.forEach(other => {
          if (other.id !== elId && other.type !== 'sensor_card') {
            const d = Math.hypot(other.x - targetX, other.y - targetY);
            if (d < minD) {
              minD = d;
              closestTarget = other;
            }
          }
        });

        setElements(prev => {
          const updated = prev.map(item => {
            if (item.id !== elId) return item;
            if (closestTarget) {
              return {
                ...item,
                attachedAssetId: closestTarget.id,
                targetOffsetX: item.x - closestTarget.x,
                targetOffsetY: item.y - closestTarget.y
              };
            } else {
              const u = { ...item };
              delete u.attachedAssetId;
              delete u.targetOffsetX;
              delete u.targetOffsetY;
              return u;
            }
          });
          if (boundsBoxRef.current) {
            boundsBoxRef.current.origElements = JSON.parse(JSON.stringify(updated));
            boundsBoxRef.current.currentElements = JSON.parse(JSON.stringify(updated));
          }
          saveScape({
            id: activeScapeId,
            title: projectTitle,
            tempCanvasSize: { width: screenSize.w, height: screenSize.h },
            zones,
            elements: updated,
            pipes
          });
          return updated;
        });

        if (viewportRef.current) {
          viewportRef.current.querySelectorAll('.element-anchor-handle, .element-anchor-line').forEach(node => {
            node.style.display = '';
          });
        }
        const iLayer = interactionLayerRef.current;
        if (iLayer) iLayer.innerHTML = '';
        dragRef.current.draggingAnchor = null;
      }
      return;
    }

    if (dragRef.current.draggingVertex) {
      const { pipeId } = dragRef.current.draggingVertex;
      dragRef.current.draggingVertex = null;
      saveHistory('Adjust Pipe Vertex');
      const targetP = pipes.find(p => p.id === pipeId);
      if (targetP) {
        setElements(prev => prev.map(el => {
          if (el.attachedPipeId === pipeId && el.pipeT != null && el.pipeOffsetX !== undefined && el.pipeOffsetY !== undefined) {
            const pt = getPointAlongPipe(targetP, el.pipeT);
            if (pt) {
              return { ...el, x: pt.x + el.pipeOffsetX, y: pt.y + el.pipeOffsetY };
            }
          }
          return el;
        }));
      }
    }

    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
      saveHistory('Move Item(s)');
      // If an element attached to a pipe was moved, update pipeOffsetX / pipeOffsetY relative to pipeT
      // If a measurement point card (sensor_card) was moved, update attachment target or offset
      setElements(prev => prev.map(el => {
        if (el.attachedPipeId && el.pipeT != null) {
          const pipe = pipes.find(p => p.id === el.attachedPipeId);
          if (pipe) {
            const pt = getPointAlongPipe(pipe, el.pipeT);
            if (pt) {
              return {
                ...el,
                pipeOffsetX: el.x - pt.x,
                pipeOffsetY: el.y - pt.y
              };
            }
          }
        }
        if (el.type === 'sensor_card' && dragRef.current.origPositions.has(el.id)) {
          return resolveSensorCardAttachmentAfterDrag(el, prev);
        }
        return el;
      }));
    }

    if (dragRef.current.draggingAnchor) {
      const w = clientToWorld(e.clientX, e.clientY);
      const targetX = snap(w.x);
      const targetY = snap(w.y);
      const elId = dragRef.current.draggingAnchor.elId;
      const el = elements.find(item => item.id === elId);

      if (el && el.type === 'sensor_card') {
        let closestTarget = null;
        let minD = 90;
        elements.forEach(other => {
          if (other.id !== el.id && other.type !== 'sensor_card') {
            const d = Math.hypot(other.x - targetX, other.y - targetY);
            if (d < minD) {
              minD = d;
              closestTarget = other;
            }
          }
        });
        saveHistory('Attach Sensor Mode');
        if (closestTarget) {
          setElements(prev => prev.map(item => item.id === elId ? {
            ...item,
            attachedAssetId: closestTarget.id,
            targetOffsetX: item.x - closestTarget.x,
            targetOffsetY: item.y - closestTarget.y
          } : item));
        } else {
          setElements(prev => prev.map(item => {
            if (item.id !== elId) return item;
            const updated = { ...item };
            delete updated.attachedAssetId;
            delete updated.targetOffsetX;
            delete updated.targetOffsetY;
            return updated;
          }));
        }
      } else if (el) {
        let closestPipe = null;
        let closestData = null;
        let minD = 24;
        pipes.forEach(p => {
          const snapD = (p.w ? p.w / 2 : 10) + 12;
          const res = getClosestPointOnPipe(p, { x: targetX, y: targetY });
          if (res && res.distance < snapD && res.distance < minD) {
            minD = res.distance;
            closestPipe = p;
            closestData = res;
          }
        });

        if (closestPipe && closestData) {
          saveHistory('Attach Anchor to Pipe');
          const tVal = Number(closestData.t.toFixed(4));
          const contactPt = closestData.point;
          setElements(prev => prev.map(item => (item.id === elId ? {
            ...item,
            attachedPipeId: closestPipe.id,
            pipeT: tVal,
            pipeOffsetX: item.x - contactPt.x,
            pipeOffsetY: item.y - contactPt.y
          } : item)));
        } else {
          saveHistory('Detach Anchor');
          setElements(prev => prev.map(item => {
            if (item.id !== elId) return item;
            const updated = { ...item };
            delete updated.attachedPipeId;
            delete updated.pipeT;
            delete updated.pipeOffsetX;
            delete updated.pipeOffsetY;
            return updated;
          }));
        }
      }

      if (viewportRef.current) {
        viewportRef.current.querySelectorAll('.element-anchor-handle, .element-anchor-line').forEach(node => {
          node.style.display = '';
        });
      }
      const iLayer = interactionLayerRef.current;
      if (iLayer) iLayer.innerHTML = '';
      dragRef.current.draggingAnchor = null;
    }

    if (dragRef.current.isMarquee) {
      dragRef.current.isMarquee = false;
      const iLayer = interactionLayerRef.current;
      if (iLayer) iLayer.innerHTML = '';

      const w = clientToWorld(e.clientX, e.clientY);
      const mStart = dragRef.current.marqueeStart;
      const x1 = Math.min(mStart.x, w.x);
      const y1 = Math.min(mStart.y, w.y);
      const x2 = Math.max(mStart.x, w.x);
      const y2 = Math.max(mStart.y, w.y);
      const mw = x2 - x1;
      const mh = y2 - y1;

      if (mw > 4 || mh > 4) {
        const nextSelected = new Set(e.shiftKey ? selectedIds : []);
        elements.forEach(el => {
          if (scapeMode === 'editor' && el.type === 'sensor_card') return;
          const bbox = getElementBBox(el);
          if (rectsIntersect(x1, y1, mw, mh, bbox.x, bbox.y, bbox.w, bbox.h)) {
            nextSelected.add(el.id);
          }
        });
        const touchedPipeIds = [];
        pipes.forEach(p => {
          const pBox = getPipeBoundingBox(p);
          if (rectsIntersect(x1, y1, mw, mh, pBox.x, pBox.y, pBox.w, pBox.h)) {
            touchedPipeIds.push(p.id);
          }
        });
        const allConnectedPipeIds = expandConnectedPipes(touchedPipeIds, pipes);
        allConnectedPipeIds.forEach(pId => nextSelected.add(pId));
        setSelectedIds(nextSelected);
      }
    }
  };

  const handleDoubleClick = (e) => {
    if (currentTool === 'draw_pipe') {
      dragRef.current.drawingPipeStart = null;
      dragRef.current.extendingPipe = null;
      if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
      setCurrentTool('select');
      return;
    }
    const pipeEl = e.target.closest('.plant-pipe-group');
    if (pipeEl) {
      const pId = pipeEl.getAttribute('data-pipe-id');
      const allConnected = getConnectedPipeIds(pId, pipes);
      setSelectedIds(new Set(allConnected));
      return;
    }
    const textEl = e.target.closest('.plant-text-group');
    if (textEl && scapeMode === 'editor') {
      const tId = textEl.getAttribute('data-text-id');
      if (tId) {
        setSelectedIds(new Set([tId]));
        setTimeout(() => {
          const inputEl = document.getElementById('psTextNoteInput');
          if (inputEl) {
            inputEl.focus();
            inputEl.select();
          }
        }, 30);
        return;
      }
    }
    const targetItem = e.target.closest('.plant-asset-group') || e.target.closest('.sensor-badge-group') || e.target.closest('.plant-text-group');
    if (targetItem) {
      const w = clientToWorld(e.clientX, e.clientY);
      centerOnPoint(w.x, w.y);
    }
  };

  const handleContextMenu = (e) => {
    if (dragRef.current.didPan) {
      e.preventDefault();
      dragRef.current.didPan = false;
    }
  };

  /**
   * Enter Pan mode and immediately clear all selection, inspector, and active tool previews
   * so canvas dragging operates solely on the whole viewport.
   */
  const activatePanTool = useCallback(() => {
    dragRef.current.isDragging = false;
    dragRef.current.isMarquee = false;
    dragRef.current.drawingPipeStart = null;
    dragRef.current.extendingPipe = null;
    if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
    setSelectedIds(new Set());
    setCurrentTool('pan');
  }, []);

  const handleClick = (e) => {
    if (scapeMode === 'runtime' || currentTool === 'pan' || isSpacePressedRef.current || e.shiftKey) return;
    const nodeEl = e.target.closest('.plant-node');
    const cardEl = e.target.closest('.sensor-badge-group');
    const textEl = e.target.closest('.plant-text-group');
    const pipeEl = e.target.closest('.plant-pipe-group');

    const clickedId = nodeEl?.getAttribute('data-node-id') ||
      cardEl?.getAttribute('data-card-id') ||
      textEl?.getAttribute('data-text-id') ||
      pipeEl?.getAttribute('data-pipe-id');

    if (clickedId) {
      let idsToSelect = [clickedId];
      if (pipeEl || pipes.some(p => p.id === clickedId)) {
        idsToSelect = getConnectedPipeIds(clickedId, pipes);
      }
      setSelectedIds(new Set(idsToSelect));
    }
  };

  // Keep mouse handlers continuously attached to window for smooth drag & pan
  const mouseHandlersRef = useRef({ move: handleMouseMove, up: handleMouseUp, reset: clearTransientDragState });
  mouseHandlersRef.current = { move: handleMouseMove, up: handleMouseUp, reset: clearTransientDragState };

  useEffect(() => {
    const onMouseMove = (e) => mouseHandlersRef.current.move(e);
    const onMouseUp = (e) => {
      mouseHandlersRef.current.up(e);
    };
    const onWindowReset = () => {
      mouseHandlersRef.current.reset();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onWindowReset);
    window.addEventListener('contextmenu', onWindowReset);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onWindowReset);
      window.removeEventListener('contextmenu', onWindowReset);
    };
  }, []);

  // Trackpad two-finger pan & pinch / ctrl+wheel zoom
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        zoomAtPoint(e.clientX, e.clientY, factor);
      } else {
        // Only allow pan scrolling when Pan tool is active in Modify mode (or Bounds Resizer in runtime)
        if (scapeMode === 'runtime') {
          if (!isBoundsResizerActive) return;
        } else if (currentTool !== 'pan' && !isSpacePressedRef.current) {
          return;
        }
        setView(v => ({
          ...v,
          x: v.x - e.deltaX,
          y: v.y - e.deltaY
        }));
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint, scapeMode, isBoundsResizerActive, currentTool]);

  // Keyboard Delete & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Single-key fit view works in both runtime and editor
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        focusSelectedOrCenter();
        return;
      }

      if (scapeMode === 'runtime' && e.key === 'Escape' && isBoundsResizerActive) {
        e.preventDefault();
        setBoundsResizerMode(null);
        setIsLiveDndActive(false);
        setResizingBox(null);
        boundsBoxRef.current = null;
        mouseHandlersRef.current.reset();
        return;
      }

      // All canvas editing / tool shortcuts are strictly scoped to editor (Modify) mode
      if (scapeMode !== 'editor') return;

      // Spacebar temporary pan
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
        if (viewportRef.current) viewportRef.current.classList.add('panning');
        return;
      }

      // Single-key shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'h') {
          activatePanTool();
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          setCurrentTool('select');
          return;
        }
        if (e.key.toLowerCase() === 'p') {
          setCurrentTool('draw_pipe');
          return;
        }
      }

      if (e.key === ']' || e.key === 'PageUp') {
        e.preventDefault();
        bringToFront();
        return;
      }
      if (e.key === '[' || e.key === 'PageDown') {
        e.preventDefault();
        sendToBack();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          saveHistory('Delete Item');
          const deletedPipeIds = new Set(pipes.filter(p => selectedIds.has(p.id)).map(p => p.id));
          const updatedElements = elements.filter(el => !selectedIds.has(el.id)).map(el => {
            if (el.attachedPipeId && deletedPipeIds.has(el.attachedPipeId)) {
              const nextEl = { ...el };
              delete nextEl.attachedPipeId;
              delete nextEl.pipeT;
              delete nextEl.pipeOffsetX;
              delete nextEl.pipeOffsetY;
              return nextEl;
            }
            return el;
          });
          const updatedPipes = pipes.filter(p => !selectedIds.has(p.id));
          setElements(updatedElements);
          setPipes(updatedPipes);
          setSelectedIds(new Set());
          saveScape({
            id: activeScapeId,
            title: projectTitle,
            tempCanvasSize: { width: screenSize.w, height: screenSize.h },
            zones,
            elements: updatedElements,
            pipes: updatedPipes
          });
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        if (viewportRef.current && currentTool !== 'pan') {
          viewportRef.current.classList.remove('panning');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [scapeMode, currentTool, isBoundsResizerActive, selectedIds, activatePanTool, saveHistory, undo, redo, bringToFront, sendToBack, focusSelectedOrCenter]);

  // --- Inspector Helper ---
  const selectedElements = elements.filter(e => selectedIds.has(e.id));
  const selectedPipes = pipes.filter(p => selectedIds.has(p.id));

  // Single element selection (when no pipes are selected)
  const singleSelectedElement = selectedElements.length === 1 && selectedPipes.length === 0 ? selectedElements[0] : null;

  // Pipeline selection: either a single pipe or multiple grouped/connected pipes (and no equipment selected)
  const isPipeSelection = selectedPipes.length > 0 && selectedElements.length === 0;
  const representativePipe = isPipeSelection ? selectedPipes[0] : null;

  const singleSelectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selectedElement = singleSelectedElement;
  const selectedPipe = representativePipe;
  const hasSelection = isPipeSelection || selectedElements.length > 0;
  const showFloatingInspector = (scapeMode === 'editor') && !isInspectorPinned && hasSelection;

  const getInspectorHeaderTitle = () => {
    if (singleSelectedElement) {
      if (singleSelectedElement.type === 'guide_line') {
        return singleSelectedElement.orientation === 'v' ? 'Vertical Line' : 'Horizontal Line';
      }
      if (singleSelectedElement.type === 'shape_rect') return 'Rectangle';
      if (singleSelectedElement.type === 'shape_circle') return 'Circle / Oval';
      if (singleSelectedElement.type === 'wall_perimeter_v') return 'Vertical Wall';
      if (singleSelectedElement.type === 'wall_perimeter_h') return 'Horizontal Wall';
      return singleSelectedElement.tag || singleSelectedElement.text || 'Item Config';
    }
    if (isPipeSelection) {
      return selectedPipes.length > 1
        ? `Pipeline (${selectedPipes.length} segments)`
        : 'Pipe Config';
    }
    return 'Inspector';
  };

  const triggerDockFlyGhost = (fromRect, toRect, title) => {
    if (!fromRect || !toRect || fromRect.width <= 0 || fromRect.height <= 0 || toRect.width <= 0) {
      return;
    }
    setDockFlyGhost({
      title,
      left: Math.round(fromRect.left),
      top: Math.round(fromRect.top),
      width: Math.round(fromRect.width),
      height: Math.round(fromRect.height),
      dx: Math.round(toRect.left - fromRect.left),
      dy: Math.round(toRect.top - fromRect.top),
      toWidth: Math.round(toRect.width),
      toHeight: Math.round(toRect.height),
      active: false
    });
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      dockAnimRafRef.current = window.requestAnimationFrame(() => {
        dockAnimRafRef.current = window.requestAnimationFrame(() => {
          setDockFlyGhost(prev => (prev ? { ...prev, active: true } : null));
        });
      });
    }
  };

  const handleToggleInspectorPin = () => {
    if (dockAnimTimerRef.current) clearTimeout(dockAnimTimerRef.current);
    if (dockAnimRafRef.current) cancelAnimationFrame(dockAnimRafRef.current);

    const headerTitle = getInspectorHeaderTitle();

    if (!isInspectorPinned) {
      const fromRect = inspectorElRef.current?.getBoundingClientRect();
      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      setIsDraggingInspector(false);
      setIsInspectorPinned(true);
      setInspectorDockAnim('to-sidebar');
      if (fromRect && sidebarRect && sidebarRect.height > 0) {
        const targetH = isInspectorMin
          ? 200
          : Math.min(520, Math.max(260, Math.round(sidebarRect.height * 0.52)));
        triggerDockFlyGhost(
          fromRect,
          {
            left: sidebarRect.left,
            top: sidebarRect.bottom - targetH,
            width: sidebarRect.width,
            height: targetH
          },
          headerTitle
        );
      }
      dockAnimTimerRef.current = setTimeout(() => {
        setDockFlyGhost(null);
        setInspectorDockAnim(null);
      }, 340);
      return;
    }

    const fromRect = (inspectorElRef.current || sidebarFooterEl)?.getBoundingClientRect();
    const benchRect = workbenchRef.current?.getBoundingClientRect();
    setIsInspectorPinned(false);
    setInspectorDockAnim('to-float');
    if (fromRect && benchRect && benchRect.width > 0) {
      const targetW = isInspectorMin ? 230 : 290;
      const targetH = 340;
      const toLeft = inspectorPos
        ? benchRect.left + (Math.max(0, Math.min(100, inspectorPos.xPct)) / 100) * Math.max(0, benchRect.width - targetW)
        : benchRect.right - targetW - 16;
      const toTop = inspectorPos
        ? benchRect.top + (Math.max(0, Math.min(100, inspectorPos.yPct)) / 100) * Math.max(0, benchRect.height - targetH)
        : benchRect.top + 14;
      triggerDockFlyGhost(
        fromRect,
        { left: toLeft, top: toTop, width: targetW, height: targetH },
        headerTitle
      );
    }
    dockAnimTimerRef.current = setTimeout(() => {
      setDockFlyGhost(null);
      setInspectorDockAnim(null);
    }, 300);
  };

  // Floating Inspector DND handlers
  const handleInspectorHeaderMouseDown = (e) => {
    if (isInspectorPinned) return;
    if (e.button !== 0) return;
    if (e.target.closest('.ps-inspector-close-btn')) return;

    e.preventDefault();
    e.stopPropagation();

    const benchEl = workbenchRef.current;
    const inspEl = inspectorElRef.current;
    if (!benchEl || !inspEl) return;

    const benchRect = benchEl.getBoundingClientRect();
    const inspRect = inspEl.getBoundingClientRect();

    const currentLeft = inspRect.left - benchRect.left;
    const currentTop = inspRect.top - benchRect.top;

    inspectorDragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startLeft: currentLeft,
      startTop: currentTop,
      benchWidth: benchRect.width,
      benchHeight: benchRect.height,
      inspectorWidth: inspRect.width,
      inspectorHeight: inspRect.height,
      didMove: false
    };

    setIsDraggingInspector(true);
  };

  const handleInspectorHeaderTouchStart = (e) => {
    if (isInspectorPinned) return;
    if (e.target.closest('.ps-inspector-close-btn')) return;
    if (!e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const benchEl = workbenchRef.current;
    const inspEl = inspectorElRef.current;
    if (!benchEl || !inspEl) return;

    const benchRect = benchEl.getBoundingClientRect();
    const inspRect = inspEl.getBoundingClientRect();

    const currentLeft = inspRect.left - benchRect.left;
    const currentTop = inspRect.top - benchRect.top;

    inspectorDragRef.current = {
      startMouseX: touch.clientX,
      startMouseY: touch.clientY,
      startLeft: currentLeft,
      startTop: currentTop,
      benchWidth: benchRect.width,
      benchHeight: benchRect.height,
      inspectorWidth: inspRect.width,
      inspectorHeight: inspRect.height,
      didMove: false
    };

    setIsDraggingInspector(true);
  };

  useEffect(() => {
    if (!isDraggingInspector) return;

    const handlePointerMove = (e) => {
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
      if (clientX === null || clientY === null) return;

      const {
        startMouseX,
        startMouseY,
        startLeft,
        startTop,
        benchWidth,
        benchHeight,
        inspectorWidth,
        inspectorHeight
      } = inspectorDragRef.current;

      const dx = clientX - startMouseX;
      const dy = clientY - startMouseY;
      if (Math.hypot(dx, dy) > 4) {
        inspectorDragRef.current.didMove = true;
      }

      const maxLeft = Math.max(0, benchWidth - inspectorWidth);
      const maxTop = Math.max(0, benchHeight - inspectorHeight);

      const newLeft = Math.max(0, Math.min(maxLeft, startLeft + dx));
      const newTop = Math.max(0, Math.min(maxTop, startTop + dy));

      const xPct = maxLeft > 0 ? Math.max(0, Math.min(100, (newLeft / maxLeft) * 100)) : 0;
      const yPct = maxTop > 0 ? Math.max(0, Math.min(100, (newTop / maxTop) * 100)) : 0;

      setBenchSize({
        width: Math.round(benchWidth),
        height: Math.round(benchHeight)
      });
      setInspectorSize({
        width: Math.round(inspectorWidth),
        height: Math.round(inspectorHeight)
      });
      setInspectorPos({
        xPct: Math.round(xPct * 100) / 100,
        yPct: Math.round(yPct * 100) / 100,
        benchWidth: Math.round(benchWidth),
        benchHeight: Math.round(benchHeight),
        inspWidth: Math.round(inspectorWidth),
        inspHeight: Math.round(inspectorHeight)
      });
    };

    const handlePointerUp = () => {
      setIsDraggingInspector(false);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDraggingInspector]);

  useEffect(() => {
    if (isInspectorPinned || !inspectorPos) return;
    const benchEl = workbenchRef.current;
    const inspEl = inspectorElRef.current;

    const updateBounds = () => {
      if (benchEl) {
        const bRect = benchEl.getBoundingClientRect();
        if (bRect.width > 0 && bRect.height > 0) {
          setBenchSize(prev => (
            prev && prev.width === Math.round(bRect.width) && prev.height === Math.round(bRect.height)
              ? prev
              : { width: Math.round(bRect.width), height: Math.round(bRect.height) }
          ));
        }
      }
      if (inspEl) {
        const iRect = inspEl.getBoundingClientRect();
        if (iRect.width > 0 && iRect.height > 0) {
          setInspectorSize(prev => (
            prev && prev.width === Math.round(iRect.width) && prev.height === Math.round(iRect.height)
              ? prev
              : { width: Math.round(iRect.width), height: Math.round(iRect.height) }
          ));
        }
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateBounds);
      if (benchEl) ro.observe(benchEl);
      if (inspEl) ro.observe(inspEl);
    }
    return () => {
      window.removeEventListener('resize', updateBounds);
      if (ro) ro.disconnect();
    };
  }, [isInspectorPinned, inspectorPos, isInspectorMin]);

  const resolvedBenchW = benchSize?.width || inspectorPos?.benchWidth || 0;
  const resolvedBenchH = benchSize?.height || inspectorPos?.benchHeight || 0;
  const resolvedInspW = inspectorSize?.width || inspectorPos?.inspWidth || (isInspectorMin ? 230 : 290);
  const resolvedInspH = inspectorSize?.height || inspectorPos?.inspHeight || 340;
  const maxInspLeft = Math.max(0, resolvedBenchW - resolvedInspW);
  const maxInspTop = Math.max(0, resolvedBenchH - resolvedInspH);
  const inspectorStyle = inspectorPos
    ? {
      left: `${Math.round((Math.max(0, Math.min(100, inspectorPos.xPct)) / 100) * maxInspLeft)}px`,
      top: `${Math.round((Math.max(0, Math.min(100, inspectorPos.yPct)) / 100) * maxInspTop)}px`,
      right: 'auto',
      bottom: 'auto'
    }
    : undefined;

  const updateSelectedElement = (fields) => {
    if (!singleSelectedElement) return;
    saveHistory('Update Element Config');
    setElements(prev => prev.map(el => (el.id === singleSelectedElement.id ? { ...el, ...fields } : el)));
  };

  /** Compact single-row preview selector for LINE_STYLE_OPTIONS (used by Line Style & Frame Style). */
  const renderLineStyleField = ({ label, activeStyle = 'single', ariaPrefix = 'Line Style', onSelect }) => (
    <div className="ps-form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label className="ps-form-label" style={{ margin: 0 }}>{label}</label>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#00ac86' }}>
          {(LINE_STYLE_OPTIONS.find(s => s.id === activeStyle) || LINE_STYLE_OPTIONS[0]).name}
        </span>
      </div>
      <div className="ps-line-style-row">
        {LINE_STYLE_OPTIONS.map(opt => {
          const active = activeStyle === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`ps-note-outline-btn ps-line-style-btn ${active ? 'active' : ''}`}
              title={opt.name}
              aria-label={`${ariaPrefix}: ${opt.name}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className={`ps-line-preview style-${opt.id}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );

  /** Shared Inspector circular color swatch row with optional extra control (e.g. custom picker). */
  const renderColorSwatchField = ({ label, palette, activeColor, ariaPrefix = '', onSelect, extraControl = null }) => {
    const normalized = (activeColor || '').toLowerCase();
    const matchedName = palette.find(c => c.hex.toLowerCase() === normalized)?.name || (activeColor || 'Custom');
    return (
      <div className="ps-form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label className="ps-form-label" style={{ margin: 0 }}>{label}</label>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#00ac86' }}>{matchedName}</span>
        </div>
        <div className="ps-swatches-row">
          {palette.map(c => {
            const isActive = normalized === c.hex.toLowerCase();
            const isTransparent = c.hex === 'transparent';
            return (
              <button
                type="button"
                key={c.id}
                className={`ps-swatch-circle-btn ${isTransparent ? 'is-transparent' : ''} ${isActive ? 'active' : ''}`}
                title={c.name}
                aria-label={ariaPrefix ? `${ariaPrefix}: ${c.name}` : c.name}
                onClick={() => onSelect(c.hex)}
                style={isTransparent ? undefined : { backgroundColor: c.hex }}
              />
            );
          })}
          {extraControl}
        </div>
      </div>
    );
  };

  /** Shared Inspector labeled slider control row. */
  const renderRangeField = ({ id, label, valueText, min, max, step = 1, value, minLabel, maxLabel, onChange, footer = null }) => (
    <div className="ps-form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label className="ps-form-label" style={{ margin: 0 }} htmlFor={id}>{label}</label>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#00ac86' }}>{valueText}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>{minLabel || `${min}px`}</span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          style={{ flex: 1, accentColor: '#00ac86' }}
          value={value}
          onChange={onChange}
        />
        <span style={{ fontSize: 11, color: '#64748b', minWidth: 34, textAlign: 'right' }}>{maxLabel || `${max}px`}</span>
      </div>
      {footer}
    </div>
  );

  /** Bottom-right aligned uniform Delete action footer rendered at the end of Item Properties. */
  const renderInspectorDeleteFooter = (onDelete) => (
    <div className="ps-inspector-delete-row">
      <button
        type="button"
        className="hud-btn-sm btn-danger-outline"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );

  /** Delete the single selected element. */
  const deleteSingleElement = (historyLabel) => {
    if (!singleSelectedElement) return;
    saveHistory(historyLabel);
    const updated = elements.filter(e => e.id !== singleSelectedElement.id);
    setElements(updated);
    setSelectedIds(new Set());
    saveScape({
      id: activeScapeId,
      title: projectTitle,
      tempCanvasSize: { width: screenSize.w, height: screenSize.h },
      zones,
      elements: updated,
      pipes
    });
  };

  const targetElement = selectedElements.length > 0 ? selectedElements[0] : null;
  const selectedElementBBox = targetElement ? getElementBBox(targetElement) : null;
  const selectedElementW = targetElement ? Math.round(targetElement.w || selectedElementBBox?.w || 100) : 0;
  const selectedElementH = targetElement ? Math.round(targetElement.h || selectedElementBBox?.h || 100) : 0;

  const handleUpdateElementDimension = (fields) => {
    if (selectedElements.length === 0) return;
    saveHistory('Resize Item');
    const targetIds = new Set(selectedElements.map(e => e.id));
    setElements(prev => prev.map(el => {
      if (targetIds.has(el.id)) {
        return { ...el, ...fields };
      }
      return el;
    }));
  };

  const updateSelectedPipe = (fields) => {
    if (!representativePipe) return;
    saveHistory('Update Pipe Config');
    if (fields.medium) {
      setActivePipeMedium(fields.medium);
    }
    // Update all pipes in selectedIds, and any pipe sharing a groupId with the selection
    const targetGroupIds = new Set(
      selectedPipes.filter(p => p.groupId).map(p => p.groupId)
    );
    setPipes(prev => prev.map(p => {
      if (selectedIds.has(p.id) || (p.groupId && targetGroupIds.has(p.groupId))) {
        return { ...p, ...fields };
      }
      return p;
    }));
  };

  const singlePipeLength = representativePipe ? getPipeLength(representativePipe) : 0;

  const handleUpdatePipeLength = (newLen) => {
    if (!representativePipe) return;
    saveHistory('Change Pipe Length');
    const oldPipe = representativePipe;
    const updatedPipe = adjustPipeLength(oldPipe, newLen, pipes);

    setPipes(prev => prev.map(p => {
      if (p.id === representativePipe.id) {
        return updatedPipe;
      }
      return p;
    }));

    // Auto-adjust all elements anchored to this pipe branch based on pipeT (x%)
    setElements(prev => prev.map(el => {
      if (el.attachedPipeId === representativePipe.id && el.pipeT != null) {
        const oldPt = getPointAlongPipe(oldPipe, el.pipeT);
        const newPt = getPointAlongPipe(updatedPipe, el.pipeT);
        if (oldPt && newPt) {
          const dx = newPt.x - oldPt.x;
          const dy = newPt.y - oldPt.y;
          return {
            ...el,
            x: el.x + dx,
            y: el.y + dy
          };
        }
      }
      return el;
    }));
  };

  // Export JSON (Includes dynamic final picture size with 16px edge margin)
  const handleExportJson = useCallback(() => {
    const finalW = contentBounds.hasContent ? contentBounds.width : screenSize.w;
    const finalH = contentBounds.hasContent ? contentBounds.height : screenSize.h;
    const originX = contentBounds.hasContent ? contentBounds.x : 0;
    const originY = contentBounds.hasContent ? contentBounds.y : 0;

    const exportData = {
      project: projectTitle,
      // Final picture size with 16px margin to edge
      screenSize: { width: finalW, height: finalH },
      tempCanvasSize: { width: screenSize.w, height: screenSize.h },
      viewBox: `${originX} ${originY} ${finalW} ${finalH}`,
      margin: 16,
      zones: zones,
      sensors: elements.filter(e => e.type === 'sensor_card').map(s => ({
        id: s.id,
        tag: s.tag,
        desc: s.desc,
        x: s.x,
        y: s.y,
        finalX: s.x - originX,
        finalY: s.y - originY,
        xPercent: `${(((s.x - originX) / finalW) * 100).toFixed(2)}%`,
        yPercent: `${(((s.y - originY) / finalH) * 100).toFixed(2)}%`,
        titlePosition: s.titlePosition,
        status: s.status,
        metric: s.metric,
        channels: s.channels,
        attachedAssetId: s.attachedAssetId || null,
        zIndex: s.zIndex
      })),
      pipes: pipes.map(p => ({
        id: p.id,
        groupId: p.groupId,
        medium: p.medium,
        label: p.label,
        points: p.points,
        w: p.w || 20,
        flow: p.flow || 'forward',
        zIndex: p.zIndex,
        finalPoints: p.points ? p.points.map(pt => ({ x: pt.x - originX, y: pt.y - originY })) : null
      })),
      elements: elements.filter(e => e.type !== 'sensor_card').map(el => {
        const pipe = el.attachedPipeId ? pipes.find(p => p.id === el.attachedPipeId) : null;
        const contactPt = (pipe && el.pipeT != null) ? getPointAlongPipe(pipe, el.pipeT) : null;
        const offX = el.pipeOffsetX !== undefined ? el.pipeOffsetX : (contactPt ? el.x - contactPt.x : null);
        const offY = el.pipeOffsetY !== undefined ? el.pipeOffsetY : (contactPt ? el.y - contactPt.y : null);
        return {
          id: el.id,
          type: el.type,
          tag: el.tag || el.text,
          text: el.text || el.tag,
          fontSize: el.fontSize,
          textColor: el.textColor,
          color: el.color,
          fillColor: el.fillColor,
          fillOpacity: el.fillOpacity,
          lineStyle: el.lineStyle,
          outlineStyle: el.outlineStyle,
          orientation: el.orientation,
          length: el.length,
          strokeWidth: el.strokeWidth,
          colorTheme: el.colorTheme || 'blue',
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          zIndex: el.zIndex,
          finalX: el.x - originX,
          finalY: el.y - originY,
          xPercent: `${(((el.x - originX) / finalW) * 100).toFixed(2)}%`,
          yPercent: `${(((el.y - originY) / finalH) * 100).toFixed(2)}%`,
          attachedPipeId: el.attachedPipeId || null,
          pipeT: el.pipeT != null ? el.pipeT : null,
          pipeTPercent: el.pipeT != null ? `${(el.pipeT * 100).toFixed(1)}%` : null,
          pipeOffsetX: offX,
          pipeOffsetY: offY
        };
      })
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [contentBounds, screenSize, projectTitle, elements, pipes, zones]);

  // Export High-Res PNG Picture (Cropped to real element bounds + 16px margin)
  const handleExportPng = useCallback(() => {
    const finalW = contentBounds.hasContent ? contentBounds.width : screenSize.w;
    const finalH = contentBounds.hasContent ? contentBounds.height : screenSize.h;
    const originX = contentBounds.hasContent ? contentBounds.x : 0;
    const originY = contentBounds.hasContent ? contentBounds.y : 0;

    const svg = viewportRef.current?.querySelector('.ps-scene-svg');
    if (!svg) return;

    const clone = svg.cloneNode(true);
    clone.querySelector('#boundaryGuide')?.remove();
    clone.querySelector('.ps-bounds-resizer-group')?.remove();
    clone.querySelector('#interactionLayer')?.remove();
    clone.querySelectorAll('.pipe-extend-group')?.forEach(e => e.remove());
    clone.querySelectorAll('.pipe-drag-handle')?.forEach(e => e.remove());
    clone.querySelectorAll('.element-anchor-handle')?.forEach(e => e.remove());
    clone.querySelectorAll('.element-anchor-line')?.forEach(e => e.remove());

    const scale = 2;
    clone.setAttribute('width', finalW * scale);
    clone.setAttribute('height', finalH * scale);
    clone.setAttribute('viewBox', `${originX} ${originY} ${finalW} ${finalH}`);

    const worldG = clone.querySelector('#worldGroup');
    if (worldG) {
      worldG.removeAttribute('transform');
    }

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = finalW * scale;
      cvs.height = finalH * scale;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = isDarkMode ? '#0f131a' : '#ffffff';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0);

      const a = document.createElement('a');
      a.href = cvs.toDataURL('image/png');
      a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-picture.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [contentBounds, screenSize, isDarkMode, projectTitle]);

  // Import JSON ProcessScape Configuration
  const loadProcessScapeConfig = useCallback((data, showNotification = true) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format');
    }

    saveHistory('Import Config');

    if (data.project || data.projectTitle || data.title) {
      setProjectTitle(data.project || data.projectTitle || data.title);
    }

    let targetScreenSize = null;
    if (data.tempCanvasSize) {
      targetScreenSize = {
        w: data.tempCanvasSize.width || data.tempCanvasSize.w || 1024,
        h: data.tempCanvasSize.height || data.tempCanvasSize.h || 800
      };
      setScreenSize(targetScreenSize);
    } else if (data.screenSize) {
      targetScreenSize = {
        w: data.screenSize.width || data.screenSize.w || 1024,
        h: data.screenSize.height || data.screenSize.h || 800
      };
      setScreenSize(targetScreenSize);
    }

    if (Array.isArray(data.zones)) {
      setZones(data.zones);
    }

    let parsedPipes = [];
    if (Array.isArray(data.pipes)) {
      parsedPipes = data.pipes.map((p, idx) => {
        const pts = p.points || [];
        return {
          id: p.id || `pipe_${Date.now()}_${idx}`,
          groupId: p.groupId,
          medium: p.medium || 'gas',
          label: p.label || '',
          points: pts,
          d: p.d || pointsToPath(pts),
          w: p.w || 20,
          flow: p.flow || 'forward',
          zIndex: p.zIndex != null ? p.zIndex : 10
        };
      });
      setPipes(parsedPipes);
    }

    let parsedElements = [];
    if (Array.isArray(data.elements)) {
      parsedElements.push(...data.elements.map((el, idx) => {
        if (el.type === 'sensor_card') {
          return {
            id: el.id || `sensor_card_${Date.now()}_${idx}`,
            type: 'sensor_card',
            tag: el.tag || 'Sensor',
            desc: el.desc || '',
            x: typeof el.x === 'number' ? el.x : 0,
            y: typeof el.y === 'number' ? el.y : 0,
            titlePosition: el.titlePosition || 'top',
            status: el.status || 'normal',
            metric: el.metric || 'flow',
            val: el.val,
            unit: el.unit,
            channels: Array.isArray(el.channels) ? el.channels : [],
            attachedAssetId: el.attachedAssetId || null,
            targetOffsetX: el.targetOffsetX,
            targetOffsetY: el.targetOffsetY,
            mpId: el.mpId || null,
            locationId: el.locationId || null,
            userPositioned: !!el.userPositioned,
            zIndex: el.zIndex != null ? el.zIndex : 40
          };
        }
        return {
          id: el.id || `asset_${Date.now()}_${idx}`,
          type: el.type || 'tank_buffer',
          tag: el.tag || el.text || '',
          text: el.text || el.tag || '',
          fontSize: el.fontSize,
          textColor: el.textColor,
          color: el.color,
          fillColor: el.fillColor,
          fillOpacity: el.fillOpacity,
          lineStyle: el.lineStyle,
          outlineStyle: el.outlineStyle,
          orientation: el.orientation,
          length: el.length,
          strokeWidth: el.strokeWidth,
          colorTheme: el.colorTheme || 'blue',
          x: typeof el.x === 'number' ? el.x : 0,
          y: typeof el.y === 'number' ? el.y : 0,
          w: el.w,
          h: el.h,
          zIndex: el.zIndex != null
            ? el.zIndex
            : ((el.type === 'shape_rect' || el.type === 'shape_circle') ? 8 : (el.type === 'guide_line' ? 15 : (el.type === 'text_note' ? 30 : 20))),
          attachedPipeId: el.attachedPipeId || null,
          pipeT: el.pipeT != null ? el.pipeT : null,
          pipeOffsetX: el.pipeOffsetX !== undefined ? el.pipeOffsetX : null,
          pipeOffsetY: el.pipeOffsetY !== undefined ? el.pipeOffsetY : null
        };
      }));
    }

    if (Array.isArray(data.sensors)) {
      parsedElements.push(...data.sensors.map((s, idx) => ({
        id: s.id || `sensor_card_${Date.now()}_${idx}`,
        type: 'sensor_card',
        tag: s.tag || 'Sensor',
        desc: s.desc || '',
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        titlePosition: s.titlePosition || 'top',
        status: s.status || 'normal',
        metric: s.metric || 'flow',
        val: s.val,
        unit: s.unit,
        channels: Array.isArray(s.channels) ? s.channels : [],
        attachedAssetId: s.attachedAssetId || null,
        zIndex: s.zIndex != null ? s.zIndex : 40
      })));
    }

    setElements(parsedElements);
    setSelectedIds(new Set());

    if (showNotification && typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification(
        'Import Successful',
        `Imported ${parsedElements.length} elements and ${parsedPipes.length} pipes.`,
        'success'
      );
    }

    return { parsedElements, parsedPipes, targetScreenSize };
  }, [saveHistory]);

  const handleImportJson = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const data = JSON.parse(text);
        const res = loadProcessScapeConfig(data, true);
        if (res) {
          handleZoomFit(res.parsedElements, res.parsedPipes, res.targetScreenSize);
        }
      } catch (err) {
        console.error('Failed to import ProcessScape config:', err);
        if (typeof window !== 'undefined' && window.showAppNotification) {
          window.showAppNotification(
            'Import Failed',
            'Could not parse the selected JSON file. Please check file format.',
            'error'
          );
        }
      }
    };
    reader.readAsText(file);
  }, [loadProcessScapeConfig, handleZoomFit]);

  const reloadActiveScape = useCallback((targetScapeId = null) => {
    resetTransientModeState({ clearHistory: true });
    if (targetScapeId !== null && targetScapeId !== undefined) {
      setActiveScapeId(targetScapeId);
      setActiveScapeIdState(targetScapeId);
    }
    const currentId = (targetScapeId !== null && targetScapeId !== undefined) ? targetScapeId : getActiveScapeId();
    if (!currentId) {
      setElements([]);
      setPipes([]);
      setZones([]);
      setActiveScapeIdState('');
      setScapeVersion(v => v + 1);
      return;
    }
    const all = getAllScapes();
    const active = all.find(s => s.id === currentId);
    if (active && active.id) {
      const res = loadProcessScapeConfig(active, false);
      const saved = getSavedScapeView(active.id);
      if (saved) {
        setView(saved);
      } else if (res) {
        handleZoomFit(res.parsedElements, res.parsedPipes, res.targetScreenSize);
      }
    } else {
      setElements([]);
      setPipes([]);
      setZones([]);
      setActiveScapeIdState('');
    }
    setScapeVersion(v => v + 1);
  }, [loadProcessScapeConfig, handleZoomFit, resetTransientModeState]);

  // Register actions & notify state to parent header
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        undo,
        redo,
        handleUndo: undo,
        handleRedo: redo,
        handleZoomFit,
        handleExportJson,
        handleExportPng,
        handleImportJson,
        handleSaveAndExit: handleSaveAndExitEditor,
        saveCurrentScape: handleSaveAndExitEditor,
        saveScape: handleSaveAndExitEditor,
        setScreenSize,
        setProjectTitle,
        openScapeManager: () => setIsScapeManagerOpen(true),
        setScapeMode: changeScapeMode,
        reloadActiveScape,
        setActiveLocationId: (locId) => {
          setActiveLocationId(locId);
          syncScapeForLocation(locId);
        },
        switchScape: (scapeId) => {
          if (!scapeId) {
            setActiveScapeId('');
            setActiveScapeIdState('');
            setElements([]);
            setPipes([]);
            setZones([]);
            handleSelectActiveScape(null);
            setScapeVersion(v => v + 1);
            return;
          }
          const all = getAllScapes();
          const target = all.find(s => s.id === scapeId);
          if (target) {
            setActiveScapeId(target.id);
            setActiveScapeIdState(target.id);
            handleSelectActiveScape(target);
          }
        }
      });
    }
  }, [onRegisterActions, undo, redo, handleZoomFit, handleExportJson, handleExportPng, handleImportJson, handleSaveAndExitEditor, changeScapeMode, reloadActiveScape, handleSelectActiveScape, syncScapeForLocation]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        screenSize,
        finalSize: { width: contentBounds.width, height: contentBounds.height },
        projectTitle,
        scapeMode,
        activeScapeId
      });
    }
  }, [screenSize, contentBounds, projectTitle, scapeMode, activeScapeId, onStateChange]);

  return (
    <div className={`processscape-root ${isDarkMode ? 'theme-dark' : ''} mode-${scapeMode}`}>
      {/* Main 3-Column Workbench */}
      <div className="ps-workbench" ref={workbenchRef}>
        {isEmptyPage ? (
          <div className="ps-empty-stage-page">
            <div className="ps-empty-stage-card">
              <div className="ps-empty-stage-icon">📍</div>
              <h2 className="ps-empty-stage-title">No Locations Configured</h2>
              <p className="ps-empty-stage-desc">
                Configure a location in Location & sensors to map sensor measurement points and activate your plant ProcessScape.
              </p>
              <div className="ps-empty-stage-actions">
                <button
                  type="button"
                  className="ps-empty-stage-btn-primary"
                  onClick={() => {
                    if (onOpenSensorManager) onOpenSensorManager();
                  }}
                >
                  <span style={{ fontSize: 16 }}>+</span>
                  <span>Configure Locations</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Left Sidebar Palette (Editor Mode only) */}
            {scapeMode === 'editor' && (
              <aside ref={sidebarRef} className="ps-sidebar">
                <div className="ps-palette-tabs">
                  {PALETTE_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      className={`ps-palette-tab ${activePaletteTab === cat.id ? 'active' : ''}`}
                      onClick={() => setActivePaletteTab(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="ps-palette-items">
                  {/* Helper renderers */}
                  {(() => {
                    const renderAssetCard = (type, def) => (
                      <div
                        key={type}
                        className="ps-palette-card"
                        draggable
                        onDragStart={(e) => {
                          const payload = { kind: 'asset', key: type };
                          if (typeof window !== 'undefined') window.__ps_active_drag = payload;
                          if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'copyMove';
                            const s = JSON.stringify(payload);
                            try {
                              e.dataTransfer.setData('application/json', s);
                              e.dataTransfer.setData('text/plain', s);
                            } catch (_) { }
                          }
                        }}
                        onDragEnd={() => {
                          if (typeof window !== 'undefined') {
                            setTimeout(() => { window.__ps_active_drag = null; }, 200);
                          }
                        }}
                      >
                        <div className="ps-card-icon-box">
                          {renderAssetPaletteIcon(type, def)}
                        </div>
                        <div className="ps-card-info">
                          <div className="ps-card-title">{def.name}</div>
                          <div className="ps-card-desc">{def.defaultDesc}</div>
                        </div>
                      </div>
                    );

                    const renderSensorCardTemplate = (key, tpl) => (
                      <div
                        key={key}
                        className="ps-palette-card"
                        draggable
                        onDragStart={(e) => {
                          const payload = { kind: 'sensor_card', key };
                          if (typeof window !== 'undefined') window.__ps_active_drag = payload;
                          if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'copyMove';
                            const s = JSON.stringify(payload);
                            try {
                              e.dataTransfer.setData('application/json', s);
                              e.dataTransfer.setData('text/plain', s);
                            } catch (_) { }
                          }
                        }}
                        onDragEnd={() => {
                          if (typeof window !== 'undefined') {
                            setTimeout(() => { window.__ps_active_drag = null; }, 200);
                          }
                        }}
                      >
                        <div
                          className="ps-card-icon-box"
                          style={{
                            background: '#fed72a',
                            borderColor: '#eab308',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: '#18181b'
                          }}
                        >
                          {tpl.tag}
                        </div>
                        <div className="ps-card-info">
                          <div className="ps-card-title">{tpl.title || (tpl.tag + ' Sensor Card')}</div>
                          <div className="ps-card-desc">{tpl.desc}</div>
                        </div>
                      </div>
                    );

                    const renderPipePresetCard = (p) => {
                      const iconColor = p.medium === 'liquid' ? '#0284c7' : '#94a3b8';
                      const isVert = p.id.includes('vert');
                      return (
                        <div
                          key={p.id}
                          className="ps-palette-card"
                          draggable
                          onDragStart={(e) => {
                            const payload = { kind: 'pipe_preset', key: p.id };
                            if (typeof window !== 'undefined') window.__ps_active_drag = payload;
                            if (e.dataTransfer) {
                              e.dataTransfer.effectAllowed = 'copyMove';
                              const s = JSON.stringify(payload);
                              try {
                                e.dataTransfer.setData('application/json', s);
                                e.dataTransfer.setData('text/plain', s);
                              } catch (_) { }
                            }
                          }}
                          onDragEnd={() => {
                            if (typeof window !== 'undefined') {
                              setTimeout(() => { window.__ps_active_drag = null; }, 200);
                            }
                          }}
                        >
                          <div
                            className="ps-card-icon-box"
                            style={{
                              background: '#f8fafc',
                              border: `2px solid ${iconColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <div
                              style={{
                                width: isVert ? 8 : 26,
                                height: isVert ? 26 : 8,
                                background: iconColor,
                                position: 'relative'
                              }}
                            >
                              {/* Flange caps on palette icon (130% diameter) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  ...(isVert
                                    ? { top: 0, left: -2, width: 12, height: 2, borderRadius: 1 }
                                    : { left: 0, top: -2, width: 2, height: 12, borderRadius: 1 }),
                                  background: iconColor
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  ...(isVert
                                    ? { bottom: 0, left: -2, width: 12, height: 2, borderRadius: 1 }
                                    : { right: 0, top: -2, width: 2, height: 12, borderRadius: 1 }),
                                  background: iconColor
                                }}
                              />
                            </div>
                          </div>
                          <div className="ps-card-info">
                            <div className="ps-card-title">{p.name}</div>
                            <div className="ps-card-desc">{p.desc}</div>
                          </div>
                        </div>
                      );
                    };

                    const renderOrientableCard = ({ reactKey, keyName, kind, title, desc, orientation, setOrientation, icon }) => {
                      const isVert = orientation === 'v';
                      return (
                        <div
                          key={reactKey || keyName}
                          className="ps-palette-card"
                          draggable
                          onDragStart={(e) => {
                            const payload = { kind, key: keyName, orientation };
                            if (typeof window !== 'undefined') window.__ps_active_drag = payload;
                            if (e.dataTransfer) {
                              e.dataTransfer.effectAllowed = 'copyMove';
                              const s = JSON.stringify(payload);
                              try {
                                e.dataTransfer.setData('application/json', s);
                                e.dataTransfer.setData('text/plain', s);
                              } catch (_) { }
                            }
                          }}
                          onDragEnd={() => {
                            if (typeof window !== 'undefined') {
                              setTimeout(() => { window.__ps_active_drag = null; }, 200);
                            }
                          }}
                        >
                          {icon}
                          <div className="ps-card-info">
                            <div className="ps-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span>{title}</span>
                              <span
                                className="ps-palette-orient-pills"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={`ps-orient-btn ${!isVert ? 'active' : ''}`}
                                  title={`Drag Horizontal ${title} (H)`}
                                  aria-label={`Palette ${title} Horizontal`}
                                  onClick={(e) => { e.stopPropagation(); setOrientation('h'); }}
                                >
                                  H
                                </button>
                                <button
                                  type="button"
                                  className={`ps-orient-btn ${isVert ? 'active' : ''}`}
                                  title={`Drag Vertical ${title} (V)`}
                                  aria-label={`Palette ${title} Vertical`}
                                  onClick={(e) => { e.stopPropagation(); setOrientation('v'); }}
                                >
                                  V
                                </button>
                              </span>
                            </div>
                            <div className="ps-card-desc">{desc}</div>
                          </div>
                        </div>
                      );
                    };

                    const renderBrickWallCard = () => {
                      const wallType = wallPaletteOrientation === 'v' ? 'wall_perimeter_v' : 'wall_perimeter_h';
                      return renderOrientableCard({
                        reactKey: 'wall_perimeter',
                        keyName: wallType,
                        kind: 'asset',
                        title: 'Brick Wall',
                        desc: 'H/V red brick wall with running bond masonry',
                        orientation: wallPaletteOrientation,
                        setOrientation: setWallPaletteOrientation,
                        icon: (
                          <div className="ps-card-icon-box">
                            {renderAssetPaletteIcon(wallType, ASSET_DEFS[wallType])}
                          </div>
                        )
                      });
                    };

                    const renderGuideLineCard = () => {
                      const isVert = linePaletteOrientation === 'v';
                      return renderOrientableCard({
                        keyName: 'guide_line',
                        kind: 'guide_line',
                        title: 'Line',
                        desc: 'H/V divider line with Label styles & line snap',
                        orientation: linePaletteOrientation,
                        setOrientation: setLinePaletteOrientation,
                        icon: (
                          <div
                            className="ps-card-icon-box"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <svg width="26" height="26" viewBox="0 0 26 26">
                              {isVert ? (
                                <line x1="13" y1="3" x2="13" y2="23" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
                              ) : (
                                <line x1="3" y1="13" x2="23" y2="13" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
                              )}
                            </svg>
                          </div>
                        )
                      });
                    };

                    const renderTextNoteCard = () => {
                      const isVert = labelPaletteOrientation === 'v';
                      return renderOrientableCard({
                        keyName: 'text_note',
                        kind: 'text_note',
                        title: 'Label',
                        desc: 'H/V editable label with outline styles & line snap',
                        orientation: labelPaletteOrientation,
                        setOrientation: setLabelPaletteOrientation,
                        icon: (
                          <div
                            className="ps-card-icon-box"
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              fontSize: 15,
                              color: '#475569',
                              position: 'relative'
                            }}
                          >
                            <span style={{ display: 'inline-block', transform: isVert ? 'rotate(-90deg)' : 'none' }}>T</span>
                          </div>
                        )
                      });
                    };

                    const renderShapeCard = ({ kind, title, desc, icon }) => (
                      <div
                        key={kind}
                        className="ps-palette-card"
                        draggable
                        onDragStart={(e) => {
                          const payload = { kind, key: kind };
                          if (typeof window !== 'undefined') window.__ps_active_drag = payload;
                          if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'copyMove';
                            const s = JSON.stringify(payload);
                            try {
                              e.dataTransfer.setData('application/json', s);
                              e.dataTransfer.setData('text/plain', s);
                            } catch (_) { }
                          }
                        }}
                        onDragEnd={() => {
                          if (typeof window !== 'undefined') {
                            setTimeout(() => { window.__ps_active_drag = null; }, 200);
                          }
                        }}
                      >
                        <div
                          className="ps-card-icon-box"
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {icon}
                        </div>
                        <div className="ps-card-info">
                          <div className="ps-card-title">{title}</div>
                          <div className="ps-card-desc">{desc}</div>
                        </div>
                      </div>
                    );

                    const renderRectShapeCard = () => renderShapeCard({
                      kind: 'shape_rect',
                      title: 'Rectangle',
                      desc: 'W×H box with fill color & line frame styles',
                      icon: (
                        <svg width="26" height="26" viewBox="0 0 26 26">
                          <rect x="4" y="6" width="18" height="14" rx="1" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
                        </svg>
                      )
                    });

                    const renderCircleShapeCard = () => renderShapeCard({
                      kind: 'shape_circle',
                      title: 'Circle',
                      desc: 'W×H circle or oval with fill & line frame styles',
                      icon: (
                        <svg width="26" height="26" viewBox="0 0 26 26">
                          <ellipse cx="13" cy="13" rx="9" ry="9" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
                        </svg>
                      )
                    });

                    if (activePaletteTab === 'all') {
                      return (
                        <>
                          {PIPE_PRESETS.map(p => renderPipePresetCard(p))}
                          {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && (d.category === 'sensors' || d.category === 'gateways')).map(([t, d]) => renderAssetCard(t, d))}
                          {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'machines').map(([t, d]) => renderAssetCard(t, d))}
                          {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'vessels').map(([t, d]) => renderAssetCard(t, d))}
                          {Object.entries(ASSET_DEFS).filter(([t, d]) => !d.isAlias && d.category === 'others' && t !== 'wall_perimeter_h' && t !== 'wall_perimeter_v').map(([t, d]) => renderAssetCard(t, d))}
                          {renderBrickWallCard()}
                          {renderGuideLineCard()}
                          {renderTextNoteCard()}
                          {renderRectShapeCard()}
                          {renderCircleShapeCard()}
                        </>
                      );
                    }
                    if (activePaletteTab === 'sensors') {
                      return (
                        <>
                          {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && (d.category === 'sensors' || d.category === 'gateways')).map(([t, d]) => renderAssetCard(t, d))}
                        </>
                      );
                    }
                    if (activePaletteTab === 'piping') {
                      return PIPE_PRESETS.map(p => renderPipePresetCard(p));
                    }
                    if (activePaletteTab === 'vessels') {
                      return Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'vessels').map(([t, d]) => renderAssetCard(t, d));
                    }
                    if (activePaletteTab === 'machines') {
                      return Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'machines').map(([t, d]) => renderAssetCard(t, d));
                    }
                    if (activePaletteTab === 'others') {
                      return (
                        <>
                          {Object.entries(ASSET_DEFS).filter(([t, d]) => !d.isAlias && d.category === 'others' && t !== 'wall_perimeter_h' && t !== 'wall_perimeter_v').map(([t, d]) => renderAssetCard(t, d))}
                          {renderBrickWallCard()}
                          {renderGuideLineCard()}
                          {renderTextNoteCard()}
                          {renderRectShapeCard()}
                          {renderCircleShapeCard()}
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>

                {isInspectorPinned && hasSelection && (
                  <div
                    ref={setSidebarFooterEl}
                    className={`ps-sidebar-footer is-pinned-inspector ${inspectorDockAnim === 'to-sidebar' ? 'is-dock-entering' : ''} ${isInspectorMin ? 'is-min' : ''}`}
                  />
                )}
              </aside>
            )}

            {/* Center Canvas Viewport */}
            <main
              ref={viewportRef}
              className={`ps-canvas-viewport ${scapeMode === 'editor' && (currentTool === 'pan' || isSpacePressed) ? 'panning' : ''} ${scapeMode === 'editor' && currentTool === 'draw_pipe' ? 'drawing-pipe' : ''}`}
              onMouseDown={handleMouseDown}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Example Demo Show Notice Banner */}
              {isExampleShow && (
                <div className={`ps-example-demo-banner ${isBannerMinimized ? 'minimized' : ''}`} role="alert">
                  <div className="ps-example-demo-badge">
                    <span className="ps-demo-pulse-dot" />
                    DEMO PREVIEW
                  </div>
                  {!isBannerMinimized && (
                    <div className="ps-example-demo-content">
                      <div className="ps-example-demo-title">
                        Example Plant Layout (Demonstration)
                      </div>
                      <div className="ps-example-demo-desc">
                        No real locations are configured in the system yet. Create your own location and ProcessScape stage to design custom piping, bind measurement points, and monitor live sensor telemetry.
                      </div>
                    </div>
                  )}
                  {isBannerMinimized && (
                    <div
                      className="ps-example-demo-desc"
                      style={{ cursor: 'pointer', color: '#f8fafc', fontWeight: 500 }}
                      onClick={() => setIsBannerMinimized(false)}
                    >
                      Example layout preview &middot; Click to expand notice
                    </div>
                  )}
                  <div className="ps-example-demo-actions">
                    <button
                      type="button"
                      className="ps-example-demo-btn-primary"
                      onClick={() => {
                        setIsBannerDismissed(true);
                        if (onOpenSensorManager) onOpenSensorManager();
                      }}
                      title="Open Sensor Manager to create your own location and scape stage"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Create Location &amp; Stage</span>
                    </button>
                    <button
                      type="button"
                      className="ps-example-demo-dismiss-btn"
                      onClick={() => setIsBannerDismissed(true)}
                      title="Dismiss example notice"
                      aria-label="Dismiss example notice"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              {/* Top Floating HUD Toolbar in Editor Mode */}
              {scapeMode === 'editor' && (
                <div className="canvas-floating-hud top-hud ps-hud-bar">
                  {/* Tool Selection Group */}
                  <div className="tool-group">
                    <button
                      id="toolSelect"
                      type="button"
                      className={`hud-icon-btn ${currentTool === 'select' ? 'active' : ''}`}
                      onClick={() => {
                        dragRef.current.drawingPipeStart = null;
                        dragRef.current.extendingPipe = null;
                        if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
                        setCurrentTool('select');
                      }}
                      title="Select Tool (V) — Select or drag items"
                      aria-label="Select Tool"
                    >
                      <HudIcons.Select />
                    </button>
                    <button
                      id="toolPan"
                      type="button"
                      className={`hud-icon-btn ${currentTool === 'pan' ? 'active' : ''}`}
                      onClick={activatePanTool}
                      title="Pan Tool (H) — Clear selection & drag canvas"
                      aria-label="Pan Tool"
                    >
                      <HudIcons.Pan />
                    </button>
                  </div>

                  <div className="hud-divider" />

                  {/* Undo / Redo History Group */}
                  <div className="tool-group">
                    <button
                      id="toolUndo"
                      type="button"
                      className="hud-icon-btn"
                      disabled={!canUndo}
                      onClick={undo}
                      title="Undo (Cmd+Z / Ctrl+Z)"
                      aria-label="Undo"
                    >
                      <HudIcons.Undo />
                    </button>
                    <button
                      id="toolRedo"
                      type="button"
                      className="hud-icon-btn"
                      disabled={!canRedo}
                      onClick={redo}
                      title="Redo (Cmd+Y / Ctrl+Y)"
                      aria-label="Redo"
                    >
                      <HudIcons.Redo />
                    </button>
                  </div>

                  {/* Dynamic Dimension Controls (W: H: for elements, L: D: for pipes) */}
                  {(isPipeSelection || selectedElements.length > 0) && (
                    <>
                      <div className="hud-divider" />
                      <div className="hud-dimension-group" id="hudDimensionSelector">
                        {isPipeSelection ? (
                          <>
                            <label className="hud-dim-item" title="Pipeline Length (px)">
                              <span className="hud-dim-label">L:</span>
                              <input
                                id="hudInputLength"
                                type="number"
                                className="hud-dim-input"
                                value={singlePipeLength || 0}
                                min="10"
                                max="4000"
                                step="10"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val >= 10) {
                                    handleUpdatePipeLength(val);
                                  }
                                }}
                              />
                            </label>
                            <label className="hud-dim-item" title="Pipeline Diameter (px)">
                              <span className="hud-dim-label">D:</span>
                              <input
                                id="hudInputDiameter"
                                type="number"
                                className="hud-dim-input"
                                value={representativePipe?.w || 20}
                                min="6"
                                max="100"
                                step="2"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val >= 6) {
                                    updateSelectedPipe({ w: val });
                                  }
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <label className="hud-dim-item" title="Item Width (px)">
                              <span className="hud-dim-label">W:</span>
                              <input
                                id="hudInputWidth"
                                type="number"
                                className="hud-dim-input"
                                value={selectedElementW}
                                min="10"
                                max="3000"
                                step="5"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val >= 10) {
                                    handleUpdateElementDimension({ w: val });
                                  }
                                }}
                              />
                            </label>
                            <label className="hud-dim-item" title="Item Height (px)">
                              <span className="hud-dim-label">H:</span>
                              <input
                                id="hudInputHeight"
                                type="number"
                                className="hud-dim-input"
                                value={selectedElementH}
                                min="10"
                                max="3000"
                                step="5"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val >= 10) {
                                    handleUpdateElementDimension({ h: val });
                                  }
                                }}
                              />
                            </label>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {currentTool === 'draw_pipe' && (
                    <>
                      <div className="hud-divider" />
                      <button
                        id="finishPipeBtn"
                        type="button"
                        className="hud-icon-btn active"
                        onClick={() => {
                          dragRef.current.drawingPipeStart = null;
                          dragRef.current.extendingPipe = null;
                          if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
                          setCurrentTool('select');
                        }}
                        title="Finish current pipe"
                        aria-label="Finish Pipe"
                      >
                        <HudIcons.Check />
                      </button>
                    </>
                  )}

                  {selectedIds.size > 0 && (
                    <>
                      <div className="hud-divider" />
                      <div className="tool-group">
                        <button
                          id="hudFrontBtn"
                          type="button"
                          className="hud-icon-btn"
                          disabled={selectedIds.size === 0}
                          onClick={bringToFront}
                          title="Bring to Front (])"
                          aria-label="Bring to Front"
                        >
                          <HudIcons.BringToFront />
                        </button>
                        <button
                          id="hudBackBtn"
                          type="button"
                          className="hud-icon-btn"
                          disabled={selectedIds.size === 0}
                          onClick={sendToBack}
                          title="Send to Back ([)"
                          aria-label="Send to Back"
                        >
                          <HudIcons.SendToBack />
                        </button>
                        <button
                          id="hudDeleteBtn"
                          type="button"
                          className="hud-icon-btn btn-danger-outline"
                          disabled={selectedIds.size === 0}
                          onClick={() => {
                            saveHistory('Delete Item');
                            const updatedElements = elements.filter(el => !selectedIds.has(el.id));
                            const updatedPipes = pipes.filter(p => !selectedIds.has(p.id));
                            setElements(updatedElements);
                            setPipes(updatedPipes);
                            setSelectedIds(new Set());
                            saveScape({
                              id: activeScapeId,
                              title: projectTitle,
                              tempCanvasSize: { width: screenSize.w, height: screenSize.h },
                              zones,
                              elements: updatedElements,
                              pipes: updatedPipes
                            });
                          }}
                          title="Delete selected items (Delete key)"
                          aria-label="Delete Selected"
                        >
                          <HudIcons.Delete />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Hidden JSON file input for importing layout config */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                aria-hidden="true"
              />

              {/* Bottom Floating Canvas Tools HUD in Modify Scape (Editor Mode only) */}
              {scapeMode === 'editor' && (
                <div key="ps-modify-page-tools" className="canvas-floating-hud zoom-hud" id="psModifyPageTools">
                  <div className="tool-group">
                    <button
                      id="toolZoomOut"
                      type="button"
                      className="hud-icon-btn"
                      onClick={() => {
                        const rect = viewportRef.current?.getBoundingClientRect();
                        const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                        const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                        zoomAtPoint(cx, cy, 1 / 1.15);
                      }}
                      title="Zoom Out (-)"
                      aria-label="Zoom Out"
                    >
                      <HudIcons.ZoomOut />
                    </button>

                    <button
                      id="toolZoomReset"
                      type="button"
                      className="zoom-text hud-btn-zoom-reset"
                      onClick={resetView}
                      title="Reset Zoom to 100% (Click to reset)"
                      aria-label="Zoom Percentage"
                    >
                      {Math.round((view?.zoom || 1) * 100)}%
                    </button>

                    <button
                      id="toolZoomIn"
                      type="button"
                      className="hud-icon-btn"
                      onClick={() => {
                        const rect = viewportRef.current?.getBoundingClientRect();
                        const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                        const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                        zoomAtPoint(cx, cy, 1.15);
                      }}
                      title="Zoom In (+)"
                      aria-label="Zoom In"
                    >
                      <HudIcons.ZoomIn />
                    </button>
                  </div>

                  <div className="hud-divider" />

                  <button
                    id="toolZoomFit"
                    type="button"
                    className="hud-icon-btn"
                    onClick={focusSelectedOrCenter}
                    title="Focus / Fit Whole Canvas (F)"
                    aria-label="Focus / Fit Whole Canvas"
                  >
                    <HudIcons.ZoomFit />
                  </button>

                  <div className="hud-divider" />

                  <button
                    key="tool-modify-bounds-resizer"
                    id="toolModifyBoundsResizer"
                    type="button"
                    className={`hud-icon-btn ${boundsResizerMode === 'editor' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleToggleBoundsResizer();
                    }}
                    title={boundsResizerMode === 'editor' ? "Confirm & Apply New Diagram Size" : "Optimal Diagram Bounds Resizer (Auto-scale pipes to screen)"}
                    aria-label="Diagram Bounds Resizer"
                  >
                    <HudIcons.BoundsScale />
                  </button>
                </div>
              )}

              {/* Four-Corner Drop Guides when dragging Runtime Canvas Tools HUD */}
              {scapeMode === 'runtime' && runtimeToolsDragPos && (
                <div className="ps-runtime-corner-targets" aria-hidden="true">
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                    <div
                      key={corner}
                      className={`ps-corner-drop-zone corner-${corner} ${runtimeToolsDragPos.hoveredCorner === corner ? 'is-active' : ''}`}
                    />
                  ))}
                </div>
              )}

              {/* Floating Canvas Tools HUD in Live View (Runtime Mode) */}
              {scapeMode === 'runtime' && (
                <div
                  key="ps-runtime-page-tools"
                  ref={runtimeToolsRef}
                  className={`canvas-floating-hud zoom-hud ps-runtime-page-tools corner-${runtimeToolsCorner}${isRuntimeToolsConcise ? ' is-concise' : ''}${runtimeToolsDragPos ? ' is-dragging' : ''}`}
                  id="psRuntimePageTools"
                  style={runtimeToolsDragPos ? { left: `${runtimeToolsDragPos.x}px`, top: `${runtimeToolsDragPos.y}px`, right: 'auto', bottom: 'auto' } : undefined}
                  onMouseDown={handleRuntimeToolsMouseDown}
                >
                  <button
                    key="tool-runtime-drag-handle"
                    id="toolRuntimeDragHandle"
                    type="button"
                    className={`hud-icon-btn ps-runtime-drag-handle ${isRuntimeToolsConcise ? 'is-concise-active' : ''}`}
                    onClick={handleDragHandleClick}
                    title={isRuntimeToolsConcise ? "Concise Style — Click to toggle style, drag to corner" : "Click to toggle concise style, drag to corner"}
                    aria-label="Click to toggle style, drag to corner"
                  >
                    <HudIcons.DragHandle />
                  </button>

                  {runtimeLocationsList.length > 0 ? (
                    <>
                      <div className="ps-runtime-location-picker" title="Toggle Plant Location">
                        <select
                          id="toolRuntimeLocationSelect"
                          className="ps-runtime-location-select"
                          value={(runtimeLocationsList.some(l => l.id === activeLocationId) ? activeLocationId : runtimeLocationsList[0]?.id) || ''}
                          onChange={handleRuntimeLocationSelect}
                          aria-label="Select Plant Location"
                        >
                          {runtimeLocationsList.map(loc => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!isRuntimeToolsConcise && <div className="hud-divider" />}
                    </>
                  ) : isRuntimeToolsConcise ? (
                    <span className="ps-runtime-concise-empty">No Locations</span>
                  ) : null}

                  {!isRuntimeToolsConcise && (
                    <>
                      <div className="tool-group">
                        <button
                          id="toolRuntimeZoomOut"
                          type="button"
                          className="hud-icon-btn"
                          onClick={() => {
                            const rect = viewportRef.current?.getBoundingClientRect();
                            const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                            const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                            zoomAtPoint(cx, cy, 1 / 1.15);
                          }}
                          title="Zoom Out (-)"
                          aria-label="Zoom Out"
                        >
                          <HudIcons.ZoomOut />
                        </button>

                        <button
                          id="toolRuntimeZoomReset"
                          type="button"
                          className="zoom-text hud-btn-zoom-reset"
                          onClick={resetView}
                          title="Reset Zoom to 100% (Click to reset)"
                          aria-label="Zoom Percentage"
                        >
                          {Math.round((view?.zoom || 1) * 100)}%
                        </button>

                        <button
                          id="toolRuntimeZoomIn"
                          type="button"
                          className="hud-icon-btn"
                          onClick={() => {
                            const rect = viewportRef.current?.getBoundingClientRect();
                            const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                            const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                            zoomAtPoint(cx, cy, 1.15);
                          }}
                          title="Zoom In (+)"
                          aria-label="Zoom In"
                        >
                          <HudIcons.ZoomIn />
                        </button>
                      </div>

                      <div className="hud-divider" />

                      <div className="tool-group">
                        {/* Combined Diagram Bounds Resizer & Sensor Card Repositioning Tool */}
                        <button
                          key="tool-runtime-bounds-resizer"
                          id="toolRuntimeBoundsResizer"
                          type="button"
                          className={`hud-icon-btn ${boundsResizerMode === 'runtime' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            handleToggleBoundsResizer();
                          }}
                          title={boundsResizerMode === 'runtime' ? "Confirm & Apply Layout Changes (Save Size & Positions)" : "Resize Diagram & Move Attached Sensor Cards"}
                          aria-label="Resize Diagram & Move Attached Sensor Cards"
                        >
                          <HudIcons.BoundsScale />
                        </button>

                        {/* Scape Manager (Switch / Create Scapes) */}
                        <div className="ps-runtime-scape-manager-anchor">
                          <button
                            id="toolRuntimeScapeManager"
                            type="button"
                            className={`hud-icon-btn ${showEmptyScapeIndicator ? 'has-indicator' : ''}`}
                            onClick={() => {
                              setIsScapeManagerOpen(true);
                              setIsBubbleDismissed(true);
                            }}
                            title="Scape Manager (Switch / Create Scapes)"
                            aria-label="Scape Manager"
                          >
                            <HudIcons.ScapeManager />
                          </button>

                          {showEmptyScapeIndicator && (
                            <div
                              className={`ps-empty-scape-bubble placement-${bubblePlacement}`}
                              onClick={() => {
                                setIsScapeManagerOpen(true);
                                setIsBubbleDismissed(true);
                              }}
                              role="button"
                              tabIndex={0}
                              title="Start scape layout edit"
                              aria-label="Start scape layout edit"
                            >
                              <span className="ps-bubble-tail" aria-hidden="true" />
                              <span className="ps-bubble-icon" aria-hidden="true">✏️</span>
                              <span className="ps-bubble-text">Start scape layout edit</span>
                              <button
                                type="button"
                                className="ps-bubble-close-btn"
                                title="Dismiss hint"
                                aria-label="Dismiss hint"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsBubbleDismissed(true);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Scalable SVG World Scene */}
              <svg className="ps-scene-svg">
                <defs>
                  <filter id="softCardShadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.08" />
                  </filter>
                  <filter id="badgeShadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
                  </filter>
                </defs>

                <g id="worldGroup" transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
                  {/* Background Zones */}
                  {zones.map(z => (
                    <g key={z.id} transform={`translate(${z.x}, ${z.y})`} pointerEvents="none">
                      <rect
                        x={0} y={0} width={z.w} height={z.h} rx={16}
                        fill={isDarkMode ? '#131922' : '#f8fafc'}
                        stroke={isDarkMode ? '#243042' : '#e2e8f0'}
                        strokeWidth={1.5}
                      />
                      <rect
                        x={0} y={z.headerPosition === 'bottom' ? z.h - 44 : 0}
                        width={z.w} height={44}
                        rx={16}
                        fill="#00a876"
                      />
                      <rect
                        x={0} y={z.headerPosition === 'bottom' ? z.h - 44 : 20}
                        width={z.w} height={24}
                        fill="#00a876"
                      />
                      <text
                        x={z.w / 2}
                        y={z.headerPosition === 'bottom' ? z.h - 16 : 28}
                        textAnchor="middle"
                        fontSize={16}
                        fontWeight={800}
                        fill="#ffffff"
                        fontFamily="sans-serif"
                        letterSpacing="0.8px"
                      >
                        {z.title}
                      </text>
                      {z.watermark && (
                        <text
                          x={z.w - 16}
                          y={z.headerPosition === 'bottom' ? z.h - 16 : 28}
                          textAnchor="end"
                          fontSize={11}
                          fontWeight={600}
                          fill="rgba(255,255,255,0.8)"
                          fontFamily="sans-serif"
                        >
                          {z.watermark}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Dynamic Diagram Elements & Pipes */}
                  <g ref={diagramLayerRef} />

                  {/* Interactive Layer (Anchors, Lead lines, Reticles) */}
                  <g ref={interactionLayerRef} />

                  {/* Diagram Bounding Box Resizer Tool Overlay */}
                  {isBoundsResizerActive && resizingBox && (
                    <g id="boundsResizerGroup" className="ps-bounds-resizer-group">
                      <rect
                        x={resizingBox.x}
                        y={resizingBox.y}
                        width={resizingBox.w}
                        height={resizingBox.h}
                        fill="rgba(0, 172, 134, 0.05)"
                        stroke="#00ac86"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        rx={4}
                        pointerEvents="none"
                      />
                      <g transform={`translate(${resizingBox.x + 8}, ${resizingBox.y - 10})`} pointerEvents="none">
                        <rect x={-4} y={-14} width={164} height={20} rx={4} fill="#0f172a" opacity={0.92} />
                        <text x={6} y={1} fontSize={11} fontWeight={700} fill="#ffffff" fontFamily="ui-monospace, monospace">
                          📐 Diagram: {Math.round(resizingBox.w)}×{Math.round(resizingBox.h)}px
                        </text>
                      </g>
                      {[
                        // Side edge handles first (10x10 px)
                        { type: 'n', x: resizingBox.x + resizingBox.w / 2, y: resizingBox.y, cursor: 'ns-resize', isCorner: false },
                        { type: 'e', x: resizingBox.x + resizingBox.w, y: resizingBox.y + resizingBox.h / 2, cursor: 'ew-resize', isCorner: false },
                        { type: 's', x: resizingBox.x + resizingBox.w / 2, y: resizingBox.y + resizingBox.h, cursor: 'ns-resize', isCorner: false },
                        { type: 'w', x: resizingBox.x, y: resizingBox.y + resizingBox.h / 2, cursor: 'ew-resize', isCorner: false },
                        // Corner handles second so they render on top with prominent 14x14 px styling
                        { type: 'nw', x: resizingBox.x, y: resizingBox.y, cursor: 'nwse-resize', isCorner: true },
                        { type: 'ne', x: resizingBox.x + resizingBox.w, y: resizingBox.y, cursor: 'nesw-resize', isCorner: true },
                        { type: 'se', x: resizingBox.x + resizingBox.w, y: resizingBox.y + resizingBox.h, cursor: 'nwse-resize', isCorner: true },
                        { type: 'sw', x: resizingBox.x, y: resizingBox.y + resizingBox.h, cursor: 'nesw-resize', isCorner: true },
                      ].map(h => (
                        <g
                          key={h.type}
                          className="ps-bounds-handle"
                          data-handle={h.type}
                          transform={`translate(${h.x}, ${h.y})`}
                          style={{ cursor: h.cursor }}
                          pointerEvents="all"
                        >
                          {/* Generous invisible hit target (28x28 px) for effortless clicking without precision strain */}
                          <rect
                            x={-14}
                            y={-14}
                            width={28}
                            height={28}
                            fill="transparent"
                            style={{ cursor: h.cursor }}
                            pointerEvents="all"
                          />
                          {/* Crisp, stable visual handle (14x14 px for 4 corners, 10x10 px for 4 edge midpoints) */}
                          <rect
                            className="ps-bounds-handle-rect"
                            x={h.isCorner ? -7 : -5}
                            y={h.isCorner ? -7 : -5}
                            width={h.isCorner ? 14 : 10}
                            height={h.isCorner ? 14 : 10}
                            rx={h.isCorner ? 3 : 2}
                            fill="#ffffff"
                            stroke="#00ac86"
                            strokeWidth={h.isCorner ? 2.5 : 2}
                            style={{ cursor: h.cursor }}
                            pointerEvents="none"
                          />
                        </g>
                      ))}
                    </g>
                  )}
                </g>
              </svg>
            </main>

            {/* Item Properties / Inspector Panel (Floating in Editor workbench or Pinned in ps-sidebar-footer) */}
            {scapeMode === 'editor' && (() => {
              const inspectorNode = (
                <aside
                  ref={inspectorElRef}
                  style={isInspectorPinned ? undefined : inspectorStyle}
                  className={`ps-inspector ${isInspectorPinned ? 'is-pinned' : (showFloatingInspector ? '' : 'collapsed')} ${!isInspectorPinned && isDraggingInspector ? 'is-dragging' : ''} ${isInspectorMin ? 'is-min' : ''} ${!isInspectorPinned && inspectorDockAnim === 'to-float' ? 'is-float-entering' : ''}`}
                >
                  <div
                    className="ps-inspector-header"
                    onMouseDown={handleInspectorHeaderMouseDown}
                    onTouchStart={handleInspectorHeaderTouchStart}
                    onDoubleClick={() => {
                      if (!isInspectorPinned) setInspectorPos(null);
                    }}
                    title={isInspectorPinned ? 'Item Properties (Pinned to Sidebar)' : 'Drag header to move • Double-click to reset position'}
                  >
                    <div className="ps-inspector-title-wrap">
                      <span
                        className="ps-inspector-drag-grip"
                        role="button"
                        tabIndex={0}
                        aria-label="Toggle Inspector Min/Normal Style"
                        aria-pressed={isInspectorMin}
                        title={isInspectorMin ? 'Min style — Click grip for Normal style' : 'Normal style — Click grip for Min style'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (inspectorDragRef.current.didMove) {
                            inspectorDragRef.current.didMove = false;
                            return;
                          }
                          setIsInspectorMin(prev => !prev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsInspectorMin(prev => !prev);
                          }
                        }}
                      >
                        ⠿
                      </span>
                      <div className="ps-inspector-title">
                        {getInspectorHeaderTitle()}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ps-inspector-close-btn"
                      onClick={handleToggleInspectorPin}
                      title={isInspectorPinned ? 'Unpin to Floating Window' : 'Pin Properties to Sidebar'}
                      aria-label={isInspectorPinned ? 'Unpin to Floating Window' : 'Pin Properties to Sidebar'}
                    >
                      {isInspectorPinned ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 17v5" />
                          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                        </svg>
                      )}
                    </button>
                  </div>

                <div className="ps-inspector-body">
                  {!singleSelectedElement && !isPipeSelection ? (
                    <div className="ps-empty-inspector">
                      <div style={{ fontSize: 32 }}>🎯</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>No Item Selected</div>
                      <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                        Click an equipment asset, pipe, or sensor card on the canvas to configure parameters and live data channels.
                      </div>
                    </div>
                  ) : singleSelectedElement?.type === 'sensor_card' ? (
                    /* Sensor Mode Card Inspector */
                    <>
                      <div className="ps-form-group">
                        <label className="ps-form-label">Sensor Tag Name</label>
                        <input
                          className="ps-input"
                          value={selectedElement.tag || ''}
                          onChange={(e) => updateSelectedElement({ tag: e.target.value })}
                        />
                      </div>

                      {!isInspectorMin && (
                        <>
                          <div className="ps-form-group">
                            <label className="ps-form-label">Title Position</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className={`hud-btn-sm ${selectedElement.titlePosition === 'left' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => updateSelectedElement({ titlePosition: 'left' })}
                              >
                                Left Tag
                              </button>
                              <button
                                type="button"
                                className={`hud-btn-sm ${selectedElement.titlePosition === 'top' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => updateSelectedElement({ titlePosition: 'top' })}
                              >
                                Top Banner
                              </button>
                            </div>
                          </div>

                          <div className="ps-form-group">
                            <label className="ps-form-label">Linked Device (Sensor / Gateway)</label>
                            <select
                              className="ps-select"
                              value={selectedElement.attachedAssetId || ''}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                updateSelectedElement({ attachedAssetId: val });
                              }}
                            >
                              <option value="">(None - Free Floating)</option>
                              {elements.filter(e => isSensorOrGateway(e)).map(dev => (
                                <option key={dev.id} value={dev.id}>
                                  {dev.tag || ASSET_DEFS[dev.type]?.name || dev.id}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Relative placement shortcuts */}
                          {selectedElement.attachedAssetId && (
                            <div className="ps-form-group">
                              <label className="ps-form-label">Quick Position vs Linked Device</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                                <button type="button" className="hud-btn-sm" style={{ justifyContent: 'center' }} onClick={() => updateSelectedElement({ x: (elements.find(e => e.id === selectedElement.attachedAssetId)?.x || 0), y: (elements.find(e => e.id === selectedElement.attachedAssetId)?.y || 0) - 80 })}>Above</button>
                                <button type="button" className="hud-btn-sm" style={{ justifyContent: 'center' }} onClick={() => updateSelectedElement({ x: (elements.find(e => e.id === selectedElement.attachedAssetId)?.x || 0), y: (elements.find(e => e.id === selectedElement.attachedAssetId)?.y || 0) + 80 })}>Below</button>
                                <button type="button" className="hud-btn-sm" style={{ justifyContent: 'center' }} onClick={() => updateSelectedElement({ x: (elements.find(e => e.id === selectedElement.attachedAssetId)?.x || 0) - 120, y: (elements.find(e => e.id === selectedElement.attachedAssetId)?.y || 0) })}>Left</button>
                                <button type="button" className="hud-btn-sm" style={{ justifyContent: 'center' }} onClick={() => updateSelectedElement({ x: (elements.find(e => e.id === selectedElement.attachedAssetId)?.x || 0) + 120, y: (elements.find(e => e.id === selectedElement.attachedAssetId)?.y || 0) })}>Right</button>
                              </div>
                            </div>
                          )}

                          {/* Assigned Telemetry Channels */}
                          <div className="ps-form-group">
                            <label className="ps-form-label">
                              Assigned Telemetry Channels ({(selectedElement.channels || []).length})
                            </label>
                            {(selectedElement.channels || []).length === 0 ? (
                              <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                                No channels assigned. Use <strong>Sensor & Measurement Point Manager</strong> to detect and bind channels.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                {(selectedElement.channels || []).map((ch, idx) => (
                                  <div
                                    key={ch.id || idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '4px 8px',
                                      background: 'rgba(15, 23, 42, 0.03)',
                                      borderRadius: 4,
                                      fontSize: 11
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{ch.name}</span>
                                    <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>{ch.unit || ''}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {renderInspectorDeleteFooter(() => deleteSingleElement('Delete Sensor'))}
                        </>
                      )}
                    </>
                  ) : singleSelectedElement?.type === 'guide_line' ? (
                    /* Dedicated H / V Guide Line Inspector (Min shows only Line Length) */
                    <>
                      {!isInspectorMin && (
                        <>
                          <div className="ps-form-group">
                            <label className="ps-form-label">Orientation</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className={`hud-btn-sm ${(singleSelectedElement.orientation || 'h') === 'h' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                aria-label="Line Orientation: Horizontal (H)"
                                onClick={() => updateSelectedElement({ orientation: 'h' })}
                              >
                                Horizontal (H)
                              </button>
                              <button
                                type="button"
                                className={`hud-btn-sm ${singleSelectedElement.orientation === 'v' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                aria-label="Line Orientation: Vertical (V)"
                                onClick={() => updateSelectedElement({ orientation: 'v' })}
                              >
                                Vertical (V)
                              </button>
                            </div>
                          </div>

                          {renderLineStyleField({
                            label: 'Line Style',
                            activeStyle: singleSelectedElement.lineStyle || 'single',
                            ariaPrefix: 'Line Style',
                            onSelect: (id) => updateSelectedElement({ lineStyle: id })
                          })}

                          {renderColorSwatchField({
                            label: 'Line Color',
                            palette: NOTE_COLOR_PALETTE,
                            activeColor: singleSelectedElement.color || '#475569',
                            onSelect: (hex) => updateSelectedElement({ color: hex })
                          })}
                        </>
                      )}

                      {renderRangeField({
                        id: 'guideLineLengthSlider',
                        label: 'Line Length',
                        valueText: `${Math.round(singleSelectedElement.length || 220)} px`,
                        min: 40,
                        max: 1000,
                        step: 10,
                        value: Math.round(singleSelectedElement.length || 220),
                        onChange: (e) => {
                          const len = Math.max(20, parseInt(e.target.value, 10) || 220);
                          updateSelectedElement({ length: len });
                        }
                      })}

                      {!isInspectorMin && (
                        <>
                          {renderRangeField({
                            id: 'guideLineWidthSlider',
                            label: 'Line Thickness',
                            valueText: `${singleSelectedElement.strokeWidth || 1} px`,
                            min: 1,
                            max: 10,
                            step: 1,
                            value: singleSelectedElement.strokeWidth || 1,
                            onChange: (e) => {
                              const sw = Math.max(1, parseInt(e.target.value, 10) || 1);
                              updateSelectedElement({ strokeWidth: sw });
                            }
                          })}

                          {renderInspectorDeleteFooter(() => deleteSingleElement('Delete Line'))}
                        </>
                      )}
                    </>
                  ) : (singleSelectedElement?.type === 'shape_rect' || singleSelectedElement?.type === 'shape_circle') ? (
                    /* Dedicated Rectangle & Circle/Oval Inspector (Min shows Width & Height W/H) */
                    (() => {
                      const isCircle = singleSelectedElement.type === 'shape_circle';
                      const shapeW = Math.max(20, Math.round(Number(singleSelectedElement.w) || (isCircle ? 120 : 160)));
                      const shapeH = Math.max(20, Math.round(Number(singleSelectedElement.h) || (isCircle ? 120 : 100)));
                      const fillColor = (singleSelectedElement.fillColor && singleSelectedElement.fillColor !== 'none') ? singleSelectedElement.fillColor : 'transparent';
                      const fillOpacityPct = fillColor === 'transparent'
                        ? 100
                        : Math.round((singleSelectedElement.fillOpacity != null ? Number(singleSelectedElement.fillOpacity) : 1) * 100);
                      const strokeColor = singleSelectedElement.color || '#475569';
                      const lineStyle = singleSelectedElement.lineStyle || 'single';
                      const strokeWidth = Math.max(1, Number(singleSelectedElement.strokeWidth) || 1);
                      const customPickerValue = /^#[0-9a-f]{6}$/i.test(fillColor) ? fillColor : '#ccfbf1';

                      return (
                        <>
                          {renderRangeField({
                            id: 'shapeWidthSlider',
                            label: 'Width (W)',
                            valueText: `${shapeW} px`,
                            min: 20,
                            max: 1200,
                            step: 10,
                            value: shapeW,
                            onChange: (e) => {
                              const nextW = Math.max(20, parseInt(e.target.value, 10) || shapeW);
                              updateSelectedElement({ w: nextW });
                            }
                          })}

                          {renderRangeField({
                            id: 'shapeHeightSlider',
                            label: 'Height (H)',
                            valueText: `${shapeH} px`,
                            min: 20,
                            max: 1200,
                            step: 10,
                            value: shapeH,
                            onChange: (e) => {
                              const nextH = Math.max(20, parseInt(e.target.value, 10) || shapeH);
                              updateSelectedElement({ h: nextH });
                            },
                            footer: (!isInspectorMin && isCircle && shapeW !== shapeH) ? (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="hud-btn-sm"
                                  style={{ fontSize: 10, height: 20, padding: '0 6px' }}
                                  onClick={() => {
                                    saveHistory('Match Circle W = H');
                                    updateSelectedElement({ h: shapeW });
                                  }}
                                  title="Set Height equal to Width to restore a perfect circle"
                                >
                                  Make Circle (W=H)
                                </button>
                              </div>
                            ) : null
                          })}

                          {!isInspectorMin && (
                            <>
                              {renderColorSwatchField({
                                label: 'Fill Color',
                                palette: SHAPE_FILL_PALETTE,
                                activeColor: fillColor,
                                ariaPrefix: 'Fill Color',
                                onSelect: (hex) => {
                                  saveHistory('Change Shape Fill Color');
                                  updateSelectedElement({ fillColor: hex });
                                },
                                extraControl: (
                                  <input
                                    id="shapeFillColorPicker"
                                    type="color"
                                    className="ps-color-picker-btn"
                                    title="Custom Fill Color"
                                    aria-label="Custom Fill Color"
                                    value={customPickerValue}
                                    onChange={(e) => updateSelectedElement({ fillColor: e.target.value })}
                                  />
                                )
                              })}

                              {fillColor !== 'transparent' && renderRangeField({
                                id: 'shapeFillOpacitySlider',
                                label: 'Fill Opacity',
                                valueText: `${fillOpacityPct}%`,
                                min: 10,
                                max: 100,
                                step: 5,
                                minLabel: '10%',
                                maxLabel: '100%',
                                value: fillOpacityPct,
                                onChange: (e) => {
                                  const nextOp = Math.max(0.1, Math.min(1, (parseInt(e.target.value, 10) || 100) / 100));
                                  updateSelectedElement({ fillOpacity: Number(nextOp.toFixed(2)) });
                                }
                              })}

                              {renderLineStyleField({
                                label: 'Frame Style',
                                activeStyle: lineStyle,
                                ariaPrefix: 'Frame Style',
                                onSelect: (id) => {
                                  saveHistory('Change Frame Style');
                                  updateSelectedElement({ lineStyle: id });
                                }
                              })}

                              {renderColorSwatchField({
                                label: 'Frame Color',
                                palette: NOTE_COLOR_PALETTE,
                                activeColor: strokeColor,
                                ariaPrefix: 'Frame Color',
                                onSelect: (hex) => {
                                  saveHistory('Change Frame Color');
                                  updateSelectedElement({ color: hex });
                                }
                              })}

                              {renderRangeField({
                                id: 'shapeStrokeWidthSlider',
                                label: 'Frame Thickness',
                                valueText: `${strokeWidth} px`,
                                min: 1,
                                max: 10,
                                step: 1,
                                value: strokeWidth,
                                onChange: (e) => {
                                  const sw = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  updateSelectedElement({ strokeWidth: sw });
                                }
                              })}

                              {renderInspectorDeleteFooter(() => deleteSingleElement(`Delete ${isCircle ? 'Circle' : 'Rectangle'}`))}
                            </>
                          )}
                        </>
                      );
                    })()
                  ) : singleSelectedElement?.type === 'text_note' ? (
                    /* Dedicated Label Inspector */
                    <>
                      <div className="ps-form-group">
                        <label className="ps-form-label" htmlFor="psTextNoteInput">Note Text</label>
                        <textarea
                          id="psTextNoteInput"
                          className="ps-input ps-textarea"
                          rows={2}
                          value={singleSelectedElement.text ?? ''}
                          placeholder="Enter label text..."
                          onChange={(e) => updateSelectedElement({ text: e.target.value })}
                        />
                      </div>

                      {/* Orientation H / V & Outline / Color controls (Normal mode) */}
                      {!isInspectorMin && (
                        <>
                          {/* Orientation H / V Style Selector */}
                          <div className="ps-form-group">
                            <label className="ps-form-label">Orientation Style</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className={`hud-btn-sm ${(singleSelectedElement.orientation || 'h') === 'h' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                aria-label="Label Orientation: Horizontal (H)"
                                onClick={() => updateSelectedElement({ orientation: 'h' })}
                              >
                                Horizontal (H)
                              </button>
                              <button
                                type="button"
                                className={`hud-btn-sm ${singleSelectedElement.orientation === 'v' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                aria-label="Label Orientation: Vertical (V)"
                                onClick={() => updateSelectedElement({ orientation: 'v' })}
                              >
                                Vertical (V)
                              </button>
                            </div>
                          </div>

                          {/* Outline Border Style Selector */}
                          <div className="ps-form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <label className="ps-form-label" style={{ margin: 0 }}>Outline Style</label>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#00ac86' }}>
                                {(NOTE_OUTLINE_STYLES.find(s => s.id === (singleSelectedElement.outlineStyle || 'none')) || NOTE_OUTLINE_STYLES[0]).name}
                              </span>
                            </div>
                            <div className="ps-note-outline-grid">
                              {NOTE_OUTLINE_STYLES.map(opt => {
                                const active = (singleSelectedElement.outlineStyle || 'none') === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    className={`ps-note-outline-btn ${active ? 'active' : ''}`}
                                    title={opt.desc}
                                    aria-label={`Outline: ${opt.name}`}
                                    onClick={() => {
                                      saveHistory('Change Note Outline');
                                      updateSelectedElement({ outlineStyle: opt.id });
                                    }}
                                  >
                                    <span className={`ps-outline-preview style-${opt.id}`} aria-hidden="true">Abc</span>
                                    <span className="ps-outline-label">{opt.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Text & Border Color Swatches */}
                          <div className="ps-form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <label className="ps-form-label" style={{ margin: 0 }}>Text &amp; Border Color</label>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#00ac86' }}>
                                {(NOTE_COLOR_PALETTE.find(c => c.hex.toLowerCase() === (singleSelectedElement.color || '#64748b').toLowerCase())?.name) || 'Custom'}
                              </span>
                            </div>
                            <div className="ps-swatches-row">
                              {NOTE_COLOR_PALETTE.map(c => {
                                const isActive = (singleSelectedElement.color || '#64748b').toLowerCase() === c.hex.toLowerCase();
                                return (
                                  <button
                                    type="button"
                                    key={c.id}
                                    className={`ps-swatch-circle-btn ${isActive ? 'active' : ''}`}
                                    title={c.name}
                                    aria-label={c.name}
                                    onClick={() => {
                                      saveHistory('Change Note Color');
                                      updateSelectedElement({ color: c.hex });
                                    }}
                                    style={{ backgroundColor: c.hex }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Font Size Slider (Tailored for Text Note, not Device Size) */}
                      <div className="ps-form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="ps-form-label" style={{ margin: 0 }}>Text Size</label>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#00ac86' }}>
                            {singleSelectedElement.fontSize || 12} px
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#64748b', minWidth: 26 }}>10px</span>
                          <input
                            id="noteFontSizeSlider"
                            type="range"
                            min="10"
                            max="32"
                            step="1"
                            style={{ flex: 1, accentColor: '#00ac86' }}
                            value={singleSelectedElement.fontSize || 12}
                            onChange={(e) => {
                              const sz = parseInt(e.target.value, 10) || 12;
                              saveHistory('Resize Note Text');
                              updateSelectedElement({ fontSize: sz });
                            }}
                          />
                          <span style={{ fontSize: 11, color: '#64748b', minWidth: 30, textAlign: 'right' }}>32px</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            type="button"
                            className="hud-btn-sm"
                            style={{ fontSize: 10, height: 20, padding: '0 6px' }}
                            onClick={() => {
                              saveHistory('Reset Note Size');
                              updateSelectedElement({ fontSize: 12 });
                            }}
                            title="Reset font size to 12px"
                          >
                            Reset (12px)
                          </button>
                        </div>
                      </div>

                      {!isInspectorMin && renderInspectorDeleteFooter(() => deleteSingleElement('Delete Text Note'))}
                    </>
                  ) : (singleSelectedElement?.type === 'wall_perimeter_h' || singleSelectedElement?.type === 'wall_perimeter_v') ? (
                    /* Dedicated Brick Wall Inspector (no Equipment Tag Name / Color Theme; Min shows only Wall Length) */
                    (() => {
                      const isVertWall = singleSelectedElement.type === 'wall_perimeter_v';
                      const curDef = ASSET_DEFS[singleSelectedElement.type] || { w: isVertWall ? 24 : 200, h: isVertWall ? 200 : 24 };
                      const wallLen = Math.max(40, Math.round(isVertWall ? (singleSelectedElement.h || curDef.h) : (singleSelectedElement.w || curDef.w)));
                      const wallThick = Math.max(12, Math.round(isVertWall ? (singleSelectedElement.w || curDef.w) : (singleSelectedElement.h || curDef.h)));
                      const applyWallSize = (nextLen, nextThick, nextType = singleSelectedElement.type) => {
                        const nextVert = nextType === 'wall_perimeter_v';
                        updateSelectedElement({
                          type: nextType,
                          scale: undefined,
                          w: nextVert ? nextThick : nextLen,
                          h: nextVert ? nextLen : nextThick
                        });
                      };
                      return (
                        <>
                          {!isInspectorMin && (
                            <div className="ps-form-group">
                              <label className="ps-form-label">Orientation</label>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {['h', 'v'].map(orient => {
                                  const isActive = (isVertWall ? 'v' : 'h') === orient;
                                  const nextType = orient === 'v' ? 'wall_perimeter_v' : 'wall_perimeter_h';
                                  return (
                                    <button
                                      key={orient}
                                      type="button"
                                      className={`hud-btn-sm ${isActive ? 'btn-primary' : ''}`}
                                      style={{ flex: 1, justifyContent: 'center' }}
                                      aria-label={`Wall Orientation: ${orient === 'v' ? 'Vertical (V)' : 'Horizontal (H)'}`}
                                      onClick={() => {
                                        if (singleSelectedElement.type === nextType) return;
                                        saveHistory('Toggle Wall Orientation');
                                        applyWallSize(wallLen, wallThick, nextType);
                                      }}
                                    >
                                      {orient === 'v' ? 'Vertical (V)' : 'Horizontal (H)'}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Wall Length Slider (Always visible in Normal & Min style) */}
                          <div className="ps-form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <label className="ps-form-label" style={{ margin: 0 }}>Wall Length</label>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#00ac86' }}>
                                {wallLen} px
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>40px</span>
                              <input
                                id="wallLengthSlider"
                                type="range"
                                min="40"
                                max="1200"
                                step="10"
                                style={{ flex: 1, accentColor: '#00ac86' }}
                                value={wallLen}
                                onChange={(e) => {
                                  const nextLen = parseInt(e.target.value, 10) || 200;
                                  saveHistory('Resize Wall Length');
                                  applyWallSize(nextLen, wallThick);
                                }}
                              />
                              <span style={{ fontSize: 11, color: '#64748b', minWidth: 38, textAlign: 'right' }}>1200px</span>
                            </div>
                            {!isInspectorMin && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="hud-btn-sm"
                                  style={{ fontSize: 10, height: 20, padding: '0 6px' }}
                                  onClick={() => {
                                    saveHistory('Reset Wall Length');
                                    applyWallSize(200, wallThick);
                                  }}
                                  title="Reset wall length to 200px"
                                >
                                  Reset (200px)
                                </button>
                              </div>
                            )}
                          </div>

                          {!isInspectorMin && (
                            <>
                              {/* Wall Thickness Slider */}
                              <div className="ps-form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <label className="ps-form-label" style={{ margin: 0 }}>Wall Thickness</label>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#00ac86' }}>
                                    {wallThick} px
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>12px</span>
                                  <input
                                    id="wallThicknessSlider"
                                    type="range"
                                    min="12"
                                    max="120"
                                    step="2"
                                    style={{ flex: 1, accentColor: '#00ac86' }}
                                    value={wallThick}
                                    onChange={(e) => {
                                      const nextThick = parseInt(e.target.value, 10) || 24;
                                      saveHistory('Change Wall Thickness');
                                      applyWallSize(wallLen, nextThick);
                                    }}
                                  />
                                  <span style={{ fontSize: 11, color: '#64748b', minWidth: 34, textAlign: 'right' }}>120px</span>
                                </div>
                              </div>

                              {renderInspectorDeleteFooter(() => deleteSingleElement('Delete Wall'))}
                            </>
                          )}
                        </>
                      );
                    })()
                  ) : singleSelectedElement ? (
                    /* Equipment / Asset Node Inspector (Min shows only Device Size) */
                    <>
                      {!isInspectorMin && (
                        <>
                          <div className="ps-form-group">
                            <label className="ps-form-label">Equipment Tag Name</label>
                            <input
                              className="ps-input"
                              value={singleSelectedElement.tag ?? ''}
                              placeholder="(Optional tag / empty)"
                              onChange={(e) => updateSelectedElement({ tag: e.target.value })}
                            />
                          </div>

                          {/* Solid Flat Color Theme Swatches (Single-line compact options) */}
                          <div className="ps-form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <label className="ps-form-label" style={{ margin: 0 }}>Color Theme</label>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#00ac86' }}>
                                {(EQUIPMENT_COLOR_THEMES[singleSelectedElement.colorTheme || 'blue'] || EQUIPMENT_COLOR_THEMES.blue).name}
                              </span>
                            </div>
                            <div className="ps-swatches-row">
                              {Object.values(EQUIPMENT_COLOR_THEMES).map(theme => (
                                <button
                                  type="button"
                                  key={theme.id}
                                  className={`ps-swatch-circle-btn ${(singleSelectedElement.colorTheme || 'blue') === theme.id ? 'active' : ''}`}
                                  title={theme.name}
                                  aria-label={theme.name}
                                  onClick={() => {
                                    saveHistory('Change Theme');
                                    updateSelectedElement({ colorTheme: theme.id });
                                  }}
                                  style={{ backgroundColor: theme.main }}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Proportional Size Control Slider */}
                      <div className="ps-form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="ps-form-label" style={{ margin: 0 }}>Device Size</label>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#00ac86' }}>
                            {Math.round(((singleSelectedElement.scale ?? ((singleSelectedElement.w && ASSET_DEFS[singleSelectedElement.type]) ? singleSelectedElement.w / ASSET_DEFS[singleSelectedElement.type].w : 1))) * 100)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>40%</span>
                          <input
                            id="itemScaleSlider"
                            type="range"
                            min="40"
                            max="250"
                            step="5"
                            style={{ flex: 1, accentColor: '#00ac86' }}
                            value={Math.round(((singleSelectedElement.scale ?? ((singleSelectedElement.w && ASSET_DEFS[singleSelectedElement.type]) ? singleSelectedElement.w / ASSET_DEFS[singleSelectedElement.type].w : 1))) * 100)}
                            onChange={(e) => {
                              const pct = parseInt(e.target.value, 10);
                              const newScale = Math.round((pct / 100) * 100) / 100;
                              const def = ASSET_DEFS[singleSelectedElement.type] || { w: 100, h: 80 };
                              const newW = Math.round(def.w * newScale);
                              const newH = Math.round(def.h * newScale);
                              saveHistory('Resize Device');
                              updateSelectedElement({ scale: newScale, w: newW, h: newH });
                            }}
                          />
                          <span style={{ fontSize: 11, color: '#64748b', minWidth: 32, textAlign: 'right' }}>250%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11, color: '#64748b' }}>
                          <span>
                            {Math.round(singleSelectedElement.w || (ASSET_DEFS[singleSelectedElement.type]?.w || 100) * (singleSelectedElement.scale || 1))} × {Math.round(singleSelectedElement.h || (ASSET_DEFS[singleSelectedElement.type]?.h || 80) * (singleSelectedElement.scale || 1))} px
                          </span>
                          <button
                            type="button"
                            className="hud-btn-sm"
                            style={{ fontSize: 10, height: 20, padding: '0 6px' }}
                            onClick={() => {
                              const def = ASSET_DEFS[singleSelectedElement.type] || { w: 100, h: 80 };
                              saveHistory('Reset Device Size');
                              updateSelectedElement({ scale: 1, w: def.w, h: def.h });
                            }}
                            title="Reset to 100% standard size"
                          >
                            Reset (100%)
                          </button>
                        </div>
                      </div>

                      {!isInspectorMin && renderInspectorDeleteFooter(() => deleteSingleElement('Delete Equipment'))}
                    </>
                  ) : isPipeSelection && representativePipe ? (
                    /* Pipe Inspector (Min shows only Pipe Thickness) */
                    <>
                      {!isInspectorMin && selectedPipes.length > 1 && (
                        <div style={{
                          fontSize: 11.5,
                          color: '#00ac86',
                          fontWeight: 600,
                          background: 'rgba(0, 172, 134, 0.08)',
                          border: '1px solid rgba(0, 172, 134, 0.25)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          marginBottom: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span>🔗</span> Grouped Pipeline ({selectedPipes.length} segments)
                        </div>
                      )}

                      <div className="ps-form-group">
                        <label className="ps-form-label">Pipe Thickness ({representativePipe.w || 20}px)</label>
                        <input
                          id="pipeThicknessSlider"
                          type="range"
                          min="10"
                          max="40"
                          step="2"
                          value={representativePipe.w || 20}
                          onChange={(e) => updateSelectedPipe({ w: parseInt(e.target.value, 10) })}
                        />
                      </div>

                      {!isInspectorMin && (
                        <>
                          <div className="ps-form-group">
                            <label className="ps-form-label">Flow Direction</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className={`hud-btn-sm ${(!representativePipe.flow || representativePipe.flow === 'forward') ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => updateSelectedPipe({ flow: 'forward' })}
                                title="Animate fluid flow from start to end"
                              >
                                ▶ Forward
                              </button>
                              <button
                                type="button"
                                className={`hud-btn-sm ${representativePipe.flow === 'reverse' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => updateSelectedPipe({ flow: 'reverse' })}
                                title="Animate fluid flow from end to start"
                              >
                                ◀ Reverse
                              </button>
                              <button
                                type="button"
                                className={`hud-btn-sm ${representativePipe.flow === 'none' ? 'btn-primary' : ''}`}
                                style={{ flex: 0.8, justifyContent: 'center' }}
                                onClick={() => updateSelectedPipe({ flow: 'none' })}
                                title="Turn off flow animation"
                              >
                                ⏹ Off
                              </button>
                            </div>
                          </div>

                          {renderInspectorDeleteFooter(() => {
                            saveHistory('Delete Pipeline');
                            const targetGroupIds = new Set(
                              selectedPipes.filter(p => p.groupId).map(p => p.groupId)
                            );
                            const deletedPipeIds = new Set(
                              pipes.filter(p => selectedIds.has(p.id) || (p.groupId && targetGroupIds.has(p.groupId))).map(p => p.id)
                            );
                            const updatedPipes = pipes.filter(p => !deletedPipeIds.has(p.id));
                            const updatedElements = elements.map(el => {
                              if (el.attachedPipeId && deletedPipeIds.has(el.attachedPipeId)) {
                                const updated = { ...el };
                                delete updated.attachedPipeId;
                                delete updated.pipeT;
                                delete updated.pipeOffsetX;
                                delete updated.pipeOffsetY;
                                return updated;
                              }
                              return el;
                            });
                            setPipes(updatedPipes);
                            setElements(updatedElements);
                            setSelectedIds(new Set());
                            saveScape({
                              id: activeScapeId,
                              title: projectTitle,
                              tempCanvasSize: { width: screenSize.w, height: screenSize.h },
                              zones,
                              elements: updatedElements,
                              pipes: updatedPipes
                            });
                          })}
                        </>
                      )}
                    </>
                  ) : null}
                </div>
                </aside>
              );

              if (isInspectorPinned) {
                return (hasSelection && sidebarFooterEl) ? createPortal(inspectorNode, sidebarFooterEl) : null;
              }
              return inspectorNode;
            })()}
          </>
        )}
      </div>

      {/* Animated Dock/Undock Fly Ghost showing Properties window moving between canvas & ps-sidebar-footer */}
      {dockFlyGhost && (
        <div
          className="ps-inspector-fly-ghost"
          aria-hidden="true"
          style={{
            left: `${dockFlyGhost.left}px`,
            top: `${dockFlyGhost.top}px`,
            width: `${dockFlyGhost.active ? dockFlyGhost.toWidth : dockFlyGhost.width}px`,
            height: `${dockFlyGhost.active ? dockFlyGhost.toHeight : dockFlyGhost.height}px`,
            transform: dockFlyGhost.active
              ? `translate3d(${dockFlyGhost.dx}px, ${dockFlyGhost.dy}px, 0) scale(0.98)`
              : 'translate3d(0px, 0px, 0) scale(1)',
            borderRadius: dockFlyGhost.active ? '4px' : '12px',
            opacity: dockFlyGhost.active ? 0.28 : 0.94
          }}
        >
          <div className="ps-inspector-fly-ghost-header">
            {dockFlyGhost.title}
          </div>
        </div>
      )}

      {/* Scape Manager Dialog for switching, creating, and modifying plant environments */}
      <ScapeManagerModal
        isOpen={isScapeManagerOpen}
        onClose={() => setIsScapeManagerOpen(false)}
        currentScapeId={activeScapeId}
        onSelectActiveScape={handleSelectScapeFromManager}
        onEditScape={handleEditScapeFromManager}
      />
    </div>
  );
}
