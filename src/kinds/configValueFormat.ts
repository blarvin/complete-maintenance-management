/**
 * configValueFormat — how a config sub-field value reads as text.
 *
 * One source of truth for two consumers that must agree: each config-only
 * kind's manifest `displayPreview` (the string form, used by history) and its
 * Renderer (the row form, used by the Library picker's config peek and a
 * Field's Details → Config section). They were separate inline expressions
 * while only `displayPreview` existed; surfacing config as rows gave the second
 * consumer, and two hand-written formatters would drift.
 *
 * Kept **JSX-free** so the manifests — and the storage layer through them — can
 * import it without pulling a component into a Node-only context.
 *
 * Each helper formats a *present* value only. Null is the caller's concern,
 * because the two callers want different things from it: `displayPreview`
 * returns null, while a renderer draws its own placeholder.
 */

import type { FlagValue, StringListValue } from '../data/models';

/** `true` → `Yes`. At this type size a word reads faster than a glyph, and it
 *  matches how the value is spoken ("multiline: yes"). */
export const formatFlag = (v: FlagValue): string => (v ? 'Yes' : 'No');

/** `["In Service","Retired"]` → `In Service, Retired`.
 *  An empty list is a distinct and meaningful state — an `enum-kv` with no
 *  options cannot be filled in — so it reads as `None` rather than as blank,
 *  which would be indistinguishable from unset. */
export const formatStringList = (v: StringListValue): string =>
    v.length === 0 ? 'None' : v.join(', ');

/* `formatCompound` lived here until 2026-08-17. `compound` is retired — number-kv's
   thresholds are four ordinary `number-kv` sub-fields now, each formatted by that
   kind — so there is no object-valued config leaf left to print. */
