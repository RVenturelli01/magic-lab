# Coding-agent instructions

MagicLab is a personal ML research dashboard intended to be installed inside other researchers' repositories and extended by coding agents. The primary rule is **minimum added entropy**: satisfy the user's request with the fewest new concepts, controls, branches, dependencies, and visual differences. Reuse existing structures, code, and styles first. Do not add speculative features or configuration. An explicit user requirement can justify a different approach; record the reason and keep the exception local.

Keep the same style and reuse the code if there is no reason to have it different. Apply this to every change and future implementation decision in this repository. Before adding a new visual pattern or implementation, find the closest existing one and extend the shared component, style, or utility when the behavior is common. Keep a difference only when the data, interaction, accessibility, or an explicit user requirement calls for it.

The active application is in `dashboard/`. Read `dashboard/AGENTS.md` before changing it; that file routes agents to the architecture, style, and verification guides. Preserve the user's existing work and the current repository state while making focused changes.
