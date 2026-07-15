/**
 * Folken's Auto Buff PF1
 * ----------------------
 * Automatic buff activation for the Pathfinder 1e system on Foundry VTT.
 *
 * Two behaviors:
 *   A. Item-use auto-activation — using an item / spell / feature activates
 *      buffs whose name starts with the item's name (word-boundary prefix),
 *      on the targeted token(s) or the caster.
 *   B. Multi-select broadcast — toggling a buff ON for one of several selected
 *      tokens copies + activates that buff on the other selected tokens.
 *
 * Credit: the item-use → buff-activation idea is inspired by mkahvi's
 * "Buff Activation for Pathfinder 1e" (mkah-pf1-buff-activator). This is an
 * independent implementation; none of mkahvi's code is reused.
 */

const MODULE = "folkens-auto-buff-pf1";
const log = (...a) => console.log(`%c${MODULE}`, "color:goldenrod", "|", ...a);
const warn = (...a) => console.warn(`${MODULE} |`, ...a);

/* -------------------------------------------- */
/*  Name matching                               */
/* -------------------------------------------- */

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
function normalize(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * "Starts-with the full item name, at a word boundary."
 *   itemName "Shield"      → buff "Shield", "Shield of Faith"      ✓
 *   itemName "CPUSS"       → buff "CPUSS Endurance"                ✓
 *   itemName "Bless"       → buff "Blessing of Fervor"             ✗ (no boundary)
 */
function prefixMatches(buffName, itemName) {
  const b = normalize(buffName);
  const i = normalize(itemName);
  if (!i) return false;
  return b === i || b.startsWith(i + " ");
}

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

function registerSettings() {
  const s = (key, data) => game.settings.register(MODULE, key, data);

  s("autoMatch", {
    name: `${MODULE}.settings.autoMatch.name`,
    hint: `${MODULE}.settings.autoMatch.hint`,
    scope: "world", config: true, type: Boolean, default: true
  });
  s("targetMode", {
    name: `${MODULE}.settings.targetMode.name`,
    hint: `${MODULE}.settings.targetMode.hint`,
    scope: "world", config: true, type: String, default: "targetElseSelf",
    choices: {
      targetElseSelf: `${MODULE}.settings.targetMode.targetElseSelf`,
      selfOnly: `${MODULE}.settings.targetMode.selfOnly`,
      selfAndTargets: `${MODULE}.settings.targetMode.selfAndTargets`
    }
  });
  s("minNameLength", {
    name: `${MODULE}.settings.minNameLength.name`,
    hint: `${MODULE}.settings.minNameLength.hint`,
    scope: "world", config: true, type: Number, default: 3,
    range: { min: 1, max: 20, step: 1 }
  });
  s("broadcast", {
    name: `${MODULE}.settings.broadcast.name`,
    hint: `${MODULE}.settings.broadcast.hint`,
    scope: "world", config: true, type: Boolean, default: true
  });
  s("broadcastDeactivate", {
    name: `${MODULE}.settings.broadcastDeactivate.name`,
    hint: `${MODULE}.settings.broadcastDeactivate.hint`,
    scope: "world", config: true, type: Boolean, default: false
  });
}

const get = (key) => game.settings.get(MODULE, key);

/* -------------------------------------------- */
/*  A. Item-use auto-activation                 */
/* -------------------------------------------- */

/** Which actors should have matching buffs toggled for this item use. */
function activationTargets(item) {
  const self = item.actor ? [item.actor] : [];
  const targeted = Array.from(game.user.targets ?? [])
    .map(t => t.actor)
    .filter(Boolean);

  switch (get("targetMode")) {
    case "selfOnly": return self;
    case "selfAndTargets": return [...new Set([...self, ...targeted])];
    case "targetElseSelf":
    default: return targeted.length ? targeted : self;
  }
}

async function activateMatchingBuffs(actor, itemName) {
  const buffs = (actor.itemTypes?.buff ?? [])
    .filter(b => !b.isActive && prefixMatches(b.name, itemName));
  if (!buffs.length) return 0;
  try {
    await actor.updateEmbeddedDocuments(
      "Item",
      buffs.map(b => ({ _id: b.id, "system.active": true })),
      { [MODULE]: { broadcast: true } } // don't let A feed B
    );
    return buffs.length;
  } catch (e) {
    warn(`activation failed on "${actor.name}"`, e);
    return 0;
  }
}

/**
 * Fires when an item/action is used. `app` is the PF1 ActionUse
 * ({ item, action, actor, shared }). PreDisplay runs after the roll is
 * resolved but before the chat card, so a cancelled use won't have fired.
 */
async function onItemUse(app) {
  if (!get("autoMatch")) return;
  const item = app?.item;
  if (!item) return;

  const iname = normalize(item.name);
  if (iname.length < get("minNameLength")) return;

  let total = 0;
  for (const actor of activationTargets(item)) {
    total += await activateMatchingBuffs(actor, item.name);
  }
  if (total) log(`"${item.name}" auto-activated ${total} buff(s).`);
}

/* -------------------------------------------- */
/*  B. Multi-select broadcast                   */
/* -------------------------------------------- */

/** Distinct actors of the other controlled tokens (excluding source). */
function otherControlledActors(srcActor) {
  const seen = new Set([srcActor.id]);
  const out = [];
  for (const tok of canvas.tokens?.controlled ?? []) {
    const a = tok.actor;
    if (!a || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

async function applyBuffToActor(actor, sourceBuff, enable) {
  if (!actor?.isOwner) return; // silently skip un-ownable targets
  const opts = { [MODULE]: { broadcast: true } };
  const existing = (actor.itemTypes?.buff ?? [])
    .find(b => normalize(b.name) === normalize(sourceBuff.name));

  try {
    if (existing) {
      if (existing.isActive !== enable) {
        await actor.updateEmbeddedDocuments(
          "Item", [{ _id: existing.id, "system.active": enable }], opts);
      }
    } else if (enable) {
      // Copy the buff over (preserving its level/config) and switch it on.
      const data = sourceBuff.toObject();
      delete data._id;
      foundry.utils.setProperty(data, "system.active", true);
      await actor.createEmbeddedDocuments("Item", [data], opts);
    }
  } catch (e) {
    warn(`broadcast to "${actor?.name}" failed`, e);
  }
}

/**
 * Fires on any item update. We act only when a buff's `system.active` flips,
 * the change was made by *this* user, and it isn't one of our own propagated
 * writes (loop guard via the options flag).
 */
async function onUpdateItem(item, changed, options, userId) {
  if (userId !== game.user.id) return;
  if (options?.[MODULE]?.broadcast) return;
  if (item.type !== "buff") return;
  if (!get("broadcast")) return;

  const nowActive = changed?.system?.active;
  if (nowActive !== true && nowActive !== false) return;
  if (nowActive === false && !get("broadcastDeactivate")) return;

  const srcActor = item.actor;
  if (!srcActor) return;

  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length < 2) return;
  // The buff's actor must be one of the selected tokens.
  if (!controlled.some(t => t.actor?.id === srcActor.id)) return;

  const others = otherControlledActors(srcActor);
  if (!others.length) return;

  for (const actor of others) await applyBuffToActor(actor, item, nowActive);
  log(`broadcast "${item.name}" (${nowActive ? "on" : "off"}) to ${others.length} token(s).`);
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

Hooks.once("init", registerSettings);

Hooks.once("ready", () => {
  Hooks.on("pf1PreDisplayActionUse", onItemUse);
  Hooks.on("updateItem", onUpdateItem);
  const mod = game.modules.get(MODULE);
  if (mod) mod.api = { normalize, prefixMatches };
  log("ready — auto-activation + multi-select broadcast active.");
});
