# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added `dotenv` package (v17.4.2) for automatic environment variable loading
- Integrated dotenv configuration in `src/config/env.ts` to load `.env` file automatically
- Created MIT LICENSE file for the project
- Created `src/routes/health.ts` - Dedicated health check router for better modularity
- Created `src/middleware/errorHandler.ts` - Typed error handler with custom error classes:
  - `AppError` - Base application error class
  - `ValidationError` - 400 Bad Request errors
  - `UnauthorizedError` - 401 Unauthorized errors
  - `ForbiddenError` - 403 Forbidden errors
  - `NotFoundError` - 404 Not Found errors
  - `RateLimitError` - 429 Rate Limit errors with retry_after support
  - `ServiceUnavailableError` - 503 Service Unavailable errors
- Created `src/middleware/notFoundHandler.ts` - Dedicated 404 handler middleware

### Changed

- Environment variables are now automatically loaded from `.env` file on application startup
- No manual environment variable setup required in development
- **Refactored `src/app.ts`** - Complete restructuring for better maintainability:
  - Extracted `configureMiddleware()` helper function for middleware setup
  - Extracted `configureRoutes()` helper function for route configuration
  - Replaced inline health check with dedicated router
  - Replaced generic error handler with typed error handler
  - Replaced inline 404 handler with dedicated middleware
  - Simplified `createApp()` function to 10 lines (from 57 lines)
  - Improved code organization and separation of concerns

### Improved

- Better error categorization and debugging with custom error classes
- Easier to test individual components (health checks, error handling, etc.)
- Clearer overview of middleware stack and route configuration
- More maintainable and extensible codebase
- Consistent pattern across all routes and middleware

## [1.0.0] - 2026-05-15

### Initial Release

- B2B API for safe code execution in isolated microVMs
- Support for Python, Node.js, Bash, and Ruby
- Multi-tenant architecture with API key authentication
- Rate limiting with token bucket algorithm
- Sandbox execution with configurable timeouts
- Health check and metrics endpoints
- MCP (Model Context Protocol) server integration
- Comprehensive logging with Pino
- Type-safe environment configuration with Valibot
