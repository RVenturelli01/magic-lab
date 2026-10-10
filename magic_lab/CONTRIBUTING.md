# Contributing

Read [AGENTS.md](AGENTS.md) and [the architecture](docs/ARCHITECTURE.md). Keep reusable code separate from host experiments and put each change in the owning layer. Follow [the extension recipes](docs/EXTENDING.md).

Use independent numerical fixtures for statistical changes and raw-to-normalized tests for readers. Keep portable tests independent of host data. Run `npm run format`, `npm run check`, `npm test` and `npm run package:check`; validate host data separately when affected. Check UI and actual artifacts in a browser when changing visible/export behavior, and report that separately from automated tests.

Update affected contracts/guides, preserve supported saved views and avoid obsolete facades/examples. Keep Node >=22, local operation and MIT licensing. Dependencies need a concrete purpose; install with npm ci from the pinned lockfile. Do not commit private logs, credentials, checkpoints, caches or generated experiment files into the module.
