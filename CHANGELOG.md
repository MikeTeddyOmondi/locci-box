# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `2c09252` - Added `dotenv` package (v17.4.2) for automatic environment variable loading
- `52bcc1c` - Integrated dotenv configuration in `src/config/env.ts` to load `.env` file automatically
- `1c94f44` - Created CHANGELOG.md documenting all project changes
- `8925e5a` - Created MIT LICENSE file for the project
- `02d61c2` - Created `src/routes/health.ts` - Dedicated health check router for better modularity
- `c9b03ab` - Created `src/middleware/errorHandler.ts` - Typed error handler with custom error classes:
  - `AppError` - Base application error class
  - `ValidationError` - 400 Bad Request errors
  - `UnauthorizedError` - 401 Unauthorized errors
  - `ForbiddenError` - 403 Forbidden errors
  - `NotFoundError` - 404 Not Found errors
  - `RateLimitError` - 429 Rate Limit errors with retry_after support
  - `ServiceUnavailableError` - 503 Service Unavailable errors
- `c4c21e8` - Created `src/middleware/notFoundHandler.ts` - Dedicated 404 handler middleware

### Changed

- `52bcc1c` - Environment variables are now automatically loaded from `.env` file on application startup
- `52bcc1c` - No manual environment variable setup required in development
- `6014ac4` - **Refactored `src/app.ts`** - Complete restructuring for better maintainability:
  - Extracted `configureMiddleware()` helper function for middleware setup
  - Extracted `configureRoutes()` helper function for route configuration
  - Replaced inline health check with dedicated router
  - Replaced generic error handler with typed error handler
  - Replaced inline 404 handler with dedicated middleware
  - Simplified `createApp()` function to 10 lines (from 57 lines)
  - Improved code organization and separation of concerns

### Improved

- `c9b03ab` - Better error categorization and debugging with custom error classes
- `02d61c2` - Easier to test individual components (health checks, error handling, etc.)
- `6014ac4` - Clearer overview of middleware stack and route configuration
- `6014ac4` - More maintainable and extensible codebase
- `6014ac4` - Consistent pattern across all routes and middleware

## [1.0.0] - 2026-05-15

### Initial Release

#### Core Features

- B2B API for safe code execution in isolated microVMs
- Support for Python, Node.js, Bash, and Ruby
- Multi-tenant architecture with API key authentication
- Rate limiting with token bucket algorithm
- Sandbox execution with configurable timeouts
- Health check and metrics endpoints
- MCP (Model Context Protocol) server integration
- Comprehensive logging with Pino
- Type-safe environment configuration with Valibot

#### Commit History

- `2c09252` - feat: add dotenv package (v17.4.2) for environment variable loading
- `52bcc1c` - feat: integrate dotenv.config() in env.ts for automatic .env file loading
- `1c94f44` - docs: create CHANGELOG.md documenting all project changes
- `eb2eca8` - chore: add project configuration and documentation files
- `8882ec4` - docs: add documentation, examples, and test files
- `9a18973` - feat: add core application services, types, and server setup
- `8e2f03e` - feat: add authentication and rate limiting middleware
- `483e827` - feat: add sandbox and metrics API routes
- `8925e5a` - docs: add MIT LICENSE and CLI reference documentation
- `02d61c2` - refactor: extract health check to dedicated router (see CHANGELOG.md)
- `c9b03ab` - refactor: add typed error handler with custom error classes (see CHANGELOG.md)
- `c4c21e8` - refactor: extract 404 handler to dedicated middleware (see CHANGELOG.md)
- `6014ac4` - refactor: restructure createApp with helper functions and modular design (see CHANGELOG.md)
