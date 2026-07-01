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
  assetDoc: 'fd_asset_doc',
  /** The logbook container's default policy Definition (entry label, staleness). */
  logbookPolicy: 'fd_logbook_policy',
} as const;
