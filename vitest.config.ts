import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: {
      ADMIN_API_KEY: "test-admin-key",
      DATABASE_MODE: "pglite",
      DB_PATH: "",
      JWT_SECRET: "test-jwt-secret-for-ci",
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
      // Box workspaces from the integration tests go here, not into ./data.
      BOX_LOCAL_ROOT: path.join(os.tmpdir(), "locci-box-test-boxes"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/types/**",
        "src/server.ts",
        "src/mcp/server.ts",
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});

// Made with Bob
