import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyOfflineProgress, bossForStage, buyUpgrade, castSkill, challengeBoss, createState, deserialize, equipItem,
  generateItem, heroStats, openAllChests, openChest, serialize, tick, upgradeCost, upgradeDelta, xpToNext, addXp,
} from '../src/engine.js';
import { formatNumber } from '../src/format.js';
import { createRng, weightedIndex } from '../src/rng.js';

test('formatNumber uses game-style suffixes', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1234), '1.23K');
  assert.equal(formatNumber(50_690_000), '50.69M');
  assert.equal(formatNumber(260_970_000), '260.97M');
  assert.equal(formatNumber(999_999), '1.00M');
  assert.equal(formatNumber(1e15), '1.00aa');
  assert.equal(formatNumber(1e18), '1.00ab');
});

test('rng is deterministic for a seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('weightedIndex never picks zero-weight entries', () => {
  const rng = createRng(1);
  for (let i = 0; i < 2000; i++) assert.notEqual(weightedIndex(rng, [0, 5, 0, 5]) % 2, 0);
});

test('bosses are stable per stage and scale up', () => {
  assert.deepEqual(bossForStage(7), bossForStage(7));
  assert.ok(bossForStage(8).maxHp > bossForStage(2).maxHp);
  const king = bossForStage(10);
  assert.ok(king.king);
  assert.match(king.name, /ราชันย์$/);
  assert.equal(bossForStage(1).traits.length, 0);
  assert.equal(bossForStage(50).traits.length, 4); // king stage: 3 + 1
});

test('a fresh hero beats stage 1 and earns rewards', () => {
  const state = createState(0);
  const rng = createRng(3);
  const events = [];
  for (let i = 0; i < 400 && !events.some((e) => e.type === 'victory'); i++) events.push(...tick(state, 0.1, rng));
  const victory = events.find((e) => e.type === 'victory');
  assert.ok(victory, 'expected a victory');
  assert.ok(state.gold > 0);
  assert.equal(state.stage, 2);
  assert.equal(state.highestStage, 2);
  assert.equal(state.chests[victory.chest] >= 1, true);
});

test('running out of time drops a stage and stops auto-advance', () => {
  const state = createState(0);
  state.stage = state.highestStage = 40;
  state.battle = null;
  challengeBoss(state);
  const rng = createRng(9);
  const events = [];
  for (let i = 0; i < 1000 && !events.some((e) => e.type === 'defeat'); i++) events.push(...tick(state, 0.1, rng));
  assert.ok(events.some((e) => e.type === 'defeat'));
  assert.equal(state.stage, 39);
  assert.equal(state.autoAdvance, false);
  challengeBoss(state);
  assert.equal(state.stage, 40);
  assert.equal(state.autoAdvance, true);
});

test('skills respect unlocks and cooldowns', () => {
  const state = createState(0);
  const rng = createRng(5);
  assert.equal(castSkill(state, 'harvest', rng).length, 0, 'harvest is locked at stage 1');
  const first = castSkill(state, 'slash', rng);
  assert.ok(first.some((e) => e.type === 'hit' && e.source === 'slash'));
  assert.equal(castSkill(state, 'slash', rng).length, 0, 'slash is on cooldown');
});

test('chests turn into items with the chest rarity table', () => {
  const state = createState(0);
  const rng = createRng(11);
  state.chests.abyss = 200;
  const rarities = new Set();
  for (let i = 0; i < 200; i++) rarities.add(openChest(state, 'abyss', rng).rarity);
  assert.ok(!rarities.has('common') && !rarities.has('uncommon'));
  assert.ok(rarities.has('mythic'));
  assert.equal(openChest(state, 'abyss', rng), null);
});

test('equipping a better weapon raises attack and returns the old one to the bag', () => {
  const state = createState(0);
  const rng = createRng(2);
  let weapon;
  do weapon = generateItem(state, 20, 5, rng); while (weapon.slot !== 'weapon');
  const before = heroStats(state).atk;
  assert.ok(upgradeDelta(state, weapon) > 0);
  equipItem(state, weapon);
  assert.ok(heroStats(state).atk > before);
  let weaker;
  do weaker = generateItem(state, 1, 0, rng); while (weaker.slot !== 'weapon');
  state.inventory.push(weaker);
  equipItem(state, weaker);
  assert.equal(state.equipment.weapon, weaker);
  assert.ok(state.inventory.includes(weapon));
  assert.ok(!state.inventory.includes(weaker));
});

test('openAllChests empties chests and only keeps upgrades', () => {
  const state = createState(0);
  state.chests = { wood: 10, silver: 5, gold: 3, abyss: 1 };
  const summary = openAllChests(state, createRng(8));
  assert.equal(summary.opened, 19);
  assert.deepEqual(state.chests, { wood: 0, silver: 0, gold: 0, abyss: 0 });
  for (const item of summary.equipped) assert.equal(state.equipment[item.slot], item);
});

test('upgrades cost gold and grow', () => {
  const state = createState(0);
  assert.equal(buyUpgrade(state, 'atk'), false);
  state.gold = 1000;
  const atk = heroStats(state).atk;
  assert.equal(buyUpgrade(state, 'atk'), true);
  assert.equal(state.gold, 1000 - upgradeCost('atk', 0));
  assert.ok(heroStats(state).atk > atk);
  assert.ok(upgradeCost('atk', 5) > upgradeCost('atk', 4));
});

test('level ups carry leftover xp', () => {
  const state = createState(0);
  const levels = addXp(state, xpToNext(1) + xpToNext(2) + 3);
  assert.deepEqual(levels, [2, 3]);
  assert.equal(state.hero.xp, 3);
});

test('offline progress pays out and is capped at 8 hours', () => {
  const state = createState(0);
  state.highestStage = 10;
  assert.equal(applyOfflineProgress(state, 10_000, createRng(1)), null);
  const result = applyOfflineProgress(state, 10_000 + 24 * 3600 * 1000, createRng(1));
  assert.equal(result.elapsed, 8 * 3600);
  assert.equal(result.kills, 960);
  assert.ok(state.gold > 0);
  const chestTotal = Object.values(result.chests).reduce((a, b) => a + b, 0);
  assert.equal(chestTotal, 30);
});

test('save round-trips and bad saves start fresh', () => {
  const state = createState(0);
  state.gold = 1234;
  state.highestStage = state.stage = 12;
  const loaded = deserialize(serialize(state), 0);
  assert.equal(loaded.gold, 1234);
  assert.equal(loaded.battle.stage, 12);
  assert.equal(deserialize('not json', 0).gold, 0);
  assert.equal(deserialize('{"version":99}', 0).stage, 1);
});
