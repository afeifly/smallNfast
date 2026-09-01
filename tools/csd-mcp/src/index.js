#!/usr/bin/env node
/**
 * csd-mcp — MCP server for inspecting and modifying SUTO CSD measurement files.
 *
 * Tools:
 *   inspect_csd           parse a .CSD and report structure + first/last rows
 *   modify_channel_range  scale/offset/set/randomize a channel over a time range
 *   extend_csd            prepend/append seconds of synthetic data
 *
 * Run directly for a quick CLI check:
 *   node src/index.js <tool> <json-args>       (stdio-free, prints JSON)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { inspect, modifyChannelRange, extend } from './ops.js';

function textBlock(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({
  name: 'csd-mcp',
  version: '0.1.0',
});

server.tool(
  'inspect_csd',
  'Parse a SUTO .CSD measurement file and report its header, channels, sample rate, time range, and the first/last data rows.',
  { path: z.string().describe('Absolute path to the .CSD file') },
  async ({ path }) => textBlock(await inspect({ path })),
);

server.tool(
  'modify_channel_range',
  'Modify one channel\'s values over a time or sample range of a .CSD file and write a new file. ' +
  'ops: multiply|add|subtract (affect measurement values only) or set|random (replace everything in range, incl. invalid gaps). ' +
  'Range defaults to the whole file if no start/stop given. Example: multiply channel "Flow" by 2 from "2026-08-20 19:30:00" to "2026-08-20 19:40:00".',
  {
    path: z.string().describe('Source .CSD path'),
    outPath: z.string().describe('Output .CSD path to write'),
    channel: z.union([z.number(), z.string()]).describe('Channel index or exact/partial name'),
    op: z.enum(['multiply', 'add', 'subtract', 'set', 'random']).describe('Operation'),
    value: z.number().optional().describe('Multiplier / addend / set value'),
    lo: z.number().optional().describe('Random op: lower bound'),
    hi: z.number().optional().describe('Random op: upper bound'),
    startTime: z.union([z.number(), z.string()]).optional().describe('Range start (epoch ms or date string)'),
    stopTime: z.union([z.number(), z.string()]).optional().describe('Range stop (epoch ms or date string)'),
    startSample: z.number().optional().describe('Range start sample index'),
    stopSample: z.number().optional().describe('Range stop sample index'),
    seed: z.number().optional().describe('Seed for reproducible random op'),
  },
  async (args) => textBlock(await modifyChannelRange(args)),
);

server.tool(
  'extend_csd',
  'Prepend/append seconds of new samples to a .CSD file (e.g. add 20 min before the existing data) and write a new file. ' +
  'channelModes maps channel index or name to a mode: ' +
  '{mode:"constant",value} | {mode:"random",lo,hi} | {mode:"copyFirst"} | {mode:"copyLast"} | {mode:"consumption"}. ' +
  'Unspecified channels copy the boundary value. Use mode:"consumption" with flowChannel (the Nm³/min flow channel index/name) ' +
  'so Consumption accumulates from the flow (per-second = flow/60), anchored at the existing boundary value so added consumption ' +
  'stays below/above it consistently.',
  {
    path: z.string().describe('Source .CSD path'),
    outPath: z.string().describe('Output .CSD path to write'),
    prependSeconds: z.number().optional().describe('Seconds of new data added before the existing range (earlier time)'),
    appendSeconds: z.number().optional().describe('Seconds of new data added after the existing range'),
    channelModes: z.record(z.union([
      z.object({ mode: z.literal('constant'), value: z.number() }),
      z.object({ mode: z.literal('random'), lo: z.number(), hi: z.number(), seed: z.number().optional() }),
      z.object({ mode: z.literal('copyFirst') }),
      z.object({ mode: z.literal('copyLast') }),
      z.object({ mode: z.literal('consumption') }),
      z.literal('constant'), z.literal('random'), z.literal('copyFirst'), z.literal('copyLast'), z.literal('consumption'),
    ])).optional().describe('Per-channel generation mode, keyed by channel index or name'),
    flowChannel: z.union([z.number(), z.string()]).optional().describe('Flow channel (Nm³/min) used to derive Consumption'),
    seed: z.number().optional().describe('Seed for reproducible random generation'),
  },
  async (args) => textBlock(await extend(args)),
);

// ── CLI fallback for quick manual testing (not used by MCP) ────────────────
if (process.argv[2] && process.argv[2] !== '--mcp') {
  const tool = process.argv[2];
  const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  const handlers = { inspect_csd: inspect, modify_channel_range: modifyChannelRange, extend_csd: extend };
  const fn = handlers[tool];
  if (!fn) {
    console.error(`Unknown tool "${tool}". Known: ${Object.keys(handlers).join(', ')}`);
    process.exit(1);
  }
  fn(args).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}