---
name: chrome-mcp-tab-no-raf
description: The Chrome MCP tab often runs no animation frames, so smooth scroll / CSS animation / screenshots stall — hand-verify motion in a foreground tab
metadata:
  type: project
---

The tab that `tabs_context_mcp` hands back is frequently not painting:
`requestAnimationFrame` never fires (a 500ms rAF loop timed out at 45s),
`Page.captureScreenshot` intermittently times out with "renderer may be frozen",
and anything rAF-driven silently no-ops — `scrollIntoView({behavior:'smooth'})`
does nothing while `behavior:'auto'` and `window.scrollTo` work fine.

**Why:** observed 2026-08-16 while hand-testing the reveal-on-arrival scroll.
It cost a long detour chasing an app bug that wasn't there.

**How to apply:** DOM state (classes, values, computed paths) is trustworthy
through the MCP tab and is the thing to assert on. Motion — smooth scroll, CSS
`@keyframes`, transitions — is not; if a behaviour depends on frames, verify the
state that drives it and hand the visual check to the user in their own window.
Don't conclude the code is broken from a stalled animation. Related:
[[working-style-docs-and-smells]].
