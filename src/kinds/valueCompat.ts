/**
 * valueCompat — whether a value may be handed to a given kind's Renderer, as
 * **pure data** read off the capability set.
 *
 * The Add Surface's draft keeps the entered value across a kind change (SPEC →
 * The Add Surface → The bands: "the name and the entered value survive"), which
 * across incompatible kinds would otherwise hand `NumberKvField` a string and
 * have `toFixed` throw mid-render. This is the guard, and it lives here rather
 * than as a `switch` in the surface so that **a new kind cannot silently break
 * the draft**: `ValueSpec.runtime` is required, so a value-bearing kind has to
 * declare what it holds before it compiles.
 *
 * Why a separate module (same constraint as `placement.ts` / `childrenPolicy.ts`):
 * it reads `KIND_CAPABILITIES`, which is component-free, so this stays importable
 * from Node-only contexts where `registry.ts` and the `.tsx` manifests are not.
 */

import type { DataFieldValue, Kind } from '../data/models';
import type { CapabilitySet } from './types';
import { KIND_CAPABILITIES } from './capabilities';

/** Read an entry as a `CapabilitySet` (the indexed access is a union of literal shapes). */
const capsOf = (kind: Kind): CapabilitySet => KIND_CAPABILITIES[kind];

/**
 * Whether `kind`'s Renderer can be handed this value.
 *
 * `null` is always acceptable — every field kind renders an empty value, and it
 * is what an incompatible carry-over degrades to.
 *
 * Three cases, in order: a kind with an `ownValue` answers from its declared
 * `runtime`; a kind whose value is an Edge instead (`internal-link` stores a
 * target id, `external-link` a `{ url }`) accepts the object it stores; anything
 * else bears no value at all and accepts none.
 */
export const acceptsValue = (kind: Kind, value: DataFieldValue | null): boolean => {
    if (value === null) return true;
    const caps = capsOf(kind);
    if (caps.ownValue) return typeof value === caps.ownValue.runtime;
    if (caps.edges) return typeof value === 'object';
    return false;
};

/** The value if this kind can render it, else `null` — the carry-over across a
 *  draft's kind change. Compatible moves (text → enum) keep it; the rest drop it. */
export const valueForKind = (
    value: DataFieldValue | null,
    kind: Kind,
): DataFieldValue | null => (acceptsValue(kind, value) ? value : null);
