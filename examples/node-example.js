// Node.js Example for Locci Box
// This code will be executed in an isolated microVM

console.log("Hello from Node.js microVM!");

// Async operations
async function main() {
  // Math operations
  const numbers = [1, 2, 3, 4, 5];
  const sum = numbers.reduce((a, b) => a + b, 0);
  console.log(`Sum of array: ${sum}`);

  // JSON output
  const data = {
    language: "node",
    version: process.version,
    platform: process.platform,
    sum: sum,
  };
  console.log(JSON.stringify(data, null, 2));

  // Environment info
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);
}

main().catch(console.error);

// Made with Bob
