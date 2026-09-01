# csd-mcp

MCP server for inspecting and modifying **SUTO CSD** measurement files (the binary
format parsed by `s4a-web/src/api/CsdAPI.js`). Lets you do in plain language what
was previously done with one-off scripts, e.g.:

- *"extend LOG00005.CSD from 12 Aug 14:30 to 20 Aug"* → `extend_csd`
- *"prepend 20 minutes, keep Consumption accumulating from Flow"* → `extend_csd` + `consumption` mode
- *"double the Flow channel between 19:30 and 19:40"* → `modify_channel_range`

## Format summary

```
0    – 33     File header    (34 B)
34   – 3585   Protocol header (3552 B)   channels@3016 samples@3020 rate@3024 start@3032 stop@3040
3586 – ...    Channel headers (918 B each)
after – end   Data records    (int32 recordId + float64/channel) × numSamples
```

All multi-byte values are big-endian. Channel header fields: desc@10, sub-device@140,
sensor@291, unit@790, stats(res/min/max/sensorId)@848.

## Tools

| Tool                   | Description |
|------------------------|-------------|
| `inspect_csd`          | Parse a `.CSD`: channels, sample rate, time range, first/last rows |
| `modify_channel_range` | `multiply`/`add`/`subtract`/`set`/`random` a channel over a time or sample range |
| `extend_csd`           | Prepend/append seconds of synthetic data; `consumption` mode accumulates from a flow channel |

### extend_csd channel modes

Keyed by channel index or name. Unspecified channels copy the boundary value.

- `{"mode":"constant","value":x}`
- `{"mode":"random","lo":..,"hi":..}`
- `{"mode":"copyFirst"}` / `{"mode":"copyLast"}`
- `{"mode":"consumption"}` — accumulates `flowChannel/60` per second, anchored at the
  existing boundary value so prepended consumption stays **below** / appended stays **above**
  the boundary consistently.

## Run / test

```sh
npm install
# CLI (not MCP): node src/index.js <tool> '<json>'
node src/index.js inspect_csd '{"path":"../s4a-web/reference/LOG00030.CSD"}'
node src/index.js modify_channel_range '{"path":"...","outPath":"/tmp/out.CSD","channel":"Flow","op":"multiply","value":2}'
node src/index.js extend_csd '{"path":"...","outPath":"/tmp/out.CSD","prependSeconds":1200,"flowChannel":2,"channelModes":{"0":{"mode":"random","lo":7,"hi":7.2},"3":{"mode":"consumption"}}}'
```

## MCP registration

Registered in `/Users/ex/project/smallNfast/opencode.json` as the `csd` server
(local stdio). Restart opencode after changing config.

```json
{ "mcp": { "csd": { "type": "local", "command": ["node", "/Users/ex/project/smallNfast/tools/csd-mcp/src/index.js"], "enabled": true } } }
```