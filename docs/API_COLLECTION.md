# Locci Box API Collection

Complete API testing collection with curl commands for all endpoints.

## Base Configuration

```bash
export API_URL="http://localhost:5757"
export API_KEY="sk_test_default_key_12345"
export ADMIN_KEY="admin_your_secret_key_here"
```

---

## 1. Health Check

### Request

```bash
curl -X GET "$API_URL/health" \
  -H "Content-Type: application/json"
```

### Expected Response (200 OK)

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-15T21:00:00.000Z",
    "uptime": 3600
  }
}
```

---

## 2. Execute Python Code

### Request

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from Python!\")\nprint(sum(range(1, 11)))",
    "timeout": 30
  }'
```

### Expected Response (200 OK)

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

---

## 3. Execute Node.js Code

### Request

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "node",
    "code": "console.log(\"Hello from Node.js!\");\nconst sum = [1,2,3,4,5].reduce((a,b) => a+b, 0);\nconsole.log(\"Sum:\", sum);",
    "timeout": 30
  }'
```

### Expected Response (200 OK)

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_def456uvw",
    "status": "completed",
    "stdout": "Hello from Node.js!\nSum: 15\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 92,
    "created_at": "2026-05-15T21:00:00.000Z",
    "completed_at": "2026-05-15T21:00:00.092Z"
  }
}
```

---

## 4. Execute Bash Script

### Request

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "bash",
    "code": "echo \"Hello from Bash!\"\nuname -a\necho \"Current date: $(date)\"",
    "timeout": 15
  }'
```

### Expected Response (200 OK)

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_ghi789rst",
    "status": "completed",
    "stdout": "Hello from Bash!\nLinux...\nCurrent date: ...\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 45,
    "created_at": "2026-05-15T21:00:00.000Z",
    "completed_at": "2026-05-15T21:00:00.045Z"
  }
}
```

---

## 5. Execute Ruby Code

### Request

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "ruby",
    "code": "puts \"Hello from Ruby!\"\nputs (1..10).sum",
    "timeout": 30
  }'
```

### Expected Response (200 OK)

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_jkl012mno",
    "status": "completed",
    "stdout": "Hello from Ruby!\n55\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 78,
    "created_at": "2026-05-15T21:00:00.000Z",
    "completed_at": "2026-05-15T21:00:00.078Z"
  }
}
```

---

## 6. Get Sandbox Status

### Request

```bash
SANDBOX_ID="sbox_abc123xyz"

curl -X GET "$API_URL/api/sandbox/$SANDBOX_ID/status" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json"
```

### Expected Response (200 OK - Running)

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "tenant_id": "tenant_default",
    "language": "python",
    "status": "running",
    "uptime_ms": 4200,
    "created_at": "2026-05-15T21:00:00.000Z"
  }
}
```

### Expected Response (404 Not Found - Completed)

```json
{
  "success": false,
  "error": "Sandbox not found or already completed"
}
```

---

## 7. Stop Sandbox

### Request

```bash
SANDBOX_ID="sbox_abc123xyz"

curl -X DELETE "$API_URL/api/sandbox/$SANDBOX_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json"
```

### Expected Response (200 OK)

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "status": "stopped",
    "message": "Sandbox terminated successfully"
  }
}
```

---

## 8. Get Metrics (Admin)

### Request

```bash
curl -X GET "$API_URL/api/metrics" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json"
```

### Expected Response (200 OK)

```json
{
  "success": true,
  "data": {
    "system": {
      "total_tenants": 1,
      "total_sandboxes_today": 142,
      "active_sandboxes": 3,
      "avg_execution_ms": 94
    },
    "tenants": [
      {
        "tenant_id": "tenant_default",
        "organization": "Default Organization",
        "total_runs": 142,
        "active_sandboxes": 3,
        "avg_execution_ms": 94,
        "last_activity": "2026-05-15T21:00:00.000Z"
      }
    ]
  }
}
```

---

## Error Responses

### 400 Bad Request - Missing Fields

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python"
  }'
```

Response:

```json
{
  "success": false,
  "error": "Missing required fields: language and code"
}
```

### 400 Bad Request - Invalid Language

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "java",
    "code": "System.out.println(\"Hello\");"
  }'
```

Response:

```json
{
  "success": false,
  "error": "Invalid language. Supported: python, node, bash, ruby"
}
```

### 401 Unauthorized - Missing API Key

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"test\")"
  }'
```

Response:

```json
{
  "success": false,
  "error": "No authorization header provided"
}
```

### 401 Unauthorized - Invalid API Key

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer invalid_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"test\")"
  }'
```

Response:

```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### 429 Too Many Requests - Rate Limit Exceeded

```bash
# Make 61 requests in quick succession (limit is 60/min)
for i in {1..61}; do
  curl -X POST "$API_URL/api/sandbox/run" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"language":"python","code":"print(1)"}' &
done
wait
```

Response (after 60 requests):

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retry_after": 45
}
```

### 503 Service Unavailable - Max Concurrent Sandboxes

```bash
# Try to create 6 concurrent sandboxes (limit is 5)
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import time\ntime.sleep(60)"
  }'
```

Response (after 5 concurrent sandboxes):

```json
{
  "success": false,
  "error": "Maximum concurrent sandboxes reached",
  "max_concurrent": 5
}
```

---

## Advanced Examples

### Execute with Custom Timeout

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import time\nprint(\"Starting...\")\ntime.sleep(5)\nprint(\"Done!\")",
    "timeout": 10
  }'
```

### Execute Multi-line Code

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nfor i in range(10):\n    print(f\"fib({i}) = {fibonacci(i)}\")"
  }'
```

### Execute with Error Handling

```bash
curl -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "try:\n    result = 10 / 0\nexcept ZeroDivisionError as e:\n    print(f\"Error: {e}\")\n    print(\"Handled gracefully\")"
  }'
```

---

## Postman Collection

Import this JSON into Postman:

```json
{
  "info": {
    "name": "Locci Box API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5757"
    },
    {
      "key": "api_key",
      "value": "sk_test_default_key_12345"
    },
    {
      "key": "admin_key",
      "value": "admin_your_secret_key_here"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{base_url}}/health"
      }
    },
    {
      "name": "Run Python Code",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{api_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"language\": \"python\",\n  \"code\": \"print('Hello from Python!')\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{base_url}}/api/sandbox/run"
      }
    },
    {
      "name": "Get Metrics",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_key}}"
          }
        ],
        "url": "{{base_url}}/api/metrics"
      }
    }
  ]
}
```

---

## Testing Workflow

### 1. Quick Smoke Test

```bash
# Test health
curl -s "$API_URL/health" | jq '.data.status'

# Test Python
curl -s -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"language":"python","code":"print(\"OK\")"}' | jq '.data.stdout'
```

### 2. Full Test Suite

```bash
chmod +x examples/test-all.sh
./examples/test-all.sh
```

### 3. Load Test

```bash
# Run 100 requests
for i in {1..100}; do
  curl -s -X POST "$API_URL/api/sandbox/run" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"language":"python","code":"print(1)"}' &
done
wait
```

---

## Tips

1. **Use jq for JSON parsing**: `curl ... | jq '.'`
2. **Save responses**: `curl ... > response.json`
3. **Time requests**: `time curl ...`
4. **Verbose output**: `curl -v ...`
5. **Follow redirects**: `curl -L ...`
6. **Save cookies**: `curl -c cookies.txt ...`

## Support

For issues or questions, check:

- README.md for API documentation
- SETUP.md for setup instructions
- PROJECT_STATUS.md for current status
