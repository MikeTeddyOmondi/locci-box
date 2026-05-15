# Python Example for Locci Box
# This code will be executed in an isolated microVM

import sys
import json

# Simple hello world
print("Hello from Python microVM!")

# Math operations
result = sum(range(1, 11))
print(f"Sum of 1-10: {result}")

# JSON output
data = {
    "language": "python",
    "version": sys.version,
    "result": result
}
print(json.dumps(data, indent=2))

# Environment info
print(f"Python version: {sys.version}")
print(f"Platform: {sys.platform}")

# Made with Bob
