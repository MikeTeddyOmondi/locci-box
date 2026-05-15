#!/bin/bash
# Bash Example for Locci Box
# This code will be executed in an isolated microVM

echo "Hello from Bash microVM!"

# System info
echo "System information:"
uname -a

# File operations
echo "Creating test file..."
echo "Test content" > /tmp/test.txt
cat /tmp/test.txt

# Math operations
sum=0
for i in {1..10}; do
  sum=$((sum + i))
done
echo "Sum of 1-10: $sum"

# Environment variables
echo "Current user: $USER"
echo "Home directory: $HOME"
echo "Shell: $SHELL"

# Exit successfully
exit 0

# Made with Bob
