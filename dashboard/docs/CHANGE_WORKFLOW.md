# Change and verification workflow

Use this loop for dashboard work. It turns a request into a specific, reviewable result and keeps source claims separate from browser observations. REA can supply evidence about an external reference when needed; ordinary changes to this source repository use the code and local browser first.

The governing rule is **minimum added entropy**. Implement only what the user requested, reusing existing structures, code and styles with the fewest new details and decisions. Explicit user requirements may justify exceptions; record the requirement instead of silently creating a new convention. The loop applies equally to features, fixes, refactors, installation and documentation; mark visual checks not applicable with a reason when rendered behavior is unaffected.

## 1. Define the change

Write down the requested behavior, affected section and view, expected states, and a concrete way to recognize success. Identify whether the work changes data semantics, chart calculations, algorithm mathematics, a shared UI pattern, or only section-specific presentation. Read [ARCHITECTURE.md](ARCHITECTURE.md), [STYLE_GUIDE.md](STYLE_GUIDE.md), and the relevant task guide: [DATA_ADAPTER.md](DATA_ADAPTER.md), [CHARTS.md](CHARTS.md), or [ALGORITHM_STYLE.md](ALGORITHM_STYLE.md). Inspect the closest existing code and browser view before implementing a new pattern.

Use a small acceptance list while working: each requested behavior, the state and viewport in which it should appear, and the observation or test that will prove it. Add the relevant empty, loading, error, reset, and saved-state cases. For shared UI, include each affected section. Revisit this list after every iteration; a feature is not finished while a requested item remains unchecked.

Record the nearest existing flow, shared component, utility, style rule and state owner using actual source paths. Capture the affected UI before changing it when there is a visible baseline, and identify a peer screen for comparison. State the scope you are implementing; do not turn an underspecified detail into extra options, configuration, a generic framework or another dependency. Resolve routine choices from existing patterns.

If the request refers to an external product, record what is directly observed there, the viewport and interaction used to observe it, and what remains an inference. Do not claim feature or calculation parity from a screenshot. Use REA only when evidence about that external running target is needed and available; [VISUAL_VERIFICATION.md](VISUAL_VERIFICATION.md) explains the local capture and reference tools. Keep private captures and raw reference data in ignored local storage.

## 2. Implement at the owning boundary

Change the smallest shared source that owns the behavior. Reuse common components, CSS, and calculation utilities; keep a difference only when the data or task requires it. Preserve the adapter contract, sample provenance, exact algorithm/version identity, missing-value semantics, and saved browser state. Add a meaningful test for changed calculations or adapter behavior. For a UI interaction, extend the visual capture or record a reproducible manual check if the existing script misses the path. Update the architecture or style guide when the feature changes their map or rule.

Use this order: existing record or option, existing component/utility, a small extension to that shared owner, then a new abstraction only if a concrete need remains. Do not copy and rename a peer implementation or build speculative extension points. Keep source-specific logic out of views. Preserve unrelated staged and unstaged work. If adding an installation dependency or source path, verify the transferred dashboard described in [ADOPTION.md](ADOPTION.md), including the installer allowlist.

## 3. Run the applicable checks

For performance work, establish a reproducible baseline before editing and measure production builds again on the same machine/browser. Use `npm run performance:check` as described in [ADOPTION.md](ADOPTION.md). Report initial resource sizes separately from interaction latency: moving a dependency to a later view can reduce startup bytes while adding a first-use wait. Prefer clear ownership and memoized stable inputs over speculative caches. Do not reduce data fidelity silently to obtain a faster number.

From the repository root on Windows, run `./start-dashboard.ps1 test`, `typecheck`, and `lint` (one command per check). On any machine with Node and installed dashboard dependencies, run `npm test`, `npm run typecheck`, and `npm run lint` from `dashboard/`. Check formatting of changed authored files with the project's Prettier installation. Run a production build for changes that affect compilation, routes, imports, or production behavior. Do not build against a checkout while its development preview is being edited; restart the preview if generated framework state becomes stale. Record any check that could not run and why.

`npm run check` runs the three checks in order, stopping on failure. For documentation-only edits, check links, paths, commands and formatting; run executable examples when their behavior changes. Add tests for meaningful behavior and regression risks, not assertions that merely repeat source text or enforce arbitrary line counts.

For data changes, check adapter contract cases, provenance, loading, empty, error, and retry states. For calculations, check representative inputs, missing values, and boundary cases. For persisted state, check a clean browser and an older saved value. For an algorithm formulation, verify the exact version against its implementation before calling it implementation-verified.

## 4. Observe and iterate in the browser

Run the local visual loop in [VISUAL_VERIFICATION.md](VISUAL_VERIFICATION.md). Exercise the changed action, its reverse or reset, reload if state persists, and keyboard or touch alternatives where relevant. Capture the changed state at desktop and mobile; check affected light and dark themes and high contrast for color or focus changes. For a shared component, inspect its uses in MagicPlot, MagicAlgo, and MagicTuner. Open the saved images and inspect clipping, hierarchy, notation, legibility, alignment, selected state, overflow, and responsive behavior. A script report with `passed: true` is a navigation and error check, not visual approval.

If the image or interaction differs from the requested behavior or the style guide, correct the code and repeat the affected checks and captures. Stop the loop when the requested states are observable, the relevant checks pass, and the screenshots have been reviewed. Do not enlarge the test sweep without a concrete remaining risk. If local browser tooling is unavailable, use another available browser for the same specific checks and report exactly which visual states remain unverified.

## 5. Critique the implementation and repeat

Review the final diff and opened screenshots against the acceptance list and the closest existing implementation. Answer concretely:

- Is every new control, branch, field, helper, dependency and CSS rule needed for a requested result? Remove speculative additions and redundant indirection.
- Did I reuse the actual shared implementation, including state and error semantics, or only imitate its appearance? Consolidate duplicate logic at its existing owner.
- Do equivalent tasks still look and behave alike across affected sections, themes and viewports? Compare the images side by side, including spacing, density, focus, overflow and labels.
- Does the observed interaction match the requested result, including reverse/reset and persisted state? Which assertion or image demonstrates it?
- Is each remaining difference explained by data, interaction, accessibility or an explicit user instruction? A preference for a different implementation is insufficient.

Fix discrepancies at their owner, then repeat the affected correctness checks, interactions, captures and image inspection. Keep a short observation → correction → recheck record. Do not invent a defect or force a second pass if the first review finds none. Do not broaden into unrelated cleanup. An unavailable browser or failing check leaves the relevant criterion unverified; report that limitation and do not describe the feature as fully verified.

## 6. Report the result

State what changed and why, list the commands and browser states actually checked, and distinguish direct observation from inference. Name any remaining limitation or unverified state. Keep documentation and tests consistent with the implemented behavior. A feature is ready when the requested behavior, shared-style consistency, relevant correctness checks, and visual review are complete; a passing command alone is not a completion claim.

Use this compact review record in the PR/task report or in ignored `outputs/change-review.md`. Do not create a new permanent document for every small change. Include paths to the actual captures; a checklist alone is not evidence.

```markdown
Requested result and scope:
Acceptance criteria → observed evidence (or explicitly unverified):
Existing components/utilities/styles reused (source paths):
Necessary additions/exceptions → requirement they serve:
Checks actually run → results:
Images opened → viewport, theme, state, nearest peer comparison:
Self-critique → observation, correction, recheck (or no discrepancy found):
Remaining limitations / not-applicable checks with reasons:
```
