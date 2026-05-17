# Locci Box CLI — Build Guide & IBM Bob Prompts

> Addendum to the main Locci Box build guide
> CLI Stack: **Commander.js** · **Clack** · **TypeScript** · **IBM Bob**

---

## What Is the Locci Box CLI?

The Locci Box CLI (`loccibox`) is a developer-first terminal interface for the Locci Box API. Developers who prefer the terminal over a web dashboard can run sandboxes, manage API keys, stream logs, and check metrics — all without opening a browser.

```bash
# What it feels like to use
$ loccibox run --lang python --code "print('Hello from Locci Box')"
$ loccibox run --file ./script.py
$ loccibox status lbox_abc123
$ loccibox stop lbox_abc123
$ loccibox keys list
$ loccibox keys create --name "ci-pipeline"
$ loccibox metrics
$ loccibox init   ← interactive setup wizard (powered by Clack)
```

---

## Why Commander + Clack?

| Tool | Role |
| --- | --- |
| **Commander.js** | Parses commands, flags, and arguments. The backbone of the CLI structure. |
| **Clack** | Beautiful interactive prompts — spinners, text inputs, select menus, confirmation dialogs. Used for the `init` wizard and any interactive flows. |

They complement each other perfectly: Commander handles the **command routing**, Clack handles the **human interaction**.

---

## CLI Architecture

```
loccibox-cli/
├── src/
│   ├── index.ts              ← Commander entry point, registers all commands
│   ├── commands/
│   │   ├── run.ts            ← loccibox run
│   │   ├── status.ts         ← loccibox status <id>
│   │   ├── stop.ts           ← loccibox stop <id>
│   │   ├── keys.ts           ← loccibox keys list | create | revoke
│   │   ├── metrics.ts        ← loccibox metrics
│   │   └── init.ts           ← loccibox init (Clack wizard)
│   ├── lib/
│   │   ├── api.ts            ← Locci Box API client (fetch wrapper)
│   │   ├── config.ts         ← reads/writes ~/.loccibox/config.json
│   │   └── output.ts         ← shared formatters (tables, colors, spinners)
│   └── types/
│       └── index.ts          ← shared TypeScript types
├── package.json
├── tsconfig.json
└── README.md
```

---

## IBM Bob Prompts — CLI

### Master Scaffold Prompt

Paste into Bob **Code mode** after the backend is already scaffolded:

```
I want to add a CLI to the Locci Box project called `loccibox`.

The CLI should sit in a separate `cli/` directory inside the 
same monorepo as the backend API.

Tech stack:
- Commander.js for command routing and argument parsing
- Clack (@clack/prompts) for interactive terminal UI
- TypeScript + tsx for local dev
- The CLI calls the Locci Box REST API (base URL configurable)

Scaffold the full CLI structure:

1. cli/src/index.ts
   - Entry point, registers all Commander commands
   - Reads API base URL and API key from ~/.loccibox/config.json
   - Falls back to LOCCIBOX_API_URL and LOCCIBOX_API_KEY env vars

2. cli/src/commands/init.ts
   - `loccibox init` — interactive Clack wizard
   - Asks: API base URL (default: http://localhost:5757)
   - Asks: API Key (masked input)
   - Saves to ~/.loccibox/config.json
   - Shows a success confirmation with Clack's outro()

3. cli/src/commands/run.ts
   - `loccibox run --lang <language> --code <code>`
   - `loccibox run --lang <language> --file <path>`
   - Shows a Clack spinner while the sandbox boots
   - Prints stdout, stderr, exit code, and duration on completion
   - Supports: python, node, bash, ruby

4. cli/src/commands/status.ts
   - `loccibox status <sandbox-id>`
   - Shows sandbox status and uptime in a formatted output

5. cli/src/commands/stop.ts
   - `loccibox stop <sandbox-id>`
   - Confirms with Clack before stopping
   - Shows success or error message

6. cli/src/commands/keys.ts
   - `loccibox keys list` — table of all API keys
   - `loccibox keys create --name <name>` — creates a key, copies to clipboard
   - `loccibox keys revoke <key-id>` — confirms with Clack before revoking

7. cli/src/commands/metrics.ts
   - `loccibox metrics` — shows per-tenant usage stats as a formatted table

8. cli/src/lib/api.ts
   - Fetch wrapper for all Locci Box API calls
   - Attaches Authorization header automatically
   - Handles errors and returns typed responses

9. cli/src/lib/config.ts
   - Reads and writes ~/.loccibox/config.json
   - Creates the directory if it doesn't exist

10. cli/src/lib/output.ts
    - Shared helpers: printTable(), printError(), printSuccess()
    - Uses picocolors for terminal colors

11. cli/package.json
    - Dependencies: commander, @clack/prompts, picocolors, tsx
    - bin field: { "loccibox": "./dist/index.js" }

12. cli/tsconfig.json

Use TypeScript throughout. No external UI libraries beyond 
@clack/prompts and picocolors.
```

---

### Follow-Up Prompt 2 — The Init Wizard (Clack Deep Dive)

```
Expand cli/src/commands/init.ts to be a full onboarding 
wizard using Clack. It should:

1. Use intro() to welcome the user:
   "Welcome to Locci Box — let's get you set up"

2. Use text() to ask for the API base URL
   - Default value: http://localhost:5757
   - Validate it starts with http:// or https://

3. Use password() to ask for the API key
   - Validate it is not empty

4. Use a Clack spinner to test the connection:
   - Call GET /metrics with the provided key
   - If it fails: show a warning but still save config
   - If it succeeds: show "Connected successfully"

5. Use confirm() to ask:
   "Set this as your default profile? (yes)"

6. Save the config to ~/.loccibox/config.json

7. Use outro() to finish:
   "You're all set. Run `loccibox run --help` to get started."

Handle Ctrl+C gracefully using Clack's isCancel() check 
after every prompt.
```

---

### Follow-Up Prompt 3 — The Run Command (Polish)

```
Polish cli/src/commands/run.ts:

1. When --file is passed, read the file contents from disk
   and send as the `code` field. Show an error if the file 
   doesn't exist.

2. If neither --code nor --file is passed, use Clack's 
   text() prompt to ask the user to paste their code inline.

3. Use a Clack spinner with the message 
   "Spinning up your Locci Box..." while waiting for the API.

4. After a successful run, display:
   - A green "✓ Execution complete" header
   - Stdout in a bordered box
   - Stderr in yellow if non-empty
   - Exit code and duration in a dim footer

5. If the API returns an error (e.g. unsupported language, 
   tenant limit exceeded), show a red formatted error using 
   Clack's log.error() and exit with code 1.
```

---

### Follow-Up Prompt 4 — Config Profiles

```
Add multi-profile support to cli/src/lib/config.ts.

Config file format:
{
  "default": "local",
  "profiles": {
    "local": {
      "apiUrl": "http://localhost:5757",
      "apiKey": "sk_local_xxx"
    },
    "production": {
      "apiUrl": "https://api.loccibox.com",
      "apiKey": "lbk_live_xxx"
    }
  }
}

Update cli/src/index.ts to accept a global --profile flag:
  loccibox --profile production run --lang python --file app.py

Update loccibox init to ask for a profile name (default: "local").

Update all commands to use the active profile from config.
```

---

### Follow-Up Prompt 5 — README for the CLI

```
Generate cli/README.md for the Locci Box CLI that includes:

- What the CLI does (2 sentences)
- Installation: npm install -g loccibox
- Quickstart: loccibox init then loccibox run
- Full command reference with all flags and examples
- Profile management docs
- Environment variable fallbacks (LOCCIBOX_API_URL, LOCCIBOX_API_KEY)
- A note that the CLI talks to any Locci Box-compatible API 
  (local or hosted)

Write for a developer audience. Use code blocks for all examples.
```

---

## What the CLI Looks Like in the Terminal

### `loccibox init`

```
┌  Welcome to Locci Box — let's get you set up
│
◇  API base URL
│  http://localhost:5757
│
◇  API key
│  ••••••••••••••••••••
│
◇  Testing connection...
│  ✓ Connected successfully
│
◇  Set this as your default profile?
│  Yes
│
└  You're all set. Run `loccibox run --help` to get started.
```

---

### `loccibox run --lang python --file ./hello.py`

```
◇  Spinning up your Locci Box...

✓  Execution complete  [87ms]

┌─ stdout ──────────────────────────┐
│  Hello from Locci Box!            │
└───────────────────────────────────┘

  exit code  0
  sandbox    lbox_abc123
  duration   87ms
```

---

### `loccibox keys list`

```
  API Keys

  NAME           CREATED       LAST USED     STATUS
  ─────────────────────────────────────────────────
  ci-pipeline    2 days ago    1 hour ago    active
  staging        5 days ago    3 days ago    active
  old-key        30 days ago   20 days ago   revoked
```

---

### `loccibox stop lbox_abc123`

```
◇  Stop sandbox lbox_abc123?
│  Yes

✓  Sandbox lbox_abc123 stopped.
```

---

## Environment Variable Fallbacks

For CI/CD environments where interactive prompts aren't possible:

```bash
export LOCCIBOX_API_URL=http://localhost:5757
export LOCCIBOX_API_KEY=lbk_live_your_key_here

# Now run without init
loccibox run --lang bash --code "echo hello"
```

---

## IBM Bob Demo — CLI Specific Moments

Add these moments to your demo video after the backend is running:

| Timestamp | What to Show |
| --- | --- |
| After backend boots | Switch to Bob Shell, run `cd cli && npm install` |
| Literate Coding | Write a comment in `run.ts` describing the spinner logic, let Bob generate it |
| Bob Shell | Run `npx tsx src/index.ts init` live — show the Clack wizard |
| Bob Shell | Run `npx tsx src/index.ts run --lang python --code "print('live demo')"` |
| Ask Mode | Ask Bob: `@cli/src/commands/run.ts — how would you add streaming output support?` |

---

## Installation (Post-Hackathon)

Once published to npm:

```bash
npm install -g loccibox
loccibox init
loccibox run --lang python --file ./my_script.py
```

---

## Full Command Reference

```
loccibox init                              Interactive setup wizard
loccibox run --lang <lang> --code <code>   Run inline code in a sandbox
loccibox run --lang <lang> --file <path>   Run a file in a sandbox
loccibox status <sandbox-id>               Check sandbox status
loccibox stop <sandbox-id>                 Stop and destroy a sandbox
loccibox keys list                         List all API keys
loccibox keys create --name <name>         Create a new API key
loccibox keys revoke <key-id>              Revoke an API key
loccibox metrics                           Show per-tenant usage stats

Global flags:
  --profile <name>    Use a named config profile (default: "local")
  --json              Output raw JSON instead of formatted display
  --help              Show help for any command
```

---

*Locci Box CLI · IBM Bob Hackathon · lablab.ai · May 15–17, 2026*
