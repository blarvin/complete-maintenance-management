/**
 * provisionPolicy — teeth for the component-free provisioning schedule. Asserts the
 * schedule stays in lockstep with the `provision` capabilities (every provisioned
 * kind present, every suffix agreeing with its idScheme), so a new lens kind added
 * to a manifest can't be silently skipped by the provisioner — and that the two
 * pack-supplied fields (container name, policy binding) actually arrive.
 */

import { describe, it, expect } from 'vitest';
import type { Kind } from '../data/models';
import type { CapabilitySet } from '../kinds/types';
import { KIND_CAPABILITIES } from '../kinds/capabilities';
import { getProvisionedLenses, isProvisionedLens } from '../kinds/provisionPolicy';
import { DEFINITION_IDS } from '../data/definitionIds';

const capsOf = (k: Kind): CapabilitySet => KIND_CAPABILITIES[k];

const provisionKinds = (Object.keys(KIND_CAPABILITIES) as Kind[]).filter((k) => capsOf(k).provision);

const lenses = getProvisionedLenses();

describe('provisionPolicy', () => {
  it('covers exactly the kinds that declare a provision capability', () => {
    const scheduled = new Set(lenses.map((l) => l.kind));
    for (const k of provisionKinds) {
      expect(scheduled.has(k)).toBe(true);
    }
    expect(lenses).toHaveLength(provisionKinds.length);
  });

  it('derives each suffix from the kind’s provision idScheme (`${parentId}::<suffix>`)', () => {
    for (const lens of lenses) {
      const idScheme = capsOf(lens.kind).provision!.idScheme;
      // `.replace` with a string arg is a literal (non-regex) replacement.
      expect(idScheme.replace('${parentId}', 'PARENT')).toBe(`PARENT::${lens.suffix}`);
    }
  });

  it('gives every scheduled lens a non-empty container name', () => {
    for (const lens of lenses) {
      expect(lens.name.length).toBeGreaterThan(0);
    }
  });

  it('carries the active pack’s policy binding, where the pack declares one', () => {
    const logbook = lenses.find((l) => l.kind === 'logbook');
    expect(logbook?.definitionId).toBe(DEFINITION_IDS.logbookPolicy);
    // jobs binds none: re-root binding is optional, and this is what proves it.
    expect(lenses.find((l) => l.kind === 'jobs')?.definitionId).toBeNull();
  });

  it('classifies the lens containers, and only those, as provisioned', () => {
    for (const k of ['jobs', 'logbook'] as const) {
      expect(isProvisionedLens(k)).toBe(true);
    }
    // The Library chrome kinds are `mintVia: 'provision'` but carry no
    // `provision` capability — seeded once, never reconciled per node.
    for (const k of ['node', 'org', 'job', 'log-entry', 'text-kv', 'library', 'definitions', 'kinds'] as const) {
      expect(isProvisionedLens(k)).toBe(false);
    }
    expect(lenses).toHaveLength(2);
  });
});
