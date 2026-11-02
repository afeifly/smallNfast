import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProcessScapeView from './ProcessScapeView.jsx';
import { ASSET_DEFS, PIPE_PRESETS, SENSOR_CARD_TEMPLATES } from './engine/constants.js';
import { renderAssetPaletteIcon } from './engine/paletteIcons.jsx';
import {
  pointsToPath,
  getSnapExtensionPoint,
  getSnapOrthogonalPoint,
  getElementBBox,
  getContentBounds,
  arePipesConnected,
  getConnectedPipeIds,
  expandConnectedPipes,
  isPipeEndpointOpen,
  resolvePipelineFlowDirections,
  getPipeLength,
  adjustPipeLength
} from './engine/pipeUtils.js';
import {
  drawBufferTank,
  drawCompressor,
  drawPistonCompressor,
  drawFilterBank,
  drawLaserCutter,
  drawInjectionMolder,
  drawDewPointMeter,
  drawLeakDetector,
  drawCompactFlowMeter,
  drawFlowMeter,
  drawStationaryDisplay,
  drawCase,
  renderPipe,
  renderAssetNode,
  createFlangeInterface
} from './engine/illustrators.js';

describe('ProcessScape Engine & Constants', () => {
  it('PIPE_PRESETS have valid dx and dy offsets and proper media', () => {
    expect(PIPE_PRESETS.length).toBe(4);
    PIPE_PRESETS.forEach(preset => {
      expect(preset.points.length).toBeGreaterThanOrEqual(2);
      preset.points.forEach(pt => {
        expect(typeof pt.dx).toBe('number');
        expect(typeof pt.dy).toBe('number');
        expect(Number.isNaN(pt.dx)).toBe(false);
        expect(Number.isNaN(pt.dy)).toBe(false);
      });
      expect(['gas', 'liquid']).toContain(preset.medium);
    });
  });

  it('ASSET_DEFS contains complete equipment catalog matching gas-pipeline', () => {
    const requiredTypes = [
      'tank_buffer',
      'cylinder_bank',
      'tank_horizontal',
      'tank_cryogenic',
      'tank_spherical',
      'tank_separator',
      'machine_compressor',
      'machine_compressor_piston',
      'machine_dryer',
      'machine_chiller',
      'filter_line',
      'filter_stage3',
      'machine_pump',
      'machine_cnc',
      'machine_robot',
      'machine_laser',
      'machine_injection',
      'logger_cabinet',
      'logger_case',
      'dewpoint_meter',
      'leak_detection',
      'compact_flow_meter',
      'flow_meter',
      'wall_perimeter_h',
      'wall_perimeter_v'
    ];

    requiredTypes.forEach(type => {
      expect(ASSET_DEFS[type], `Missing asset def for ${type}`).toBeDefined();
      expect(ASSET_DEFS[type].w).toBeGreaterThan(0);
      expect(ASSET_DEFS[type].h).toBeGreaterThan(0);
      expect(ASSET_DEFS[type].category).toBeDefined();
    });
  });

  it('renderAssetPaletteIcon generates SVG vector graphics for all assets', () => {
    Object.entries(ASSET_DEFS).forEach(([type, def]) => {
      const { container } = render(<div>{renderAssetPaletteIcon(type, def)}</div>);
      // Either an svg or div (for masonry brick walls)
      const element = container.querySelector('svg') || container.querySelector('div');
      expect(element, `Icon for ${type} did not render`).not.toBeNull();
    });
  });

  it('equipment drawing functions return valid SVG nodes without errors', () => {
    const fakeNode = { id: 'test_node', x: 100, y: 100, tag: 'Test Unit' };
    const bufferTankG = drawBufferTank(fakeNode);
    expect(bufferTankG.tagName.toLowerCase()).toBe('g');

    const compressorG = drawCompressor(fakeNode);
    expect(compressorG.tagName.toLowerCase()).toBe('g');

    const pistonG = drawPistonCompressor(fakeNode);
    expect(pistonG.tagName.toLowerCase()).toBe('g');

    const filterBankG = drawFilterBank(fakeNode);
    expect(filterBankG.tagName.toLowerCase()).toBe('g');

    const laserG = drawLaserCutter(fakeNode);
    expect(laserG.tagName.toLowerCase()).toBe('g');

    const injectionG = drawInjectionMolder(fakeNode);
    expect(injectionG.tagName.toLowerCase()).toBe('g');

    // Physical sensor transmitters & detectors
    const dewPointG = drawDewPointMeter(fakeNode);
    expect(dewPointG.tagName.toLowerCase()).toBe('g');
    expect(dewPointG.innerHTML).toContain('-49.2');
    expect(dewPointG.innerHTML).toContain('°C Td');
    expect(dewPointG.innerHTML).toContain('.SUTO');

    const leakG = drawLeakDetector(fakeNode);
    expect(leakG.tagName.toLowerCase()).toBe('g');
    expect(leakG.innerHTML).toContain('SUTO S530');
    expect(leakG.innerHTML).toContain('75 dB');
    expect(leakG.innerHTML).toContain('GRADE 3');

    const compactFlowG = drawCompactFlowMeter(fakeNode);
    expect(compactFlowG.tagName.toLowerCase()).toBe('g');
    expect(compactFlowG.innerHTML).toContain('183.6');
    expect(compactFlowG.innerHTML).toContain('.SUTO');
    expect(compactFlowG.innerHTML).toContain('lpm');

    const flowMeterG = drawFlowMeter(fakeNode);
    expect(flowMeterG.tagName.toLowerCase()).toBe('g');
    expect(flowMeterG.innerHTML).toContain('37.3');
    expect(flowMeterG.innerHTML).toContain('m³/h');
    expect(flowMeterG.innerHTML).toContain('6.2 bar');
    expect(flowMeterG.innerHTML).toContain('.SUTO');

    // Stationary displays and field cases
    const stationaryG = drawStationaryDisplay(fakeNode);
    expect(stationaryG.tagName.toLowerCase()).toBe('g');
    expect(stationaryG.innerHTML).toContain('.SUT');
    expect(stationaryG.innerHTML).toContain('MENU');

    const caseG = drawCase(fakeNode);
    expect(caseG.tagName.toLowerCase()).toBe('g');
    expect(caseG.innerHTML).toContain('SUTO');
  });

  it('pointsToPath correctly formats SVG path string', () => {
    const pts = [{ x: 100, y: 150 }, { x: 260, y: 150 }];
    const path = pointsToPath(pts);
    expect(path).toBe('M 100,150 L 260,150');
  });

  it('getSnapOrthogonalPoint snaps coordinates to orthogonal horizontal or vertical', () => {
    const pStart = { x: 100, y: 100 };
    // Predominantly horizontal movement
    const snapH = getSnapOrthogonalPoint(pStart, { x: 253, y: 112 });
    expect(snapH.y).toBe(100);
    expect(snapH.x).toBe(250);

    // Predominantly vertical movement
    const snapV = getSnapOrthogonalPoint(pStart, { x: 112, y: 318 });
    expect(snapV.x).toBe(100);
    expect(snapV.y).toBe(320);
  });

  it('getSnapExtensionPoint calculates valid extension endpoints', () => {
    const pipe = {
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }]
    };
    const extending = { pipe, end: 'end' };
    const pt = getSnapExtensionPoint(extending, { x: 450, y: 100 });
    expect(pt.y).toBe(100);
    expect(pt.x).toBe(450);
  });

  it('getPipeLength calculates correct total pixel length', () => {
    const pipeH = { points: [{ x: 100, y: 100 }, { x: 350, y: 100 }] };
    expect(getPipeLength(pipeH)).toBe(250);

    const pipeV = { points: [{ x: 50, y: 50 }, { x: 50, y: 250 }] };
    expect(getPipeLength(pipeV)).toBe(200);

    const pipeMulti = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
    expect(getPipeLength(pipeMulti)).toBe(200);
  });

  it('adjustPipeLength adjusts length while respecting orientation and anchored junctions', () => {
    // Both endpoints open: anchors p0 and extends p1
    const pipeH = { id: 'p1', points: [{ x: 100, y: 100 }, { x: 200, y: 100 }] };
    const extendedH = adjustPipeLength(pipeH, 300, [pipeH]);
    expect(extendedH.points[0]).toEqual({ x: 100, y: 100 });
    expect(extendedH.points[1]).toEqual({ x: 400, y: 100 });
    expect(extendedH.d).toBe('M 100,100 L 400,100');

    // p1 connected to another pipe at (200, 100), p0 open: anchors p1 and extends p0
    const junctionPipe = { id: 'p2', points: [{ x: 200, y: 100 }, { x: 200, y: 300 }] };
    const anchoredAdjusted = adjustPipeLength(pipeH, 300, [pipeH, junctionPipe]);
    expect(anchoredAdjusted.points[1]).toEqual({ x: 200, y: 100 });
    expect(anchoredAdjusted.points[0]).toEqual({ x: -100, y: 100 });

    // Vertical pipe: anchors p0, extends p1 vertically
    const pipeV = { id: 'pv', points: [{ x: 100, y: 100 }, { x: 100, y: 200 }] };
    const extendedV = adjustPipeLength(pipeV, 250, [pipeV]);
    expect(extendedV.points[0]).toEqual({ x: 100, y: 100 });
    expect(extendedV.points[1]).toEqual({ x: 100, y: 350 });
  });
});

describe('ProcessScapeView UI, HUD & Navigation', () => {
  it('renders wrapped palette tabs with all categories', () => {
    const { container } = render(<ProcessScapeView />);
    const tabs = container.querySelectorAll('.ps-palette-tab');
    expect(tabs.length).toBe(7);
    expect(tabs[0].textContent).toContain('All');
    expect(tabs[1].textContent).toContain('Sensors');
    expect(tabs[2].textContent).toContain('Pipes');
    expect(tabs[3].textContent).toContain('Tanks & Air');
    expect(tabs[4].textContent).toContain('Machines');
    expect(tabs[5].textContent).toContain('Gateways');
    expect(tabs[6].textContent).toContain('Walls & Others');
  });

  it('renders floating top HUD and floating zoom HUD with all controls', () => {
    const { container } = render(<ProcessScapeView />);

    // Top HUD
    const topHud = container.querySelector('.canvas-floating-hud.top-hud');
    expect(topHud).not.toBeNull();
    expect(container.querySelector('#toolSelect')).not.toBeNull();
    expect(container.querySelector('#toolPan')).not.toBeNull();
    expect(container.querySelector('#toolUndo')).not.toBeNull();
    expect(container.querySelector('#toolRedo')).not.toBeNull();
    // toolDrawPipe and pipeMediumSelector removed as requested
    expect(container.querySelector('#toolDrawPipe')).toBeNull();
    expect(container.querySelector('#pipeMediumSelector')).toBeNull();
    expect(container.querySelector('#hudDimensionSelector')).toBeNull();
    expect(container.querySelector('#hudFrontBtn')).not.toBeNull();
    expect(container.querySelector('#hudBackBtn')).not.toBeNull();
    expect(container.querySelector('#hudDeleteBtn')).not.toBeNull();

    // Zoom HUD
    const zoomHud = container.querySelector('.canvas-floating-hud.zoom-hud');
    expect(zoomHud).not.toBeNull();
    expect(container.querySelector('#zoomOutBtn')).not.toBeNull();
    expect(container.querySelector('#zoomLevelText')).not.toBeNull();
    expect(container.querySelector('#zoomInBtn')).not.toBeNull();
    expect(container.querySelector('#zoomFitBtn')).not.toBeNull();
    expect(container.querySelector('#zoomResetBtn')).not.toBeNull();
    expect(container.querySelector('#zoomFocusBtn')).not.toBeNull();
  });

  it('allows activating Pan tool and updates viewport class to panning', () => {
    const { container } = render(<ProcessScapeView />);
    const viewport = container.querySelector('.ps-canvas-viewport');
    expect(viewport.classList.contains('panning')).toBe(false);

    const panBtn = container.querySelector('#toolPan');
    fireEvent.click(panBtn);
    expect(panBtn.classList.contains('active')).toBe(true);
    expect(viewport.classList.contains('panning')).toBe(true);
  });

  it('calculates real picture bounds with 16px margin to each edge (30x20 element gives 62x52)', () => {
    // Test with a 30x20 element as specifically requested by user
    const sampleElement = {
      id: 'el_test_1',
      type: 'custom_box',
      x: 100,
      y: 100,
      w: 30,
      h: 20
    };
    const bbox = getElementBBox(sampleElement);
    expect(bbox.w).toBe(30);
    expect(bbox.h).toBe(20);

    const bounds = getContentBounds([sampleElement], [], 16);
    expect(bounds.hasContent).toBe(true);
    expect(bounds.contentW).toBe(30);
    expect(bounds.contentH).toBe(20);
    // (16 + 16 + 30) = 62
    expect(bounds.width).toBe(16 + 16 + 30);
    // (16 + 16 + 20) = 52
    expect(bounds.height).toBe(16 + 16 + 20);
    expect(bounds.x).toBe(bbox.x - 16);
    expect(bounds.y).toBe(bbox.y - 16);
  });

  it('hides the inspector by default and when no element is selected, and allows closing/reopening when selected', () => {
    const { container } = render(<ProcessScapeView />);
    const inspector = container.querySelector('aside.ps-inspector');
    expect(inspector).not.toBeNull();

    // 1. By default with no element selected, inspector is hidden (collapsed)
    expect(inspector.classList.contains('collapsed')).toBe(true);
    // Floating reopen button is also NOT shown when no element is selected
    expect(container.querySelector('.ps-inspector-toggle-float')).toBeNull();

    // 2. Select an element by dropping onto canvas
    const viewport = container.querySelector('.ps-canvas-viewport');
    fireEvent.drop(viewport, {
      clientX: 200,
      clientY: 200,
      dataTransfer: {
        getData: (type) => type === 'application/json' ? JSON.stringify({ kind: 'asset', key: 'tank_buffer' }) : ''
      }
    });

    // Now inspector is open and visible
    expect(inspector.classList.contains('collapsed')).toBe(false);

    // 3. Click close button on inspector header
    const closeBtn = container.querySelector('.ps-inspector-close-btn');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);

    // Inspector should now be collapsed (closed)
    expect(inspector.classList.contains('collapsed')).toBe(true);

    // Floating reopen button should appear because an element is selected
    const floatReopenBtn = container.querySelector('.ps-inspector-toggle-float button');
    expect(floatReopenBtn).not.toBeNull();
    fireEvent.click(floatReopenBtn);

    // Inspector should now be opened again
    expect(inspector.classList.contains('collapsed')).toBe(false);

    // 4. Deselect by clicking empty canvas
    fireEvent.mouseDown(viewport, { clientX: 50, clientY: 50 });
    // When no element is selected, inspector is hidden
    expect(inspector.classList.contains('collapsed')).toBe(true);
    expect(container.querySelector('.ps-inspector-toggle-float')).toBeNull();
  });

  it('positions worldGroup safely down from top-hud on initial mount to avoid overlap', () => {
    const { container } = render(<ProcessScapeView />);
    const worldG = container.querySelector('#worldGroup');
    expect(worldG).not.toBeNull();
    const transform = worldG.getAttribute('transform');
    expect(transform).toContain('translate(');
    const match = transform.match(/translate\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
    expect(match).not.toBeNull();
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    expect(x).toBe(20);
    // Must be positioned at y = 78 to safely clear the top floating HUD
    expect(y).toBe(78);
  });

  it('renders Real Size icon button on HUD and keeps bounds guide hidden unless button is held', () => {
    const { container } = render(<ProcessScapeView />);
    const realSizeBtn = container.querySelector('#toolRealSize');
    expect(realSizeBtn).not.toBeNull();
    expect(realSizeBtn.getAttribute('title')).toContain('preview Real Picture Size');
    expect(realSizeBtn.querySelector('svg')).not.toBeNull();
    // Only Gas / Liquid retain text, all other buttons are pure icon buttons
    expect(realSizeBtn.textContent.trim()).toBe('');

    // Bounds guide is NOT shown by default when drawing
    expect(container.querySelector('.ps-real-bounds-guide')).toBeNull();

    // hud-stat-pill is removed as requested
    expect(container.querySelector('.hud-stat-pill')).toBeNull();
  });

  it('renders all buttons in top-hud as consistent icon buttons with undo/redo and no pipeMediumSelector', () => {
    const { container } = render(<ProcessScapeView />);
    const topHud = container.querySelector('.canvas-floating-hud.top-hud');
    expect(topHud).not.toBeNull();

    // pipeMediumSelector is removed from top-hud
    expect(container.querySelector('#pipeMediumSelector')).toBeNull();

    // All buttons in top-hud must be pure icon buttons with consistent SVG icon and NO plain text
    const buttons = Array.from(topHud.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThanOrEqual(6);

    buttons.forEach(btn => {
      expect(btn.classList.contains('hud-icon-btn')).toBe(true);
      expect(btn.textContent.trim()).toBe('');
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
    });

    // Check Undo and Redo buttons exist in top-hud and have proper disabled/enabled states
    const undoBtn = container.querySelector('#toolUndo');
    const redoBtn = container.querySelector('#toolRedo');
    expect(undoBtn).not.toBeNull();
    expect(redoBtn).not.toBeNull();
    expect(undoBtn.hasAttribute('disabled')).toBe(true);
    expect(redoBtn.hasAttribute('disabled')).toBe(true);
  });

  it('dynamically displays W: H: for equipment and L: D: for pipes in top-hud only when selected', () => {
    const { container } = render(<ProcessScapeView />);
    const viewport = container.querySelector('.ps-canvas-viewport');
    expect(viewport).not.toBeNull();

    // 1. With no item selected, dimension selector is NOT shown
    expect(container.querySelector('#hudDimensionSelector')).toBeNull();

    // 2. Select an equipment asset by dropping onto canvas
    fireEvent.drop(viewport, {
      clientX: 200,
      clientY: 200,
      dataTransfer: {
        getData: (type) => type === 'application/json' ? JSON.stringify({ kind: 'asset', key: 'tank_buffer' }) : ''
      }
    });

    // Dimension selector appears with W: and H:
    const dimGroup = container.querySelector('#hudDimensionSelector');
    expect(dimGroup).not.toBeNull();
    expect(dimGroup.textContent).toContain('W:');
    expect(dimGroup.textContent).toContain('H:');
    expect(dimGroup.textContent).not.toContain('L:');
    expect(dimGroup.textContent).not.toContain('D:');

    const wInput = container.querySelector('#hudInputWidth');
    const hInput = container.querySelector('#hudInputHeight');
    expect(wInput).not.toBeNull();
    expect(hInput).not.toBeNull();

    // Update width and height
    fireEvent.change(wInput, { target: { value: '180' } });
    fireEvent.change(hInput, { target: { value: '160' } });
    expect(wInput.value).toBe('180');
    expect(hInput.value).toBe('160');

    // 3. Select a pipe by dropping pipe preset
    fireEvent.drop(viewport, {
      clientX: 400,
      clientY: 300,
      dataTransfer: {
        getData: (type) => type === 'application/json' ? JSON.stringify({ kind: 'pipe_preset', key: 'pipe_gas_h' }) : ''
      }
    });

    // Now dimension selector updates to show L: and D: for pipeline!
    expect(dimGroup.textContent).toContain('L:');
    expect(dimGroup.textContent).toContain('D:');
    expect(dimGroup.textContent).not.toContain('W:');
    expect(dimGroup.textContent).not.toContain('H:');

    const lInput = container.querySelector('#hudInputLength');
    const dInput = container.querySelector('#hudInputDiameter');
    expect(lInput).not.toBeNull();
    expect(dInput).not.toBeNull();

    // Update length and diameter
    fireEvent.change(lInput, { target: { value: '380' } });
    fireEvent.change(dInput, { target: { value: '26' } });
    expect(lInput.value).toBe('380');
    expect(dInput.value).toBe('26');
  });

  it('initializes default canvas size to 1024x800', () => {
    const { container } = render(<ProcessScapeView />);
    const boundaryGuide = container.querySelector('#boundaryGuide');
    expect(boundaryGuide).not.toBeNull();
    expect(boundaryGuide.getAttribute('width')).toBe('1024');
    expect(boundaryGuide.getAttribute('height')).toBe('800');
  });

  it('supports mouse marquee selection over empty canvas space', () => {
    const { container } = render(<ProcessScapeView />);
    const viewport = container.querySelector('.ps-canvas-viewport');
    expect(viewport).not.toBeNull();

    // Start marquee drag at (50, 50)
    fireEvent.mouseDown(viewport, { clientX: 50, clientY: 50, button: 0 });
    // Drag to (300, 300)
    fireEvent.mouseMove(window, { clientX: 300, clientY: 300 });

    // Interaction layer should have drawn the selection rectangle
    const rect = container.querySelector('#interactionLayer rect') || viewport.querySelector('g:last-child rect');
    // Release mouse
    fireEvent.mouseUp(window, { clientX: 300, clientY: 300 });
  });

  it('contains zero ps-btn classes across the inspector and document', () => {
    const { container } = render(<ProcessScapeView />);
    const psBtns = container.querySelectorAll('.ps-btn');
    expect(psBtns.length).toBe(0);
  });

  it('treats connected pipes as an entirety so they are never separated', () => {
    // Pipe A runs horizontally from (100, 100) to (200, 100)
    const pipeA = {
      id: 'pipe_A',
      groupId: 'grp_1',
      points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      w: 20
    };
    // Pipe B bends vertically from (200, 100) to (200, 250)
    const pipeB = {
      id: 'pipe_B',
      groupId: 'grp_1',
      points: [{ x: 200, y: 100 }, { x: 200, y: 250 }],
      w: 20
    };
    // Pipe C is an independent pipe far away
    const pipeC = {
      id: 'pipe_C',
      points: [{ x: 500, y: 500 }, { x: 600, y: 500 }],
      w: 20
    };

    const allPipes = [pipeA, pipeB, pipeC];

    // arePipesConnected returns true for connected pipes A and B
    expect(arePipesConnected(pipeA, pipeB)).toBe(true);
    expect(arePipesConnected(pipeA, pipeC)).toBe(false);

    // getConnectedPipeIds returns both pipeA and pipeB when either is queried
    const connectedFromA = getConnectedPipeIds('pipe_A', allPipes);
    expect(connectedFromA).toContain('pipe_A');
    expect(connectedFromA).toContain('pipe_B');
    expect(connectedFromA).not.toContain('pipe_C');

    const connectedFromB = getConnectedPipeIds('pipe_B', allPipes);
    expect(connectedFromB).toContain('pipe_A');
    expect(connectedFromB).toContain('pipe_B');

    // expandConnectedPipes ensures selection touching one segment expands to the entirety
    const expanded = expandConnectedPipes(['pipe_A'], allPipes);
    expect(expanded).toContain('pipe_A');
    expect(expanded).toContain('pipe_B');
    expect(expanded).not.toContain('pipe_C');
  });

  it('renders industrial flange interfaces at open endpoints with 130% diameter', () => {
    // Pipe with width = 20
    const standalonePipe = {
      id: 'pipe_flange_test',
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      d: 'M 100,100 L 300,100',
      w: 20,
      medium: 'gas'
    };

    // Both endpoints of a standalone pipe are open
    expect(isPipeEndpointOpen(standalonePipe, 0, [standalonePipe])).toBe(true);
    expect(isPipeEndpointOpen(standalonePipe, 1, [standalonePipe])).toBe(true);

    const pipeSvg = renderPipe(standalonePipe, new Set(), [standalonePipe]);
    const flanges = pipeSvg.querySelectorAll('.pipe-flange-interface');
    expect(flanges.length).toBe(2);

    // Flange plate height must be 20 * 1.30 = 26px (130% of diameter)
    const plate = flanges[0].querySelector('rect[rx="1.5"]');
    expect(plate).not.toBeNull();
    expect(parseFloat(plate.getAttribute('height'))).toBe(26);

    // Flange must have bolt holes
    const boltHoles = flanges[0].querySelectorAll('ellipse');
    expect(boltHoles.length).toBe(2);
  });

  it('does not render flanges at internal connected pipe junctions', () => {
    const pipe1 = {
      id: 'pipe1',
      points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      d: 'M 100,100 L 200,100',
      w: 20
    };
    const pipe2 = {
      id: 'pipe2',
      points: [{ x: 200, y: 100 }, { x: 200, y: 300 }],
      d: 'M 200,100 L 200,300',
      w: 20
    };
    const bothPipes = [pipe1, pipe2];

    // Junction at (200, 100) is connected, not open
    expect(isPipeEndpointOpen(pipe1, 1, bothPipes)).toBe(false);
    expect(isPipeEndpointOpen(pipe2, 0, bothPipes)).toBe(false);

    // Open terminals at (100, 100) and (200, 300) are open
    expect(isPipeEndpointOpen(pipe1, 0, bothPipes)).toBe(true);
    expect(isPipeEndpointOpen(pipe2, 1, bothPipes)).toBe(true);

    // Each pipe only renders 1 flange at its open terminal, 0 at the elbow junction
    const svg1 = renderPipe(pipe1, new Set(), bothPipes);
    expect(svg1.querySelectorAll('.pipe-flange-interface').length).toBe(1);

    const svg2 = renderPipe(pipe2, new Set(), bothPipes);
    expect(svg2.querySelectorAll('.pipe-flange-interface').length).toBe(1);
  });

  it('renders smooth rounded elbow junction circles at turning points (keeping the old way without fractured right angles)', () => {
    const pipe1 = {
      id: 'pipe1',
      points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      d: 'M 100,100 L 200,100',
      w: 20,
      medium: 'gas'
    };
    const pipe2 = {
      id: 'pipe2',
      points: [{ x: 200, y: 100 }, { x: 200, y: 300 }],
      d: 'M 200,100 L 200,300',
      w: 20,
      medium: 'gas'
    };
    const bothPipes = [pipe1, pipe2];

    const svg1 = renderPipe(pipe1, new Set(['pipe1']), bothPipes);
    const elbowCircle1 = svg1.querySelector('.pipe-elbow-junction');
    expect(elbowCircle1).not.toBeNull();
    // Radius must be strokeW / 2 = 10px to perfectly round the 90-degree corner
    expect(parseFloat(elbowCircle1.getAttribute('r'))).toBe(10);
    expect(parseFloat(elbowCircle1.getAttribute('cx'))).toBe(200);
    expect(parseFloat(elbowCircle1.getAttribute('cy'))).toBe(100);

    // Selection halo also includes the elbow junction circle
    const haloCircles = svg1.querySelectorAll('.pipe-selection-halo');
    const elbowHalo = Array.from(haloCircles).find(el => el.tagName === 'circle');
    expect(elbowHalo).not.toBeUndefined();
    expect(parseFloat(elbowHalo.getAttribute('r'))).toBe((20 + 8) / 2); // 14px
  });

  it('keeps inspector open and allows changing medium type and pipe thickness for grouped pipeline', () => {
    const { container } = render(<ProcessScapeView />);

    // Select a pipe via click
    const pipeEl = container.querySelector('.plant-pipe-group');
    if (pipeEl) {
      fireEvent.click(pipeEl);
      const inspector = container.querySelector('aside.ps-inspector');
      expect(inspector.textContent).not.toContain('No Item Selected');
      expect(inspector.textContent).toMatch(/Medium Type|Gas \(Grey\)/);

      // Pipeline Label input is removed as requested (users can use text notes instead)
      expect(inspector.textContent).not.toContain('Pipeline Label');

      // Click Liquid button
      const liquidBtn = Array.from(inspector.querySelectorAll('button')).find(b => b.textContent.includes('Liquid'));
      if (liquidBtn) {
        fireEvent.click(liquidBtn);
        expect(liquidBtn.classList.contains('btn-primary')).toBe(true);
      }
    }
  });

  it('does not render inline text labels on pipes (labels removed in favor of text notes)', () => {
    const pipeWithOldLabel = {
      id: 'pipe_labeled',
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      d: 'M 100,100 L 300,100',
      w: 20,
      label: 'Old Pipe Label'
    };
    const svg = renderPipe(pipeWithOldLabel);
    expect(svg.querySelector('text')).toBeNull();
  });

  it('renders moving dashed flow line inside pipe with identical in and out endpoints', () => {
    const pipeForward = {
      id: 'pipe_flow_test',
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      d: 'M 100,100 L 300,100',
      w: 20,
      flow: 'forward'
    };
    const svg = renderPipe(pipeForward);
    const flowDash = svg.querySelector('.pipe-flow-dash.flow-forward');
    expect(flowDash).not.toBeNull();
    expect(flowDash.getAttribute('stroke-dasharray')).toBe('8 12');

    // Both endpoints have identical flanges without different looking badges
    const flanges = svg.querySelectorAll('.pipe-flange-interface');
    expect(flanges.length).toBe(2);
    // Flange 0 and Flange 1 have identical structure
    expect(flanges[0].querySelectorAll('ellipse').length).toBe(2);
    expect(flanges[1].querySelectorAll('ellipse').length).toBe(2);

    // Reverse flow
    const pipeReverse = { ...pipeForward, flow: 'reverse' };
    const svgRev = renderPipe(pipeReverse);
    expect(svgRev.querySelector('.pipe-flow-dash.flow-reverse')).not.toBeNull();

    // Flow turned off
    const pipeOff = { ...pipeForward, flow: 'none' };
    const svgOff = renderPipe(pipeOff);
    expect(svgOff.querySelector('.pipe-flow-dash')).toBeNull();
  });

  it('allows setting length on a single pipe and has removed the Flip Flow Direction button', () => {
    const { container } = render(<ProcessScapeView />);

    // Drop a pipe preset onto the canvas viewport to create and select a single pipe
    const viewport = container.querySelector('.ps-canvas-viewport');
    expect(viewport).not.toBeNull();

    fireEvent.drop(viewport, {
      clientX: 300,
      clientY: 300,
      dataTransfer: {
        getData: (type) => {
          if (type === 'application/json') {
            return JSON.stringify({ kind: 'pipe_preset', key: 'pipe_gas_h' });
          }
          return '';
        }
      }
    });

    const inspector = container.querySelector('aside.ps-inspector');
    expect(inspector).not.toBeNull();

    // 1. Check that "Flip Flow Direction" button is NOT in the inspector
    const flipBtn = Array.from(inspector.querySelectorAll('button')).find(b =>
      b.textContent.includes('Flip Flow Direction')
    );
    expect(flipBtn).toBeUndefined();

    // 2. Check that Forward, Reverse, Off buttons exist and can be toggled
    const fwdBtn = Array.from(inspector.querySelectorAll('button')).find(b => b.textContent.includes('Forward'));
    const revBtn = Array.from(inspector.querySelectorAll('button')).find(b => b.textContent.includes('Reverse'));
    const offBtn = Array.from(inspector.querySelectorAll('button')).find(b => b.textContent.includes('Off'));
    expect(fwdBtn).not.toBeUndefined();
    expect(revBtn).not.toBeUndefined();
    expect(offBtn).not.toBeUndefined();

    fireEvent.click(revBtn);
    expect(revBtn.classList.contains('btn-primary')).toBe(true);

    fireEvent.click(fwdBtn);
    expect(fwdBtn.classList.contains('btn-primary')).toBe(true);

    // 3. Check Pipe Length setting is rendered for single pipe
    expect(inspector.textContent).toContain('Pipe Length');
    const lengthInput = inspector.querySelector('input[type="number"]');
    expect(lengthInput).not.toBeNull();
    const initialLen = parseInt(lengthInput.value, 10);
    expect(initialLen).toBeGreaterThan(0);

    // Update pipe length via number input
    fireEvent.change(lengthInput, { target: { value: '450' } });
    expect(inspector.textContent).toContain('450px');
    expect(lengthInput.value).toBe('450');

    // Verify pipe in SVG was updated with the new length
    const pipeGroup = container.querySelector('.plant-pipe-group');
    expect(pipeGroup).not.toBeNull();
    const pipePath = pipeGroup.querySelector('path.pipe-metal-body');
    expect(pipePath).not.toBeNull();
    const d = pipePath.getAttribute('d');
    expect(d).toContain('L ');
  });

  it('splits flow direction outward to both branches when branching from one node', () => {
    // Main pipe terminates at junction J (200, 200)
    const pipeMain = {
      id: 'pipe_main',
      points: [{ x: 100, y: 200 }, { x: 200, y: 200 }],
      d: 'M 100,200 L 200,200',
      w: 20
    };
    // Branch 1 starts at J (200, 200) and extends up to (200, 100)
    const branch1 = {
      id: 'branch_1',
      points: [{ x: 200, y: 200 }, { x: 200, y: 100 }],
      d: 'M 200,200 L 200,100',
      w: 20
    };
    // Branch 2 starts at (200, 300) and terminates at J (200, 200) - opposite point order!
    const branch2 = {
      id: 'branch_2',
      points: [{ x: 200, y: 300 }, { x: 200, y: 200 }],
      d: 'M 200,300 L 200,200',
      w: 20
    };
    const allPipes = [pipeMain, branch1, branch2];

    const dirs = resolvePipelineFlowDirections(allPipes);

    // Main pipe flows forward into junction J
    expect(dirs.get('pipe_main')).toBe('forward');

    // Branch 1 flows forward (from 200,200 away from J to 200,100)
    expect(dirs.get('branch_1')).toBe('forward');

    // Branch 2 points are stored bottom-to-top, so its effective direction is 'reverse'
    // which in SVG animates from (200, 200) away from J to (200, 300)!
    expect(dirs.get('branch_2')).toBe('reverse');

    // Both branches rendered via renderPipe receive the outward flowing animation
    const svg1 = renderPipe(branch1, new Set(), allPipes, dirs);
    expect(svg1.querySelector('.pipe-flow-dash.flow-forward')).not.toBeNull();

    const svg2 = renderPipe(branch2, new Set(), allPipes, dirs);
    expect(svg2.querySelector('.pipe-flow-dash.flow-reverse')).not.toBeNull();
  });

  it('renders anchor handle at center of item (0, 0) and shows the final dotted connection line to the pipe without a solid dot cluttering the pipe', () => {
    const pipeBranch = {
      id: 'branch_a',
      medium: 'gas',
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      d: 'M 100,100 L 300,100',
      w: 20
    };
    const node = {
      id: 'comp_1',
      type: 'machine_compressor',
      x: 200,
      y: 40,
      w: 120,
      h: 120,
      attachedPipeId: 'branch_a',
      pipeT: 0.5 // 50% along branch_a -> contact point (200, 100)
    };

    // When UNSELECTED: final dotted line is present connecting to pipe, but NO solid dot on pipe and NO interactive handle
    const svgUnselected = renderAssetNode(node, new Set(), [pipeBranch]);
    expect(svgUnselected).not.toBeNull();
    const unselectedDottedLine = svgUnselected.querySelector('line[stroke-dasharray="4 3"]');
    expect(unselectedDottedLine).not.toBeNull();
    expect(parseFloat(unselectedDottedLine.getAttribute('x2'))).toBe(0); // relX = 200 - 200 = 0
    expect(parseFloat(unselectedDottedLine.getAttribute('y2'))).toBe(60); // relY = 100 - 40 = 60
    expect(svgUnselected.querySelector('.element-anchor-handle')).toBeNull();

    // When SELECTED: anchor handle is placed at center of item (0, 0) on top of the machine, with active dotted line
    const svgSelected = renderAssetNode(node, new Set(['comp_1']), [pipeBranch]);
    expect(svgSelected).not.toBeNull();
    const anchorHandle = svgSelected.querySelector('.element-anchor-handle');
    expect(anchorHandle).not.toBeNull();
    expect(anchorHandle.getAttribute('transform')).toBe('translate(0, 0)');
    expect(svgSelected.querySelector('line[stroke-dasharray="4 3"]')).not.toBeNull();
  });

  it('allows binding anchor point of equipment to a specific pipe branch via mouse interaction and adjusts dynamically with pipe length', () => {
    const pipe1 = {
      id: 'pipe_branch_1',
      medium: 'gas',
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      d: 'M 100,100 L 300,100',
      w: 20
    };
    const machine = {
      id: 'machine_1',
      type: 'machine_compressor',
      tag: 'Main Compressor',
      x: 200,
      y: 40,
      w: 120,
      h: 120
    };

    const { container } = render(
      <ProcessScapeView
        initialElements={[machine]}
        initialPipes={[pipe1]}
      />
    );

    // MouseDown on machine to select it
    const machineEl = container.querySelector('.plant-node[data-node-id="machine_1"]');
    expect(machineEl).not.toBeNull();
    fireEvent.mouseDown(machineEl, { clientX: 190, clientY: 112, button: 0 });
    fireEvent.mouseUp(window);

    // Inspector should open with Pipeline Anchor Binding section showing Free floating
    const inspector = container.querySelector('aside.ps-inspector');
    expect(inspector).not.toBeNull();
    expect(inspector.textContent).toContain('Pipeline Anchor Binding');
    expect(inspector.textContent).toContain('Free floating');

    // Anchor handle is rendered
    const anchorHandle = container.querySelector('.element-anchor-handle[data-element-id="machine_1"]');
    expect(anchorHandle).not.toBeNull();

    // MouseDown on anchor handle, drag towards pipe1 at world (200, 100) -> clientX: 190, clientY: 163
    fireEvent.mouseDown(anchorHandle, { clientX: 190, clientY: 112, button: 0 });
    fireEvent.mouseMove(window, { clientX: 190, clientY: 163 });
    fireEvent.mouseUp(window, { clientX: 190, clientY: 163 });

    // Machine is now bound at ~50% of pipe_branch_1
    expect(inspector.textContent).toContain('Bound (50%)');
    const detachBtn = Array.from(inspector.querySelectorAll('button')).find(b => b.textContent === 'Detach');
    expect(detachBtn).not.toBeUndefined();

    // Test Detach button
    fireEvent.click(detachBtn);
    expect(inspector.textContent).toContain('Free floating');
  });
});


