# Locci Box - Quick Start Guide

Get Locci Box running in 3 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Start the Server

```bash
npm run dev
```

You should see:

```
[INFO] Locci Box API server started
[INFO] Default API key for testing: sk_test_default_key_12345
```

## Step 3: Test It!

Open a new terminal and run:

```bash
# Test health check
curl http://localhost:3000/health

# Run Python code
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from Locci Box!\")"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_...",
    "status": "completed",
    "stdout": "Hello from Locci Box!\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 87
  }
}
```

## That's It! 🎉

Your Locci Box API is now running locally.

### What's Next?

- **Try other languages**: Change `"language"` to `"node"`, `"bash"`, or `"ruby"`
- **Check metrics**: `curl http://localhost:3000/api/metrics -H "Authorization: Bearer admin_your_secret_key_here"`
- **Read full docs**: See [README.md](README.md) for complete API reference
- **Set up MCP**: See [SETUP.md](SETUP.md) for MCP server configuration

### Default API Key

For testing: `sk_test_default_key_12345`

### Common Commands

```bash
npm run dev      # Start development server
npm run build    # Build TypeScript
npm start        # Start production server
npm run mcp      # Start MCP server
```

### Need Help?

- Check [SETUP.md](SETUP.md) for detailed setup instructions
- Review [README.md](README.md) for API documentation
- See [REFERENCE.MD](REFERENCE.MD) for hackathon guidelines
