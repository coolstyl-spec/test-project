import { CHESTS, SKILLS, TRAITS } from './data.js';
import {
  applyOfflineProgress, buyUpgrade, castSkill, challengeBoss, createState, deserialize, equipItem, heroStats,
  openAllChests, openChest, salvageItem, serialize, skillUnlocked, storeItem, tick, upgradeDelta, xpToNext,
} from './engine.js';
import { formatNumber } from './format.js';
import { ArenaRenderer } from './render.js';
import { createRng } from './rng.js';
import {
  bagPanel, chestsPanel, gearPanel, offlineModal, openAllModal, resetModal, revealModal, upgradesPanel,
} from './ui.js';

const SAVE_KEY = 'lootbox-idle-save';
const $ = (id) => document.getElementById(id);

const rng = createRng(Date.now() % 2147483647);
let state;
let renderer;
let activeTab = 'chests';
let panelSignature = '';
let pendingItem = null;
let bannerTimer = 0;
let lastFrame = performance.now();
let lastSave = 0;

// ---------- Persistence ----------

function readSave() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function save() {
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // Storage may be blocked (private mode); the game still runs for this session.
  }
}

// ---------- HUD ----------

function buildSkillButtons() {
  $('skills').innerHTML = SKILLS.map((s) => `
    <button type="button" class="skill" data-skill="${s.id}" style="--skill-color:${s.color}" aria-label="${s.name}">
      <span class="glyph ${s.id}"></span>
      <span class="cd"></span>
      <span class="skill-name">${s.name}</span>
    </button>`).join('');
}

function updateHud() {
  const battle = state.battle;
  const { boss } = battle;
  const stats = heroStats(state);
  const chestTotal = CHESTS.reduce((sum, c) => sum + state.chests[c.id], 0);

  $('stage').textContent = battle.stage;
  $('gold').textContent = formatNumber(state.gold);
  $('chest-count').textContent = chestTotal;

  const nameEl = $('boss-name');
  if (nameEl.textContent !== boss.name) nameEl.textContent = boss.name;
  nameEl.classList.toggle('king', boss.king);
  const traitKey = boss.traits.join(',') + battle.enraged;
  const traitsEl = $('boss-traits');
  if (traitsEl.dataset.key !== traitKey) {
    traitsEl.dataset.key = traitKey;
    traitsEl.innerHTML = boss.traits.map((id) => {
      const t = TRAITS.find((x) => x.id === id);
      const active = id === 'wrath' && battle.enraged;
      return `<span class="trait${active ? ' active' : ''}" title="${t.desc}">${t.name}</span>`;
    }).join('');
  }

  const bossPct = (battle.bossHp / boss.maxHp) * 100;
  $('boss-fill').style.width = `${bossPct}%`;
  $('boss-hp-text').textContent = `${bossPct.toFixed(1)}%`;
  document.querySelector('.boss-bar').classList.toggle('enraged', battle.enraged);
  const timeLeft = Math.max(0, Math.ceil(battle.timeLeft));
  $('timer').textContent = timeLeft;
  document.querySelector('.timer').classList.toggle('low', timeLeft <= 8);

  $('hero-level').textContent = state.hero.level;
  $('hero-fill').style.width = `${(battle.heroHp / stats.maxHp) * 100}%`;
  $('hero-hp-text').textContent = `${formatNumber(battle.heroHp)}/${formatNumber(stats.maxHp)}`;
  const need = xpToNext(state.hero.level);
  $('xp-fill').style.width = `${(state.hero.xp / need) * 100}%`;
  $('xp-text').textContent = `${formatNumber(state.hero.xp)}/${formatNumber(need)}`;

  for (const skill of SKILLS) {
    const btn = document.querySelector(`[data-skill="${skill.id}"]`);
    const cd = btn.querySelector('.cd');
    const unlocked = skillUnlocked(state, skill);
    btn.classList.toggle('locked', !unlocked);
    if (!unlocked) {
      cd.textContent = `ปลดล็อกด่าน ${skill.unlockStage}`;
      cd.style.setProperty('--cd', '0%');
      continue;
    }
    const remaining = battle.cooldowns[skill.id];
    cd.style.setProperty('--cd', `${(remaining / skill.cooldown) * 100}%`);
    cd.textContent = remaining > 0 ? Math.ceil(remaining) : '';
  }

  $('auto-skills').setAttribute('aria-pressed', String(state.autoSkills));
  const challenge = $('challenge');
  challenge.disabled = state.autoAdvance;
  challenge.textContent = state.autoAdvance ? 'บุกด่านต่ออัตโนมัติ' : `ท้าบอสด่าน ${state.highestStage}`;
  challenge.classList.toggle('pulse', !state.autoAdvance);
  $('speed').textContent = `x${state.speed}`;
}

function showBanner(text, kind) {
  const el = $('banner');
  el.hidden = false;
  el.className = `banner ${kind}`;
  el.textContent = text;
  // Restart the CSS animation.
  void el.offsetWidth;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  bannerTimer = 1.2;
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'victory') {
      const chest = CHESTS.find((c) => c.id === e.chest);
      showBanner(`ชนะ! +${formatNumber(e.gold)} ทอง · ${chest.name}`, 'victory');
    } else if (e.type === 'defeat') {
      showBanner(e.reason === 'timeout' ? 'หมดเวลา! ถอยกลับไปฝึกฝน' : 'พ่ายแพ้! ถอยกลับไปฝึกฝน', 'defeat');
    } else if (e.type === 'levelUp') {
      showBanner(`เลเวลอัป! ${e.level}`, 'victory');
    } else if (e.type === 'enrage') {
      showBanner('บอสโกรธแล้ว!', 'defeat');
    }
  }
}

// ---------- Panel ----------

function panelKey() {
  switch (activeTab) {
    case 'chests': return JSON.stringify(state.chests);
    case 'gear': return JSON.stringify([state.hero.level, state.upgrades, Object.values(state.equipment).map((i) => i?.id), state.stats.kills]);
    case 'bag': return JSON.stringify([state.inventory.map((i) => i.id), Object.values(state.equipment).map((i) => i?.id), state.hero.level, state.upgrades]);
    case 'upgrades': return JSON.stringify([state.upgrades, Math.floor(Math.log10(state.gold + 1) * 20)]);
    default: return '';
  }
}

function renderPanel(force = false) {
  const key = activeTab + panelKey();
  if (!force && key === panelSignature) return;
  panelSignature = key;
  const builders = { chests: chestsPanel, gear: gearPanel, bag: bagPanel, upgrades: upgradesPanel };
  $('panel').innerHTML = builders[activeTab](state);
}

function setTab(tab) {
  activeTab = tab;
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
  }
  renderPanel(true);
}

// ---------- Modal ----------

function openModal(html) {
  $('modal-card').innerHTML = html;
  $('modal').hidden = false;
  $('modal-card').querySelector('button')?.focus();
}

function closeModal() {
  $('modal').hidden = true;
  if (pendingItem) {
    storeItem(state, pendingItem);
    pendingItem = null;
  }
  renderPanel(true);
}

function onPanelClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  switch (btn.dataset.action) {
    case 'open': {
      const item = openChest(state, btn.dataset.tier, rng);
      if (!item) return;
      pendingItem = item;
      openModal(revealModal(state, item, CHESTS.find((c) => c.id === btn.dataset.tier).name));
      break;
    }
    case 'open-all':
      openModal(openAllModal(state, openAllChests(state, rng)));
      break;
    case 'equip': {
      const item = state.inventory.find((i) => i.id === id);
      if (item) equipItem(state, item);
      break;
    }
    case 'salvage': {
      const item = state.inventory.find((i) => i.id === id);
      if (item) salvageItem(state, item);
      break;
    }
    case 'salvage-worse':
      for (const item of [...state.inventory]) if (upgradeDelta(state, item) <= 0) salvageItem(state, item);
      break;
    case 'upgrade':
      buyUpgrade(state, btn.dataset.id);
      break;
    case 'reset':
      openModal(resetModal());
      return;
    default:
      return;
  }
  save();
  renderPanel(true);
}

function onModalClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  switch (btn.dataset.action) {
    case 'modal-equip':
      if (pendingItem) {
        state.inventory.push(pendingItem);
        equipItem(state, pendingItem);
        pendingItem = null;
      }
      break;
    case 'modal-salvage':
      if (pendingItem) {
        state.inventory.push(pendingItem);
        salvageItem(state, pendingItem);
        pendingItem = null;
      }
      break;
    case 'confirm-reset':
      pendingItem = null;
      state = createState();
      break;
    default:
      break; // modal-keep and close fall through to closeModal, which stores any pending item.
  }
  closeModal();
  save();
}

// ---------- Loop ----------

function frame(now) {
  const realDt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  const events = tick(state, realDt * state.speed, rng);
  renderer.handle(events);
  handleEvents(events);
  renderer.draw(state, now / 1000, realDt);
  updateHud();
  renderPanel();
  if (bannerTimer > 0) {
    bannerTimer -= realDt;
    if (bannerTimer <= 0) $('banner').hidden = true;
  }
  if (now - lastSave > 5000) {
    lastSave = now;
    save();
  }
  requestAnimationFrame(frame);
}

function bindControls() {
  $('skills').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-skill]');
    if (!btn) return;
    const events = castSkill(state, btn.dataset.skill, rng);
    renderer.handle(events);
    handleEvents(events);
  });
  $('auto-skills').addEventListener('click', () => { state.autoSkills = !state.autoSkills; save(); });
  $('challenge').addEventListener('click', () => { challengeBoss(state); save(); });
  $('speed').addEventListener('click', () => { state.speed = (state.speed % 3) + 1; save(); });
  $('chest-shortcut').addEventListener('click', () => {
    setTab('chests');
    $('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  }
  $('panel').addEventListener('click', onPanelClick);
  $('modal-card').addEventListener('click', onModalClick);
  $('modal').addEventListener('click', (event) => { if (event.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('modal').hidden) closeModal(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      save();
    } else {
      const result = applyOfflineProgress(state, Date.now(), rng);
      if (result) openModal(offlineModal(result));
      lastFrame = performance.now();
    }
  });
  window.addEventListener('pagehide', save);
}

function start(hotData = {}) {
  const raw = hotData.save ?? readSave();
  state = raw ? deserialize(raw) : createState();
  const offline = raw ? applyOfflineProgress(state, Date.now(), rng) : null;

  renderer = new ArenaRenderer($('arena'));
  buildSkillButtons();
  bindControls();
  setTab(activeTab);
  if (offline) openModal(offlineModal(offline));
  window.claude?.hot?.snapshot?.(() => ({ save: serialize(state) }));
  requestAnimationFrame((now) => { lastFrame = now; frame(now); });
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
