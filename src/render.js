// Canvas arena: draws the crypt, the hero, the boss and combat effects from engine events.

import { formatNumber } from './format.js';

const NUM_FONT = "'Chakra Petch', 'IBM Plex Sans Thai', monospace";
const DISPLAY_FONT = "'Chonburi', 'IBM Plex Sans Thai', serif";

export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.floaters = [];
    this.particles = [];
    this.slashes = [];
    this.shake = 0;
    this.bossFlash = 0;
    this.heroLunge = 0;
    this.heroHurt = 0;
    this.width = 0;
    this.height = 0;
    this.background = null;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.background = this.paintBackground(dpr);
  }

  get bossPos() {
    return { x: this.width * 0.66, y: this.height * 0.52 };
  }

  get heroPos() {
    return { x: this.width * 0.24, y: this.height * 0.7 };
  }

  handle(events) {
    const boss = this.bossPos;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const big = e.crit || e.source !== 'attack';
          this.floaters.push({
            text: formatNumber(e.amount),
            x: boss.x + (Math.random() - 0.5) * this.width * 0.3,
            y: boss.y - this.height * 0.12 + (Math.random() - 0.5) * 30,
            vy: -28,
            life: 0.9,
            maxLife: 0.9,
            color: e.crit ? '#ff8a2b' : e.source === 'attack' ? '#f4ead6' : '#ffd25a',
            size: e.crit ? 26 : big ? 21 : 16,
            font: NUM_FONT,
          });
          this.bossFlash = 0.1;
          this.heroLunge = 0.18;
          if (e.crit) this.shake = Math.max(this.shake, 5);
          this.burst(boss.x, boss.y, e.crit ? '#ff8a2b' : '#f4ead6', e.crit ? 10 : 4);
          if (e.source === 'attack') this.slashes.push({ life: 0.18, maxLife: 0.18, color: '#f4ead6', angle: -0.6 + Math.random() * 0.4 });
          break;
        }
        case 'skill':
          this.floaters.push({
            text: e.name, x: this.width / 2, y: this.height * 0.2, vy: -6, life: 1.3, maxLife: 1.3,
            color: e.color, size: Math.min(24, this.width / 14), font: DISPLAY_FONT, outline: true,
          });
          this.slashes.push({ life: 0.35, maxLife: 0.35, color: e.color, angle: -0.9, wide: true });
          this.burst(boss.x, boss.y, e.color, 18);
          this.shake = Math.max(this.shake, 7);
          break;
        case 'heal':
          this.floaters.push({ text: `+${formatNumber(e.amount)}`, ...this.heroPos, y: this.heroPos.y - 60, vy: -24, life: 1, maxLife: 1, color: '#7dff6a', size: 18, font: NUM_FONT });
          this.burst(this.heroPos.x, this.heroPos.y - 30, '#7dff6a', 12);
          break;
        case 'bossHit':
          this.heroHurt = 0.2;
          this.floaters.push({ text: `-${formatNumber(e.amount)}`, x: this.heroPos.x + 10, y: this.heroPos.y - 70, vy: -20, life: 0.8, maxLife: 0.8, color: '#ff5a4f', size: 15, font: NUM_FONT });
          break;
        case 'enrage':
          this.shake = 10;
          this.burst(boss.x, boss.y, '#d23a2f', 30);
          break;
        case 'victory':
          this.burst(boss.x, boss.y, '#e2b64a', 40);
          break;
        default:
          break;
      }
    }
    if (this.floaters.length > 60) this.floaters.splice(0, this.floaters.length - 60);
  }

  burst(x, y, color, count) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40, life: 0.6, maxLife: 0.6, color, size: 2 + Math.random() * 3 });
    }
    if (this.particles.length > 240) this.particles.splice(0, this.particles.length - 240);
  }

  update(dt) {
    for (const f of this.floaters) { f.y += f.vy * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.bossFlash = Math.max(0, this.bossFlash - dt);
    this.heroLunge = Math.max(0, this.heroLunge - dt);
    this.heroHurt = Math.max(0, this.heroHurt - dt);
  }

  draw(state, time, dt) {
    if (!this.width) this.resize();
    if (!this.width) return;
    this.update(dt);
    const { ctx } = this;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.shake && !this.reducedMotion) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    if (this.background) ctx.drawImage(this.background, 0, 0, this.width, this.height);
    this.drawTorches(time);
    const battle = state.battle;
    this.drawBoss(battle, time);
    this.drawHero(battle, time);
    this.drawSlashes();
    this.drawParticles();
    this.drawFloaters();
    ctx.restore();
  }

  paintBackground(dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(this.width * dpr);
    c.height = Math.round(this.height * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const W = this.width;
    const H = this.height;
    const floorY = H * 0.72;
    const wall = g.createLinearGradient(0, 0, 0, floorY);
    wall.addColorStop(0, '#1b1724');
    wall.addColorStop(1, '#3a3346');
    g.fillStyle = wall;
    g.fillRect(0, 0, W, floorY);
    // Brick courses.
    g.strokeStyle = 'rgba(10, 8, 14, 0.45)';
    g.lineWidth = 1.5;
    const brickH = Math.max(18, H / 14);
    const brickW = brickH * 2.2;
    for (let row = 0, y = 0; y < floorY; row++, y += brickH) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
      for (let x = (row % 2) * brickW / 2; x < W; x += brickW) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, Math.min(y + brickH, floorY));
        g.stroke();
      }
    }
    // Archway behind the boss.
    g.fillStyle = 'rgba(8, 6, 12, 0.55)';
    g.beginPath();
    const ax = W * 0.66;
    const aw = W * 0.2;
    g.moveTo(ax - aw, floorY);
    g.lineTo(ax - aw, H * 0.3);
    g.arc(ax, H * 0.3, aw, Math.PI, 0);
    g.lineTo(ax + aw, floorY);
    g.fill();
    // Floor.
    const floor = g.createLinearGradient(0, floorY, 0, H);
    floor.addColorStop(0, '#2a2433');
    floor.addColorStop(1, '#141119');
    g.fillStyle = floor;
    g.fillRect(0, floorY, W, H - floorY);
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillRect(0, floorY, W, 3);
    // Vignette.
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    return c;
  }

  drawTorches(time) {
    const { ctx } = this;
    for (const tx of [0.08, 0.92]) {
      const x = this.width * tx;
      const y = this.height * 0.32;
      const flicker = this.reducedMotion ? 1 : 0.85 + Math.sin(time * 13 + tx * 10) * 0.08 + Math.sin(time * 7.3) * 0.07;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 70 * flicker);
      glow.addColorStop(0, 'rgba(255, 160, 60, 0.45)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 80, y - 80, 160, 160);
      ctx.fillStyle = '#4a3b2c';
      ctx.fillRect(x - 3, y, 6, 22);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 5 * flicker, 10 * flicker, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBoss(battle, time) {
    if (!battle) return;
    const { ctx } = this;
    const { boss } = battle;
    const pos = this.bossPos;
    let scale = 1;
    let alpha = 1;
    if (battle.phase === 'victory') {
      const t = 1 - battle.phaseTimer / 1.2;
      scale = 1 - t * 0.6;
      alpha = Math.max(0, 1 - t * 1.4);
    }
    const R = Math.min(this.width, this.height) * 0.26 * (boss.king ? 1.15 : 1) * scale;
    const bob = this.reducedMotion ? 0 : Math.sin(time * 2.2) * 4;
    const cx = pos.x;
    const cy = pos.y + bob;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, this.height * 0.74, R * 0.9, R * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    if (battle.enraged) {
      const aura = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.5);
      aura.addColorStop(0, 'rgba(210, 58, 47, 0.5)');
      aura.addColorStop(1, 'rgba(210, 58, 47, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
    }

    const hue = boss.hue;
    // Horns.
    ctx.fillStyle = `hsl(${hue}, 20%, 82%)`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * R * 0.35, cy - R * 0.7);
      ctx.quadraticCurveTo(cx + side * R * 0.9, cy - R * 1.1, cx + side * R * 0.75, cy - R * 1.45);
      ctx.quadraticCurveTo(cx + side * R * 0.7, cy - R * 1.0, cx + side * R * 0.15, cy - R * 0.8);
      ctx.fill();
    }
    if (boss.king) {
      ctx.fillStyle = '#e2b64a';
      ctx.beginPath();
      const crownY = cy - R * 0.95;
      ctx.moveTo(cx - R * 0.35, crownY + R * 0.18);
      for (let i = 0; i <= 4; i++) {
        const x = cx - R * 0.35 + (R * 0.7 * i) / 4;
        ctx.lineTo(x, i % 2 ? crownY : crownY - R * 0.22);
      }
      ctx.lineTo(cx + R * 0.35, crownY + R * 0.18);
      ctx.fill();
    }

    // Body: a wobbling blob.
    const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R * 1.1);
    body.addColorStop(0, `hsl(${hue}, 45%, ${this.bossFlash ? 85 : 48}%)`);
    body.addColorStop(1, `hsl(${hue}, 50%, ${this.bossFlash ? 60 : 20}%)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    const points = 18;
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const wobble = this.reducedMotion ? 1 : 1 + Math.sin(a * 3 + time * 3) * 0.04 + Math.sin(a * 5 - time * 2) * 0.03;
      const rx = R * wobble;
      const ry = R * 0.95 * wobble;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry * (Math.sin(a) > 0 ? 0.85 : 1);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Eyes.
    const eyeColor = battle.enraged ? '#ff3b2f' : '#ffd25a';
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = eyeColor;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * R * 0.3, cy - R * 0.2, R * 0.13, R * 0.08, side * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Mouth.
    ctx.fillStyle = '#120a0c';
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.4, cy + R * 0.25);
    ctx.quadraticCurveTo(cx, cy + R * 0.6, cx + R * 0.4, cy + R * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#efe6d2';
    for (let i = 0; i < 5; i++) {
      const x = cx - R * 0.32 + (R * 0.64 * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x - R * 0.05, cy + R * 0.27);
      ctx.lineTo(x + R * 0.05, cy + R * 0.27);
      ctx.lineTo(x, cy + R * 0.38);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHero(battle, time) {
    const { ctx } = this;
    const pos = this.heroPos;
    const s = Math.min(this.width, this.height) / 300;
    const lunge = this.heroLunge > 0 ? Math.sin((this.heroLunge / 0.18) * Math.PI) * 14 * s : 0;
    const breathe = this.reducedMotion ? 0 : Math.sin(time * 3) * 1.5 * s;
    const dead = battle?.phase === 'defeat';
    const x = pos.x + lunge;
    const y = pos.y;

    ctx.save();
    if (dead) ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(pos.x, this.height * 0.74, 26 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y + breathe);
    ctx.scale(s, s);
    const hurt = this.heroHurt > 0;
    // Cape.
    ctx.fillStyle = hurt ? '#ff6b5f' : '#7a1f2b';
    ctx.beginPath();
    ctx.moveTo(-10, -48);
    ctx.quadraticCurveTo(-30, -20, -24, 6);
    ctx.lineTo(4, 6);
    ctx.lineTo(4, -48);
    ctx.fill();
    // Legs.
    ctx.fillStyle = '#2b2531';
    ctx.fillRect(-10, -12, 8, 18);
    ctx.fillRect(2, -12, 8, 18);
    // Torso.
    ctx.fillStyle = hurt ? '#ffd0c8' : '#9aa3b5';
    ctx.beginPath();
    ctx.roundRect(-13, -50, 26, 40, 5);
    ctx.fill();
    ctx.fillStyle = '#5d6577';
    ctx.fillRect(-13, -22, 26, 5);
    // Helm.
    ctx.fillStyle = '#c3cad6';
    ctx.beginPath();
    ctx.arc(0, -60, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1724';
    ctx.fillRect(1, -62, 11, 3);
    // Plume.
    ctx.fillStyle = '#ff8a2b';
    ctx.beginPath();
    ctx.moveTo(-4, -71);
    ctx.quadraticCurveTo(-22, -84, -26, -62);
    ctx.quadraticCurveTo(-14, -74, -2, -68);
    ctx.fill();
    // Sword: swings forward while lunging.
    const swing = this.heroLunge > 0 ? -1.6 + (this.heroLunge / 0.18) * 1.2 : -0.5;
    ctx.save();
    ctx.translate(12, -32);
    ctx.rotate(swing);
    ctx.fillStyle = '#5d4630';
    ctx.fillRect(-2, -2, 4, 12);
    ctx.fillStyle = '#e2b64a';
    ctx.fillRect(-8, -4, 16, 4);
    ctx.fillStyle = '#e8eef7';
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.lineTo(0, -46);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawSlashes() {
    const { ctx } = this;
    const boss = this.bossPos;
    const R = Math.min(this.width, this.height) * 0.3;
    for (const s of this.slashes) {
      const t = 1 - s.life / s.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.wide ? 10 * (1 - t) + 2 : 4 * (1 - t) + 1;
      ctx.lineCap = 'round';
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
      ctx.translate(boss.x, boss.y);
      ctx.rotate(s.angle);
      ctx.beginPath();
      ctx.arc(0, 0, R * (s.wide ? 1 : 0.7), -0.9 + t * 0.6, 0.9 + t * 0.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const t = f.life / f.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2.5);
      const pop = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
      ctx.font = `700 ${Math.round(f.size * pop)}px ${f.font}`;
      ctx.lineWidth = f.outline ? 5 : 4;
      ctx.strokeStyle = 'rgba(20, 10, 6, 0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
