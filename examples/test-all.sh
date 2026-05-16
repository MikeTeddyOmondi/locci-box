#!/bin/bash
# Test script for Locci Box API
# Tests all supported languages with example code

API_URL="http://localhost:5757"
API_KEY="${ADMIN_API_KEY:-A9Ytm4GAKfYF3yCanI24DLAV}"

echo "🚀 Testing Locci Box API"
echo "========================"
echo ""

# Test health endpoint
echo "1️⃣  Testing health endpoint..."
curl -s "$API_URL/health" | jq '.'
echo ""

# Test Python
echo "2️⃣  Testing Python execution..."
PYTHON_CODE=$(cat examples/python-example.py)
curl -s -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"language\":\"python\",\"code\":$(echo "$PYTHON_CODE" | jq -Rs .)}" | jq '.'
echo ""

# Test Node.js
echo "3️⃣  Testing Node.js execution..."
NODE_CODE=$(cat examples/node-example.js)
curl -s -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"language\":\"node\",\"code\":$(echo "$NODE_CODE" | jq -Rs .)}" | jq '.'
echo ""

# Test Bash
echo "4️⃣  Testing Bash execution..."
BASH_CODE=$(cat examples/bash-example.sh)
curl -s -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"language\":\"bash\",\"code\":$(echo "$BASH_CODE" | jq -Rs .)}" | jq '.'
echo ""

# Test Ruby
echo "5️⃣  Testing Ruby execution..."
RUBY_CODE=$(cat examples/ruby-example.rb)
curl -s -X POST "$API_URL/api/sandbox/run" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"language\":\"ruby\",\"code\":$(echo "$RUBY_CODE" | jq -Rs .)}" | jq '.'
echo ""

# Test metrics
echo "6️⃣  Testing metrics endpoint..."
curl -s "$API_URL/api/metrics" \
  -H "Authorization: Bearer $API_KEY" | jq '.'
echo ""

echo "✅ All tests completed!"

# Made with Bob
