# @locci/box

CLI for [Locci Box](https://box.locci.cloud) — execute code in isolated microVM sandboxes, manage API keys, and connect AI agents via MCP.

## Installation

```bash
# NPM (recommended)
npm install -g @locci/box

# or via pnpm
pnpm add -g @locci/box

# or without installing
npx @locci/box --help
```

## Quick Start

```bash
# 1. Configure
loccibox init

# 2. Run code
loccibox run -l python -c "print('Hello from Locci Box!')"

# 3. Run from a file
loccibox run -l node -f script.js
```

## Commands

### `init`
Interactive setup wizard — sets API URL, API key, and profile name.
```bash
loccibox init
```

### `login`
Authenticate with email and password to get a JWT for key management.
```bash
loccibox login
```

### `run`
Execute code in an isolated sandbox.
```bash
loccibox run [options]

Options:
  -l, --lang <language>    python | node | bash | ruby | go | rust | c | cpp  (asked for when left out)
  -c, --code <code>        Inline code to execute
  -f, --file <path>        Path to a code file
  -t, --timeout <seconds>  Execution timeout in seconds (default: 30)
  --profile <name>         Use a specific profile
```

```bash
loccibox run -l python -c "print('hello')"
loccibox run -l bash -c "echo \$HOSTNAME"
loccibox run -l node -f index.js -t 60
```

### `box`
Agent boxes from the terminal, the same operations as the `box_*` MCP tools. A box is a Debian microVM (apt, git, curl, gcc, Python 3, Node 22) that keeps running between calls and keeps its disk after a stop; work happens in `/workspace`.
```bash
loccibox box create                          # prints the new box id
loccibox box create --language go            # with Go ready (python, go, rust, ruby, c, cpp, ...)
loccibox box create --attach <box_id>        # start or reattach to one
loccibox box ls                              # your boxes, running and stopped
loccibox box info <box_id>
loccibox box exec <box_id> -- ls -la         # put -- before a command with flags
loccibox box exec <box_id> 'apt-get install -y jq' -t 300
loccibox box shell <box_id>                  # interactive: each line runs in the box, cd is remembered
loccibox box write <box_id> app.py -f ./app.py
echo 'print(1)' | loccibox box write <box_id> one.py
loccibox box read <box_id> app.py [-o ./app.py]
loccibox box stop <box_id> [--rm]            # stop keeps the disk; --rm deletes it
loccibox box rm <box_id>
```
`exec` prints the command's stdout and stderr as they are and exits with its exit code, so it works in scripts and pipes. In `shell` each line is its own `sh -c` (variables and background jobs do not carry over; the folder, files and installs do).

### `sandboxes`
List all currently running sandboxes — recover IDs when a response was lost.
```bash
loccibox sandboxes [--profile <name>]
```

### `status`
Check the status of a specific sandbox by ID.
```bash
loccibox status <sandbox-id> [--profile <name>]
```

### `stop`
Stop and destroy a running sandbox.
```bash
loccibox stop <sandbox-id> [-y] [--profile <name>]

Flags:
  -y, --yes    Skip confirmation prompt
```

### `keys`
Manage API keys (requires `loccibox login` first).
```bash
loccibox keys list
loccibox keys create --name "my-key"
loccibox keys revoke <key-id>
loccibox keys delete <key-id>
```

### `metrics`
View system and tenant usage statistics (requires admin key).
```bash
loccibox metrics [--profile <name>]
```

### `mcp start`
Start a stdio MCP server — connect Claude Desktop, Cursor, or any MCP client directly to Locci Box.
```bash
loccibox mcp start
```

### `mcp config`
Print ready-to-paste MCP config for your client.
```bash
loccibox mcp config
```

Example output:
```json
{
  "mcpServers": {
    "locci-box": {
      "command": "loccibox",
      "args": ["mcp", "start"],
      "env": {
        "LOCCIBOX_API_URL": "https://api-box.locci.cloud",
        "LOCCIBOX_API_KEY": "lbk_live_..."
      }
    }
  }
}
```

## MCP Tools

When connected via `loccibox mcp start` or the HTTP transport, the following tools are available to AI agents:

| Tool | Description |
|------|-------------|
| `run_sandbox` | Execute code in an isolated microVM |
| `get_sandbox_status` | Check the status of a running sandbox |
| `stop_sandbox` | Stop and destroy a sandbox |
| `list_sandboxes` | List all active sandboxes (use when a prior `run_sandbox` response was lost) |

## Configuration

Config is stored at `~/.loccibox/config.json`:

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "apiUrl": "https://api-box.locci.cloud",
      "apiKey": "lbk_live_..."
    }
  }
}
```

Environment variables override the config file:

```bash
export LOCCIBOX_API_URL="https://api-box.locci.cloud"
export LOCCIBOX_API_KEY="lbk_live_..."
```

## HTTP MCP Transport

If the API server has `MCP_HTTP_ENABLED=true`, it also accepts MCP over HTTP at `POST /mcp`:

```json
{
  "mcpServers": {
    "locci-box": {
      "type": "http",
      "url": "https://box.locci.cloud/mcp",
      "headers": { "Authorization": "Bearer lbk_live_..." }
    }
  }
}
```

## Project Structure

```
cli/
├── src/
│   ├── commands/   init · login · run · sandboxes · status · stop · metrics · keys · mcp
│   ├── lib/        api.ts · config.ts · output.ts
│   ├── types/      index.ts
│   └── index.ts
├── dist/           compiled output (published to NPM)
├── package.json
└── tsconfig.json
```

## License

MIT — see [LICENSE](./LICENSE)
