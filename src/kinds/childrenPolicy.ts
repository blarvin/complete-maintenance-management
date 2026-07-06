/**
 * childrenPolicy — what a kind admits as children, as **pure data**, the
 * component-free read of each kind's `children` capability (`childrenSpec`).
 *
 * Why a separate module (same constraint as `placement.ts` / `capabilities.ts`):
 * these predicates are consumed by the create surface and the shell, and must be
 * unit-testable without importing `registry.ts`/`*.manifest.ts` — those pull the
 * Qwik `component$` renderers, which Vitest can't transform. So this reads
 * `KIND_CAPABILITIES` (already component-free) directly.
 *
 * First consumer of `childrenSpec.allowedKinds` (chrome entailment #5): the
 * create picker offers only what the parent admits, and a content-free lens
 * (`jobs` — no `children` capability) offers no "Add" and bears no DataCard.
 */

import type { Kind } from '../data/models';
import type { CapabilitySet } from './types';
import { KIND_CAPABILITIES } from './capabilities';

/** Read an entry as a `CapabilitySet` (the indexed access is a union of literal shapes). */
const capsOf = (kind: Kind): CapabilitySet => KIND_CAPABILITIES[kind];

/** The child kinds a parent admits (its `childrenSpec.allowedKinds`); `[]` for content-free kinds. */
export const allowedChildKinds = (parentKind: Kind): Kind[] =>
    capsOf(parentKind).children?.spec.allowedKinds ?? [];

/** Whether a kind can hold children at all (has a `children` capability). */
export const canHaveChildren = (parentKind: Kind): boolean =>
    !!capsOf(parentKind).children;

/**
 * The kinds that are *surfaced in a lens* — every `derivation.targetKind` declared
 * by some kind's capabilities. Today this is `{'job'}` (the `jobs` lens targets
 * `job`); `log-entry` joins automatically when `logbook` (#6c) lands. `org`'s
 * untyped derivation has no `targetKind`, so it's correctly excluded.
 *
 * The single source for both halves of "this kind lives in a lens, not the tree":
 * hide it from a parent's child list (display) AND drop it from the create picker
 * (creation) — jobs are minted from inside the `Jobs` lens, never as loose siblings.
 */
const LENS_TARGET_KINDS: ReadonlySet<Kind> = new Set(
    (Object.keys(KIND_CAPABILITIES) as Kind[])
        .map((k) => capsOf(k).derivation?.targetKind)
        .filter((k): k is Kind => !!k),
);

/** Whether a kind is surfaced in a lens (so hidden from the tree + trimmed from the picker). */
export const isLensSurfaced = (kind: Kind): boolean => LENS_TARGET_KINDS.has(kind);
