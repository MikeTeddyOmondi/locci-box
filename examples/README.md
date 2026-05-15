# Locci Box Examples

This directory contains example code snippets for testing Locci Box with different programming languages.

## Available Examples

- **python-example.py** - Python code demonstrating basic operations
- **node-example.js** - Node.js async operations and JSON output
- **bash-example.sh** - Bash script with system commands
- **ruby-example.rb** - Ruby code with array and string operations

## Running Examples

### Using curl

#### Python Example

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "language": "python",
  "code": "print('Hello from Python!')\nprint(sum(range(1, 11)))"
}
EOF
```

#### Node.js Example

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "language": "node",
  "code": "console.log('Hello from Node.js!');\nconsole.log([1,2,3,4,5].reduce((a,b) => a+b, 0));"
}
EOF
```

#### Bash Example

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "language": "bash",
  "code": "echo 'Hello from Bash!'\nuname -a"
}
EOF
```

#### Ruby Example

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "language": "ruby",
  "code": "puts 'Hello from Ruby!'\nputs (1..10).sum"
}
EOF
```

### Using the Test Script

Run all examples at once:

```bash
# Make the script executable
chmod +x examples/test-all.sh

# Run all tests
./examples/test-all.sh
```

This will test:

1. Health endpoint
2. Python execution
3. Node.js execution
4. Bash execution
5. Ruby execution
6. Metrics endpoint

## Example Response

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "status": "completed",
    "stdout": "Hello from Python!\n55\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 87,
    "created_at": "2026-05-15T21:00:00.000Z",
    "completed_at": "2026-05-15T21:00:00.087Z"
  }
}
```

## Testing Different Scenarios

### Test with Timeout

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import time\ntime.sleep(2)\nprint(\"Done!\")",
    "timeout": 5
  }'
```

### Test Error Handling

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "raise Exception(\"Test error\")"
  }'
```

### Test with Environment Variables (Future Feature)

```bash
curl -X POST http://localhost:3000/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import os\nprint(os.environ.get(\"MY_VAR\", \"default\"))",
    "env": {
      "MY_VAR": "custom_value"
    }
  }'
```

## Notes

- All examples run in isolated microVMs
- Default timeout is 30 seconds
- Maximum code size is 1MB
- Each tenant can run up to 5 concurrent sandboxes by default
