# Contributing to Locci Box

Thanks for taking the time to contribute! A few things to know before you start.

## License

Locci Box is MIT licensed. By contributing you agree your changes are released under the same terms.

## Open Core Model

Locci Box follows an **open core** model:

- The full codebase is public and MIT licensed — anyone can self-host
- Paid/hosted-tier features are **flagged, not forked** — they live in the same repo behind env vars or plan gates (e.g. `JFS_ENABLED`, `plan: free | pro | team`)
- Adding a feature behind a plan gate is acceptable and expected, not a code smell
- The hosted service's value comes from managed infrastructure, uptime, and support — not from hidden code

If you're adding a feature that should only be available to paid users on the hosted platform, gate it behind the appropriate plan flag and document it in `BACKLOG.md`.

## Getting Started

```bash
pnpm install
pnpm dev
```

See `docs/SETUP.md` for full setup instructions and `docs/QUICKSTART.md` for a 3-minute quick start.

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes and add tests where applicable
3. Run `pnpm test` and ensure all tests pass
4. Submit a pull request with a clear description of what changed and why

## Reporting Issues

Open an issue on GitHub with steps to reproduce, expected behaviour, and actual behaviour.
