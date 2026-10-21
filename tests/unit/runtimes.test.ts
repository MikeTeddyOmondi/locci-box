import { describe, it, expect } from "vitest";
import { RUNTIMES, goCacheDir } from "../../src/services/SandboxService.js";
import { SUPPORTED_LANGUAGES } from "../../src/types/index.js";

describe("run_sandbox runtimes", () => {
  it("has one for every supported language, with a pinned docker.io image", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const runtime = RUNTIMES[language];
      expect(runtime, language).toBeDefined();
      // Fully qualified: microsandbox refused short names at times ("Not authorized").
      expect(runtime.image).toMatch(/^docker\.io\/library\/[a-z]+:\d+(\.\d+)?(-[a-z]+)?$/);
      expect(runtime.build ?? runtime.run).toContain(runtime.file);
    }
  });

  it("gives compilers more than the 128 MB default", () => {
    for (const language of ["go", "rust", "c", "cpp"] as const) {
      expect(RUNTIMES[language].memory).toBeGreaterThan(128);
    }
  });

  it("blanks the gcc image's tab-separated env, which microsandbox cannot boot with", () => {
    expect(RUNTIMES.c.env).toMatchObject({ GPG_KEYS: "", GCC_MIRRORS: "" });
    expect(RUNTIMES.cpp.env).toMatchObject({ GPG_KEYS: "", GCC_MIRRORS: "" });
  });

  it("compiles separately from running, so compile time does not use up the run's timeout", () => {
    for (const language of ["go", "rust", "c", "cpp"] as const) {
      expect(RUNTIMES[language].build, language).toBeTruthy();
      expect(RUNTIMES[language].run).toBe("./main");
    }
  });

  it("keeps one Go standard library cache per Go image, linked into each run", () => {
    expect(goCacheDir("docker.io/library/golang:1.27-alpine")).toMatch(/docker.io_library_golang_1.27-alpine$/);
    expect(goCacheDir("docker.io/library/golang:1.28-alpine")).not.toBe(goCacheDir("docker.io/library/golang:1.27-alpine"));
    expect(RUNTIMES.go.build).toContain("cp -as /opt/gocache");
  });
});
