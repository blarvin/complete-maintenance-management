/**
 * provisionPolicy — teeth for the component-free provisioning schedule. Asserts the
 * derived PROVISIONED_LENSES stays in lockstep with the `provision` capabilities
 * (every provisioned kind present, every suffix agreeing with its idScheme), so a
 * new lens kind added to a manifest can't be silently skipped by the provisioner.
 */

import { describe, it, expect } from 'vitest';
import type { Kind } from '../data/models';
import type { CapabilitySet } from '../kinds/types';
import { KIND_CAPABILITIES } from '../kinds/capabilities';
import { PROVISIONED_LENSES, isProvisionedLens } from '../kinds/provisionPolicy';

const capsOf = (k: Kind): CapabilitySet => KIND_CAPABILITIES[k];

const provisionKinds = (Object.keys(KIND_CAPABILITIES) as Kind[]).filter((k) => capsOf(k).provision);

describe('provisionPolicy', () => {
  it('covers exactly the kinds that declare a provision capability', () => {
    const scheduled = new Set(PROVISIONED_LENSES.map((l) => l.kind));
    for (const k of provisionKinds) {
      expect(scheduled.has(k)).toBe(true);
    }
    expect(PROVISIONED_LENSES).toHaveLength(provisionKinds.length);
  });

  it('derives each suffix from the kind’s provision idScheme (`${parentId}::<suffix>`)', () => {
    for (const lens of PROVISIONED_LENSES) {
      const idScheme = capsOf(lens.kind).provision!.idScheme;
      // `.replace` with a string arg is a literal (non-regex) replacement.
      expect(idScheme.replace('${parentId}', 'PARENT')).toBe(`PARENT::${lens.suffix}`);
    }
  });

  it('gives every scheduled lens a non-empty container name', () => {
    for (const lens of PROVISIONED_LENSES) {
      expect(lens.name.length).toBeGreaterThan(0);
    }
  });

  it('classifies the lens containers, and only those, as provisioned', () => {
    for (const k of ['jobs', 'logbook'] as const) {
      expect(isProvisionedLens(k)).toBe(true);
    }
    for (const k of ['node', 'org', 'job', 'log-entry', 'text-kv'] as const) {
      expect(isProvisionedLens(k)).toBe(false);
    }
  });
});
