# Environment Configuration with Valibot

## Overview

Locci Box uses a centralized, type-safe environment configuration system powered by [Valibot](https://valibot.dev/) for validation. This ensures all environment variables are validated at startup and provides a single source of truth for configuration.

## Architecture

```
.env file
    ↓
process.env (Node.js)
    ↓
src/config/env.ts (Valibot validation)
    ↓
Validated & typed env object
    ↓
Imported throughout the application
```

## Benefits

✅ **Type Safety** - Full TypeScript support with inferred types  
✅ **Validation** - Environment variables validated at startup  
✅ **Single Source** - One place to import configuration  
✅ **Clear Errors** - Helpful error messages for missing/invalid values  
✅ **Default Values** - Sensible defaults for optional variables  
✅ **No Runtime Errors** - Catch configuration issues before they cause problems

## Usage

### Importing Configuration

```typescript
// ❌ Don't use process.env directly
const port = process.env.PORT || 3000;

// ✅ Use the validated env object
import { env } from "./config/env";
const port = env.PORT;
```

### Available Configuration

```typescript
import { env, isDevelopment, isProduction, isTest } from "./config/env";

// Server configuration
env.PORT; // number (default: 3000)
env.NODE_ENV; // 'development' | 'production' | 'test'

// Admin configuration
env.ADMIN_API_KEY; // string (required)

// Sandbox defaults
env.DEFAULT_MAX_CONCURRENT_SANDBOXES; // number (default: 5)
env.DEFAULT_SANDBOX_TIMEOUT_SECONDS; // number (default: 30)
env.DEFAULT_RATE_LIMIT_PER_MINUTE; // number (default: 60)

// Logging
env.LOG_LEVEL; // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

// MCP Server
env.MCP_ENABLED; // boolean (default: true)

// Database (optional)
env.DATABASE_URL; // string | undefined

// Helper functions
isDevelopment; // boolean
isProduction; // boolean
isTest; // boolean
```

## Schema Definition

The schema is defined in `src/config/env.ts` using Valibot:

```typescript
const EnvSchema = v.object({
  PORT: v.optional(v.pipe(v.string(), v.transform(Number)), "3000"),
  NODE_ENV: v.optional(
    v.picklist(["development", "production", "test"]),
    "development",
  ),
  ADMIN_API_KEY: v.pipe(
    v.string(),
    v.minLength(1, "ADMIN_API_KEY is required"),
  ),
  // ... more fields
});
```

## Validation

Environment variables are validated when the application starts. If validation fails, you'll see clear error messages:

```bash
❌ Environment variable validation failed:
  - ADMIN_API_KEY: ADMIN_API_KEY is required
  - DEFAULT_MAX_CONCURRENT_SANDBOXES: Expected number, received string
```

The application will exit immediately with code 1, preventing runtime errors.

## Adding New Environment Variables

### 1. Update `.env` and `.env.example`

```env
# .env
NEW_FEATURE_ENABLED=true
```

### 2. Add to Schema in `src/config/env.ts`

```typescript
const EnvSchema = v.object({
  // ... existing fields
  NEW_FEATURE_ENABLED: v.optional(
    v.pipe(
      v.string(),
      v.transform((val) => val === "true"),
    ),
    "false",
  ),
});
```

### 3. Update the Parse Function

```typescript
function parseEnv() {
  try {
    const parsed = v.parse(EnvSchema, {
      // ... existing fields
      NEW_FEATURE_ENABLED: process.env.NEW_FEATURE_ENABLED,
    });
    return parsed;
  } catch (error) {
    // ... error handling
  }
}
```

### 4. Use in Your Code

```typescript
import { env } from "./config/env";

if (env.NEW_FEATURE_ENABLED) {
  // Feature is enabled
}
```

## Type Inference

TypeScript automatically infers the correct types:

```typescript
import { env } from "./config/env";

env.PORT; // number
env.NODE_ENV; // 'development' | 'production' | 'test'
env.ADMIN_API_KEY; // string
env.DEFAULT_MAX_CONCURRENT_SANDBOXES; // number
env.MCP_ENABLED; // boolean
env.DATABASE_URL; // string | undefined
```

## Validation Rules

### Required Fields

```typescript
ADMIN_API_KEY: v.pipe(
  v.string(),
  v.minLength(1, 'ADMIN_API_KEY is required')
),
```

### Optional with Default

```typescript
PORT: v.optional(v.pipe(v.string(), v.transform(Number)), '3000'),
```

### Enum/Picklist

```typescript
NODE_ENV: v.optional(
  v.picklist(['development', 'production', 'test']),
  'development'
),
```

### Number with Validation

```typescript
DEFAULT_MAX_CONCURRENT_SANDBOXES: v.optional(
  v.pipe(v.string(), v.transform(Number), v.minValue(1)),
  '5'
),
```

### Boolean Transformation

```typescript
MCP_ENABLED: v.optional(
  v.pipe(
    v.string(),
    v.transform((val) => val !== 'false')
  ),
  'true'
),
```

## Files Updated

The following files now use the centralized env configuration:

- ✅ `src/config/env.ts` - Configuration definition
- ✅ `src/utils/logger.ts` - Logger configuration
- ✅ `src/server.ts` - Server startup
- ✅ `src/services/TenantService.ts` - Tenant defaults
- ✅ `src/middleware/auth.ts` - Admin key validation
- ✅ `src/mcp/server.ts` - MCP server startup

## Testing

### Unit Tests

Mock the env module in tests:

```typescript
import { vi } from "vitest";

vi.mock("./config/env", () => ({
  env: {
    PORT: 3001,
    NODE_ENV: "test",
    ADMIN_API_KEY: "test_admin_key",
    // ... other values
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));
```

### Integration Tests

Set environment variables before importing:

```typescript
process.env.PORT = "3001";
process.env.ADMIN_API_KEY = "test_key";

// Now import modules that use env
import { createApp } from "./app";
```

## Best Practices

### ✅ Do

- Import `env` from `src/config/env`
- Use helper functions like `isDevelopment`
- Add validation rules for new variables
- Provide sensible defaults for optional values
- Document new environment variables

### ❌ Don't

- Access `process.env` directly in application code
- Skip validation for new variables
- Use string literals for environment checks
- Forget to update `.env.example`
- Leave required variables without validation

## Migration Guide

If you have existing code using `process.env`:

### Before

```typescript
const port = parseInt(process.env.PORT || "3000");
const isProduction = process.env.NODE_ENV === "production";
const adminKey = process.env.ADMIN_API_KEY;

if (!adminKey) {
  throw new Error("ADMIN_API_KEY is required");
}
```

### After

```typescript
import { env, isProduction } from "./config/env";

const port = env.PORT;
const adminKey = env.ADMIN_API_KEY;

// No need to check - validation ensures it exists
```

## Troubleshooting

### Error: "ADMIN_API_KEY is required"

**Solution:** Add `ADMIN_API_KEY` to your `.env` file:

```env
ADMIN_API_KEY=your_secret_key_here
```

### Error: "Expected number, received string"

**Solution:** Ensure numeric values are valid numbers:

```env
# ❌ Wrong
DEFAULT_MAX_CONCURRENT_SANDBOXES=five

# ✅ Correct
DEFAULT_MAX_CONCURRENT_SANDBOXES=5
```

### Error: "Cannot find module './config/env'"

**Solution:** Run `npm install` to ensure all dependencies are installed.

## Resources

- [Valibot Documentation](https://valibot.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Environment Variables](https://nodejs.org/api/process.html#processenv)

## Summary

The centralized environment configuration system provides:

1. **Type safety** through TypeScript inference
2. **Validation** at application startup
3. **Clear errors** for configuration issues
4. **Single source of truth** for all configuration
5. **Better developer experience** with autocomplete and type checking

All environment variables are now validated, typed, and accessible through a single import, making the codebase more maintainable and less error-prone.
