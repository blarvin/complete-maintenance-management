/**
 * KIND_CAPABILITIES — the composed capability subset for every kind, as **pure
 * data** (no renderer components). Each `*.manifest.ts` spreads its entry; the
 * manifest is still the assembled whole, this is just the capability slice's
 * authoring home.
 *
 * Why a separate module: capability data must be readable without importing the
 * Qwik renderer `component$`s the manifests carry — both for the coherence test
 * (Vitest doesn't transform components; project convention forbids importing them
 * in unit tests) and for the SPEC's "degeneration anti-pattern is CI-lintable"
 * (§584), which reads capability subsets without booting the app. `satisfies
 * Record<Kind, CapabilitySet>` enforces an entry for every kind.
 *
 * **Structural seam only** — not read by any consumer in the running app yet; the
 * lens / node-like kinds (#6) are the first readers, the cascade arbiter (#7) the
 * second.
 */

import type { Kind } from '../data/models';
import type { CapabilitySet } from './types';

export const KIND_CAPABILITIES = {
    // Children(open) + physical container (ELEMENT-MODEL §node). `allowedKinds` is
    // provisional — a literal list to avoid a `registry` import cycle; the real
    // allow-policy firms up with the node-like kinds (#6).
    node: {
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['node', 'text-kv', 'enum-kv', 'number-kv', 'single-image'], // TODO(#6)
            },
        },
        container: 'physical',
    },

    // Field-like kinds compose OwnValue. Minimal — the validation/threshold logic
    // stays config-level for now (the value-shape vocabulary is #5's).
    'text-kv': { ownValue: {} },
    'enum-kv': { ownValue: {} },
    'number-kv': { ownValue: {} },
    'single-image': { ownValue: {} },

    // Config-only sub-field kinds also bear an own value (inside config subtrees).
    flag: { ownValue: {} },
    compound: { ownValue: {} },
    'string-list': { ownValue: {} },
} satisfies Record<Kind, CapabilitySet>;
