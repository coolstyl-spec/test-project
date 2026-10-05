// Pure game logic. No DOM access: every function takes state (and an rng where randomness
// is involved) so it can run in the browser and under `node --test` alike.

import {
  AFFIX_POOL, BALANCE, BOSS_NAMES, CHESTS, ITEM_SUFFIXES, RARITIES, SKILLS, SLOTS, STAT_BASE, TRAITS, UPGRADES,
} from './data.js';
import { createRng, pick, randRange, weightedIndex } from './rng.js';

export const SAVE_VERSION = 1;

export function createState(now = Date.now()) {
  const state = {
    version: SAVE_VERSION,
    gold: 0,
    stage: 1,
    highestStage: 1,
    autoAdvance: true,
    autoSkills: true,
    speed: 1,
    hero: { level: 1, xp: 0 },
    upgrades: { atk: 0, hp: 0, crit: 0 },
    equipment: Object.fromEntries(SLOTS.map((s) => [s.id, null])),
    inventory: [],
    chests: { wood: 1, silver: 0, gold: 0, abyss: 0 },
    stats: { kills: 0, chestsOpened: 0, bestHit: 0 },
    nextItemId: 1,
    lastSeen: now,
    battle: null,
  };
  state.battle = spawnBattle(state);
  return state;
}

// ---------- Hero ----------

export function xpToNext(level) {
  return Math.floor(20 * Math.pow(1.15, level - 1));
}

export function equipmentTotals(equipment) {
  const totals = Object.fromEntries(AFFIX_POOL.map((k) => [k, 0]));
  for (const item of Object.values(equipment)) {
    if (!item) continue;
    for (const [stat, value] of Object.entries(item.stats)) totals[stat] += value;
  }
  return totals;
}

export function heroStats(state, equipment = state.equipment) {
  const eq = equipmentTotals(equipment);
  const lvlMult = Math.pow(1.06, state.hero.level - 1);
  const up = state.upgrades;
  const atk = (10 * lvlMult + eq.atk) * Math.pow(1.08, up.atk) * (1 + eq.atkPct / 100);
  const maxHp = (100 * lvlMult + eq.hp) * Math.pow(1.08, up.hp) * (1 + eq.hpPct / 100);
  const critChance = Math.min(BALANCE.critChanceCap, 5 + 0.5 * up.crit + eq.critChance);
  const critDmg = 150 + 5 * up.crit + eq.critDmg;
  const atkSpeed = Math.min(BALANCE.atkSpeedCap, 1 + eq.atkSpeed / 100);
  const goldPct = eq.goldPct;
  return { atk, maxHp, critChance, critDmg, atkSpeed, goldPct };
}

// A single number used to compare gear: damage weighted heavier than survivability.
export function powerScore(stats) {
  const critFactor = 1 + (stats.critChance / 100) * (stats.critDmg / 100 - 1);
  const dps = stats.atk * critFactor * stats.atkSpeed;
  return Math.pow(dps, 0.75) * Math.pow(stats.maxHp, 0.25) * (1 + stats.goldPct / 400);
}

export function addXp(state, amount) {
  const levelsGained = [];
  state.hero.xp += amount;
  while (state.hero.xp >= xpToNext(state.hero.level)) {
    state.hero.xp -= xpToNext(state.hero.level);
    state.hero.level += 1;
    levelsGained.push(state.hero.level);
  }
  return levelsGained;
}

// ---------- Bosses ----------

export function isKingStage(stage) {
  return stage % 10 === 0;
}

// Same stage always produces the same boss, so retries feel fair.
export function bossForStage(stage) {
  const rng = createRng(stage * 9973 + 17);
  const king = isKingStage(stage);
  let traitCount = stage < 5 ? 0 : stage < 15 ? 1 : stage < 40 ? 2 : 3;
  if (king) traitCount += 1;
  const pool = [...TRAITS];
  const traits = [];
  for (let i = 0; i < traitCount && pool.length; i++) {
    traits.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  }
  const has = (id) => traits.includes(id);
  const baseName = pick(rng, BOSS_NAMES);
  const maxHp = 60 * Math.pow(1.25, stage - 1) * (king ? 4 : 1) * (has('sturdy') ? 1.5 : 1);
  const atk = 6 * Math.pow(1.19, stage - 1) * (king ? 1.5 : 1) * (has('brutal') ? 1.5 : 1);
  return {
    name: king ? `${baseName} ราชันย์` : baseName,
    king,
    traits,
    maxHp,
    atk,
    attackInterval: 1.6 * (has('swift') ? 0.65 : 1),
    timeLimit: king ? BALANCE.kingTimeLimit : BALANCE.bossTimeLimit,
    hue: Math.floor(rng() * 360),
  };
}

export function spawnBattle(state) {
  const boss = bossForStage(state.stage);
  const hero = heroStats(state);
  return {
    stage: state.stage,
    boss,
    bossHp: boss.maxHp,
    heroHp: hero.maxHp,
    timeLeft: boss.timeLimit,
    heroAttackTimer: 0,
    bossAttackTimer: boss.attackInterval,
    cooldowns: Object.fromEntries(SKILLS.map((s) => [s.id, 0])),
    enraged: false,
    phase: 'fight', // fight | victory | defeat
    phaseTimer: 0,
  };
}

export function goldReward(stage) {
  return 15 * Math.pow(1.18, stage - 1) * (isKingStage(stage) ? 5 : 1);
}

export function xpReward(stage) {
  return 10 * Math.pow(1.1, stage - 1) * (isKingStage(stage) ? 3 : 1);
}

export function rollChestTier(stage, rng) {
  if (isKingStage(stage)) return stage >= 30 && rng() < 0.3 ? 'abyss' : 'gold';
  const weights = [70, 25, 5, stage >= 20 ? 1.5 : 0];
  return CHESTS[weightedIndex(rng, weights)].id;
}

// ---------- Combat ----------

function trait(battle, id) {
  return battle.boss.traits.includes(id);
}

function damageBoss(state, battle, raw, rng, stats, source, events) {
  const crit = rng() < stats.critChance / 100;
  let amount = raw * randRange(rng, 0.9, 1.1) * (crit ? stats.critDmg / 100 : 1);
  if (trait(battle, 'armored')) amount *= 0.7;
  battle.bossHp = Math.max(0, battle.bossHp - amount);
  state.stats.bestHit = Math.max(state.stats.bestHit, amount);
  events.push({ type: 'hit', amount, crit, source });
}

export function skillUnlocked(state, skill) {
  return state.highestStage >= skill.unlockStage;
}

export function skillReady(state, skillId) {
  const battle = state.battle;
  const skill = SKILLS.find((s) => s.id === skillId);
  return Boolean(skill && battle && battle.phase === 'fight' && skillUnlocked(state, skill) && battle.cooldowns[skillId] <= 0);
}

export function castSkill(state, skillId, rng, events = []) {
  if (!skillReady(state, skillId)) return events;
  const battle = state.battle;
  const skill = SKILLS.find((s) => s.id === skillId);
  const stats = heroStats(state);
  battle.cooldowns[skillId] = skill.cooldown;
  events.push({ type: 'skill', id: skill.id, name: skill.name, color: skill.color });
  if (skill.kind === 'heal') {
    const heal = stats.maxHp * skill.healPct;
    battle.heroHp = Math.min(stats.maxHp, battle.heroHp + heal);
    events.push({ type: 'heal', amount: heal });
    return events;
  }
  let mult = skill.mult;
  if (skill.executeBelow && battle.bossHp / battle.boss.maxHp < skill.executeBelow) mult *= 2;
  for (let i = 0; i < skill.hits; i++) {
    damageBoss(state, battle, stats.atk * mult, rng, stats, skill.id, events);
  }
  return events;
}

function autoCastSkills(state, rng, stats, events) {
  const battle = state.battle;
  for (const skill of SKILLS) {
    if (!skillReady(state, skill.id)) continue;
    // Save the heal for when it matters.
    if (skill.kind === 'heal' && battle.heroHp / stats.maxHp > 0.6) continue;
    castSkill(state, skill.id, rng, events);
    if (battle.bossHp <= 0) return;
  }
}

function winFight(state, rng, events) {
  const battle = state.battle;
  const stage = battle.stage;
  const stats = heroStats(state);
  const gold = goldReward(stage) * (1 + stats.goldPct / 100);
  const xp = xpReward(stage);
  const chest = rollChestTier(stage, rng);
  state.gold += gold;
  state.chests[chest] += 1;
  state.stats.kills += 1;
  const levels = addXp(state, xp);
  battle.phase = 'victory';
  battle.phaseTimer = BALANCE.pauseBetweenFights;
  events.push({ type: 'victory', stage, gold, xp, chest });
  for (const level of levels) events.push({ type: 'levelUp', level });
  if (state.autoAdvance) {
    state.stage = stage + 1;
    state.highestStage = Math.max(state.highestStage, state.stage);
  }
}

function loseFight(state, reason, events) {
  const battle = state.battle;
  battle.phase = 'defeat';
  battle.phaseTimer = BALANCE.pauseBetweenFights;
  events.push({ type: 'defeat', reason, stage: battle.stage });
  // Fall back one stage and farm there until the player challenges again.
  state.autoAdvance = false;
  state.stage = Math.max(1, battle.stage - 1);
}

function step(state, dt, rng, events) {
  const battle = state.battle;
  if (battle.phase !== 'fight') {
    battle.phaseTimer -= dt;
    if (battle.phaseTimer <= 0) {
      state.battle = spawnBattle(state);
      events.push({ type: 'spawn', stage: state.stage });
    }
    return;
  }

  const stats = heroStats(state);
  for (const id of Object.keys(battle.cooldowns)) {
    battle.cooldowns[id] = Math.max(0, battle.cooldowns[id] - dt);
  }
  battle.timeLeft -= dt;

  if (trait(battle, 'regen')) {
    battle.bossHp = Math.min(battle.boss.maxHp, battle.bossHp + battle.boss.maxHp * 0.015 * dt);
  }

  battle.heroAttackTimer -= dt;
  while (battle.heroAttackTimer <= 0 && battle.bossHp > 0) {
    battle.heroAttackTimer += 1 / stats.atkSpeed;
    damageBoss(state, battle, stats.atk, rng, stats, 'attack', events);
  }
  if (state.autoSkills && battle.bossHp > 0) autoCastSkills(state, rng, stats, events);

  if (battle.bossHp <= 0) {
    winFight(state, rng, events);
    return;
  }

  if (trait(battle, 'wrath') && !battle.enraged && battle.bossHp / battle.boss.maxHp < 0.5) {
    battle.enraged = true;
    events.push({ type: 'enrage' });
  }

  battle.bossAttackTimer -= dt;
  while (battle.bossAttackTimer <= 0) {
    battle.bossAttackTimer += battle.boss.attackInterval;
    const amount = battle.boss.atk * (battle.enraged ? 2 : 1) * randRange(rng, 0.9, 1.1);
    battle.heroHp = Math.max(0, battle.heroHp - amount);
    events.push({ type: 'bossHit', amount });
  }

  if (battle.heroHp <= 0) loseFight(state, 'died', events);
  else if (battle.timeLeft <= 0) loseFight(state, 'timeout', events);
}

// Advances the simulation by `dt` seconds (already multiplied by game speed).
export function tick(state, dt, rng) {
  const events = [];
  let remaining = Math.min(dt, 1);
  while (remaining > 1e-9) {
    const slice = Math.min(0.05, remaining);
    step(state, slice, rng, events);
    remaining -= slice;
  }
  return events;
}

export function challengeBoss(state) {
  state.autoAdvance = true;
  state.stage = state.highestStage;
  state.battle = spawnBattle(state);
}

// ---------- Items & chests ----------

function rollStat(stat, ilvl, rarity, rng, share = 1) {
  const value = STAT_BASE[stat](ilvl) * rarity.mult * share * randRange(rng, 0.85, 1.15);
  return Math.round(value * 100) / 100;
}

export function generateItem(state, ilvl, rarityIndex, rng) {
  const rarity = RARITIES[rarityIndex];
  const slot = pick(rng, SLOTS);
  const stats = { [slot.main]: rollStat(slot.main, ilvl, rarity, rng) };
  const pool = AFFIX_POOL.filter((s) => s !== slot.main);
  for (let i = 0; i < rarity.affixes; i++) {
    const stat = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    stats[stat] = rollStat(stat, ilvl, rarity, rng, 0.5);
  }
  return {
    id: state.nextItemId++,
    slot: slot.id,
    name: `${pick(rng, slot.nouns)}${pick(rng, ITEM_SUFFIXES)}`,
    rarity: rarity.id,
    ilvl,
    stats,
  };
}

export function rarityOf(item) {
  return RARITIES.find((r) => r.id === item.rarity);
}

export function salvageValue(item) {
  return Math.floor(5 * Math.pow(1.18, item.ilvl - 1) * rarityOf(item).mult);
}

// Positive when equipping `item` would make the hero stronger.
export function upgradeDelta(state, item) {
  const current = powerScore(heroStats(state));
  const withItem = powerScore(heroStats(state, { ...state.equipment, [item.slot]: item }));
  return withItem / current - 1;
}

export function openChest(state, tier, rng) {
  if (!state.chests[tier]) return null;
  const chest = CHESTS.find((c) => c.id === tier);
  state.chests[tier] -= 1;
  state.stats.chestsOpened += 1;
  const ilvl = Math.max(1, state.highestStage);
  return generateItem(state, ilvl, weightedIndex(rng, chest.weights), rng);
}

export function equipItem(state, item) {
  const previous = state.equipment[item.slot];
  state.equipment[item.slot] = item;
  state.inventory = state.inventory.filter((i) => i.id !== item.id);
  if (previous) storeItem(state, previous);
  clampHeroHp(state);
  return previous;
}

export function storeItem(state, item) {
  if (state.inventory.length >= BALANCE.inventoryCap) {
    state.gold += salvageValue(item);
    return false;
  }
  state.inventory.push(item);
  return true;
}

export function salvageItem(state, item) {
  state.inventory = state.inventory.filter((i) => i.id !== item.id);
  const value = salvageValue(item);
  state.gold += value;
  return value;
}

// Opens every chest, keeps upgrades on the hero and turns the rest into gold.
export function openAllChests(state, rng) {
  const summary = { opened: 0, equipped: [], salvagedGold: 0, byRarity: {} };
  for (const chest of CHESTS) {
    while (state.chests[chest.id] > 0) {
      const item = openChest(state, chest.id, rng);
      summary.opened += 1;
      summary.byRarity[item.rarity] = (summary.byRarity[item.rarity] || 0) + 1;
      if (upgradeDelta(state, item) > 0) {
        const previous = state.equipment[item.slot];
        state.equipment[item.slot] = item;
        if (previous) summary.salvagedGold += salvageValue(previous);
        summary.equipped.push(item);
      } else {
        summary.salvagedGold += salvageValue(item);
      }
    }
  }
  state.gold += summary.salvagedGold;
  // Items replaced earlier in this batch never reach the hero.
  summary.equipped = summary.equipped.filter((item) => state.equipment[item.slot] === item);
  clampHeroHp(state);
  return summary;
}

function clampHeroHp(state) {
  if (!state.battle) return;
  state.battle.heroHp = Math.min(state.battle.heroHp, heroStats(state).maxHp);
}

// ---------- Upgrades ----------

export function upgradeCost(id, level) {
  const def = UPGRADES.find((u) => u.id === id);
  return Math.ceil(def.baseCost * Math.pow(def.growth, level));
}

export function buyUpgrade(state, id) {
  const cost = upgradeCost(id, state.upgrades[id]);
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.upgrades[id] += 1;
  if (id === 'hp' && state.battle) {
    // Grow current HP along with the max so an upgrade mid-fight helps immediately.
    const before = heroStats({ ...state, upgrades: { ...state.upgrades, hp: state.upgrades.hp - 1 } }).maxHp;
    state.battle.heroHp += heroStats(state).maxHp - before;
  }
  return true;
}

// ---------- Offline progress ----------

export function applyOfflineProgress(state, now, rng) {
  const elapsed = Math.min(BALANCE.offlineCapSeconds, Math.max(0, (now - state.lastSeen) / 1000));
  state.lastSeen = now;
  const kills = Math.floor(elapsed / BALANCE.offlineSecondsPerKill);
  if (kills < 1) return null;
  const farmStage = Math.max(1, state.highestStage - 1);
  const gold = goldReward(farmStage) * kills * (1 + heroStats(state).goldPct / 100);
  const xp = xpReward(farmStage) * kills;
  const chests = {};
  for (let i = 0; i < Math.min(kills, BALANCE.offlineChestCap); i++) {
    const tier = rollChestTier(farmStage, rng);
    chests[tier] = (chests[tier] || 0) + 1;
    state.chests[tier] += 1;
  }
  state.gold += gold;
  state.stats.kills += kills;
  const levels = addXp(state, xp);
  return { elapsed, kills, gold, xp, chests, levelsGained: levels.length };
}

// ---------- Save / load ----------

export function serialize(state) {
  const { battle, ...rest } = state;
  return JSON.stringify(rest);
}

export function deserialize(json, now = Date.now()) {
  const fresh = createState(now);
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return fresh;
  }
  if (!data || typeof data !== 'object' || data.version !== SAVE_VERSION) return fresh;
  const state = {
    ...fresh,
    ...data,
    hero: { ...fresh.hero, ...data.hero },
    upgrades: { ...fresh.upgrades, ...data.upgrades },
    equipment: { ...fresh.equipment, ...data.equipment },
    chests: { ...fresh.chests, ...data.chests },
    stats: { ...fresh.stats, ...data.stats },
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
  };
  state.battle = spawnBattle(state);
  return state;
}
