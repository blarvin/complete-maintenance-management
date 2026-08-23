/**
 * Stable seeded-Definition ids — pure literals, no runtime imports, so any layer
 * (the component-free kind policies, the seed, UI) can reference a canonical
 * Definition without dragging in the seed module (which imports the db).
 *
 * The `fd_` prefix is historical (FieldDefinition) and deliberately kept:
 * ids are opaque, and churning them buys nothing (see the WP1 rename note).
 */

import type { Kind } from './models';
export const DEFINITION_IDS = {
  description: 'fd_description',
  typeOf: 'fd_type_of',
  tags: 'fd_tags',
  status: 'fd_status',
  weight: 'fd_weight',
  powerRating: 'fd_power_rating',
  mainImage: 'fd_main_image',
  internalLink: 'fd_internal_link',
  /** The logbook container's default policy Definition (entry label, staleness). */
  logbookPolicy: 'fd_logbook_policy',
} as const;

/**
 * Ids of the three seeded Library chrome Elements (Library-As-Lens-Tree).
 * Separate from `DEFINITION_IDS` on purpose: these rows are chrome, not
 * Definitions — `isDefinitionRow` excludes them everywhere Definitions are read.
 */
export const LIBRARY_CHROME_IDS = {
  root: 'lib_root',
  definitions: 'lib_definitions',
  kinds: 'lib_kinds',
} as const;

/**
 * The Kinds lens's row id for one kind. **Not an Element id** — a kind is an
 * archetype with nothing in storage (KindsIndex → *a kind is an archetype, not
 * an object*), so this is a synthetic row identity: what `useFieldEdit` keys the
 * archetype's edit state by, and what a `revealElement` aims at to send someone
 * to that Kind's card. Lives here, beside `LIBRARY_CHROME_IDS.kinds`, because
 * the reveal needs both halves and two copies of the template would let the
 * target and the row drift apart in silence.
 */
export const kindArchetypeId = (kind: Kind): string => `library-kind::${kind}`;

/*
 * Which Definitions a new node is born with is no longer here: it is pack data,
 * read through `constructionDefaults()` (`src/data/packs/activePack.ts`). This
 * module stays a pure id vocabulary — the ids other layers name, nothing about
 * how they are used.
 */
