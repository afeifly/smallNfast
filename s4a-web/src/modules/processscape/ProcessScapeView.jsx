import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './ProcessScapeView.css';
import {
  ASSET_DEFS,
  EQUIPMENT_COLOR_THEMES,
  SENSOR_CARD_TEMPLATES,
  PIPE_PRESETS,
  TIPS_LIST
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
  distToSegment
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
  DEFAULT_COMPRESSED_AIR_SCAPE
} from './engine/scapeStorage.js';
import ScapeManagerModal from './ScapeManagerModal.jsx';
import { useProcessScapeTelemetry } from './engine/useProcessScapeTelemetry.js';

const PALETTE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'sensors', label: '🏷 Sensors' },
  { id: 'piping', label: '➰ Pipes' },
  { id: 'vessels', label: 'Tanks & Air' },
  { id: 'machines', label: 'Machines' },
  { id: 'gateways', label: 'Gateways' },
  { id: 'others', label: '🧱 Walls & Others' }
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
  RealSize: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
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
  )
};

export default function ProcessScapeView({
  onBackToLanding,
  onRegisterActions,
  onStateChange,
  initialElements = [],
  initialPipes = [],
  initialMode
}) {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const defaultMode = initialMode || (isTest ? 'editor' : 'runtime');
  const [scapeMode, setScapeMode] = useState(defaultMode); // 'runtime' | 'editor'
  const [isScapeManagerOpen, setIsScapeManagerOpen] = useState(false);

  // Load active scape from storage if custom elements/pipes not explicitly passed
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
    return getActiveScape();
  }, [initialElements, initialPipes]);

  const [activeScapeId, setActiveScapeIdState] = useState(() => activeScape.id);
  const [projectTitle, setProjectTitle] = useState(() => activeScape.title || 'ProcessScape');
  const [screenSize, setScreenSize] = useState(() => (
    activeScape.tempCanvasSize
      ? { w: activeScape.tempCanvasSize.width, h: activeScape.tempCanvasSize.height }
      : { w: 1024, h: 800 }
  ));
  const [zones, setZones] = useState(() => activeScape.zones || []);
  const [pipes, setPipes] = useState(() => (initialPipes.length > 0 ? initialPipes : (activeScape.pipes || [])));
  const [elements, setElements] = useState(() => (initialElements.length > 0 ? initialElements : (activeScape.elements || [])));

  const handleSelectActiveScape = useCallback((scape) => {
    setActiveScapeIdState(scape.id);
    setProjectTitle(scape.title || 'ProcessScape');
    setScreenSize(scape.tempCanvasSize ? { w: scape.tempCanvasSize.width, h: scape.tempCanvasSize.height } : { w: 1024, h: 800 });
    setZones(scape.zones || []);
    setElements(scape.elements || []);
    setPipes(scape.pipes || []);
    setSelectedIds(new Set());
    setScapeMode('runtime');
  }, []);

  const handleEditScapeFromManager = useCallback((scape) => {
    setActiveScapeIdState(scape.id);
    setProjectTitle(scape.title || 'ProcessScape');
    setScreenSize(scape.tempCanvasSize ? { w: scape.tempCanvasSize.width, h: scape.tempCanvasSize.height } : { w: 1024, h: 800 });
    setZones(scape.zones || []);
    setElements(scape.elements || []);
    setPipes(scape.pipes || []);
    setSelectedIds(new Set());
    setScapeMode('editor');
  }, []);

  const handleSaveAndExitEditor = useCallback(() => {
    saveScape({
      id: activeScapeId,
      title: projectTitle,
      tempCanvasSize: { width: screenSize.w, height: screenSize.h },
      zones,
      elements,
      pipes
    });
    setSelectedIds(new Set());
    setScapeMode('runtime');
    if (typeof window !== 'undefined' && window.showAppNotification) {
      window.showAppNotification('Scape Saved', `"${projectTitle}" updated and running live.`, 'success');
    }
  }, [activeScapeId, projectTitle, screenSize, zones, elements, pipes]);

  const changeScapeMode = useCallback((newMode) => {
    if (newMode === 'runtime' && scapeMode === 'editor') {
      saveScape({
        id: activeScapeId,
        title: projectTitle,
        tempCanvasSize: { width: screenSize.w, height: screenSize.h },
        zones,
        elements,
        pipes
      });
      if (typeof window !== 'undefined' && window.showAppNotification) {
        window.showAppNotification('Scape Saved', `"${projectTitle}" updated and running live.`, 'success');
      }
    }
    setSelectedIds(new Set());
    setScapeMode(newMode);
  }, [activeScapeId, projectTitle, screenSize, zones, elements, pipes, scapeMode]);

  // Dynamic real picture bounding box based on placed items with 16px margin to edge
  const contentBounds = useMemo(() => getContentBounds(elements, pipes, 16), [elements, pipes]);

  // --- Interaction & Tool State ---
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentTool, setCurrentTool] = useState('select'); // 'select' | 'pan' | 'draw_pipe'
  const [activePipeMedium, setActivePipeMedium] = useState('gas'); // 'gas' | 'liquid'
  const [view, setView] = useState({ x: 20, y: 78, zoom: 1.0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isRealSizePreview, setIsRealSizePreview] = useState(false);
  const [activePaletteTab, setActivePaletteTab] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  // Live View Tool States
  const [isLiveDndActive, setIsLiveDndActive] = useState(false);
  const [isBoundsResizerActive, setIsBoundsResizerActive] = useState(false);
  const [resizingBox, setResizingBox] = useState(null);
  const boundsBoxRef = useRef(null);

  // Real device live telemetry hook - powers live numbers and dynamic pipe flow (paused during bounds resizing)
  const telemetry = useProcessScapeTelemetry({
    elements,
    pipes,
    setElements,
    setPipes,
    enabled: !isBoundsResizerActive
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
  const handleZoomFit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const topOffset = 78; // Clearance to prevent overlap from floating top HUD
    const bottomOffset = 50; // Clearance for floating zoom HUD
    const availH = Math.max(100, rect.height - topOffset - bottomOffset);
    const scaleX = (rect.width - 60) / screenSize.w;
    const scaleY = availH / screenSize.h;
    const zoom = Math.min(scaleX, scaleY, 1.2);
    const x = (rect.width - screenSize.w * zoom) / 2;
    const y = topOffset + (availH - screenSize.h * zoom) / 2;
    setView({ x, y, zoom });
  }, [screenSize.w, screenSize.h]);

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
    const vw = viewportRef.current?.clientWidth || 1000;
    setView({
      zoom: 1.0,
      x: Math.max(10, (vw - screenSize.w) / 2),
      y: 78
    });
  }, [screenSize.w]);

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

  // Diagram Bounding Box Scaler & Pipe Extender Tool
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
      setIsBoundsResizerActive(true);
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
      }
      setIsBoundsResizerActive(false);
      setResizingBox(null);
      boundsBoxRef.current = null;
      setTimeout(() => {
        focusSelectedOrCenter();
      }, 50);
    }
  }, [isBoundsResizerActive, resizingBox, elements, pipes, activeScapeId, projectTitle, zones, focusSelectedOrCenter]);

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
          dLayer.appendChild(renderSensorCard(d.item, activeSelectedIds, elements, (scapeMode === 'runtime' && isLiveDndActive)));
        } else {
          dLayer.appendChild(renderAssetNode(d.item, activeSelectedIds, pipes));
        }
      }
    });
  }, [elements, pipes, selectedIds, scapeMode, isLiveDndActive]);

  // --- Drag & Drop from Sidebar ---
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.json') || file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const json = JSON.parse(ev.target.result);
            loadProcessScapeConfig(json);
          } catch (err) {
            console.error('Failed to parse dropped JSON:', err);
          }
        };
        reader.readAsText(file);
        return;
      }
    }
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    try {
      const data = JSON.parse(rawData);
      saveHistory('Add Item');
      const w = clientToWorld(e.clientX, e.clientY);
      const dropX = snap(w.x);
      const dropY = snap(w.y);

      if (data.kind === 'asset') {
        const def = ASSET_DEFS[data.key] || { w: 120, h: 120, defaultTag: data.key };
        const newNode = {
          id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: data.key,
          tag: def.defaultTag,
          x: dropX,
          y: dropY,
          w: def.w,
          h: def.h,
          colorTheme: 'blue',
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
      } else if (data.kind === 'text_note') {
        const newNote = {
          id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'text_note',
          text: 'Modbus / RTU',
          fontSize: 12,
          color: '#64748b',
          x: dropX,
          y: dropY,
          zIndex: 30
        };
        saveHistory('Add Text Note');
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

  const handleMouseDown = (e) => {
    if (e.target.closest('.canvas-floating-hud') || e.target.closest('.ps-inspector-toggle-float')) {
      return;
    }

    const w = clientToWorld(e.clientX, e.clientY);

    // Bounding Box Handle Drag (works in runtime and editor modes)
    if (isBoundsResizerActive && resizingBox) {
      const handleEl = e.target.closest('.ps-bounds-handle');
      if (handleEl) {
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

      // In runtime mode, left-click or middle-click pans the plant diagram smoothly
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        dragRef.current.isPanning = true;
        dragRef.current.didPan = false;
        dragRef.current.panStart = { x: e.clientX - view.x, y: e.clientY - view.y };
        if (viewportRef.current) viewportRef.current.classList.add('is-panning');
      }
      return;
    }

    // Workspace Pan (Middle click, Right click, Spacebar held, or Pan Tool)
    if (e.button === 1 || e.button === 2 || currentTool === 'pan' || isSpacePressedRef.current) {
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

      if (e.shiftKey) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          const allSelected = idsToSelect.every(id => next.has(id));
          if (allSelected) {
            idsToSelect.forEach(id => next.delete(id));
          } else {
            idsToSelect.forEach(id => next.add(id));
          }
          return next;
        });
      } else {
        const isAlreadySelected = idsToSelect.every(id => selectedIds.has(id));
        if (!isAlreadySelected) {
          setSelectedIds(new Set(idsToSelect));
        }
        setIsInspectorOpen(true);
      }

      dragRef.current.isDragging = true;
      dragRef.current.dragStart = { x: w.x, y: w.y };
      const origs = new Map();
      const effectiveIds = new Set(selectedIds);
      idsToSelect.forEach(id => effectiveIds.add(id));

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
      // Also track any sensor cards attached to elements being moved
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

      // Helper: check if a pipe is horizontal
      const isPipeHoriz = (p) => {
        if (!p.points || p.points.length < 2) return false;
        return p.points.every(pt => Math.abs(pt.y - p.points[0].y) <= 3);
      };

      // 1. Automatically extend or contract pipe lengths along horizontal and vertical axes
      // Horizontal pipes extend their length horizontally, while preserving V position (no vertical drift)
      const updatedPipes = origPipes.map(p => {
        const pipeIsHoriz = isPipeHoriz(p);
        const newPoints = (p.points || []).map((pt, ptIdx, pts) => {
          const px = Math.round(updatedBox.x + (pt.x - origBox.x) * sx);
          let py;
          if (pipeIsHoriz) {
            // Horizontal pipe: V position does not change (only translates if top box boundary shifts)
            py = Math.round(pt.y + shiftY);
          } else {
            const prev = pts[ptIdx - 1];
            const next = pts[ptIdx + 1];
            const segHoriz = (prev && Math.abs(prev.y - pt.y) <= 2) || (next && Math.abs(next.y - pt.y) <= 2);
            const segVert = (prev && Math.abs(prev.x - pt.x) <= 2) || (next && Math.abs(next.x - pt.x) <= 2);
            if (segHoriz && !segVert) {
              py = Math.round(pt.y + shiftY);
            } else {
              py = Math.round(updatedBox.y + (pt.y - origBox.y) * sy);
            }
          }
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
      // A machine touching a horizontal pipe line:
      // - In H direction: follows percent size (sx) along the pipe ("very good")
      // - In V direction: does NOT change V position ("it should not change the V position")
      const posMap = new Map();

      origElements.forEach(el => {
        if (el.type === 'sensor_card' && el.attachedAssetId) return; // Follows parent asset in pass 2

        const elW = el.w || 100;
        const elH = el.h || 80;
        const elLeft = el.x - elW / 2;
        const elRight = el.x + elW / 2;

        let touchesHorizPipe = false;
        for (const p of origPipes) {
          if (!p.points || p.points.length < 2) continue;
          const isExplicitAttached = el.attachedPipeId && el.attachedPipeId === p.id;

          for (let i = 0; i < p.points.length - 1; i++) {
            const p1 = p.points[i];
            const p2 = p.points[i + 1];
            if (Math.abs(p1.y - p2.y) > 3) continue;

            const pipeY = (p1.y + p2.y) / 2;
            const pMinX = Math.min(p1.x, p2.x) - 30;
            const pMaxX = Math.max(p1.x, p2.x) + 30;

            if (elRight >= pMinX && elLeft <= pMaxX) {
              const pipeThickness = p.w || 20;
              const distY = Math.abs(el.y - pipeY);
              if (isExplicitAttached || distY <= (elH / 2 + pipeThickness / 2 + 30)) {
                touchesHorizPipe = true;
                break;
              }
            }
          }
          if (touchesHorizPipe) break;
        }

        const newX = Math.round(updatedBox.x + (el.x - origBox.x) * sx);
        let newY;
        if (touchesHorizPipe) {
          // Machine touching horizontal pipe: V position does NOT change
          newY = Math.round(el.y + shiftY);
        } else {
          newY = Math.round(updatedBox.y + (el.y - origBox.y) * sy);
        }

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
        return pos ? { ...el, x: pos.x, y: pos.y } : el;
      });
      boundsBoxRef.current.currentElements = updatedElements;
      setElements(updatedElements);
      return;
    }

    // Live DND Measurement Point dragging in runtime mode
    if (dragRef.current.draggingLiveCard) {
      const { cardId, startMouse, origPos } = dragRef.current.draggingLiveCard;
      const dx = snap(w.x - startMouse.x, 5);
      const dy = snap(w.y - startMouse.y, 5);
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
        // Equipment / Text Note: pipe snap to a specific pipe branch
        // Only snap to pipe if user dragged cursor away from origin and cursor is close to pipe
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
        const anchorPt = (closestPipe && closestData) ? closestData.point : { x: targetX, y: targetY };

        // Dynamic dashed connection line
        iLayer.appendChild(svgEl('line', {
          x1: el.x, y1: el.y, x2: anchorPt.x, y2: anchorPt.y,
          stroke: closestPipe ? '#00ac86' : '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '5 3'
        }));

        // Moving anchor reticle following cursor / snapped pipe contact
        const reticleG = svgEl('g', { transform: `translate(${anchorPt.x}, ${anchorPt.y})` });
        reticleG.appendChild(svgEl('circle', {
          class: 'anchor-handle-core',
          cx: 0, cy: 0, r: 8,
          fill: closestPipe ? '#00ac86' : '#0284c7', stroke: '#ffffff', 'stroke-width': 2.5
        }));
        reticleG.appendChild(svgEl('line', { x1: -4, y1: 0, x2: 4, y2: 0, stroke: '#ffffff', 'stroke-width': 1.5 }));
        reticleG.appendChild(svgEl('line', { x1: 0, y1: -4, x2: 0, y2: 4, stroke: '#ffffff', 'stroke-width': 1.5 }));
        iLayer.appendChild(reticleG);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (dragRef.current.isPanning) {
      dragRef.current.isPanning = false;
      if (viewportRef.current) {
        viewportRef.current.classList.remove('is-panning');
        if (currentTool !== 'pan' && !isSpacePressedRef.current) {
          viewportRef.current.classList.remove('panning');
        }
      }
    }

    if (dragRef.current.draggingBoundsHandle) {
      dragRef.current.draggingBoundsHandle = null;
    }

    if (scapeMode === 'runtime') {
      if (dragRef.current.draggingLiveCard) {
        const { cardId } = dragRef.current.draggingLiveCard;
        dragRef.current.draggingLiveCard = null;
        setElements(prev => {
          const updated = prev.map(el => {
            if (el.id !== cardId) return el;
            let closestTarget = null;
            let minD = 90;
            prev.forEach(other => {
              if (other.id !== el.id && other.type !== 'sensor_card') {
                const d = Math.hypot(other.x - el.x, other.y - el.y);
                if (d < minD) {
                  minD = d;
                  closestTarget = other;
                }
              }
            });
            if (closestTarget) {
              return {
                ...el,
                attachedAssetId: closestTarget.id,
                targetOffsetX: el.x - closestTarget.x,
                targetOffsetY: el.y - closestTarget.y
              };
            }
            return el;
          });
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
          let closestTarget = null;
          let minD = 90;
          prev.forEach(other => {
            if (other.id !== el.id && other.type !== 'sensor_card') {
              const d = Math.hypot(other.x - el.x, other.y - el.y);
              if (d < minD) {
                minD = d;
                closestTarget = other;
              }
            }
          });
          if (closestTarget) {
            return {
              ...el,
              attachedAssetId: closestTarget.id,
              targetOffsetX: el.x - closestTarget.x,
              targetOffsetY: el.y - closestTarget.y
            };
          } else if (el.attachedAssetId) {
            const existingTarget = prev.find(p => p.id === el.attachedAssetId);
            if (existingTarget) {
              const d = Math.hypot(existingTarget.x - el.x, existingTarget.y - el.y);
              if (d > 220) {
                const detached = { ...el };
                delete detached.attachedAssetId;
                delete detached.targetOffsetX;
                delete detached.targetOffsetY;
                return detached;
              } else {
                return {
                  ...el,
                  targetOffsetX: el.x - existingTarget.x,
                  targetOffsetY: el.y - existingTarget.y
                };
              }
            }
          }
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
        // Equipment / Text Note: bind anchor to a specific pipe branch
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
          setElements(prev => prev.map(item => {
            if (item.id !== elId) return item;
            return {
              ...item,
              attachedPipeId: closestPipe.id,
              pipeT: tVal,
              pipeOffsetX: item.x - contactPt.x,
              pipeOffsetY: item.y - contactPt.y
            };
          }));
        } else {
          saveHistory('Detach Anchor from Pipe');
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
        if (nextSelected.size > 0) {
          setIsInspectorOpen(true);
        }
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

  const handleClick = (e) => {
    if (scapeMode === 'runtime') return;
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
      setIsInspectorOpen(true);
    }
  };

  // Keep mouse handlers continuously attached to window for smooth drag & pan
  const mouseHandlersRef = useRef({ move: handleMouseMove, up: handleMouseUp });
  mouseHandlersRef.current = { move: handleMouseMove, up: handleMouseUp };

  useEffect(() => {
    const onMouseMove = (e) => mouseHandlersRef.current.move(e);
    const onMouseUp = (e) => {
      setIsRealSizePreview(false);
      mouseHandlersRef.current.up(e);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
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
        setView(v => ({
          ...v,
          x: v.x - e.deltaX,
          y: v.y - e.deltaY
        }));
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  // Keyboard Delete & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

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
          setCurrentTool('pan');
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
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          focusSelectedOrCenter();
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
              const updated = { ...el };
              delete updated.attachedPipeId;
              delete updated.pipeT;
              delete updated.pipeOffsetX;
              delete updated.pipeOffsetY;
              return updated;
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
  }, [currentTool, selectedIds, saveHistory, undo, redo, bringToFront, sendToBack, focusSelectedOrCenter]);

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
  const showInspector = (scapeMode === 'editor') && isInspectorOpen && hasSelection;

  const prevSelectedIdsSizeRef = useRef(selectedIds.size);
  useEffect(() => {
    if (selectedIds.size > 0 && prevSelectedIdsSizeRef.current === 0) {
      setIsInspectorOpen(true);
    } else if (selectedIds.size === 0) {
      setIsInspectorOpen(false);
    }
    prevSelectedIdsSizeRef.current = selectedIds.size;
  }, [selectedIds]);

  const updateSelectedElement = (fields) => {
    if (!singleSelectedElement) return;
    saveHistory('Update Element Config');
    setElements(prev => prev.map(el => el.id === singleSelectedElement.id ? { ...el, ...fields } : el));
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
    clone.querySelector('.ps-real-bounds-guide')?.remove();
    clone.querySelector('.ps-bounds-resizer-group')?.remove();
    clone.querySelector('#interactionLayer')?.remove();
    clone.querySelectorAll('.pipe-extend-group')?.forEach(e => e.remove());
    clone.querySelectorAll('.pipe-drag-handle')?.forEach(e => e.remove());
    clone.querySelectorAll('.element-anchor-handle')?.forEach(e => e.remove());

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

    if (data.tempCanvasSize) {
      setScreenSize({
        w: data.tempCanvasSize.width || data.tempCanvasSize.w || 1024,
        h: data.tempCanvasSize.height || data.tempCanvasSize.h || 800
      });
    } else if (data.screenSize) {
      setScreenSize({
        w: data.screenSize.width || data.screenSize.w || 1024,
        h: data.screenSize.height || data.screenSize.h || 800
      });
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
          colorTheme: el.colorTheme || 'blue',
          x: typeof el.x === 'number' ? el.x : 0,
          y: typeof el.y === 'number' ? el.y : 0,
          w: el.w,
          h: el.h,
          zIndex: el.zIndex != null ? el.zIndex : (el.type === 'text_note' ? 30 : 20),
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
        loadProcessScapeConfig(data, true);
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
  }, [loadProcessScapeConfig]);

  const reloadActiveScape = useCallback((targetScapeId = null) => {
    if (targetScapeId) {
      setActiveScapeId(targetScapeId);
      setActiveScapeIdState(targetScapeId);
    }
    const all = getAllScapes();
    const active = targetScapeId ? all.find(s => s.id === targetScapeId) : getActiveScape();
    if (active) {
      loadProcessScapeConfig(active, false);
    }
  }, [loadProcessScapeConfig]);

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
        reloadActiveScape
      });
    }
  }, [onRegisterActions, undo, redo, handleZoomFit, handleExportJson, handleExportPng, handleImportJson, handleSaveAndExitEditor, changeScapeMode, reloadActiveScape]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        screenSize,
        finalSize: { width: contentBounds.width, height: contentBounds.height },
        projectTitle,
        scapeMode
      });
    }
  }, [screenSize, contentBounds, projectTitle, scapeMode, onStateChange]);

  return (
    <div className={`processscape-root ${isDarkMode ? 'theme-dark' : ''}`}>
      {/* Main 3-Column Workbench */}
      <div className="ps-workbench">
        {/* Left Sidebar Palette (Editor Mode only) */}
        {scapeMode === 'editor' && (
          <aside className="ps-sidebar">
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
                    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'asset', key: type }));
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
                    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'sensor_card', key }));
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
                      e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'pipe_preset', key: p.id }));
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

              const renderTextNoteCard = () => (
                <div
                  key="text_note"
                  className="ps-palette-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'text_note', key: 'text_note' }));
                  }}
                >
                  <div
                    className="ps-card-icon-box"
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: 16,
                      color: '#64748b'
                    }}
                  >
                    T
                  </div>
                  <div className="ps-card-info">
                    <div className="ps-card-title">Text Note / Label</div>
                    <div className="ps-card-desc">Editable text annotation (e.g. Modbus, Tag, Zone)</div>
                  </div>
                </div>
              );

              if (activePaletteTab === 'all') {
                return (
                  <>
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'sensors').map(([t, d]) => renderAssetCard(t, d))}
                    {PIPE_PRESETS.map(p => renderPipePresetCard(p))}
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'machines').map(([t, d]) => renderAssetCard(t, d))}
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'vessels').map(([t, d]) => renderAssetCard(t, d))}
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'gateways').map(([t, d]) => renderAssetCard(t, d))}
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'others').map(([t, d]) => renderAssetCard(t, d))}
                    {renderTextNoteCard()}
                  </>
                );
              }
              if (activePaletteTab === 'sensors') {
                return (
                  <>
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'sensors').map(([t, d]) => renderAssetCard(t, d))}
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
              if (activePaletteTab === 'gateways') {
                return Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'gateways').map(([t, d]) => renderAssetCard(t, d));
              }
              if (activePaletteTab === 'others') {
                return (
                  <>
                    {Object.entries(ASSET_DEFS).filter(([_, d]) => !d.isAlias && d.category === 'others').map(([t, d]) => renderAssetCard(t, d))}
                    {renderTextNoteCard()}
                  </>
                );
              }
              return null;
            })()}
          </div>

          {tipVisible && (
            <div className="ps-sidebar-footer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ color: '#00a876', fontSize: 10, textTransform: 'uppercase' }}>💡 Pro Tip</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#00a876' }}
                    onClick={() => setTipIndex((tipIndex + 1) % TIPS_LIST.length)}
                  >
                    Next →
                  </button>
                  <button
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#94a3b8' }}
                    onClick={() => setTipVisible(false)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div dangerouslySetInnerHTML={{ __html: TIPS_LIST[tipIndex] }} />
            </div>
          )}
        </aside>
      )}

        {/* Center Canvas Viewport */}
        <main
          ref={viewportRef}
          className={`ps-canvas-viewport ${currentTool === 'pan' || isSpacePressed ? 'panning' : ''} ${currentTool === 'draw_pipe' ? 'drawing-pipe' : ''}`}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
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
                  title="Select Tool (V)"
                  aria-label="Select Tool"
                >
                  <HudIcons.Select />
                </button>
                <button
                  id="toolPan"
                  type="button"
                  className={`hud-icon-btn ${currentTool === 'pan' ? 'active' : ''}`}
                  onClick={() => {
                    dragRef.current.drawingPipeStart = null;
                    dragRef.current.extendingPipe = null;
                    if (interactionLayerRef.current) interactionLayerRef.current.innerHTML = '';
                    setCurrentTool('pan');
                  }}
                  title="Pan Tool (H or hold Space)"
                  aria-label="Pan Tool"
                >
                  <HudIcons.Pan />
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

              {contentBounds.hasContent && (
                <>
                  <div className="hud-divider" />
                  <button
                    id="toolRealSize"
                    type="button"
                    className={`hud-icon-btn ${isRealSizePreview ? 'active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); setIsRealSizePreview(true); }}
                    onMouseUp={() => setIsRealSizePreview(false)}
                    onMouseLeave={() => setIsRealSizePreview(false)}
                    onTouchStart={(e) => { e.preventDefault(); setIsRealSizePreview(true); }}
                    onTouchEnd={() => setIsRealSizePreview(false)}
                    title={`Hold to preview Real Picture Size (${contentBounds.width}×${contentBounds.height}px)`}
                    aria-label="Real Size Preview"
                  >
                    <HudIcons.RealSize />
                  </button>
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

          {/* Floating Inspector Reopen Button (when Inspector is closed but an element is selected) */}
          {(scapeMode === 'editor') && !showInspector && hasSelection && (
            <div className="ps-inspector-toggle-float">
              <button
                className="hud-btn"
                onClick={() => setIsInspectorOpen(true)}
                title="Open Inspector Panel"
              >
                <span>⚙️</span> Inspector
              </button>
            </div>
          )}

          {/* Bottom Floating Canvas Tools HUD in Modify Scape (Editor Mode only) */}
          {scapeMode === 'editor' && (
            <div className="canvas-floating-hud zoom-hud" id="psModifyPageTools">
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
                id="toolModifyBoundsResizer"
                type="button"
                className={`hud-icon-btn ${isBoundsResizerActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleBoundsResizer();
                }}
                title={isBoundsResizerActive ? "Confirm & Apply New Diagram Size" : "Optimal Diagram Bounds Resizer (Auto-scale pipes to screen)"}
                aria-label="Diagram Bounds Resizer"
              >
                <HudIcons.BoundsScale />
              </button>

              <div className="hud-divider" />

              <span
                className="ps-canvas-size-badge"
                title={`Whole Canvas Size: ${screenSize.w} × ${screenSize.h} px`}
              >
                {screenSize.w}×{screenSize.h}
              </span>
            </div>
          )}

          {/* Bottom Floating Canvas Tools HUD in Live View (Runtime Mode) */}
          {scapeMode === 'runtime' && (
            <div className="canvas-floating-hud zoom-hud ps-runtime-page-tools" id="psRuntimePageTools">
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

              <button
                id="toolRuntimeZoomFit"
                type="button"
                className="hud-icon-btn"
                onClick={focusSelectedOrCenter}
                title="Focus / Fit Whole Canvas (F)"
                aria-label="Focus / Fit Whole Canvas"
              >
                <HudIcons.ZoomFit />
              </button>

              <div className="hud-divider" />

              {/* Status toggle to enable/disable DND of measurement point card & anchor position */}
              <button
                id="toolRuntimeDndToggle"
                type="button"
                className={`hud-icon-btn ${isLiveDndActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsLiveDndActive(prev => !prev);
                }}
                title={isLiveDndActive ? "Disable Card & Anchor Dragging" : "Enable Card & Anchor Dragging (Live DND)"}
                aria-label="Toggle Measurement Point DND"
              >
                <HudIcons.LiveDnd />
              </button>

              {/* Diagram Bounding Box Resizer Tool */}
              <button
                id="toolRuntimeBoundsResizer"
                type="button"
                className={`hud-icon-btn ${isBoundsResizerActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleBoundsResizer();
                }}
                title={isBoundsResizerActive ? "Confirm & Apply New Diagram Size" : "Optimal Diagram Bounds Resizer (Auto-scale pipes to screen)"}
                aria-label="Diagram Bounds Resizer"
              >
                <HudIcons.BoundsScale />
              </button>

              <div className="hud-divider" />

              <span
                className="ps-canvas-size-badge"
                title={`Current Diagram Size: ${screenSize.w} × ${screenSize.h} px`}
              >
                {screenSize.w}×{screenSize.h}
              </span>
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
              {/* Screen Boundary Guide (Temporary canvas drawing area in editor mode) */}
              {scapeMode !== 'runtime' && (
                <rect
                  id="boundaryGuide"
                  x={0} y={0}
                  width={screenSize.w} height={screenSize.h}
                  rx={12}
                  fill="#ffffff"
                  stroke={isDarkMode ? '#1e293b' : '#cbd5e1'}
                  strokeWidth={2}
                  strokeDasharray="8 6"
                />
              )}

              {/* Dynamic Real Picture Bounds Guide (Shown only when holding 'Real Size' button) */}
              {isRealSizePreview && contentBounds.hasContent && (
                <g className="ps-real-bounds-guide" pointerEvents="none">
                  <rect
                    x={contentBounds.x}
                    y={contentBounds.y}
                    width={contentBounds.width}
                    height={contentBounds.height}
                    rx={6}
                    fill="rgba(0, 172, 134, 0.08)"
                    stroke="#00ac86"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    opacity={0.9}
                  />
                  <g transform={`translate(${contentBounds.x + 8}, ${contentBounds.y - 8})`}>
                    <rect x={-4} y={-14} width={154} height={18} rx={4} fill="#0f172a" opacity={0.92} />
                    <text x={4} y={-1} fontSize={10} fontWeight={700} fill="#ffffff" fontFamily="ui-monospace, monospace">
                      📐 Real Size: {contentBounds.width}×{contentBounds.height}px
                    </text>
                  </g>
                </g>
              )}

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

        {/* Right Inspector Panel (Editor Mode only) */}
        {scapeMode === 'editor' && (
          <aside className={`ps-inspector ${showInspector ? '' : 'collapsed'}`}>
          <div className="ps-inspector-header">
            <div className="ps-inspector-title">
              {singleSelectedElement
                ? (singleSelectedElement.tag || singleSelectedElement.text || 'Item Config')
                : isPipeSelection
                ? (selectedPipes.length > 1
                    ? `Pipeline (${selectedPipes.length} segments)`
                    : 'Pipe Config')
                : 'Inspector'}
            </div>
            <button
              type="button"
              className="ps-inspector-close-btn"
              onClick={() => setIsInspectorOpen(false)}
              title="Close Inspector"
              aria-label="Close Inspector"
            >
              ✕
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

                <button
                  type="button"
                  className="hud-btn-sm btn-danger-outline"
                  style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    saveHistory('Delete Sensor');
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
                  }}
                >
                  🗑 Delete Sensor Card
                </button>
              </>
            ) : singleSelectedElement ? (
              /* Equipment / Asset Node Inspector */
              <>
                <div className="ps-form-group">
                  <label className="ps-form-label">Equipment Tag Name</label>
                  <input
                    className="ps-input"
                    value={singleSelectedElement.tag || ''}
                    onChange={(e) => updateSelectedElement({ tag: e.target.value })}
                  />
                </div>

                {/* Solid Flat Color Theme Swatches (strictly zero gradients) */}
                <div className="ps-form-group">
                  <label className="ps-form-label">Color Theme</label>
                  <div className="ps-swatches-grid">
                    {Object.values(EQUIPMENT_COLOR_THEMES).map(theme => (
                      <div
                        key={theme.id}
                        className={`ps-swatch-item ${(singleSelectedElement.colorTheme || 'blue') === theme.id ? 'active' : ''}`}
                        onClick={() => {
                          saveHistory('Change Theme');
                          updateSelectedElement({ colorTheme: theme.id });
                        }}
                      >
                        <div className="ps-swatch-circle" style={{ background: theme.main }} />
                        <span className="ps-swatch-name">{theme.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pipeline Anchor Binding (Branch Percentage Binding) */}
                <div className="ps-form-group">
                  <label className="ps-form-label">Pipeline Anchor Binding</label>
                  {singleSelectedElement.attachedPipeId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        background: 'rgba(0, 172, 134, 0.08)',
                        border: '1px solid rgba(0, 172, 134, 0.25)',
                        borderRadius: 6,
                        padding: '6px 10px'
                      }}>
                        <span style={{ fontWeight: 600, color: '#00ac86' }}>
                          ⚓ Bound ({Math.round((singleSelectedElement.pipeT || 0) * 100)}%)
                        </span>
                        <button
                          type="button"
                          className="hud-btn-sm"
                          style={{ fontSize: 10, height: 22, padding: '0 8px' }}
                          onClick={() => {
                            saveHistory('Detach Anchor');
                            updateSelectedElement({
                              attachedPipeId: null,
                              pipeT: null,
                              pipeOffsetX: null,
                              pipeOffsetY: null
                            });
                          }}
                        >
                          Detach
                        </button>
                      </div>

                      {/* Percentage slider along specific pipe branch */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>0%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          style={{ flex: 1, accentColor: '#00ac86' }}
                          value={Math.round((singleSelectedElement.pipeT || 0) * 100)}
                          onChange={(e) => {
                            const newPct = parseInt(e.target.value, 10);
                            const newT = newPct / 100;
                            const pipe = pipes.find(p => p.id === singleSelectedElement.attachedPipeId);
                            if (pipe) {
                              const newPt = getPointAlongPipe(pipe, newT);
                              const oldPt = getPointAlongPipe(pipe, singleSelectedElement.pipeT || 0);
                              const dx = (newPt && oldPt) ? newPt.x - oldPt.x : 0;
                              const dy = (newPt && oldPt) ? newPt.y - oldPt.y : 0;
                              updateSelectedElement({
                                pipeT: newT,
                                x: singleSelectedElement.x + dx,
                                y: singleSelectedElement.y + dy
                              });
                            } else {
                              updateSelectedElement({ pipeT: newT });
                            }
                          }}
                        />
                        <span style={{ fontSize: 11, color: '#64748b', minWidth: 36, textAlign: 'right', fontWeight: 600 }}>
                          {Math.round((singleSelectedElement.pipeT || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                      Free floating. Drag the ⚓ anchor handle onto any pipe branch to bind.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="hud-btn-sm btn-danger-outline"
                  style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    saveHistory('Delete Equipment');
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
                  }}
                >
                  🗑 Delete Equipment
                </button>
              </>
            ) : isPipeSelection && representativePipe ? (
              /* Pipe Inspector (Works for both single pipe and grouped pipelines) */
              <>
                {selectedPipes.length > 1 && (
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
                  <label className="ps-form-label">Medium Type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={`hud-btn-sm ${representativePipe.medium === 'gas' ? 'btn-primary' : ''}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => updateSelectedPipe({ medium: 'gas' })}
                    >
                      Gas (Grey)
                    </button>
                    <button
                      type="button"
                      className={`hud-btn-sm ${representativePipe.medium === 'liquid' ? 'btn-primary' : ''}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => updateSelectedPipe({ medium: 'liquid' })}
                    >
                      Liquid (Blue)
                    </button>
                  </div>
                </div>

                <div className="ps-form-group">
                  <label className="ps-form-label">Pipe Thickness ({representativePipe.w || 20}px)</label>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    step="2"
                    value={representativePipe.w || 20}
                    onChange={(e) => updateSelectedPipe({ w: parseInt(e.target.value, 10) })}
                  />
                </div>

                {selectedPipes.length === 1 && (
                  <div className="ps-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="ps-form-label" style={{ margin: 0 }}>Pipe Length</label>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#00ac86', fontWeight: 600 }}>
                        {singlePipeLength}px
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="range"
                        min="20"
                        max="1200"
                        step="10"
                        style={{ flex: 1 }}
                        value={singlePipeLength}
                        onChange={(e) => handleUpdatePipeLength(parseInt(e.target.value, 10))}
                      />
                      <input
                        type="number"
                        className="ps-input"
                        style={{ width: 70, textAlign: 'right', padding: '4px 6px', fontSize: 12 }}
                        min="10"
                        max="4000"
                        step="10"
                        value={singlePipeLength}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 10) {
                            handleUpdatePipeLength(val);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

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

                <button
                  type="button"
                  className="hud-btn-sm btn-danger-outline"
                  style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
                  onClick={() => {
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
                  }}
                >
                  🗑 Delete Pipeline {selectedPipes.length > 1 ? `(${selectedPipes.length} segments)` : ''}
                </button>
              </>
            ) : null}
          </div>
        </aside>
        )}
      </div>

      {/* Scape Manager Dialog for switching, creating, and modifying plant environments */}
      <ScapeManagerModal
        isOpen={isScapeManagerOpen}
        onClose={() => setIsScapeManagerOpen(false)}
        onSelectActiveScape={handleSelectActiveScape}
        onEditScape={handleEditScapeFromManager}
      />
    </div>
  );
}
