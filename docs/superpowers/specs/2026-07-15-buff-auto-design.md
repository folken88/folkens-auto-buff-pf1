# Folken Games: Auto Buff Activation (PF1) — Design Spec

**Date:** 2026-07-15
**Module id:** `folkengames-pf1-buff-auto`
**Basis:** fork/superset of `mkah-pf1-buff-activator` v1.2.0 (by mkahvi / Mana),
license + copyright preserved, credited as a fork. Enabled *instead of* the
original in worlds that want auto behavior (do not run both — they'd
double-toggle).

## Purpose

A GM time-saver for Pathfinder 1e (Foundry VTT). Three behaviors:

- **A. Item-use auto-activation** — using an item/spell/feature auto-activates
  same-named buffs, on the selected target(s) or the caster.
- **B. Multi-select broadcast** — toggling a buff on one of several selected
  tokens copies + activates it on the other selected tokens.
- **C. Manual config (inherited)** — mkahvi's per-item activate/deactivate
  lists, item-sheet UI, and item-hints integration, kept intact.

The two new behaviors (A, B) are additive to C; C's explicit config always
takes precedence.

## Terminology

A **buff** is an embedded Item of `type: "buff"` on an actor. "Active" =
`system.active === true`. Toggling activation is
`actor.updateEmbeddedDocuments("Item", [{ _id, "system.active": true }])`.

## Name matching (shared by A)

Normalize both names: lowercase, replace runs of non-alphanumeric characters
with a single space, collapse whitespace, trim. Strip diacritics (NFD +
remove combining marks). A buff **matches** an item when:

```
buffNorm === itemNorm  ||  buffNorm.startsWith(itemNorm + " ")
```

This is "starts-with the full item name at a word boundary."

- `Shield` → `Shield`, `Shield of Faith`, `Shield, Greater` ✓
- `CPUSS Badge` → `CPUSS Badge`, `CPUSS Badge (Greater)` ✓
- `CPUSS` (rename the item) → `CPUSS Endurance`, `CPUSS Anything` ✓
- `Bless` → `Bless`, `Bless X` — but **not** `Blessing of Fervor` (word boundary)

Guard: item names shorter than `minNameLength` (default 3, after normalize)
never auto-match, preventing junk matches.

## Behavior A — item-use auto-activation

Hook: `pf1PreDisplayActionUse` (same as upstream; fires on item/action use,
after cancellation is resolved).

1. Run upstream manual config first (activate/deactivate lists) — unchanged.
2. If `settings.autoMatch` is on and the item name passes the length guard,
   collect **auto targets** per `settings.targetMode`:
   - `targetElseSelf` (default): `game.user.targets` actors if non-empty,
     else the item's own actor.
   - `selfOnly`: the item's actor.
   - `selfAndTargets`: the item's actor ∪ targeted actors.
3. For each target actor, find its buffs matching the item name (rule above)
   and set them active. Auto-matching is **activate-only** (no auto-deactivate
   — a one-shot item use has no natural "off" trigger). Manual deactivate
   lists still work via C.

A target only lights up if it already owns a buff of that name — A toggles
existing buffs, it does not create them. (Creation is B's job.)

## Behavior B — multi-select broadcast

Hook: `updateItem(item, changed, options, userId)`.

Fire only when ALL hold:
- `item.type === "buff"` and `changed.system?.active === true` (a false→true
  activation this update).
- `userId === game.user.id` (only the user who flipped it broadcasts — avoids
  every connected client doing it).
- `options.buffAutoBroadcast` is NOT set (loop guard — propagated writes carry
  this flag).
- `settings.broadcast` is on.
- The buff's actor has a token in `canvas.tokens.controlled`, and there is at
  least one OTHER controlled token.

Action, for each other controlled token's actor the user can modify
(`actor.isOwner` / GM):
- If it has a buff matching by **exact normalized name** (not prefix — this is
  a deliberate 1:1 copy, not a fan-out), set that buff active.
- Else copy the source buff: `create` from `sourceBuff.toObject()` with
  `system.active = true`.
- All writes pass `{ buffAutoBroadcast: true }` in options so they don't
  re-trigger B.

Defaults (both are settings): activation only (turning a buff **off** does not
propagate unless `settings.broadcastDeactivate` is on); already-present →
just activate (never overwrite the existing buff's level/config).

Permission: skip any target actor the user cannot modify (no error, just a
debug log). Typically the GM runs this and owns everything.

## Settings (world scope unless noted)

| key | type | default | meaning |
|---|---|---|---|
| `autoMatch` | Boolean | true | enable behavior A |
| `targetMode` | String choice | `targetElseSelf` | A's target selection |
| `minNameLength` | Number | 3 | A's junk-match guard |
| `broadcast` | Boolean | true | enable behavior B |
| `broadcastDeactivate` | Boolean | false | B also mirrors off→on de-activation |

## Compatibility / packaging

- Keeps upstream flag namespace `flags.world.buffToggle` so existing manual
  configs carry over when swapping to the fork.
- Keeps the item-sheet buff-selector UI and the `mkah-pf1-item-hints`
  handler registration.
- New module id + title; `compatibility` bumped to verified 13 (min 12) so it
  loads cleanly on the v13 servers (f4 is v14 → shows unverified, expected).
- Preserve upstream `LICENSE` + a `## Fork` credit in README pointing at
  mkahvi's `fvtt-micro-modules`.

## Testing

Manual in a scratch PF1 world (a `folken-buff-test` world or an existing one):
1. Actor with a buff "Shield"; cast/use a "Shield" spell → buff activates.
2. Buff "CPUSS Endurance"; item named "CPUSS" → activates it; item "CPUSS
   Badge" does NOT (word boundary) — confirms the rule.
3. `Bless` item does not activate `Blessing of Fervor`.
4. Target another token that owns "Shield", cast Shield with it targeted →
   the target's buff activates, not the caster's.
5. Select 3 tokens (two lack the buff), toggle "Haste" on one → the other two
   get a copied, active "Haste"; no infinite loop; a token already having
   "Haste" just activates it without a duplicate.
6. Deselect all but one, toggle a buff → no broadcast.

## Out of scope (v1)

Auto-deactivation on item use; syncing buff level when already present;
cross-scene / non-controlled propagation; PF2e.
