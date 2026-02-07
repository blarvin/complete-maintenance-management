# Always Consult SPECIFICATION.md Before Building

- **Source of truth for scope**: Treat SPECIFICATION.md as the definitive list of what is required.
- **No overbuild**: This is prototyping! Build only what is required by the spec.
- **Prefer hardcoded/simple choices** over generalization when SPECIFICATION.md says to defer richer features.
- **When unsure**: Re-read SPECIFICATION.md and choose the simpler, Phase-1-aligned approach.
- **If new matter of critical engineering arises**: Explain it to the User and try to present option to defer into `LATER.md`.

# Always Consult LATER.md Before Building

- **Source of truth for scope**: Treat LATER.md as the definitive list of what is deferred.
- **No overbuild**: If a feature, complexity, or optimization is listed as deferred, do not implement it in Phase 1. Ask the user.
- **If new matter of critical engineering arises**: Explain it to the User and try to present option to defer into `LATER.md`.

If a task conflicts with these, either simplify it to Phase 1 or explicitly record it in `LATER.md` for future phases.
