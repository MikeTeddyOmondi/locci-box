# Locci Box CLI

A command-line interface for interacting with the Locci Box API - execute code in isolated microVM sandboxes.

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd locci-box/cli

# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Link globally (optional)
pnpm link --global
```

### Using npm/pnpm (when published)

```bash
npm install -g loccibox
# or
pnpm add -g loccibox
```

## Quick Start

1. **Initialize the CLI**

```bash
loccibox init
```

This will guide you through setting up your API configuration with an interactive wizard.

2. **Run your first sandbox**

```bash
# Run inline code
loccibox run -l python -c "print('Hello from Locci Box!')"

# Run code from a file
loccibox run -l python -f script.py

# Interactive mode
loccibox run -l python -i
```

## Configuration

### Config File

The CLI stores configuration in `~/.loccibox/config.json`:

```json
{
  "defaultProfile": "production",
  "profiles": {
    "production": {
      "apiUrl": "https://api.loccibox.com",
      "apiKey": "your-api-key"
    },
    "staging": {
      "apiUrl": "https://staging.loccibox.com",
      "apiKey": "your-staging-key"
    }
  }
}
```

### Environment Variables

You can also use environment variables (they take precedence over config file):

```bash
export LOCCIBOX_API_URL="https://api.loccibox.com"
export LOCCIBOX_API_KEY="your-api-key"
```

### Multiple Profiles

Switch between different environments:

```bash
# Use a specific profile
loccibox run -p staging -l python -c "print('Hello')"

# Set default profile
loccibox init  # Select profile during setup
```

## Commands

### `init`

Initialize or reconfigure the CLI.

```bash
loccibox init
```

**Interactive prompts:**

- Profile name
- API URL
- API Key
- Set as default profile

### `run`

Execute code in a sandbox.

```bash
loccibox run [options]
```

**Options:**

- `-l, --language <lang>` - Programming language (required)
- `-c, --code <code>` - Inline code to execute
- `-f, --file <path>` - Path to code file
- `-i, --interactive` - Interactive mode (enter code in editor)
- `-t, --timeout <ms>` - Execution timeout in milliseconds (default: 30000)
- `-m, --memory <mb>` - Memory limit in MB (default: 128)
- `-p, --profile <name>` - Use specific profile

**Supported Languages:**

- `python` - Python 3.x
- `node` - Node.js
- `bash` - Bash shell
- `ruby` - Ruby

**Examples:**

```bash
# Inline code
loccibox run -l python -c "print('Hello World')"

# From file
loccibox run -l node -f script.js

# Interactive mode
loccibox run -l python -i

# With custom limits
loccibox run -l python -c "print('test')" -t 60000 -m 256

# Using specific profile
loccibox run -p staging -l python -c "print('test')"
```

### `status`

Check the status of a running sandbox.

```bash
loccibox status <sandbox-id> [options]
```

**Options:**

- `-p, --profile <name>` - Use specific profile

**Example:**

```bash
loccibox status abc123def456
```

### `stop`

Stop a running sandbox.

```bash
loccibox stop <sandbox-id> [options]
```

**Options:**

- `-y, --yes` - Skip confirmation prompt
- `-p, --profile <name>` - Use specific profile

**Examples:**

```bash
# With confirmation
loccibox stop abc123def456

# Skip confirmation
loccibox stop abc123def456 -y
```

### `metrics`

View usage statistics and metrics.

```bash
loccibox metrics [options]
```

**Options:**

- `-p, --profile <name>` - Use specific profile

**Example:**

```bash
loccibox metrics
```

**Output includes:**

- Total sandboxes created
- Active sandboxes
- Average execution time
- Total execution time
- Memory usage statistics

### `keys`

Manage API keys (coming soon).

```bash
loccibox keys [options]
```

**Planned features:**

- List API keys
- Create new keys
- Revoke keys
- View key permissions

## Output Formats

### Success Messages

```
✔ Sandbox created successfully
  ID: abc123def456
  Status: completed
  Duration: 1.23s
```

### Error Messages

```
✖ Failed to create sandbox
  Error: Invalid API key
```

### Tables

```
┌─────────────┬──────────┐
│ Metric      │ Value    │
├─────────────┼──────────┤
│ Total       │ 1,234    │
│ Active      │ 5        │
│ Avg Time    │ 2.5s     │
└─────────────┴──────────┘
```

## Development

### Project Structure

```
cli/
├── src/
│   ├── commands/       # Command implementations
│   │   ├── init.ts
│   │   ├── run.ts
│   │   ├── status.ts
│   │   ├── stop.ts
│   │   ├── metrics.ts
│   │   └── keys.ts
│   ├── lib/           # Shared utilities
│   │   ├── api.ts     # API client
│   │   ├── config.ts  # Config management
│   │   └── output.ts  # Terminal formatting
│   ├── types/         # TypeScript types
│   │   └── index.ts
│   └── index.ts       # CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Build Commands

```bash
# Install dependencies
pnpm install

# Development mode (watch)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test -- run.test.ts

# Watch mode
pnpm test -- --watch
```

## Troubleshooting

### "No configuration found"

Run `loccibox init` to set up your configuration, or set environment variables:

```bash
export LOCCIBOX_API_URL="https://api.loccibox.com"
export LOCCIBOX_API_KEY="your-api-key"
```

### "Invalid API key"

Verify your API key is correct:

1. Check `~/.loccibox/config.json`
2. Or verify environment variables
3. Contact support for a new key

### "Connection refused"

Check that:

1. The API URL is correct
2. The API server is running
3. You have network connectivity

### TypeScript Errors

If you see TypeScript errors during development:

```bash
# Clean and rebuild
rm -rf dist
pnpm build
```

## API Reference

The CLI interacts with the Locci Box API. For full API documentation, see:

- [API Documentation](../docs/API_COLLECTION.md)
- [Quickstart Guide](../docs/QUICKSTART.md)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- GitHub Issues: [Report a bug](https://github.com/your-org/locci-box/issues)
- Documentation: [Full docs](../docs/README.md)
- Email: support@loccibox.com

---

Made with ❤️ by the Locci Box team
