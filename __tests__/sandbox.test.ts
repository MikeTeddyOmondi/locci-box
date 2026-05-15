import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app";
import type { Express } from "express";

describe("Sandbox API", () => {
  let app: Express;
  const testApiKey = "sk_test_default_key_12345";

  beforeAll(() => {
    app = createApp();
  });

  describe("POST /api/sandbox/run", () => {
    it("should execute Python code successfully", async () => {
      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "python",
          code: 'print("Hello, World!")',
          timeout: 10,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("sandbox_id");
      expect(data.data).toHaveProperty("stdout");
      expect(data.data).toHaveProperty("stderr");
      expect(data.data).toHaveProperty("exit_code");
      expect(data.data).toHaveProperty("duration_ms");
    });

    it("should execute Node.js code successfully", async () => {
      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "node",
          code: 'console.log("Hello from Node!");',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("completed");
    });

    it("should reject invalid API key", async () => {
      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "python",
          code: 'print("test")',
        }),
      });

      expect(response.status).toBe(401);
    });

    it("should reject missing authorization header", async () => {
      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "python",
          code: 'print("test")',
        }),
      });

      expect(response.status).toBe(401);
    });

    it("should reject invalid language", async () => {
      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "invalid",
          code: 'print("test")',
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject missing code", async () => {
      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "python",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject code exceeding size limit", async () => {
      const largeCode = 'x = "a" * 2000000'; // > 1MB

      const response = await fetch("http://localhost:5757/api/sandbox/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "python",
          code: largeCode,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const response = await fetch("http://localhost:5757/health");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("healthy");
      expect(data.data).toHaveProperty("timestamp");
      expect(data.data).toHaveProperty("uptime");
    });
  });

  describe("GET /api/metrics", () => {
    it("should return metrics with admin key", async () => {
      const response = await fetch("http://localhost:5757/api/metrics", {
        headers: {
          Authorization: "Bearer admin-secret-key",
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("system");
      expect(data.data).toHaveProperty("tenants");
    });

    it("should reject invalid admin key", async () => {
      const response = await fetch("http://localhost:5757/api/metrics", {
        headers: {
          Authorization: "Bearer invalid_admin_key",
        },
      });

      expect(response.status).toBe(403);
    });

    it("should reject missing admin key", async () => {
      const response = await fetch("http://localhost:5757/api/metrics");

      expect(response.status).toBe(401);
    });
  });
});

// Made with Bob
