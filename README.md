# Folken's Auto Buff PF1

Automatic buff activation for the **Pathfinder 1e** system on Foundry VTT.

Two time-savers:

### A. Item-use auto-activation
Using an item, spell, or feature automatically activates buffs whose **name
matches** the item — no per-item setup. Matching is *"starts-with the full item
name, at a word boundary"* (case- and punctuation-insensitive):

| You use… | It activates buffs named… |
|---|---|
| `Shield` | `Shield`, `Shield of Faith`, `Shield, Greater` |
| `CPUSS Badge` | `CPUSS Badge`, `CPUSS Badge (Greater)` |
| `CPUSS` (rename the item) | `CPUSS Endurance`, `CPUSS Anything` |
| `Bless` | `Bless`, `Bless X` — **not** `Blessing of Fervor` |

By default it targets the **token(s) you have targeted**, or the caster if you
have none targeted (configurable). A target only lights up if it already owns a
buff of that name — this toggles existing buffs, it doesn't create them.

### B. Multi-select broadcast
Select several tokens, turn a buff **on** for one of them, and it **copies +
activates** that buff on the other selected tokens (copying the buff item, with
its level/config, to any token that doesn't have it). A huge time-saver for
party-wide buffs like *Haste* or *Bless*.

## Settings (world scope)

- **Auto-activate buffs by name** — on/off (default on)
- **Auto-activation target** — Targeted-else-self / Self only / Self and targets
- **Minimum item-name length** — junk-match guard (default 3)
- **Broadcast to selected tokens** — on/off (default on)
- **Broadcast deactivation too** — also mirror turning a buff *off* (default off)

## Credit

The item-use → buff-activation concept is inspired by **mkahvi (Mana)**'s
[*Buff Activation for Pathfinder 1e*](https://gitlab.com/mkahvi/fvtt-micro-modules/-/tree/master/pf1-buff-activator)
(`mkah-pf1-buff-activator`). This module is an independent implementation and
does not reuse that module's code. If you want **manual, per-item** buff
selection (rather than automatic name matching), mkahvi's original is the
complementary tool — the two shouldn't both drive activation in the same world.

## License

MIT — see [LICENSE](LICENSE).
