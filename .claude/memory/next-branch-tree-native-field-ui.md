---
name: next-branch-tree-native-field-ui
description: Next branch after ISSUES-pruning-August26 replaces the Field authoring/picking UI with a tree-native inline picker
metadata: 
  node_type: memory
  type: project
  originSessionId: 41ec2142-12d0-48d6-a7d1-371a0d98f7d3
  modified: 2026-08-11T18:44:59.126Z
---

As of 2026-08-11, the next branch's work is a rebuild of the **Field authoring
and Field adding UI/UX**. The current surfaces — the `FieldComposer/`
checkbox pick-list (`pendingMode`, `pendingFields:` drafts,
`DefinitionAuthoringForm` + `configForms/`) and the legacy `CreateDataField`
"+ Add Field" — were scaffolding: they existed to get the data model and the
registry/manifest rebuilt, never as the real answer. Both are expected to go.

The replacement "truly embraces the tree-nature": it will *just be the tree* —
expandable inline nodes for choosing Fields and their sub-fields — reusing the
new registry/manifest architecture more directly than the composer does.

**Why:** items in `docs/ISSUES.md` that are bound to the composer/legacy
surfaces are not worth fixing twice.

**How to apply:** such items carry a leading `[Fields UI]` tag in ISSUES.md
(legend is in the file's header) and are parked until the new UI lands. When
new field-UI work surfaces, tag it the same way rather than scheduling it.
Work that *feeds* the new picker — e.g. the `node.allowedKinds` allow-policy —
is pre-work, not parked. See [[working-style-docs-and-smells]].
