# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## How labels appear in this tracker

The tracker is markdown (`docs/ISSUES.md`), not a labelled issue system, and its
house rules say "no labels, no statuses — order = priority". So apply a label
only when `/triage` actually runs, as a bracketed tag before the bold lead-in:

```markdown
3.) [needs-info] **Composer draft loses the uncommitted keystrokes** — …
```

Remove the tag once the item is resolved or the question is answered. An
untagged item is simply an untriaged queue item — the normal state for most of
the file.
