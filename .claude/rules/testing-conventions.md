---
paths: "**/*.test.ts"
---

# Testing Conventions

- Use `fake-indexeddb` for IndexedDB tests (fast, in-memory)
- Use `setCommandBus(mock)` / `setNodeQueries(mock)` / `setFieldQueries(mock)` for CQRS swapping in tests
- Test domain logic at the command handler / query / adapter layer, not in components
- Components are not unit-tested here: `vitest.config.ts` has no Solid JSX transform, so nothing test-reachable may import a `.tsx` file (this is why `src/kinds/{placement,capabilities,childrenPolicy,provisionPolicy,configSchema}.ts` exist as component-free reads — a test must never import `registry.ts` or a `*.manifest.ts`). Test the logic components call instead; component behaviour is covered by the Cypress contract specs.
