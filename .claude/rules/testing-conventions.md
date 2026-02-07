---
paths: "**/*.test.ts"
---

# Testing Conventions

- Use `fake-indexeddb` for IndexedDB tests (fast, in-memory)
- Use `setNodeService(mock)` / `setFieldService(mock)` for service swapping in tests
- Test domain logic at the service/adapter layer, not in components
- Qwik components are not unit-testable with standard Vitest — test the logic they call instead
