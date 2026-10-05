// HTML builders for the tab panel and modals. Pure string output; main.js wires the events.

import { CHESTS, RARITIES, SLOTS, STATS, UPGRADES } from './data.js';
import { heroStats, rarityOf, salvageValue, upgradeCost, upgradeDelta } from './engine.js';
import { formatDuration, formatNumber } from './format.js';

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function statLine(stat, value) {
  const def = STATS[stat];
  const amount = def.percent ? `${value.toFixed(1)}%` : formatNumber(value);
  return `+${amount} ${def.name}`;
}

function slotName(slotId) {
  return SLOTS.find((s) => s.id === slotId).name;
}

function deltaHtml(state, item) {
  if (state.equipment[item.slot] === item) return '<span class="item-meta">สวมใส่อยู่</span>';
  const delta = upgradeDelta(state, item) * 100;
  if (Math.abs(delta) < 0.05) return '<span class="item-meta">พลังเท่าเดิม</span>';
  const cls = delta > 0 ? 'delta-up' : 'delta-down';
  return `<span class="${cls}">พลังรวม ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%</span>`;
}

export function itemHtml(state, item, actions = '') {
  const rarity = rarityOf(item);
  const stats = Object.entries(item.stats).map(([k, v]) => statLine(k, v)).join(' · ');
  return `
    <div class="item" style="--rarity:${rarity.color}">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-meta"><span class="rarity-tag" style="color:${rarity.ink}">${rarity.name}</span> · ${slotName(item.slot)} · เลเวล ${item.ilvl} · ${deltaHtml(state, item)}</div>
      <div class="item-stats">${stats}</div>
      ${actions ? `<div class="item-actions">${actions}</div>` : ''}
    </div>`;
}

export function chestsPanel(state) {
  const total = CHESTS.reduce((sum, c) => sum + state.chests[c.id], 0);
  const cards = CHESTS.map((chest) => {
    const count = state.chests[chest.id];
    const best = RARITIES[chest.weights.findLastIndex((w) => w > 0)];
    return `
      <div class="chest-card">
        <div class="chest-art" style="--chest-color:${chest.color};--chest-glow:${count ? chest.color : 'transparent'}"></div>
        <strong>${chest.name}</strong>
        <span class="count">x${count}</span>
        <span class="item-meta">สูงสุด: <span style="color:${best.ink};font-weight:600">${best.name}</span></span>
        <button type="button" class="btn" data-action="open" data-tier="${chest.id}" ${count ? '' : 'disabled'}>เปิด</button>
      </div>`;
  }).join('');
  return `
    <h3>หีบสมบัติ</h3>
    <p class="hint">ชนะบอสได้หีบ 1 ใบ ทุก 10 ด่านเป็นบอสราชันย์ที่ให้หีบทองขึ้นไป เลเวลไอเทมเท่ากับด่านสูงสุดที่ไปถึง</p>
    <div class="chest-grid">${cards}</div>
    <button type="button" class="btn" data-action="open-all" ${total ? '' : 'disabled'}>เปิดทั้งหมด (${total}) แล้วสวมของที่ดีกว่าอัตโนมัติ</button>`;
}

export function gearPanel(state) {
  const stats = heroStats(state);
  const slots = SLOTS.map((slot) => {
    const item = state.equipment[slot.id];
    return item ? itemHtml(state, item) : `<div class="empty-slot">${slot.name}: ยังไม่มี เปิดหีบเพื่อหาไอเทม</div>`;
  }).join('');
  return `
    <h3>ค่าสถานะ</h3>
    <dl class="stat-table">
      <dt>พลังโจมตี</dt><dd>${formatNumber(stats.atk)}</dd>
      <dt>พลังชีวิต</dt><dd>${formatNumber(stats.maxHp)}</dd>
      <dt>โอกาสคริติคอล</dt><dd>${stats.critChance.toFixed(1)}%</dd>
      <dt>ดาเมจคริติคอล</dt><dd>${stats.critDmg.toFixed(0)}%</dd>
      <dt>ความเร็วโจมตี</dt><dd>${stats.atkSpeed.toFixed(2)} ครั้ง/วิ</dd>
      <dt>ทองที่ได้รับ</dt><dd>+${stats.goldPct.toFixed(1)}%</dd>
      <dt>ดาเมจสูงสุดที่เคยทำ</dt><dd>${formatNumber(state.stats.bestHit)}</dd>
      <dt>บอสที่ล้มได้</dt><dd>${formatNumber(state.stats.kills)}</dd>
    </dl>
    <h3>อุปกรณ์ที่สวมใส่</h3>
    <div class="gear-list">${slots}</div>`;
}

export function bagPanel(state) {
  if (!state.inventory.length) {
    return `<h3>คลัง (0/30)</h3><p class="hint">ไอเทมที่เก็บไว้จะอยู่ที่นี่ ถ้าคลังเต็ม ไอเทมใหม่จะถูกแยกเป็นทองอัตโนมัติ</p>`;
  }
  const sorted = [...state.inventory].sort((a, b) => upgradeDelta(state, b) - upgradeDelta(state, a));
  const items = sorted.map((item) => itemHtml(state, item, `
    <button type="button" class="btn" data-action="equip" data-id="${item.id}">สวม</button>
    <button type="button" class="btn secondary" data-action="salvage" data-id="${item.id}">+${formatNumber(salvageValue(item))}</button>`)).join('');
  return `
    <h3>คลัง (${state.inventory.length}/30)</h3>
    <p class="hint">เรียงจากของที่เพิ่มพลังมากที่สุด ปุ่มตัวเลขคือแยกชิ้นส่วนเป็นทอง</p>
    <button type="button" class="btn secondary" data-action="salvage-worse">แยกของที่แย่กว่าที่สวมอยู่ทั้งหมด</button>
    <div class="bag-list">${items}</div>`;
}

export function upgradesPanel(state) {
  const rows = UPGRADES.map((u) => {
    const level = state.upgrades[u.id];
    const cost = upgradeCost(u.id, level);
    return `
      <div class="upgrade">
        <strong>${u.name} <span class="item-meta">เลเวล ${level}</span></strong>
        <span class="desc">${u.desc}</span>
        <button type="button" class="btn" data-action="upgrade" data-id="${u.id}" ${state.gold >= cost ? '' : 'disabled'}>${formatNumber(cost)} ทอง</button>
      </div>`;
  }).join('');
  return `
    <h3>ฝึกฝน</h3>
    <p class="hint">ใช้ทองเพิ่มพลังถาวร ค่าฝึกจะแพงขึ้นทุกเลเวล</p>
    ${rows}
    <button type="button" class="btn secondary" data-action="reset">เริ่มเกมใหม่</button>`;
}

export function revealModal(state, item, chestName) {
  const rarity = rarityOf(item);
  const better = upgradeDelta(state, item) > 0;
  return `
    <div class="reveal-glow" style="--rarity:${rarity.color}"></div>
    <h3 style="color:${rarity.ink}">${rarity.name}!</h3>
    <p class="hint">ได้จาก${chestName}</p>
    ${itemHtml(state, item)}
    <div class="row">
      <button type="button" class="btn" data-action="modal-equip">${better ? 'สวมใส่ (ดีกว่า)' : 'สวมใส่'}</button>
      <button type="button" class="btn secondary" data-action="modal-keep">เก็บเข้าคลัง</button>
      <button type="button" class="btn secondary" data-action="modal-salvage">แยกเป็นทอง +${formatNumber(salvageValue(item))}</button>
    </div>`;
}

export function openAllModal(state, summary) {
  const counts = RARITIES.filter((r) => summary.byRarity[r.id])
    .map((r) => `<span style="color:${r.ink};font-weight:600">${r.name} ${summary.byRarity[r.id]}</span>`)
    .join(' · ');
  const equipped = summary.equipped.length
    ? summary.equipped.map((item) => itemHtml(state, item)).join('')
    : '<p class="hint">ไม่มีไอเทมที่ดีกว่าของเดิม</p>';
  return `
    <h3>เปิดหีบ ${summary.opened} ใบ</h3>
    <p>${counts}</p>
    <p class="hint">สวมของใหม่ ${summary.equipped.length} ชิ้น แยกที่เหลือได้ ${formatNumber(summary.salvagedGold)} ทอง</p>
    ${equipped}
    <div class="row"><button type="button" class="btn" data-action="close">ตกลง</button></div>`;
}

export function offlineModal(result) {
  const chests = CHESTS.filter((c) => result.chests[c.id]).map((c) => `${c.name} x${result.chests[c.id]}`).join(', ');
  return `
    <h3>ระหว่างที่คุณไม่อยู่</h3>
    <p class="hint">ฮีโร่ลุยแดนลับต่อเป็นเวลา ${formatDuration(result.elapsed)}</p>
    <dl class="stat-table">
      <dt>ล้มบอส</dt><dd>${formatNumber(result.kills)}</dd>
      <dt>ทอง</dt><dd>+${formatNumber(result.gold)}</dd>
      <dt>เลเวลที่เพิ่ม</dt><dd>+${result.levelsGained}</dd>
    </dl>
    <p class="hint">${chests || 'ไม่ได้หีบ'}</p>
    <div class="row"><button type="button" class="btn" data-action="close">รับรางวัล</button></div>`;
}

export function resetModal() {
  return `
    <h3>เริ่มเกมใหม่?</h3>
    <p class="hint">ทอง ไอเทม และด่านทั้งหมดจะหายไป ย้อนกลับไม่ได้</p>
    <div class="row">
      <button type="button" class="btn" data-action="confirm-reset">ลบเซฟและเริ่มใหม่</button>
      <button type="button" class="btn secondary" data-action="close">ยกเลิก</button>
    </div>`;
}
