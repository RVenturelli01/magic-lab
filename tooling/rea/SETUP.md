# Optional REA tooling

This folder contains tools for inspecting reference interfaces during MagicLab development. It is not required to run the dashboard.

On Windows, run `./tooling/rea/install.ps1` from the repository root to install the pinned Node.js and REA versions. The installer verifies the Node.js archive hash. To register REA with Codex as well, use `./tooling/rea/install.ps1 -RegisterCodex`; this updates your personal Codex configuration.

Use `./tooling/rea/start-browser.ps1 -CheckOnly` to inspect the browser setup, or `./tooling/rea/start-browser.ps1` to launch a dedicated Chrome profile for interface inspection. The browser listens on the local machine at `127.0.0.1:9222`. Sign in directly in that browser window if a reference site requires it.

The runtime, downloaded archives, dependencies, browser profiles, and local diagnostics stay on the development machine and are ignored by Git. See [dashboard/README.md](../../dashboard/README.md) for the application setup.
