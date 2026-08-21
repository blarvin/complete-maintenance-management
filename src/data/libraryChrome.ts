/**
 * libraryChrome — component-free identity predicates for the Library lens tree
 * (Library-As-Lens-Tree, 2026-08-20).
 *
 * The Library's three chrome Elements live in the `library` tree alongside the
 * Definitions, so "is a Definition" is no longer just "library root row" — it is
 * "library root row whose kind is not chrome". These helpers are the single
 * definition of that split; the storage layer (`IDBAdapter`), the seeders and
 * the views all read them rather than re-deriving it inline.
 *
 * Kind-based, deliberately NOT "field-like": `fd_logbook_policy` is a Definition
 * of the re-root kind `logbook` and must stay a Definition.
 */

import type { Element, Kind } from './models';
import { isInline } from '../kinds/placement';
import { KIND_MINT_VIA } from '../kinds/mintVia';

const CHROME_KINDS: ReadonlySet<Kind> = new Set<Kind>(['library', 'definitions', 'kinds']);

/** Whether a kind is one of the three Library chrome kinds. */
export const isLibraryChrome = (kind: Kind): boolean => CHROME_KINDS.has(kind);

type ElementIdentity = Pick<Element, 'kind' | 'treeType' | 'parentId'>;

/** A Definition row: a library-tree root whose kind is not chrome. */
export const isDefinitionRow = (el: ElementIdentity): boolean =>
    el.treeType === 'library' && el.parentId === null && !isLibraryChrome(el.kind);

/** A config sub-field: a parented, non-chrome library-tree row. */
export const isConfigSubField = (el: ElementIdentity): boolean =>
    el.treeType === 'library' && el.parentId !== null && !isLibraryChrome(el.kind);

/**
 * The kinds the DefinitionsIndex gathers: user-authorable field kinds
 * (`isInline && mintVia === 'add-surface'`). Drops policy Definitions
 * (`logbook`) and config-only kinds (`flag`/`compound`/`string-list`).
 */
export const isFieldLikeDefinitionKind = (kind: Kind): boolean =>
    isInline(kind) && KIND_MINT_VIA[kind] === 'add-surface';

/** Which Library index view a chrome kind routes to (BranchView), if any. */
export const libraryIndexView = (kind: Kind): 'definitions' | 'kinds' | null =>
    kind === 'definitions' ? 'definitions' : kind === 'kinds' ? 'kinds' : null;
