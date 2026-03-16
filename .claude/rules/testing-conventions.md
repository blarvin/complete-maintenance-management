---
paths: "**/*.test.ts"
---

# Testing Conventions

- Use `fake-indexeddb` for IndexedDB tests (fast, in-memory)
- Use `setCommandBus(mock)` / `setNodeQueries(mock)` / `setFieldQueries(mock)` for CQRS swapping in tests
- Test domain logic at the command handler / query / adapter layer, not in components
- Qwik components are not unit-testable with standard Vitest — test the logic they call instead
