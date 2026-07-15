# Changelog

## 1.0.0 — 2026-07-15

Initial release.

- **Item-use auto-activation**: using an item/spell/feature activates buffs
  whose name starts with the item's name (word-boundary prefix), on the
  targeted token(s) or the caster (configurable target mode).
- **Multi-select broadcast**: turning a buff on for one of several selected
  tokens copies + activates it on the other selected tokens; optional
  deactivation mirroring.
- Loop-safe (propagated writes are flagged), single-writer (only the acting
  user broadcasts), and permission-aware (skips un-ownable targets).
- World settings: auto-match toggle, target mode, minimum name length,
  broadcast toggle, broadcast-deactivate toggle.
- Concept credit to mkahvi's `mkah-pf1-buff-activator`; independent code.
