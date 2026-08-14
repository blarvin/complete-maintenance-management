/**
 * Stable seeded-Definition ids — pure literals, zero imports, so any layer
 * (the component-free kind policies, the seed, UI) can reference a canonical
 * Definition without dragging in the seed module (which imports the db).
 *
 * The `fd_` prefix is historical (FieldDefinition) and deliberately kept:
 * ids are opaque, and churning them buys nothing (see the WP1 rename note).
 */
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
 * The Definitions every new node is born with (SPEC → *Default DataFields at
 * Node Creation*). Owned here rather than by a picker component: node creation
 * seeds them whether or not any add-field surface is mounted.
 */
export const CONSTRUCTION_DEFAULT_DEFINITION_IDS = [
  DEFINITION_IDS.typeOf,
  DEFINITION_IDS.description,
  DEFINITION_IDS.tags,
] as const;
