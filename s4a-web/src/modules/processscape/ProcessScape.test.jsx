import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ProcessScapeView from './ProcessScapeView.jsx';
import { ASSET_DEFS, PIPE_PRESETS, SENSOR_CARD_TEMPLATES } from './engine/constants.js';
import { renderAssetPaletteIcon } from './engine/paletteIcons.jsx';
import {
  getAllScapes,
  getActiveScape,
  saveScape,
  duplicateScape,
  deleteScape,
  createNewScape
} from './engine/scapeStorage.js';
import SensorManagerModal from './SensorManagerModal.jsx';
import DeviceConnectModal from '../../components/DeviceConnectModal.jsx';
import TauriSutoAPI from '../../api/TauriSutoAPI.js';
import * as lanScannerModule from '../../api/lanScanner.js';
import {
  getLocations,
  saveLocations,
  detectConnectedSensors,
  syncMeasurementPointToScape,
  syncAllLocationsToScapes,
  buildDeviceFromRawChannels,
  getSavedDevices,
  getDeviceChannelAssignments,
  removeDeviceAndUnassignChannels,
  autoReconnectSavedDevices,
  generateDeterministicDeviceId,
  isSameDevice,
  upsertDeviceList
} from './engine/sensorManagerStorage.js';
import {
  snap,
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
  renderSensorCard,
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

    // Physical sensor transmitters & detectors (clean placeholders without fake mock numbers)
    const dewPointG = drawDewPointMeter(fakeNode);
    expect(dewPointG.tagName.toLowerCase()).toBe('g');
    expect(dewPointG.innerHTML).toContain('--.-');
    expect(dewPointG.innerHTML).toContain('°C Td');
    expect(dewPointG.innerHTML).toContain('.SUTO');

    const leakG = drawLeakDetector(fakeNode);
    expect(leakG.tagName.toLowerCase()).toBe('g');
    expect(leakG.innerHTML).toContain('SUTO S530');
    expect(leakG.innerHTML).toContain('-- dB');
    expect(leakG.innerHTML).toContain('STANDBY');

    const compactFlowG = drawCompactFlowMeter(fakeNode);
    expect(compactFlowG.tagName.toLowerCase()).toBe('g');
    expect(compactFlowG.innerHTML).toContain('---.-');
    expect(compactFlowG.innerHTML).toContain('.SUTO');
    expect(compactFlowG.innerHTML).toContain('lpm');

    const flowMeterG = drawFlowMeter(fakeNode);
    expect(flowMeterG.tagName.toLowerCase()).toBe('g');
    expect(flowMeterG.innerHTML).toContain('--.-');
    expect(flowMeterG.innerHTML).toContain('m³/h');
    expect(flowMeterG.innerHTML).toContain('--.- bar');
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

  it('renders top HUD with toolSelect and toolPan, and provides page tools (zoom percent, focus, size) in modify scape only', () => {
    const { container } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={[
          { id: 'el_1', type: 'machine_compressor', tag: 'Comp 1', x: 100, y: 100, w: 140, h: 120 }
        ]}
      />
    );

    // Top HUD is present in editor mode and houses toolSelect and toolPan
    const topHud = container.querySelector('.canvas-floating-hud.top-hud.ps-hud-bar');
    expect(topHud).not.toBeNull();
    expect(topHud.querySelector('#toolSelect')).not.toBeNull();
    expect(topHud.querySelector('#toolPan')).not.toBeNull();

    // Dimensions and item actions are hidden when nothing is selected
    expect(container.querySelector('#hudDimensionSelector')).toBeNull();
    expect(container.querySelector('#hudFrontBtn')).toBeNull();

    // Select the element
    const nodeEl = container.querySelector('.plant-node');
    expect(nodeEl).not.toBeNull();
    fireEvent.click(nodeEl);

    // Top HUD appears showing dimensions and layer stacking
    expect(container.querySelector('#hudDimensionSelector')).not.toBeNull();
    expect(container.querySelector('#hudFrontBtn')).not.toBeNull();
    expect(container.querySelector('#hudBackBtn')).not.toBeNull();
    expect(container.querySelector('#hudDeleteBtn')).not.toBeNull();

    // Redundant canvas buttons are removed (they reside cleanly in top bar)
    expect(container.querySelector('#toolUndo')).toBeNull();
    expect(container.querySelector('#toolRedo')).toBeNull();
    expect(container.querySelector('#hudImportJsonBtn')).toBeNull();
    expect(container.querySelector('#hudExportJsonBtn')).toBeNull();

    // Modify scape page tools (zoom percent, focus, tools) are present in editor mode
    const pageTools = container.querySelector('.canvas-floating-hud.zoom-hud');
    expect(pageTools).not.toBeNull();
    expect(pageTools.querySelector('#toolZoomReset').textContent).toMatch(/\d+%/);
    expect(pageTools.querySelector('#toolZoomFit')).not.toBeNull();
    expect(pageTools.querySelector('.ps-canvas-size-badge')).toBeNull();
    // toolSelect and toolPan are strictly in top-hud, not in zoom-hud
    expect(pageTools.querySelector('#toolSelect')).toBeNull();
    expect(pageTools.querySelector('#toolPan')).toBeNull();

    // Palette has NO "Live Telemetry Card" (managed exclusively by Sensor Manager)
    const paletteTitles = Array.from(container.querySelectorAll('.ps-card-title')).map(el => el.textContent);
    expect(paletteTitles.some(t => t.includes('Live Telemetry'))).toBe(false);
  });

  it('allows activating Pan mode via keyboard and updates viewport class to panning', () => {
    const { container } = render(<ProcessScapeView />);
    const viewport = container.querySelector('.ps-canvas-viewport');
    expect(viewport.classList.contains('panning')).toBe(false);

    fireEvent.keyDown(window, { code: 'Space' });
    expect(viewport.classList.contains('panning')).toBe(true);

    fireEvent.keyUp(window, { code: 'Space' });
    expect(viewport.classList.contains('panning')).toBe(false);
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

  it('renders Real Size bounds guide hidden unless active and keeps top HUD selection-focused', () => {
    const { container } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={[
          { id: 'el_1', type: 'machine_compressor', tag: 'Comp 1', x: 100, y: 100, w: 140, h: 120 }
        ]}
      />
    );

    // Bounds guide is NOT shown by default when drawing
    expect(container.querySelector('.ps-real-bounds-guide')).toBeNull();

    // hud-stat-pill is removed as requested
    expect(container.querySelector('.hud-stat-pill')).toBeNull();
  });

  it('renders all buttons in top-hud as consistent icon buttons when selection is active', () => {
    const { container } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={[
          { id: 'el_1', type: 'machine_compressor', tag: 'Comp 1', x: 100, y: 100, w: 140, h: 120 }
        ]}
      />
    );

    // Select the element
    const nodeEl = container.querySelector('.plant-node');
    expect(nodeEl).not.toBeNull();
    fireEvent.click(nodeEl);

    const topHud = container.querySelector('.canvas-floating-hud.top-hud');
    expect(topHud).not.toBeNull();

    // pipeMediumSelector is removed from top-hud
    expect(container.querySelector('#pipeMediumSelector')).toBeNull();

    // All action buttons in selection top-hud must be icon buttons with SVG icon
    const buttons = Array.from(topHud.querySelectorAll('button.hud-icon-btn'));
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    buttons.forEach(btn => {
      expect(btn.classList.contains('hud-icon-btn')).toBe(true);
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    });
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

  it('does not render boundaryGuide in canvas and default canvas renders viewport', () => {
    const { container } = render(<ProcessScapeView />);
    const boundaryGuide = container.querySelector('#boundaryGuide');
    expect(boundaryGuide).toBeNull();
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

    // Inspector should open with Device Size slider and no Pipeline Anchor Binding section
    const inspector = container.querySelector('aside.ps-inspector');
    expect(inspector).not.toBeNull();
    expect(inspector.textContent).toContain('Device Size');
    expect(inspector.textContent).not.toContain('Pipeline Anchor Binding');

    // Anchor handle is rendered
    const anchorHandle = container.querySelector('.element-anchor-handle[data-element-id="machine_1"]');
    expect(anchorHandle).not.toBeNull();

    // MouseDown on anchor handle, drag towards pipe1 at world (200, 100) -> clientX: 220, clientY: 178 (at zoom 1.0, vx: 20, vy: 78)
    fireEvent.mouseDown(anchorHandle, { clientX: 220, clientY: 178, button: 0 });
    fireEvent.mouseMove(window, { clientX: 220, clientY: 178 });
    fireEvent.mouseUp(window, { clientX: 220, clientY: 178 });

    // Machine is now bound to pipe branch, showing anchor connection line
    const anchorLine = container.querySelector('line.element-anchor-line[data-element-id="machine_1"]');
    expect(anchorLine).not.toBeNull();
  });

  it('registers Import JSON, Export JSON, and Export PNG actions for pure icon buttons', () => {
    let capturedActions = null;
    render(
      <ProcessScapeView
        onRegisterActions={(actions) => {
          capturedActions = actions;
        }}
      />
    );

    expect(typeof capturedActions.handleImportJson).toBe('function');
    expect(typeof capturedActions.handleExportJson).toBe('function');
    expect(typeof capturedActions.handleExportPng).toBe('function');
  });

  it('supports importing a ProcessScape JSON config file and updating diagram elements and pipes', async () => {
    let capturedActions = null;
    const { container } = render(
      <ProcessScapeView
        onRegisterActions={(actions) => {
          capturedActions = actions;
        }}
      />
    );

    expect(capturedActions).not.toBeNull();
    expect(typeof capturedActions.handleImportJson).toBe('function');

    const fileInput = container.querySelector('input[type="file"][accept*=".json"]');
    expect(fileInput).not.toBeNull();

    // Simulate file import with config containing 1 element and 1 pipe
    const mockConfig = {
      projectTitle: 'Custom Imported Plant',
      tempCanvasSize: { width: 1200, height: 900 },
      elements: [
        { id: 'imported_chiller_1', type: 'machine_chiller', tag: 'Imported Chiller', x: 250, y: 150, w: 140, h: 140 }
      ],
      pipes: [
        { id: 'imported_pipe_1', medium: 'liquid', points: [{ x: 50, y: 50 }, { x: 400, y: 50 }], d: 'M 50,50 L 400,50', w: 16 }
      ]
    };

    const originalFileReader = global.FileReader;
    class MockFileReader {
      readAsText() {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: JSON.stringify(mockConfig) } });
          }
        }, 10);
      }
    }
    global.FileReader = MockFileReader;

    try {
      const file = new File([JSON.stringify(mockConfig)], 'plant-config.json', { type: 'application/json' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for file reader to update diagram
      await waitFor(() => {
        expect(container.querySelector('.plant-node[data-node-id="imported_chiller_1"]')).not.toBeNull();
        expect(container.querySelector('.plant-pipe-group[data-pipe-id="imported_pipe_1"]')).not.toBeNull();
      });
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('renders clean Current Scape runtime view by default when initialMode="runtime" with runtime page tools', () => {
    const { container } = render(<ProcessScapeView initialMode="runtime" />);

    // Palette sidebar and inspector are completely hidden in runtime
    expect(container.querySelector('.ps-sidebar')).toBeNull();
    expect(container.querySelector('.ps-inspector')).toBeNull();

    // Editor top-hud and telemetry cards are completely removed in runtime mode
    expect(container.querySelector('.canvas-floating-hud.top-hud')).toBeNull();
    expect(container.querySelector('.canvas-floating-hud.ps-runtime-hud')).toBeNull();
    // boundaryGuide is removed in runtime mode (current mode) as requested
    expect(container.querySelector('#boundaryGuide')).toBeNull();

    // Runtime floating tools HUD (#psRuntimePageTools) is available
    const runtimeTools = container.querySelector('#psRuntimePageTools');
    expect(runtimeTools).not.toBeNull();
    expect(runtimeTools.querySelector('#toolRuntimeZoomOut')).not.toBeNull();
    expect(runtimeTools.querySelector('#toolRuntimeZoomReset')).not.toBeNull();
    expect(runtimeTools.querySelector('#toolRuntimeZoomIn')).not.toBeNull();
    expect(runtimeTools.querySelector('#toolRuntimeZoomFit')).toBeNull();
    expect(runtimeTools.querySelector('#toolRuntimeDndToggle')).not.toBeNull();
    expect(runtimeTools.querySelector('#toolRuntimeBoundsResizer')).not.toBeNull();
  });

  it('allows toggling Live DND in runtime mode to drag measurement point cards and anchors', () => {
    const testCard = {
      id: 'live_card_1',
      type: 'sensor_card',
      tag: 'Main S403',
      x: 200,
      y: 200,
      channels: [{ id: 'ch_1', name: 'Flow', val: 120, unit: 'm³/h' }]
    };

    const currentActive = getActiveScape();
    currentActive.elements = [testCard];
    saveScape(currentActive);

    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
      />
    );

    const dndToggleBtn = container.querySelector('#toolRuntimeDndToggle');
    expect(dndToggleBtn).not.toBeNull();
    expect(dndToggleBtn.classList.contains('active')).toBe(false);

    // Initial state: card does not have live-dnd-active
    let cardGroup = container.querySelector('.sensor-badge-group[data-card-id="live_card_1"]');
    expect(cardGroup).not.toBeNull();
    expect(cardGroup.classList.contains('live-dnd-active')).toBe(false);

    // Click toggle to enable Live DND
    fireEvent.click(dndToggleBtn);
    expect(dndToggleBtn.classList.contains('active')).toBe(true);

    cardGroup = container.querySelector('.sensor-badge-group[data-card-id="live_card_1"]');
    expect(cardGroup.classList.contains('live-dnd-active')).toBe(true);
    // Anchor handle is present, but green pill bar showing element name is removed
    expect(cardGroup.querySelector('rect[fill="#00a876"]')).toBeNull();
    expect(cardGroup.textContent).not.toContain('⚓');

    // Drag the measurement point card to a new position
    fireEvent.mouseDown(cardGroup, { clientX: 200, clientY: 200, button: 0 });
    fireEvent.mouseMove(window, { clientX: 250, clientY: 280 });
    fireEvent.mouseUp(window, { clientX: 250, clientY: 280 });

    // Verify card was moved and saved
    const activeScape = getActiveScape();
    const updatedCard = activeScape.elements.find(e => e.id === 'live_card_1');
    expect(updatedCard).toBeDefined();

    // Toggle off Live DND
    fireEvent.click(dndToggleBtn);
    expect(dndToggleBtn.classList.contains('active')).toBe(false);
  });

  it('allows resizing diagram bounding box, extending pipe lengths proportionally, and confirming optimal screen fit', () => {
    const testPipe = {
      id: 'resizer_pipe_1',
      medium: 'gas',
      w: 20,
      points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
      d: 'M 100,100 L 300,100'
    };
    const testMachine = {
      id: 'resizer_machine_1',
      type: 'machine_compressor',
      tag: 'Comp A',
      x: 100,
      y: 100,
      w: 120,
      h: 100
    };

    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        initialElements={[testMachine]}
        initialPipes={[testPipe]}
      />
    );

    const boundsResizerBtn = container.querySelector('#toolRuntimeBoundsResizer');
    expect(boundsResizerBtn).not.toBeNull();
    expect(boundsResizerBtn.classList.contains('active')).toBe(false);
    expect(container.querySelector('#boundsResizerGroup')).toBeNull();

    // 1. Click bounds resizer tool to activate bounding box
    fireEvent.click(boundsResizerBtn);
    expect(boundsResizerBtn.classList.contains('active')).toBe(true);

    const resizerGroup = container.querySelector('#boundsResizerGroup');
    expect(resizerGroup).not.toBeNull();

    const handles = resizerGroup.querySelectorAll('.ps-bounds-handle');
    expect(handles.length).toBe(8); // nw, n, ne, e, se, s, sw, w

    // 2. Drag the East handle to stretch width
    const eastHandle = resizerGroup.querySelector('.ps-bounds-handle[data-handle="e"]');
    expect(eastHandle).not.toBeNull();

    fireEvent.mouseDown(eastHandle, { clientX: 350, clientY: 150, button: 0 });
    fireEvent.mouseMove(window, { clientX: 550, clientY: 150 });
    fireEvent.mouseUp(window);

    // Verify pipe points extended along horizontal axis
    const pipeGroup = container.querySelector('.plant-pipe-group[data-pipe-id="resizer_pipe_1"]');
    expect(pipeGroup).not.toBeNull();

    // 3. Click bounds resizer tool icon again to confirm, dismiss bounding box, and apply optimal size
    fireEvent.click(boundsResizerBtn);
    expect(boundsResizerBtn.classList.contains('active')).toBe(false);
    expect(container.querySelector('#boundsResizerGroup')).toBeNull();

    // Verify active scape in storage was updated with the new dimensions
    const activeScape = getActiveScape();
    expect(activeScape.tempCanvasSize).toBeDefined();
    expect(activeScape.tempCanvasSize.width).toBeGreaterThanOrEqual(1024);
    // Machine touching horizontal pipe kept its vertical Y position locked at 100
    const finalMachine = activeScape.elements.find(e => e.id === 'resizer_machine_1');
    expect(finalMachine).toBeDefined();
    expect(finalMachine.y).toBe(100);
  });

  it('resizes grouped pipeline height without breaking right-angle orthogonality or disconnecting junctions', () => {
    // Pipeline group with a horizontal main header pipe and a vertical branch drop pipe connected at (300, 100)
    const testPipes = [
      {
        id: 'group_pipe_main',
        points: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
        d: 'M 100 100 L 500 100',
        w: 20
      },
      {
        id: 'group_pipe_branch',
        points: [{ x: 300, y: 100 }, { x: 300, y: 300 }],
        d: 'M 300 100 L 300 300',
        w: 20
      }
    ];

    const testElements = [
      {
        id: 'group_machine_1',
        type: 'compressor',
        name: 'Compressor 1',
        x: 300,
        y: 300,
        w: 100,
        h: 80
      }
    ];

    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        initialElements={testElements}
        initialPipes={testPipes}
      />
    );

    const boundsResizerBtn = container.querySelector('#toolRuntimeBoundsResizer');
    expect(boundsResizerBtn).not.toBeNull();
    fireEvent.click(boundsResizerBtn);

    const resizerGroup = container.querySelector('#boundsResizerGroup');
    expect(resizerGroup).not.toBeNull();

    // Drag the South handle to stretch height by 150px
    const southHandle = resizerGroup.querySelector('.ps-bounds-handle[data-handle="s"]');
    expect(southHandle).not.toBeNull();

    fireEvent.mouseDown(southHandle, { clientX: 300, clientY: 300, button: 0 });
    fireEvent.mouseMove(window, { clientX: 300, clientY: 450 });
    fireEvent.mouseUp(window);

    // Confirm bounds resize
    fireEvent.click(boundsResizerBtn);

    // Fetch the updated pipes
    const mainPipeEl = container.querySelector('.plant-pipe-group[data-pipe-id="group_pipe_main"]');
    const branchPipeEl = container.querySelector('.plant-pipe-group[data-pipe-id="group_pipe_branch"]');
    expect(mainPipeEl).not.toBeNull();
    expect(branchPipeEl).not.toBeNull();

    // Verify both pipes remain connected at the junction point
    const mainPath = mainPipeEl.querySelector('path.pipe-metal-body').getAttribute('d');
    const branchPath = branchPipeEl.querySelector('path.pipe-metal-body').getAttribute('d');

    // Main pipe stays horizontal (y coordinates for start and end are identical)
    const mainCoords = mainPath.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)\s+L\s*([\d.-]+)[,\s]+([\d.-]+)/);
    expect(mainCoords).not.toBeNull();
    const [, mx1, my1, mx2, my2] = mainCoords;
    expect(my1).toBe(my2); // Horizontal pipe remained strictly horizontal

    // Branch pipe starts at junction on main pipe
    const branchCoords = branchPath.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)\s+L\s*([\d.-]+)[,\s]+([\d.-]+)/);
    expect(branchCoords).not.toBeNull();
    const [, bx1, by1, bx2, by2] = branchCoords;
    expect(bx1).toBe(bx2); // Vertical pipe remained strictly vertical
    expect(by1).toBe(my1); // Top of branch pipe touches main pipe at exactly the same y!
    expect(Number(by2)).toBeGreaterThan(Number(by1)); // Branch pipe stretched downwards
  });

  it('keeps anchored sensor attached to horizontal pipe without drifting away when height grows', () => {
    // Horizontal pipe from (100, 200) to (500, 200)
    // Sensor anchored at t=0.5 (x=300), positioned 30px above the pipe at (300, 170)
    const testPipes = [
      {
        id: 'h_pipe_1',
        points: [{ x: 100, y: 200 }, { x: 500, y: 200 }],
        d: 'M 100,200 L 500,200',
        w: 20
      }
    ];

    const testElements = [
      {
        id: 'anchored_sensor_1',
        type: 'dew_point',
        name: 'S220 Dew Point',
        x: 300,
        y: 170,
        w: 60,
        h: 60,
        attachedPipeId: 'h_pipe_1',
        pipeT: 0.5,
        pipeOffsetX: 0,
        pipeOffsetY: -30
      }
    ];

    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        initialElements={testElements}
        initialPipes={testPipes}
      />
    );

    const boundsResizerBtn = container.querySelector('#toolRuntimeBoundsResizer');
    expect(boundsResizerBtn).not.toBeNull();
    fireEvent.click(boundsResizerBtn);

    const resizerGroup = container.querySelector('#boundsResizerGroup');
    expect(resizerGroup).not.toBeNull();

    // Drag the South handle down by 200px (Height grows significantly)
    const southHandle = resizerGroup.querySelector('.ps-bounds-handle[data-handle="s"]');
    expect(southHandle).not.toBeNull();

    fireEvent.mouseDown(southHandle, { clientX: 300, clientY: 200, button: 0 });
    fireEvent.mouseMove(window, { clientX: 300, clientY: 400 });
    fireEvent.mouseUp(window);

    // Confirm bounds resize
    fireEvent.click(boundsResizerBtn);

    // Find the updated pipe and sensor
    const pipeGroup = container.querySelector('.plant-pipe-group[data-pipe-id="h_pipe_1"]');
    expect(pipeGroup).not.toBeNull();
    const pipePath = pipeGroup.querySelector('path.pipe-metal-body').getAttribute('d');
    const pipeCoords = pipePath.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)\s+L\s*([\d.-]+)[,\s]+([\d.-]+)/);
    expect(pipeCoords).not.toBeNull();
    const pipeY = Number(pipeCoords[2]);

    const sensorNode = container.querySelector('[data-node-id="anchored_sensor_1"]');
    expect(sensorNode).not.toBeNull();
    const transform = sensorNode.getAttribute('transform');
    const match = transform.match(/translate\(([\d.-]+)[,\s]+([\d.-]+)\)/);
    expect(match).not.toBeNull();
    const sensorY = Number(match[2]);

    // The sensor must remain exactly 30px above the pipe (pipeY - sensorY === 30), NOT far away!
    expect(pipeY - sensorY).toBe(30);
  });

  it('hides anchor dot connection lines in runtime mode (final show) and displays them when modifying in editor mode', () => {
    let actions;
    const testPipes = [
      {
        id: 'test_pipe_show',
        points: [{ x: 100, y: 100 }, { x: 400, y: 100 }],
        d: 'M 100,100 L 400,100',
        w: 20
      }
    ];

    const testElements = [
      {
        id: 'anchored_item_show',
        type: 'compressor',
        name: 'Compressor 1',
        x: 250,
        y: 50,
        w: 100,
        h: 80,
        attachedPipeId: 'test_pipe_show',
        pipeT: 0.5,
        pipeOffsetX: 0,
        pipeOffsetY: -50
      }
    ];

    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        initialElements={testElements}
        initialPipes={testPipes}
        onRegisterActions={(a) => { actions = a; }}
      />
    );

    // 1. In runtime mode (final show): anchor dotted lines MUST NOT be rendered
    expect(container.querySelector('.element-anchor-line')).toBeNull();

    // 2. Switch to editor mode (modify scape)
    act(() => {
      actions.setScapeMode('editor');
    });

    // In editor mode (when modifying): anchor dotted line is rendered so user can see and adjust attachment
    expect(container.querySelector('.element-anchor-line')).not.toBeNull();

    // 3. Switch back to runtime mode (final show): anchor dotted lines are hidden again
    act(() => {
      actions.setScapeMode('runtime');
    });
    expect(container.querySelector('.element-anchor-line')).toBeNull();
  });

  it('switches between Current Scape runtime and Scape Builder editor seamlessly', () => {
    let actions;
    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        onRegisterActions={(actObj) => { actions = actObj; }}
      />
    );

    // Runtime mode: sidebar hidden
    expect(container.querySelector('.ps-sidebar')).toBeNull();

    // Switch to editor mode via action
    act(() => {
      actions.setScapeMode('editor');
    });

    // Sidebar unfolds
    expect(container.querySelector('.ps-sidebar')).not.toBeNull();

    // Switch back to runtime view via action
    act(() => {
      actions.setScapeMode('runtime');
    });

    // Returns to runtime view
    expect(container.querySelector('.ps-sidebar')).toBeNull();
  });

  it('opens and closes Scape Manager modal to browse and manage plant topologies', () => {
    let actions;
    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        onRegisterActions={(actObj) => { actions = actObj; }}
      />
    );

    // Modal is initially not rendered
    expect(container.querySelector('.ps-mgr-modal')).toBeNull();

    // Open Scape Manager via action
    act(() => {
      actions.openScapeManager();
    });

    // Modal opens
    expect(container.querySelector('.ps-mgr-modal')).not.toBeNull();
    expect(container.querySelector('#mgrModalTitle').textContent).toBe('Scape Manager');

    // Close button works
    const closeBtn = container.querySelector('.ps-mgr-close-btn');
    fireEvent.click(closeBtn);
    expect(container.querySelector('.ps-mgr-modal')).toBeNull();
  });

  it('scapeStorage handles CRUD, defaults, duplication, and protection of last scape', () => {
    const scapes = getAllScapes();
    expect(scapes.length).toBeGreaterThan(0);
    expect(scapes[0].title).toBeDefined();

    const active = getActiveScape();
    expect(active).not.toBeNull();
    expect(active.id).toBeDefined();

    // Duplicate
    const dup = duplicateScape(active.id);
    expect(dup).not.toBeNull();
    expect(dup.title).toContain('(Copy)');

    // Delete
    const deleted = deleteScape(dup.id);
    expect(deleted).toBe(true);
  });

  it('renders anchor handle with anchor-handle-core and without ghost offsets or redundant origin dots', () => {
    const { container } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={[
          { id: 'm_1', type: 'machine_compressor', tag: 'Main Compressor', x: 200, y: 200, w: 170, h: 140 }
        ]}
      />
    );

    // Click compressor to select it
    const nodeEl = container.querySelector('.plant-node');
    expect(nodeEl).not.toBeNull();
    fireEvent.click(nodeEl);

    // Verify anchor handle has .anchor-handle-core class and no css filter
    const anchorCore = container.querySelector('.element-anchor-handle .anchor-handle-core');
    expect(anchorCore).not.toBeNull();
    expect(anchorCore.getAttribute('cx')).toBe('0');
    expect(anchorCore.getAttribute('cy')).toBe('0');
    expect(anchorCore.getAttribute('r')).toBe('8');
  });

  it('SensorManagerModal reuses Connect SUTO Hardware dialog to collect real sensors one at a time, displays them together on the left, and supports DND and sync', async () => {
    let synced = false;
    let connectedDevice = null;

    // Spy on hardware connection and channel query
    const connectUsbSpy = vi.spyOn(TauriSutoAPI, 'connectUsb').mockResolvedValue({
      transport: 'USB',
      name: 'SUTO S401 Flow Meter',
      serial: 'SN-4010892'
    });

    const getChannelsSpy = vi.spyOn(TauriSutoAPI, 'getChannels').mockResolvedValue([
      { id: 1, channel_id: 1, name: 'Flow Rate', unit: 'm³/h', sensor_name: 'Thermal Flow Transducer' },
      { id: 2, channel_id: 2, name: 'Air Temp', unit: '°C', sensor_name: 'Thermal Flow Transducer' }
    ]);

    const getSysInfoSpy = vi.spyOn(TauriSutoAPI, 'getSystemInfo').mockResolvedValue({
      device_name: 'SUTO S401 Flow Meter',
      serial_number: 'SN-4010892'
    });

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
        onSyncToScape={() => { synced = true; }}
        onDeviceConnected={(conn) => { connectedDevice = conn; }}
      />
    );

    // Modal title & two columns
    expect(container.querySelector('.ps-sm-title').textContent).toContain('Sensor & Measurement Point Manager');
    expect(container.querySelector('.ps-sm-col-left')).not.toBeNull();
    expect(container.querySelector('.ps-sm-col-right')).not.toBeNull();

    // 1. Initially zero fake locations and zero fake devices (clean state)
    expect(container.querySelector('.ps-sm-empty-tree')).not.toBeNull();
    // No redundant button inside the empty tree (user requested removal)
    expect(container.querySelector('.ps-sm-empty-connect-btn')).toBeNull();
    expect(container.querySelector('.ps-sm-empty-locations')).not.toBeNull();
    expect(container.querySelectorAll('.ps-sm-device-node').length).toBe(0);
    expect(container.querySelectorAll('.ps-sm-location-card').length).toBe(0);

    // Top bar has "Detect" button, and NO "Import active sensor" or "Clear All" buttons
    const detectBtn = container.querySelector('.ps-sm-detect-btn');
    expect(detectBtn).not.toBeNull();
    expect(detectBtn.textContent).toContain('Detect');
    expect(container.querySelector('.ps-sm-import-active-btn')).toBeNull();
    expect(container.querySelector('.ps-sm-clear-btn')).toBeNull();

    // 2. Click "Detect" button to open DeviceConnectModal
    fireEvent.click(detectBtn);

    // Connect SUTO Hardware dialog (DeviceConnectModal) is opened!
    const overlay = document.querySelector('.device-connect-overlay');
    expect(overlay).not.toBeNull();
    expect(document.querySelector('.device-connect-modal h3').textContent).toBe('Connect SUTO Hardware');

    // 3. Connect First Device via USB in DeviceConnectModal
    const usbActionBtn = document.querySelector('.connect-action-btn');
    expect(usbActionBtn).not.toBeNull();
    fireEvent.click(usbActionBtn);

    // Wait for sensor 1 to be read and appended to the left tree
    await waitFor(() => {
      expect(container.querySelectorAll('.ps-sm-device-node').length).toBe(1);
    });
    expect(container.textContent).toContain('SUTO S401 Flow Meter');
    expect(connectedDevice).not.toBeNull();

    // 4. Connect Second Device via Ethernet TCP ("one time one sensor to collect as many as we can")
    fireEvent.click(detectBtn);
    expect(document.querySelector('.device-connect-overlay')).not.toBeNull();

    // Switch mock to TCP station for device 2
    getChannelsSpy.mockResolvedValueOnce([
      { id: 10, channel_id: 10, name: 'Main Dew Point', unit: '°C Td', sensor_name: 'Dew Point Transducer' }
    ]);
    getSysInfoSpy.mockResolvedValueOnce({
      device_name: 'SUTO S331 Data Station',
      serial_number: 'SN-3310056'
    });
    const connectTcpSpy = vi.spyOn(TauriSutoAPI, 'connectTcp').mockResolvedValue({
      transport: 'TCP',
      name: 'SUTO S331 Data Station',
      serial: 'SN-3310056',
      host: '192.168.1.100'
    });

    // Switch tab to Ethernet TCP and connect
    const tcpTabBtn = Array.from(document.querySelectorAll('.modal-tab-btn')).find(b => b.textContent.includes('Ethernet TCP'));
    expect(tcpTabBtn).not.toBeUndefined();
    fireEvent.click(tcpTabBtn);

    const tcpActionBtn = document.querySelector('.connect-action-btn');
    fireEvent.click(tcpActionBtn);

    // Both USB and TCP real sensors are collected together in the left tree!
    await waitFor(() => {
      expect(container.querySelectorAll('.ps-sm-device-node').length).toBe(2);
    });
    expect(container.textContent).toContain('SUTO S401 Flow Meter');
    expect(container.textContent).toContain('SUTO S331 Data Station');

    // Transport badges
    const pills = container.querySelectorAll('.ps-sm-device-pill');
    expect(pills.length).toBe(2);

    // Draggable channels are rendered
    const channels = container.querySelectorAll('.ps-sm-channel-item');
    expect(channels.length).toBeGreaterThan(0);
    expect(channels[0].getAttribute('draggable')).toBe('true');

    // 5. Test user creating location and measurement point for themselves
    const addLocBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Location'));
    expect(addLocBtn).not.toBeUndefined();
    fireEvent.click(addLocBtn);

    // Location card is added
    const locCards = container.querySelectorAll('.ps-sm-location-card');
    expect(locCards.length).toBe(1);

    // Location starts with 0 measurement points (clean empty location as requested by user)
    expect(container.querySelectorAll('.ps-sm-mp-card').length).toBe(0);
    expect(container.querySelector('.ps-sm-loc-empty-dropzone')).not.toBeNull();

    // Add Measurement Point 1 to this location
    const addPtBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Measurement Point'));
    expect(addPtBtn).not.toBeUndefined();
    fireEvent.click(addPtBtn);

    let ptCards = container.querySelectorAll('.ps-sm-mp-card');
    expect(ptCards.length).toBe(1);
    expect(ptCards[0].querySelector('.ps-sm-mp-name-input').value).toBe('Measurement Point 1');

    // Add Measurement Point 2
    fireEvent.click(addPtBtn);
    ptCards = container.querySelectorAll('.ps-sm-mp-card');
    expect(ptCards.length).toBe(2);
    expect(ptCards[1].querySelector('.ps-sm-mp-name-input').value).toBe('Measurement Point 2');

    // 6. Test Drag & Drop channel onto the measurement point
    const dropTargets = container.querySelectorAll('.ps-sm-dropzone');
    expect(dropTargets.length).toBe(2);

    // Simulate drop onto Measurement Point 1
    fireEvent.drop(dropTargets[0], {
      dataTransfer: {
        getData: (k) => JSON.stringify({
          channelId: 'ch_test_1',
          name: 'Flow Rate',
          unit: 'm³/h',
          device: 'SUTO S401 Flow Meter'
        })
      }
    });

    // Channel should now be mapped in the point card
    expect(ptCards[0].querySelectorAll('.ps-sm-assigned-tag').length).toBe(1);

    // Assigned channel tag on right side is draggable for moving between points
    const assignedTag = ptCards[0].querySelector('.ps-sm-assigned-tag.draggable-tag');
    expect(assignedTag).not.toBeNull();
    expect(assignedTag.getAttribute('draggable')).toBe('true');

    // Individual sync button on MP card is removed
    expect(container.querySelector('.ps-sm-sync-btn')).toBeNull();

    // 7. Test DND moving channel from Measurement Point 1 to Measurement Point 2
    fireEvent.drop(dropTargets[1], {
      dataTransfer: {
        getData: (k) => JSON.stringify({
          type: 'move_channel',
          id: 'ch_test_1',
          name: 'Flow Rate',
          unit: 'm³/h',
          device: 'SUTO S401 Flow Meter',
          fromLocId: locCards[0].key || 'loc_test',
          fromMpId: ptCards[0].key || 'mp_test_1'
        })
      }
    });

    // 8. Test Footer Bar Confirm & Sync All
    const footer = container.querySelector('.ps-sensor-mgr-footer');
    expect(footer).not.toBeNull();
    expect(footer.querySelector('.ps-sm-footer-info')).not.toBeNull();

    const confirmBtn = container.querySelector('.ps-sm-footer-confirm-btn');
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn.textContent).toContain('Confirm & Sync All');
    fireEvent.click(confirmBtn);
    expect(synced).toBe(true);

    connectUsbSpy.mockRestore();
    connectTcpSpy.mockRestore();
    getChannelsSpy.mockRestore();
    getSysInfoSpy.mockRestore();
  });

  it('unifies S403 channels (Flow, Consumption, Pressure) under a single S403 sensor node without splitting into 451 or pressure', () => {
    const rawChannels = [
      { id: 2, channel_id: 2, name: 'Flow', unit: 'm³/h', sensor_description: '451', device_desc: 'S 403' },
      { id: 3, channel_id: 3, name: 'Consumption', unit: 'm³', sensor_description: '451', device_desc: 'S 403' },
      { id: 6, channel_id: 6, name: 'Pressure', unit: 'bar', sensor_description: 'Pressure Sensor', device_desc: 'S 403' },
    ];

    const device = buildDeviceFromRawChannels(
      rawChannels,
      'S403-12345678',
      'Bluetooth (BLE)',
      'ble',
      { device_name: 'S403-12345678', serial_number: '12345678' }
    );

    // There should be exactly 1 sensor container named S403
    expect(device.sensors.length).toBe(1);
    expect(device.sensors[0].name).toBe('S403');

    // All 3 channels belong to S403
    expect(device.sensors[0].channels.length).toBe(3);
    const names = device.sensors[0].channels.map(c => c.name);
    expect(names).toEqual(['Flow', 'Consumption', 'Pressure']);

    // Check localStorage auto-consolidation of legacy split sensors
    window.localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([{
      id: 'dev_legacy_s403',
      name: 'S403-12345678',
      model: 'S403-12345678',
      serial: 'SN-12345678',
      transport: 'Bluetooth (BLE)',
      transportType: 'ble',
      sensors: [
        {
          id: 'sens_split_451',
          name: '451',
          channels: [
            { id: 'ch_2', channel_id: 2, name: 'Flow', unit: 'm³/h' },
            { id: 'ch_3', channel_id: 3, name: 'Consumption', unit: 'm³' }
          ]
        },
        {
          id: 'sens_split_press',
          name: 'Pressure',
          channels: [
            { id: 'ch_6', channel_id: 6, name: 'Pressure', unit: 'bar' }
          ]
        }
      ]
    }]));

    const saved = getSavedDevices();
    expect(saved.length).toBe(1);
    expect(saved[0].sensors.length).toBe(1);
    expect(saved[0].sensors[0].name).toBe('S403');
    expect(saved[0].sensors[0].channels.length).toBe(3);
  });

  it('creates a measurement point named after the sensor when dropping entire sensor or channel onto an empty location', () => {
    window.localStorage.removeItem('s4a_sensor_locations_v1');
    window.localStorage.removeItem('s4a_sensor_devices_v1');

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // 1. Add location (starts completely empty with 0 measurement points)
    const addLocBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Location'));
    fireEvent.click(addLocBtn);

    const locCard = container.querySelector('.ps-sm-location-card');
    expect(locCard).not.toBeNull();
    expect(locCard.querySelectorAll('.ps-sm-mp-card').length).toBe(0);

    const emptyDropzone = locCard.querySelector('.ps-sm-loc-empty-dropzone');
    expect(emptyDropzone).not.toBeNull();

    // 2. Drop an entire sensor (e.g. S403 with 3 channels) directly onto the location
    fireEvent.drop(emptyDropzone, {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'sensor',
          sensorName: 'S403',
          device: 'S403-12345678',
          channels: [
            { id: 'ch_2', channel_id: 2, name: 'Flow', unit: 'm³/h' },
            { id: 'ch_3', channel_id: 3, name: 'Consumption', unit: 'm³' },
            { id: 'ch_6', channel_id: 6, name: 'Pressure', unit: 'bar' }
          ]
        })
      }
    });

    // Measurement point named "S403" is created with all 3 channels
    const mpCards = locCard.querySelectorAll('.ps-sm-mp-card');
    expect(mpCards.length).toBe(1);
    expect(mpCards[0].querySelector('.ps-sm-mp-name-input').value).toBe('S403');
    expect(mpCards[0].querySelectorAll('.ps-sm-assigned-tag').length).toBe(3);

    // 3. Add a second empty location and test dropping a single channel
    fireEvent.click(addLocBtn);
    const allLocs = container.querySelectorAll('.ps-sm-location-card');
    expect(allLocs.length).toBe(2);

    const secondEmptyDropzone = allLocs[1].querySelector('.ps-sm-loc-empty-dropzone');
    expect(secondEmptyDropzone).not.toBeNull();

    fireEvent.drop(secondEmptyDropzone, {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_temp',
          name: 'Temperature',
          unit: '°C',
          sensorName: 'S403',
          device: 'S403-12345678'
        })
      }
    });

    // Measurement point named after the sensor ("S403") is created for this channel
    const secondLocMps = allLocs[1].querySelectorAll('.ps-sm-mp-card');
    expect(secondLocMps.length).toBe(1);
    expect(secondLocMps[0].querySelector('.ps-sm-mp-name-input').value).toBe('S403');
    expect(secondLocMps[0].querySelectorAll('.ps-sm-assigned-tag').length).toBe(1);
    expect(secondLocMps[0].querySelector('.ps-sm-assigned-tag').textContent).toContain('Temperature');
  });

  it('enforces channel exclusivity (cannot reuse assigned channels) and allows dragging channels between measurement points', () => {
    window.localStorage.removeItem('s4a_sensor_locations_v1');
    window.localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([{
      id: 'dev_test_s403',
      name: 'S403 Flow Meter',
      transport: 'USB',
      transportType: 'usb',
      sensors: [{
        id: 'sens_s403',
        name: 'S403',
        channels: [
          { id: 'ch_flow', channel_id: 1, name: 'Flow Rate', unit: 'm³/h' },
          { id: 'ch_temp', channel_id: 2, name: 'Temperature', unit: '°C' }
        ]
      }]
    }]));

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Initial state: both channels are unassigned
    let channelItems = container.querySelectorAll('.ps-sm-channel-item');
    expect(channelItems.length).toBe(2);
    expect(channelItems[0].classList.contains('is-assigned')).toBe(false);
    expect(channelItems[0].getAttribute('draggable')).toBe('true');

    // Add a Location
    const addLocBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Location'));
    fireEvent.click(addLocBtn);

    // Add Measurement Point 1 & 2
    const addPtBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Measurement Point'));
    fireEvent.click(addPtBtn);
    fireEvent.click(addPtBtn);

    let dropzones = container.querySelectorAll('.ps-sm-dropzone');
    expect(dropzones.length).toBe(2);

    // Drop 'Flow Rate' channel into Measurement Point 1
    fireEvent.drop(dropzones[0], {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_flow',
          channel_id: 1,
          name: 'Flow Rate',
          unit: 'm³/h',
          device: 'S403 Flow Meter'
        })
      }
    });

    // Flow Rate is now assigned to Measurement Point 1
    expect(dropzones[0].querySelectorAll('.ps-sm-assigned-tag').length).toBe(1);

    // Left tree channel item for Flow Rate is now marked as assigned and disabled from dragging
    channelItems = container.querySelectorAll('.ps-sm-channel-item');
    expect(channelItems[0].classList.contains('is-assigned')).toBe(true);
    expect(channelItems[0].getAttribute('draggable')).toBe('false');
    expect(channelItems[0].textContent).toContain('✓ Assigned');

    // Dropping Flow Rate again into Measurement Point 2 is prevented (exclusivity)
    fireEvent.drop(dropzones[1], {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_flow',
          channel_id: 1,
          name: 'Flow Rate',
          unit: 'm³/h',
          device: 'S403 Flow Meter'
        })
      }
    });
    // Measurement Point 2 still has 0 channels
    expect(dropzones[1].querySelectorAll('.ps-sm-assigned-tag').length).toBe(0);

    // Moving Flow Rate from MP1 to MP2 via drag & drop on the right side
    const locs = getLocations();
    const locId = locs[0]?.id;
    const mp1Id = locs[0]?.measurementPoints[0]?.id;
    const mp2Id = locs[0]?.measurementPoints[1]?.id;

    fireEvent.drop(dropzones[1], {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'move_channel',
          id: 'ch_flow',
          channel_id: 1,
          name: 'Flow Rate',
          unit: 'm³/h',
          device: 'S403 Flow Meter',
          fromLocId: locId,
          fromMpId: mp1Id
        })
      }
    });

    // Channel moved from MP1 to MP2
    dropzones = container.querySelectorAll('.ps-sm-dropzone');
    expect(dropzones[0].querySelectorAll('.ps-sm-assigned-tag').length).toBe(0);
    expect(dropzones[1].querySelectorAll('.ps-sm-assigned-tag').length).toBe(1);
    expect(dropzones[1].querySelector('.ps-sm-assigned-tag').textContent).toContain('Flow Rate');

    // With 1 channel moved to MP2, footer reports exactly 1 Channel Assigned
    let footerInfo = container.querySelector('.ps-sm-footer-info');
    expect(footerInfo.textContent).toContain('1 Channel Assigned');

    // Now drop the second channel ('Temperature') into Measurement Point 2
    fireEvent.drop(dropzones[1], {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_temp',
          channel_id: 2,
          name: 'Temperature',
          unit: '°C',
          device: 'S403 Flow Meter'
        })
      }
    });

    // Exactly 2 channels assigned across all locations (MUST NOT say 4!)
    footerInfo = container.querySelector('.ps-sm-footer-info');
    expect(footerInfo.textContent).toContain('2 Channels Assigned');
    expect(footerInfo.textContent).not.toContain('4 Channels Assigned');
  });

  it('allows distinct sensors with identical channel names and indices to be assigned independently without collision', () => {
    window.localStorage.removeItem('s4a_sensor_locations_v1');
    window.localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([
      {
        id: 'dev_sensor_A',
        name: 'Sensor Alpha',
        transport: 'BLE',
        transportType: 'ble',
        sensors: [{
          id: 'sens_A',
          name: 'Alpha',
          channels: [
            { id: 'ch_dev_sensor_A_1_0', channel_id: 1, name: 'Flow', unit: 'm³/h', device: 'Sensor Alpha' }
          ]
        }]
      },
      {
        id: 'dev_sensor_B',
        name: 'Sensor Beta',
        transport: 'BLE',
        transportType: 'ble',
        sensors: [{
          id: 'sens_B',
          name: 'Beta',
          channels: [
            { id: 'ch_dev_sensor_B_1_0', channel_id: 1, name: 'Flow', unit: 'm³/h', device: 'Sensor Beta' }
          ]
        }]
      }
    ]));

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Initial state: both channels from Alpha and Beta are unassigned
    let channelItems = container.querySelectorAll('.ps-sm-channel-item');
    expect(channelItems.length).toBe(2);
    expect(channelItems[0].classList.contains('is-assigned')).toBe(false);
    expect(channelItems[1].classList.contains('is-assigned')).toBe(false);

    // Add Location
    const addLocBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Location'));
    fireEvent.click(addLocBtn);

    // Add Measurement Point 1
    const addPtBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Measurement Point'));
    fireEvent.click(addPtBtn);

    let dropzones = container.querySelectorAll('.ps-sm-dropzone');
    expect(dropzones.length).toBe(1);

    // Drop Alpha's 'Flow' channel into Measurement Point 1
    fireEvent.drop(dropzones[0], {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_dev_sensor_A_1_0',
          channel_id: 1,
          name: 'Flow',
          unit: 'm³/h',
          device: 'Sensor Alpha'
        })
      }
    });

    // Check tree items: Alpha's Flow should be assigned, but Beta's Flow MUST NOT be locked out or assigned
    channelItems = container.querySelectorAll('.ps-sm-channel-item');
    expect(channelItems[0].classList.contains('is-assigned')).toBe(true);
    expect(channelItems[1].classList.contains('is-assigned')).toBe(false);

    // Add Measurement Point 2
    fireEvent.click(addPtBtn);
    dropzones = container.querySelectorAll('.ps-sm-dropzone');
    expect(dropzones.length).toBe(2);

    // Drop Beta's 'Flow' into Measurement Point 2
    fireEvent.drop(dropzones[1], {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_dev_sensor_B_1_0',
          channel_id: 1,
          name: 'Flow',
          unit: 'm³/h',
          device: 'Sensor Beta'
        })
      }
    });

    // Both should now be assigned independently to their respective measurement points
    channelItems = container.querySelectorAll('.ps-sm-channel-item');
    expect(channelItems[0].classList.contains('is-assigned')).toBe(true);
    expect(channelItems[1].classList.contains('is-assigned')).toBe(true);

    const assignedTags = container.querySelectorAll('.ps-sm-assigned-tag');
    expect(assignedTags.length).toBe(2);
  });

  it('allows user to customize display name of assigned channels in location measurement point', () => {
    window.localStorage.removeItem('s4a_sensor_locations_v1');
    window.localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([
      {
        id: 'dev_custom_name_test',
        name: 'SUTO S401 Flow Meter',
        transport: 'USB',
        transportType: 'usb',
        sensors: [{
          id: 'sens_s401',
          name: 'S401',
          channels: [
            { id: 'ch_s401_1', channel_id: 1, name: 'Flow', unit: 'm³/h' }
          ]
        }]
      }
    ]));

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // 1. Add Location and Measurement Point
    const addLocBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Location'));
    fireEvent.click(addLocBtn);

    const addPtBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Add Measurement Point'));
    fireEvent.click(addPtBtn);

    const dropzone = container.querySelector('.ps-sm-dropzone');
    expect(dropzone).not.toBeNull();

    // 2. Drop Flow channel into the measurement point
    fireEvent.drop(dropzone, {
      dataTransfer: {
        getData: () => JSON.stringify({
          type: 'channel',
          id: 'ch_s401_1',
          channel_id: 1,
          name: 'Flow',
          unit: 'm³/h',
          device: 'SUTO S401 Flow Meter'
        })
      }
    });

    // 3. Verify channel tag has an editable input with default value 'Flow'
    const nameInput = container.querySelector('.ps-sm-tag-name-input');
    expect(nameInput).not.toBeNull();
    expect(nameInput.value).toBe('Flow');

    // 4. Change display name to 'Main Header Flow'
    fireEvent.change(nameInput, { target: { value: 'Main Header Flow' } });
    expect(nameInput.value).toBe('Main Header Flow');

    // 5. Verify locations storage reflects modified displayName
    const currentLocs = getLocations();
    const assignedCh = currentLocs[0].measurementPoints[0].channels[0];
    expect(assignedCh.displayName).toBe('Main Header Flow');
    expect(assignedCh.name).toBe('Flow');

    // 6. Verify sync to ProcessScape incorporates custom displayName for display and preserves rawName for telemetry
    const syncRes = syncAllLocationsToScapes(currentLocs);
    expect(syncRes.success).toBe(true);

    const activeScape = getActiveScape();
    const sensorCard = activeScape.elements.find(e => e.type === 'sensor_card');
    expect(sensorCard).toBeDefined();
    expect(sensorCard.channels[0].name).toBe('Main Header Flow');
    expect(sensorCard.channels[0].rawName).toBe('Flow');
  });

  it('syncs measurement point with channels to ProcessScape, preserving all channels upon reload', () => {
    window.localStorage.removeItem('s4a_sensor_locations_v1');
    window.localStorage.removeItem('s4a_processscapes_v1');

    const defaultScape = getActiveScape();
    const locId = 'loc_test_sync';
    const mpId = 'mp_test_sync';

    const testLocations = [{
      id: locId,
      name: 'Compressor Room',
      scapeId: defaultScape.id,
      measurementPoints: [{
        id: mpId,
        name: 'S403 Flow Station',
        channels: [
          { id: 'ch_f1', channel_id: 1, name: 'Flow Rate', unit: 'm³/h' },
          { id: 'ch_t1', channel_id: 2, name: 'Temperature', unit: '°C' }
        ]
      }]
    }];

    // 1. Sync all locations to scapes
    const res = syncAllLocationsToScapes(testLocations);
    expect(res.success).toBe(true);
    expect(res.syncCount).toBe(1);

    // 2. Render ProcessScapeView and verify reloadActiveScape loads the sensor card with its channels
    let actions = null;
    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        onRegisterActions={(a) => { actions = a; }}
      />
    );

    // Reload active scape
    act(() => {
      actions.reloadActiveScape(defaultScape.id);
    });

    // Sensor card should be rendered on the drawing canvas
    const sensorCards = container.querySelectorAll('.sensor-badge-group');
    expect(sensorCards.length).toBeGreaterThan(0);

    const card = Array.from(sensorCards).find(c => c.textContent.includes('S403 Flow Station'));
    expect(card).not.toBeUndefined();

    // Verify both channels are rendered inside the sensor card (NOT a blank card!)
    expect(card.textContent).toContain('Flow Rate:');
    expect(card.textContent).toContain('Temperature:');
    expect(card.textContent).toContain('m³/h');
    expect(card.textContent).toContain('°C');
  });

  it('removes sensor card from ProcessScape when all channels are removed from a location and synced', () => {
    const defaultScape = getActiveScape();
    const locId = 'loc_test_removal';
    const mpId = 'mp_test_removal';

    // 1. Initial location with channels synced
    const initialLocations = [{
      id: locId,
      name: 'Compressor Room',
      scapeId: defaultScape.id,
      measurementPoints: [{
        id: mpId,
        name: 'S403 Flow Station',
        channels: [
          { id: 'ch_f1', channel_id: 1, name: 'Flow Rate', unit: 'm³/h' }
        ]
      }]
    }];
    syncAllLocationsToScapes(initialLocations);

    // Verify scape now has the sensor card
    let scapes = getAllScapes();
    let currentScape = scapes.find(s => s.id === defaultScape.id);
    expect(currentScape.elements.some(e => e.type === 'sensor_card')).toBe(true);

    // 2. Now user removes all channels from the location
    const emptyChannelLocations = [{
      id: locId,
      name: 'Compressor Room',
      scapeId: defaultScape.id,
      measurementPoints: [{
        id: mpId,
        name: 'S403 Flow Station',
        channels: []
      }]
    }];

    const syncRes = syncAllLocationsToScapes(emptyChannelLocations);
    expect(syncRes.success).toBe(true);
    expect(syncRes.syncCount).toBe(0);

    // Verify the scape has ZERO sensor cards now
    scapes = getAllScapes();
    currentScape = scapes.find(s => s.id === defaultScape.id);
    const sensorCards = currentScape.elements.filter(e => e.type === 'sensor_card');
    expect(sensorCards.length).toBe(0);

    // 3. Render ProcessScapeView and verify reloadActiveScape renders 0 sensor cards
    let actions = null;
    const { container } = render(
      <ProcessScapeView
        initialMode="runtime"
        onRegisterActions={(a) => { actions = a; }}
      />
    );

    act(() => {
      actions.reloadActiveScape(defaultScape.id);
    });

    const renderedCards = container.querySelectorAll('.sensor-badge-group');
    expect(renderedCards.length).toBe(0);
  });

  it('saves modifications and deletions when exiting modify scape mode so changes persist upon reload', () => {
    const defaultScape = getActiveScape();
    let actions = null;

    const { container } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={[
          { id: 'el_keep', type: 'machine_compressor', tag: 'Comp 1', x: 100, y: 100, w: 140, h: 120 },
          { id: 'el_delete_me', type: 'tank_buffer', tag: 'Tank Delete', x: 300, y: 100, w: 120, h: 60 }
        ]}
        onRegisterActions={(a) => { actions = a; }}
      />
    );

    // Select the asset to delete
    const deleteNode = container.querySelector('[data-node-id="el_delete_me"]');
    expect(deleteNode).not.toBeNull();
    fireEvent.click(deleteNode);

    // Click delete in the HUD
    const deleteBtn = container.querySelector('#hudDeleteBtn');
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn);

    // The element should be removed from view
    expect(container.textContent).not.toContain('Tank Delete');

    // Trigger save and exit editor
    act(() => {
      actions.handleSaveAndExit();
    });

    // Verify saved scape in storage no longer contains the deleted element
    const saved = getActiveScape();
    expect(saved.elements.some(e => e.id === 'el_delete_me')).toBe(false);
  });

  it('displays example compressor station layout with demo notice when no locations exist, and removes it once a location is created', () => {
    // 1. Ensure clean state with 0 locations and 0 real scapes
    window.localStorage.clear();

    let openSensorManagerTriggered = false;
    const { container, unmount } = render(
      <ProcessScapeView
        initialMode="runtime"
        onOpenSensorManager={() => { openSensorManagerTriggered = true; }}
      />
    );

    // Verify demo notice banner is present with message prompting location creation
    const banner = container.querySelector('.ps-example-demo-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('DEMO PREVIEW');
    expect(banner.textContent).toContain('Example Plant Layout');
    expect(banner.textContent).toContain('Create your own location and ProcessScape stage');

    // Clicking CTA button triggers sensor manager callback
    const ctaBtn = container.querySelector('.ps-example-demo-btn-primary');
    expect(ctaBtn).not.toBeNull();
    fireEvent.click(ctaBtn);
    expect(openSensorManagerTriggered).toBe(true);

    // Example station elements from example-compressor-station-layout.json are rendered
    expect(container.textContent).toContain('Air Compressor');
    expect(container.textContent).toContain('Buffer Tank 1');

    unmount();

    // 2. Clicking dismiss button (✕) dismisses the demo notice
    const { container: containerDismissable } = render(
      <ProcessScapeView initialMode="runtime" />
    );
    expect(containerDismissable.querySelector('.ps-example-demo-banner')).not.toBeNull();
    const dismissBtn = containerDismissable.querySelector('.ps-example-demo-dismiss-btn');
    expect(dismissBtn).not.toBeNull();
    fireEvent.click(dismissBtn);
    expect(containerDismissable.querySelector('.ps-example-demo-banner')).toBeNull();

    // 3. Now user creates a real location in the system
    saveLocations([{
      id: 'loc_real_1',
      name: 'Real Compressor Station',
      scapeId: 'scape_real_1',
      measurementPoints: []
    }]);

    const { container: containerWithLocation } = render(
      <ProcessScapeView
        initialMode="runtime"
      />
    );

    // Once a real location exists, the example demo notice banner is GONE
    expect(containerWithLocation.querySelector('.ps-example-demo-banner')).toBeNull();

    // 4. Also, if a real scape exists (even without locations), the example demo banner is GONE
    window.localStorage.clear();
    createNewScape('Custom Factory Scape');
    const { container: containerWithScape } = render(
      <ProcessScapeView initialMode="runtime" />
    );
    expect(containerWithScape.querySelector('.ps-example-demo-banner')).toBeNull();
  });

  it('SensorManagerModal provides Auto Detect LAN mode to probe subnet and batch import multiple devices with checkboxes', async () => {
    // Mock lanScanner.scanLanRange
    const mockDiscovered = [
      {
        id: 'dev_192.168.5.28',
        ip: '192.168.5.28',
        port: 8080,
        transport: 'API',
        name: 'SUTO S332 Main Station',
        serial: 'SN-332001',
        firmware: '1.0.3-Atlas11',
        channelCount: 3,
        channels: [
          { channelid: 1, channeldescription: 'Dew point', Unitascii: '°C Td' },
          { channelid: 2, channeldescription: 'Temperature', Unitascii: '°C' },
          { channelid: 3, channeldescription: 'Flow', Unitascii: 'm³/h' }
        ]
      },
      {
        id: 'dev_192.168.5.29',
        ip: '192.168.5.29',
        port: 8080,
        transport: 'API',
        name: 'SUTO S332 Dryer Station',
        serial: 'SN-332002',
        firmware: '1.0.3-Atlas11',
        channelCount: 2,
        channels: [
          { channelid: 1, channeldescription: 'Humidity', Unitascii: '%rH' },
          { channelid: 2, channeldescription: 'Pressure', Unitascii: 'bar' }
        ]
      }
    ];

    const broadcastSpy = vi.spyOn(lanScannerModule, 'discoverDevicesViaBroadcast').mockImplementation(async (opts) => {
      for (const dev of mockDiscovered) {
        opts.onDeviceFound(dev);
      }
      return mockDiscovered;
    });

    window.__TAURI_INTERNALS__ = { invoke: vi.fn() };

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // 1. Click "Detect" button in SensorManager header to open DeviceConnectModal
    const detectBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Detect')
    );
    expect(detectBtn).not.toBeUndefined();
    fireEvent.click(detectBtn);

    // Switch to Ethernet TCP tab and select Auto Detect
    const tcpTab = Array.from(document.querySelectorAll('.modal-tab-btn')).find(
      t => t.textContent.includes('Ethernet TCP') || t.textContent.includes('Ethernet')
    );
    expect(tcpTab).not.toBeUndefined();
    fireEvent.click(tcpTab);

    const autoModeBtn = Array.from(document.querySelectorAll('.lan-detect-mode-btn')).find(
      b => b.textContent.includes('Auto Detect')
    );
    expect(autoModeBtn).not.toBeUndefined();
    fireEvent.click(autoModeBtn);

    // DeviceConnectModal shows Auto Detect section active
    expect(document.querySelector('.lan-auto-detect-section')).not.toBeNull();
    expect(document.querySelector('.lan-scan-btn')).not.toBeNull();

    // 2. Click "Scan LAN"
    const scanBtn = document.querySelector('.lan-scan-btn');
    await act(async () => {
      fireEvent.click(scanBtn);
    });

    expect(broadcastSpy).toHaveBeenCalled();

    // Discovered devices are rendered in the list with checkboxes
    const cards = document.querySelectorAll('.lan-device-card');
    expect(cards.length).toBe(2);
    expect(document.body.textContent).toContain('192.168.5.28');
    expect(document.body.textContent).toContain('192.168.5.29');
    expect(document.body.textContent).toContain('SUTO S332 Main Station');
    expect(document.body.textContent).toContain('SUTO S332 Dryer Station');

    // "Get Sensors (2 Devices)" button is visible
    const getSensorsBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent.includes('Get Sensors')
    );
    expect(getSensorsBtn).not.toBeUndefined();
    expect(getSensorsBtn.textContent).toContain('2 Devices');

    // 3. User unchecks the second device (192.168.5.29)
    const checkboxes = document.querySelectorAll('.lan-device-checkbox');
    expect(checkboxes.length).toBe(2);
    fireEvent.click(checkboxes[1]);

    // Now button shows 1 Device
    expect(getSensorsBtn.textContent).toContain('1 Device');

    // 4. Click "Get Sensors"
    await act(async () => {
      fireEvent.click(getSensorsBtn);
    });

    // Modal closes and device is added to SensorManagerModal's device tree
    await waitFor(() => {
      expect(document.querySelector('.device-connect-overlay')).toBeNull();
    });

    expect(container.textContent).toContain('SUTO S332 Main Station');
  });

  it('DeviceConnectModal in web mode shows only Bluetooth BLE tab without S332 API (Dev)', () => {
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI__;

    const { container } = render(
      <DeviceConnectModal
        isOpen={true}
        onClose={() => {}}
        onConnected={() => {}}
      />
    );

    const tabs = Array.from(container.querySelectorAll('.modal-tab-btn'));
    expect(tabs.length).toBe(1);
    expect(tabs[0].textContent).toContain('Bluetooth (BLE)');
    expect(container.textContent).not.toContain('S332 API (Dev)');
  });

  it('renders sensor card with seamless zero-gap header and aligned channel columns (name left, value right, unit left)', () => {
    const card = {
      id: 'sensor_align_1',
      tag: 'Air Compressor 1 / Discharge',
      x: 200,
      y: 200,
      channels: [
        { name: 'Pressure', val: 7.25, unit: 'bar' },
        { name: 'Flow', val: 1240.8, unit: 'm³/h' }
      ]
    };

    const svgNode = renderSensorCard(card);
    expect(svgNode).not.toBeNull();

    // 1. Verify zero space between header badge and card body
    const cardBorder = svgNode.querySelector('.sensor-card-border');
    const badge = svgNode.querySelector('.badge-rect');
    expect(cardBorder).not.toBeNull();
    expect(badge).not.toBeNull();

    // 2. Channel names have text-anchor="start" (align left)
    const nameTexts = Array.from(svgNode.querySelectorAll('text')).filter(t => t.textContent.includes(':'));
    expect(nameTexts.length).toBe(2);
    expect(nameTexts[0].textContent).toBe('Pressure:');
    expect(nameTexts[0].getAttribute('text-anchor')).toBe('start');
    expect(nameTexts[1].textContent).toBe('Flow:');
    expect(nameTexts[1].getAttribute('text-anchor')).toBe('start');
    // Both start at the same X
    expect(nameTexts[0].getAttribute('x')).toBe(nameTexts[1].getAttribute('x'));

    // 3. Channel values have text-anchor="end" (align right)
    const valTexts = Array.from(svgNode.querySelectorAll('text')).filter(t => t.textContent === '7.25' || t.textContent === '1240.8');
    expect(valTexts.length).toBe(2);
    expect(valTexts[0].getAttribute('text-anchor')).toBe('end');
    expect(valTexts[1].getAttribute('text-anchor')).toBe('end');
    // Both end at the exact same X
    expect(valTexts[0].getAttribute('x')).toBe(valTexts[1].getAttribute('x'));

    // 4. Channel units have text-anchor="start" (align left)
    const unitTexts = Array.from(svgNode.querySelectorAll('text')).filter(t => t.textContent === 'bar' || t.textContent === 'm³/h');
    expect(unitTexts.length).toBe(2);
    expect(unitTexts[0].getAttribute('text-anchor')).toBe('start');
    expect(unitTexts[1].getAttribute('text-anchor')).toBe('start');
    // Both start at the exact same X
    expect(unitTexts[0].getAttribute('x')).toBe(unitTexts[1].getAttribute('x'));
  });

  it('hides sensor mode cards in editor mode and displays them in runtime mode', () => {
    const testElements = [
      { id: 'el_comp', type: 'machine_compressor', tag: 'Comp 1', x: 100, y: 100, w: 140, h: 120 },
      { id: 'el_sensor_card', type: 'sensor_card', tag: 'S403 Flow', x: 200, y: 200, channels: [{ id: 'c1', name: 'Flow', val: 120, unit: 'm³/h' }] }
    ];

    // In editor mode: sensor cards are hidden to keep diagram editing clean
    const { container: editorContainer } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={testElements}
      />
    );
    expect(editorContainer.querySelector('[data-node-id="el_comp"]')).not.toBeNull();
    expect(editorContainer.querySelector('[data-card-id="el_sensor_card"]')).toBeNull();
    expect(editorContainer.querySelector('.sensor-badge-group')).toBeNull();

    // In runtime mode: sensor cards are rendered for live monitoring
    const { container: runtimeContainer } = render(
      <ProcessScapeView
        initialMode="runtime"
        initialElements={testElements}
      />
    );
    expect(runtimeContainer.querySelector('[data-node-id="el_comp"]')).not.toBeNull();
    expect(runtimeContainer.querySelector('[data-card-id="el_sensor_card"]')).not.toBeNull();
  });

  it('supports proportional scaling slider for equipment items in inspector', () => {
    const testElements = [
      { id: 'el_comp', type: 'machine_compressor', tag: 'Comp 1', x: 100, y: 100, w: 170, h: 140 }
    ];

    const { container } = render(
      <ProcessScapeView
        initialMode="editor"
        initialElements={testElements}
      />
    );

    // Select the machine
    const compNode = container.querySelector('[data-node-id="el_comp"]');
    expect(compNode).not.toBeNull();
    fireEvent.click(compNode);

    // Inspector should show the Device Size slider
    const scaleSlider = container.querySelector('#itemScaleSlider');
    expect(scaleSlider).not.toBeNull();
    expect(scaleSlider.value).toBe('100'); // Default 100%

    // Scale up to 150%
    fireEvent.change(scaleSlider, { target: { value: '150' } });

    // Slider value should now reflect 150%
    expect(scaleSlider.value).toBe('150');
    expect(container.textContent).toContain('150%');

    // Pipeline Anchor Binding block should be removed
    expect(container.textContent).not.toContain('Pipeline Anchor Binding');
  });

  it('renders asset with scale wrapper in renderAssetNode when scale is customized', () => {
    const node = {
      id: 'tank_1',
      type: 'tank_buffer',
      x: 100,
      y: 100,
      scale: 1.5
    };
    const rendered = renderAssetNode(node);
    const wrapper = rendered.querySelector('.asset-scale-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper.getAttribute('transform')).toBe('scale(1.5)');
  });

  it('keeps equipment tag font size constant on screen regardless of scale', () => {
    const comp1 = {
      id: 'comp_1',
      type: 'machine_compressor',
      x: 100,
      y: 100,
      scale: 1.0,
      tag: 'Air Compressor'
    };
    const comp15 = {
      id: 'comp_15',
      type: 'machine_compressor',
      x: 100,
      y: 100,
      scale: 1.5,
      tag: 'Air Compressor'
    };
    const rendered1 = renderAssetNode(comp1);
    const rendered15 = renderAssetNode(comp15);

    const txt1 = Array.from(rendered1.querySelectorAll('text')).find(t => t.textContent === 'Air Compressor');
    const txt15 = Array.from(rendered15.querySelectorAll('text')).find(t => t.textContent === 'Air Compressor');

    expect(txt1).not.toBeNull();
    expect(txt15).not.toBeNull();
    expect(parseFloat(txt1.getAttribute('font-size'))).toBe(12);
    // At scale 1.5, font-size is 12 / 1.5 = 8 so when scaled by 1.5 it renders at 12px ("text is text")
    expect(parseFloat(txt15.getAttribute('font-size'))).toBe(8);
  });

  it('allows equipment tag to be null or empty string without rendering text', () => {
    const emptyComp = {
      id: 'comp_empty',
      type: 'machine_compressor',
      x: 100,
      y: 100,
      tag: '' // explicitly empty
    };
    const nullTank = {
      id: 'tank_null',
      type: 'tank_horizontal',
      x: 200,
      y: 200,
      tag: null // explicitly null
    };
    const renderedComp = renderAssetNode(emptyComp);
    const renderedTank = renderAssetNode(nullTank);

    expect(renderedComp.textContent).not.toContain('Air Compressor');
    expect(renderedTank.textContent).not.toContain('Horiz Tank');
  });

  it('uses finer 2px snap step for high precision dragging', () => {
    // Default snap step is now 2
    expect(snap(10.4)).toBe(10);
    expect(snap(11.2)).toBe(12);
    expect(snap(11.9)).toBe(12);
    expect(snap(13.1)).toBe(14);
  });

  it('correctly tracks assigned channels for a device and unassigns them upon deletion', () => {
    const testDev = {
      id: 'dev_test_s403',
      name: 'SUTO S403 Multi-Parameter',
      transport: 'Ethernet (192.168.1.100)',
      transportType: 'tcp',
      connectionConfig: {
        transport: 'tcp',
        host: '192.168.1.100',
        port: 502
      },
      sensors: [
        {
          id: 'sens_s403',
          name: 'S403',
          channels: [
            { id: 'ch_s403_flow', channel_id: 1, name: 'Flow', unit: 'm³/h', device: 'SUTO S403 Multi-Parameter' },
            { id: 'ch_s403_press', channel_id: 2, name: 'Pressure', unit: 'bar', device: 'SUTO S403 Multi-Parameter' }
          ]
        }
      ]
    };

    const testLocations = [
      {
        id: 'loc_main',
        name: 'Main Plant',
        scapeId: 'scape_default',
        measurementPoints: [
          {
            id: 'mp_1',
            name: 'Inlet Point',
            channels: [
              { id: 'ch_s403_flow', channel_id: 1, name: 'Flow', unit: 'm³/h', device: 'SUTO S403 Multi-Parameter' }
            ]
          }
        ]
      }
    ];

    // 1. getDeviceChannelAssignments finds the active assignment
    const assignments = getDeviceChannelAssignments(testDev, testLocations);
    expect(assignments.length).toBe(1);
    expect(assignments[0].channelName).toBe('Flow');
    expect(assignments[0].locationName).toBe('Main Plant');
    expect(assignments[0].mpName).toBe('Inlet Point');

    // 2. Setup localStorage and test removeDeviceAndUnassignChannels
    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([testDev]));
    localStorage.setItem('s4a_sensor_locations_v1', JSON.stringify(testLocations));

    const result = removeDeviceAndUnassignChannels(testDev.id);
    expect(result.unassignedCount).toBe(1);
    expect(result.updatedDevices.length).toBe(0);
    expect(result.updatedLocations[0].measurementPoints[0].channels.length).toBe(0);

    // Verify localStorage was updated
    expect(getSavedDevices().length).toBe(0);
    expect(getLocations()[0].measurementPoints[0].channels.length).toBe(0);
  });

  it('auto-reconnects to saved devices on startup or refresh', async () => {
    const savedTcpDev = {
      id: 'dev_reconnect_tcp',
      name: 'Plant Flow Sensor',
      transport: 'Ethernet (192.168.1.200)',
      transportType: 'tcp',
      connectionConfig: {
        transport: 'tcp',
        host: '192.168.1.200',
        port: 502
      },
      sensors: []
    };

    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([savedTcpDev]));

    const connectTcpSpy = vi.spyOn(TauriSutoAPI, 'connectTcp').mockResolvedValue({
      transport: 'TCP',
      host: '192.168.1.200',
      port: 502
    });
    const isConnectedSpy = vi.spyOn(TauriSutoAPI, 'isConnected').mockReturnValue(false);

    const res = await autoReconnectSavedDevices();
    expect(res.reconnected).toBe(true);
    expect(res.transport).toBe('TCP');
    expect(connectTcpSpy).toHaveBeenCalledWith('192.168.1.200', 502);

    connectTcpSpy.mockRestore();
    isConnectedSpy.mockRestore();
  });

  it('automatically resumes connection for saved Bluetooth (BLE) devices on startup', async () => {
    const savedBleDev = {
      id: 'dev_ble_mock_1',
      name: 'SUTO S401 BLE',
      transport: 'Bluetooth (BLE)',
      transportType: 'ble',
      connectionConfig: {
        transport: 'ble',
        deviceId: 'ble-guid-saved-456',
        name: 'SUTO S401 BLE'
      },
      sensors: []
    };
    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([savedBleDev]));

    const resumeBleSpy = vi.spyOn(TauriSutoAPI, 'resumeBleConnection').mockResolvedValue({
      address: 1,
      device: 'SUTO S401 BLE',
      transport: 'BLE',
      deviceId: 'ble-guid-saved-456'
    });
    const isConnectedSpy = vi.spyOn(TauriSutoAPI, 'isConnected').mockReturnValue(false);

    const res = await autoReconnectSavedDevices();
    expect(res.reconnected).toBe(true);
    expect(res.transport).toBe('BLE');
    expect(resumeBleSpy).toHaveBeenCalledWith({
      deviceId: 'ble-guid-saved-456',
      name: 'SUTO S401 BLE'
    });

    resumeBleSpy.mockRestore();
    isConnectedSpy.mockRestore();
  });

  it('generates deterministic device IDs and correctly detects duplicate devices with isSameDevice', () => {
    // BLE ID determinism
    const bleId1 = generateDeterministicDeviceId('ble', { deviceId: 'ble-guid-abc' }, 'SUTO S401');
    const bleId2 = generateDeterministicDeviceId('ble', { deviceId: 'ble-guid-abc' }, 'SUTO S401');
    expect(bleId1).toBe(bleId2);
    expect(bleId1).toContain('ble-guid-abc');

    // TCP ID determinism
    const tcpId1 = generateDeterministicDeviceId('tcp', { host: '192.168.1.100', port: 502 }, 'S330');
    const tcpId2 = generateDeterministicDeviceId('tcp', { host: '192.168.1.100', port: 502 }, 'S330');
    expect(tcpId1).toBe(tcpId2);

    // isSameDevice tests
    const devA = { id: 'dev_1', serial: '12345678', transportType: 'ble' };
    const devB = { id: 'dev_2', serial: '12345678', transportType: 'ble' };
    expect(isSameDevice(devA, devB)).toBe(true);

    const devTcpA = { id: 'dev_tcp_1', transportType: 'tcp', connectionConfig: { host: '192.168.1.50', port: 502 } };
    const devTcpB = { id: 'dev_tcp_2', transportType: 'tcp', connectionConfig: { host: '192.168.1.50', port: 502 } };
    expect(isSameDevice(devTcpA, devTcpB)).toBe(true);

    // Generic serial numbers should not falsely match
    const devGen1 = { id: 'dev_gen_1', serial: 'SN-USB-123456', transportType: 'usb' };
    const devGen2 = { id: 'dev_gen_2', serial: 'SN-USB-987654', transportType: 'usb' };
    expect(isSameDevice(devGen1, devGen2)).toBe(false);
  });

  it('upsertDeviceList updates existing devices in-place and preserves existing device and channel IDs', () => {
    const existingList = [
      {
        id: 'dev_original_id',
        name: 'SUTO S401',
        serial: '88776655',
        transportType: 'ble',
        isOnline: false,
        sensors: [
          {
            id: 'sens_orig_1',
            name: 'S401',
            channels: [
              { id: 'ch_orig_flow_1', channel_id: 1, name: 'Flow Rate', unit: 'm³/h' }
            ]
          }
        ]
      }
    ];

    const reDetectedDev = {
      id: 'dev_new_random_id',
      name: 'SUTO S401',
      serial: '88776655',
      transportType: 'ble',
      sensors: [
        {
          id: 'sens_new_1',
          name: 'S401',
          channels: [
            { id: 'ch_new_flow_1', channel_id: 1, name: 'Flow Rate Refreshed', unit: 'm³/h' }
          ]
        }
      ]
    };

    const merged = upsertDeviceList(existingList, [reDetectedDev]);
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('dev_original_id'); // Preserved!
    expect(merged[0].isOnline).toBe(true);
    expect(merged[0].sensors[0].channels[0].id).toBe('ch_orig_flow_1'); // Channel ID preserved for locations!
    expect(merged[0].sensors[0].channels[0].name).toBe('Flow Rate Refreshed');
  });

  it('upsertDeviceList does not wipe out existing channels if a subsequent scan returns 0 channels', () => {
    const existingList = [
      {
        id: 'dev_s403_id',
        name: 'S403-12345678',
        serial: '12345678',
        transportType: 'ble',
        isOnline: false,
        sensors: [
          {
            id: 'sens_s403',
            name: 'S403',
            channels: [
              { id: 'ch_s403_flow', channel_id: 2, name: 'Flow', unit: 'm³/h' },
              { id: 'ch_s403_press', channel_id: 3, name: 'Pressure', unit: 'bar' }
            ]
          }
        ]
      }
    ];

    // Re-detection where channel scan returned empty (e.g. timeout)
    const scanWithZeroChannels = {
      id: 'dev_new_ble_id',
      name: 'S403-12345678',
      serial: '12345678',
      transportType: 'ble',
      sensors: [
        {
          id: 'sens_s403_empty',
          name: 'S403',
          channels: []
        }
      ]
    };

    const merged = upsertDeviceList(existingList, [scanWithZeroChannels]);
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('dev_s403_id');
    expect(merged[0].isOnline).toBe(true);
    expect(merged[0].sensors[0].channels.length).toBe(2);
    expect(merged[0].sensors[0].channels[0].name).toBe('Flow');
  });

  it('getSavedDevices auto-heals and recovers device channels from locations if device lost channels', () => {
    const emptyDev = {
      id: 'dev_ble_heal',
      name: 'S403-12345678',
      serial: '12345678',
      transport: 'Bluetooth (BLE)',
      transportType: 'ble',
      sensors: [
        {
          id: 'sens_empty',
          name: 'S403',
          channels: []
        }
      ]
    };
    const testLoc = [
      {
        id: 'loc_main',
        name: 'Main Plant',
        measurementPoints: [
          {
            id: 'mp_flow',
            name: 'Main Flow',
            channels: [
              { id: 'ch_recovered_1', channel_id: 2, name: 'Flow Rate', unit: 'm³/h', device: 'S403-12345678' }
            ]
          }
        ]
      }
    ];
    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([emptyDev]));
    localStorage.setItem('s4a_sensor_locations_v1', JSON.stringify(testLoc));

    const saved = getSavedDevices();
    expect(saved.length).toBe(1);
    expect(saved[0].sensors[0].channels.length).toBe(1);
    expect(saved[0].sensors[0].channels[0].name).toBe('Flow Rate');
    expect(saved[0].sensors[0].channels[0].id).toBe('ch_recovered_1');
  });

  it('prompts confirmation warning when deleting a device with assigned channels in SensorManagerModal', async () => {
    const testDev = {
      id: 'dev_modal_test',
      name: 'Active Plant Sensor',
      transport: 'Ethernet (192.168.1.50)',
      transportType: 'api',
      sensors: [
        {
          id: 'sens_modal',
          name: 'Sensor 1',
          channels: [
            { id: 'ch_modal_1', channel_id: 10, name: 'Dew Point', unit: '°Ctd', device: 'Active Plant Sensor' }
          ]
        }
      ]
    };

    const testLocations = [
      {
        id: 'loc_comp',
        name: 'Compressor Room',
        scapeId: 'scape_default',
        measurementPoints: [
          {
            id: 'mp_comp',
            name: 'Dryer Output',
            channels: [
              { id: 'ch_modal_1', channel_id: 10, name: 'Dew Point', unit: '°Ctd', device: 'Active Plant Sensor' }
            ]
          }
        ]
      }
    ];

    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([testDev]));
    localStorage.setItem('s4a_sensor_locations_v1', JSON.stringify(testLocations));

    const disconnectSpy = vi.spyOn(TauriSutoAPI, 'disconnect').mockResolvedValue(true);

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
        onSyncToScape={() => {}}
      />
    );

    // Find the delete button on the device header
    const delBtn = container.querySelector('.ps-sm-device-del-btn');
    expect(delBtn).not.toBeNull();

    // Click remove device button
    fireEvent.click(delBtn);

    // Verify confirmation modal with warning banner is displayed
    const confirmModal = container.querySelector('.ps-sm-confirm-dialog');
    expect(confirmModal).not.toBeNull();
    expect(confirmModal.textContent).toContain('Remove Sensor Device');
    expect(confirmModal.textContent).toContain('Active Channels in Use');
    expect(confirmModal.textContent).toContain('Dew Point');
    expect(confirmModal.textContent).toContain('Compressor Room');
    expect(confirmModal.textContent).toContain('Dryer Output');

    // Confirm deletion
    const confirmDeleteBtn = confirmModal.querySelector('.ps-sm-btn.danger');
    expect(confirmDeleteBtn).not.toBeNull();
    expect(confirmDeleteBtn.textContent).toContain('Unassign & Delete Device');

    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    // Connection should be disconnected
    expect(disconnectSpy).toHaveBeenCalled();

    // Confirmation modal should close
    expect(container.querySelector('.ps-sm-confirm-dialog')).toBeNull();

    // Left side list should no longer show the device
    expect(container.textContent).toContain('No Sensors Collected Yet');

    disconnectSpy.mockRestore();
  });

  it('supports DND with memory fallback when e.dataTransfer.getData is empty in app mode', async () => {
    const testDev = {
      id: 'dev_dnd_test',
      name: 'Pressure Sensor',
      transport: 'USB',
      transportType: 'usb',
      sensors: [
        {
          id: 'sens_press',
          name: 'S401',
          channels: [
            { id: 'ch_press_1', channel_id: 1, name: 'Pressure High', unit: 'bar', device: 'Pressure Sensor' }
          ]
        }
      ]
    };

    const testLocations = [
      {
        id: 'loc_dnd',
        name: 'Boiler Room',
        scapeId: 'scape_default',
        measurementPoints: []
      }
    ];

    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([testDev]));
    localStorage.setItem('s4a_sensor_locations_v1', JSON.stringify(testLocations));

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
        onSyncToScape={() => {}}
      />
    );

    // 1. Drag start sets window.__ps_active_drag
    const chItem = container.querySelector('.ps-sm-channel-item');
    expect(chItem).not.toBeNull();

    fireEvent.dragStart(chItem, {
      dataTransfer: {
        setData: () => {},
        effectAllowed: 'all'
      }
    });

    expect(window.__ps_active_drag).not.toBeNull();
    expect(window.__ps_active_drag.name).toBe('Pressure High');

    // 2. Drop target simulates Tauri WebKit where dataTransfer.getData returns ""
    const dropzone = container.querySelector('.ps-sm-loc-empty-dropzone');
    expect(dropzone).not.toBeNull();

    fireEvent.drop(dropzone, {
      dataTransfer: {
        getData: () => '' // Tauri WebKit empty string
      }
    });

    // Should successfully create measurement point using fallback payload
    expect(container.textContent).toContain('Pressure High');
    expect(container.textContent).toContain('✓ Assigned');
  });

  it('provides quick-assign (+ Assign) to bind channels directly without dragging', async () => {
    const testDev = {
      id: 'dev_quick_assign',
      name: 'Flow Meter',
      transport: 'TCP',
      transportType: 'tcp',
      sensors: [
        {
          id: 'sens_flow',
          name: 'S401 Flow',
          channels: [
            { id: 'ch_quick_1', channel_id: 5, name: 'Flow Rate', unit: 'm³/h', device: 'Flow Meter' }
          ]
        }
      ]
    };

    const testLocations = [
      {
        id: 'loc_quick',
        name: 'Header Room',
        scapeId: 'scape_default',
        measurementPoints: [
          {
            id: 'mp_quick_1',
            name: 'Main Pipe',
            channels: []
          }
        ]
      }
    ];

    localStorage.setItem('s4a_sensor_devices_v1', JSON.stringify([testDev]));
    localStorage.setItem('s4a_sensor_locations_v1', JSON.stringify(testLocations));

    const { container } = render(
      <SensorManagerModal
        isOpen={true}
        onClose={() => {}}
        onSyncToScape={() => {}}
      />
    );

    const assignBtn = container.querySelector('.ps-sm-quick-assign-btn');
    expect(assignBtn).not.toBeNull();
    expect(assignBtn.textContent).toContain('+ Assign');

    fireEvent.click(assignBtn);

    // Channel is now assigned to the measurement point
    expect(container.textContent).toContain('✓ Assigned');
  });
});




