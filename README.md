# HWP MCP Server

Production-ready MCP server for reading and converting Korean HWP documents.

## Quick Start

```bash
npm install
npm run build
```

Run the server:

```bash
npm run dev
```

HTTP/SSE mode (for PlayMCP):

```bash
MCP_TRANSPORT=http MCP_PORT=8787 node dist/index.js
```

## Docs

- User guide: `docs/README.md`
- API reference: `docs/API.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Contributing: `docs/CONTRIBUTING.md`

## Supported Tools

- `read_hwp`
- `read_hwpx`
- `convert_to_docx`

## Bridge Mode (Local -> Remote)

Run the same MCP in bridge mode to read local files and forward them to a remote MCP server.

```bash
HWP_MCP_MODE=bridge HWP_MCP_REMOTE_URL=https://hwp-universal-reader-mcp.onrender.com/message node dist/index.js
```

`HWP_MCP_REMOTE_URL` can also point to the `/sse` endpoint; it will be rewritten to `/message`.

## Environment

- `HWP_MCP_ALLOWED_DIRS`: Comma-separated allowed roots for file access.
- `HWP_MCP_MEMORY_LIMIT_MB`: Heap usage limit for large files.
- `LOG_LEVEL`: `debug`, `info`, `warn`, `error`.
- `HWP_MCP_MODE`: `server` (default) or `bridge` (local file access + remote calls).
- `HWP_MCP_REMOTE_URL`: Remote MCP HTTP endpoint used in bridge mode.
- `HWP_MCP_REMOTE_TIMEOUT_MS`: Optional remote request timeout in milliseconds.

## Credits

- [hwp.js](https://github.com/hahnlee/hwp.js) - Apache 2.0
- [@ssabrojs/hwpxjs](https://www.npmjs.com/package/@ssabrojs/hwpxjs) - MIT
