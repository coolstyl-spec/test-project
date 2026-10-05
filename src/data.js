// Static game content: rarities, chests, equipment slots, skills, boss traits.

// `color` is for glows and bars; `ink` is the readable text color on parchment.
export const RARITIES = [
  { id: 'common', ink: '#5a4a37', name: 'ธรรมดา', color: '#a39d93', mult: 1, affixes: 0 },
  { id: 'uncommon', ink: '#2f6f2a', name: 'ดี', color: '#6cc070', mult: 1.3, affixes: 1 },
  { id: 'rare', ink: '#1d5aa6', name: 'หายาก', color: '#4ea3ff', mult: 1.7, affixes: 1 },
  { id: 'epic', ink: '#6a2db0', name: 'มหากาพย์', color: '#b77cff', mult: 2.3, affixes: 2 },
  { id: 'legendary', ink: '#9a4f00', name: 'ตำนาน', color: '#ff9f2e', mult: 3.2, affixes: 3 },
  { id: 'mythic', ink: '#a8102b', name: 'เทพ', color: '#ff4d6d', mult: 4.5, affixes: 4 },
];

// Weights line up with RARITIES (common → mythic).
export const CHESTS = [
  { id: 'wood', name: 'หีบไม้', color: '#9a6b3f', weights: [60, 30, 9, 1, 0, 0] },
  { id: 'silver', name: 'หีบเงิน', color: '#b8c4cf', weights: [25, 40, 25, 8, 2, 0] },
  { id: 'gold', name: 'หีบทอง', color: '#f2c14e', weights: [0, 20, 40, 28, 10, 2] },
  { id: 'abyss', name: 'หีบแดนลับ', color: '#c04dff', weights: [0, 0, 20, 40, 30, 10] },
];

export const STATS = {
  atk: { name: 'พลังโจมตี', percent: false },
  hp: { name: 'พลังชีวิต', percent: false },
  critChance: { name: 'โอกาสคริติคอล', percent: true },
  critDmg: { name: 'ดาเมจคริติคอล', percent: true },
  atkSpeed: { name: 'ความเร็วโจมตี', percent: true },
  atkPct: { name: 'พลังโจมตี', percent: true },
  hpPct: { name: 'พลังชีวิต', percent: true },
  goldPct: { name: 'ทองที่ได้รับ', percent: true },
};

// Base value of a stat on an item before rarity multiplier. Flat stats scale with item level.
export const STAT_BASE = {
  atk: (ilvl) => 4 * Math.pow(1.12, ilvl - 1),
  hp: (ilvl) => 30 * Math.pow(1.12, ilvl - 1),
  critChance: () => 2,
  critDmg: () => 15,
  atkSpeed: () => 4,
  atkPct: () => 5,
  hpPct: () => 5,
  goldPct: () => 6,
};

export const AFFIX_POOL = ['atk', 'hp', 'critChance', 'critDmg', 'atkSpeed', 'atkPct', 'hpPct', 'goldPct'];

export const SLOTS = [
  { id: 'weapon', name: 'อาวุธ', main: 'atk', nouns: ['ดาบ', 'ขวาน', 'หอก', 'เคียว'] },
  { id: 'helm', name: 'หมวก', main: 'hp', nouns: ['หมวกเหล็ก', 'มงกุฎ', 'ฮู้ด'] },
  { id: 'armor', name: 'เกราะ', main: 'hp', nouns: ['เกราะอก', 'เสื้อคลุม', 'เกราะเกล็ด'] },
  { id: 'ring', name: 'แหวน', main: 'critChance', nouns: ['แหวน', 'กำไล'] },
  { id: 'amulet', name: 'สร้อย', main: 'critDmg', nouns: ['สร้อยคอ', 'เครื่องราง'] },
  { id: 'boots', name: 'รองเท้า', main: 'atkSpeed', nouns: ['รองเท้าบูท', 'รองเท้าหนัง'] },
];

export const ITEM_SUFFIXES = ['แห่งเงา', 'แห่งเพลิง', 'แห่งน้ำแข็ง', 'แห่งวิญญาณ', 'แห่งแดนลับ', 'แห่งราชันย์', 'แห่งพายุ', 'แห่งโลหิต'];

export const SKILLS = [
  { id: 'slash', name: 'ฟันสายฟ้า', cooldown: 4, unlockStage: 1, kind: 'damage', mult: 3, hits: 1, color: '#6fc3ff' },
  { id: 'claw', name: 'กรงเล็บโลหิต', cooldown: 7, unlockStage: 3, kind: 'damage', mult: 0.8, hits: 5, color: '#ff5a4f' },
  { id: 'ward', name: 'ปราการศิลา', cooldown: 12, unlockStage: 6, kind: 'heal', healPct: 0.3, color: '#d9b26f' },
  { id: 'harvest', name: 'เก็บเกี่ยวไร้ความปรานี', cooldown: 15, unlockStage: 10, kind: 'damage', mult: 8, hits: 1, executeBelow: 0.3, color: '#7dff6a' },
];

export const TRAITS = [
  { id: 'swift', name: 'ว่องไว', desc: 'โจมตีเร็วขึ้น 35%' },
  { id: 'sturdy', name: 'แข็งแรง', desc: 'พลังชีวิต +50%' },
  { id: 'brutal', name: 'โจมตีแรง', desc: 'พลังโจมตี +50%' },
  { id: 'wrath', name: 'ความโกรธ', desc: 'เลือดต่ำกว่า 50% โจมตี x2' },
  { id: 'armored', name: 'เกราะหนา', desc: 'ลดดาเมจที่ได้รับ 30%' },
  { id: 'regen', name: 'ฟื้นฟู', desc: 'ฟื้นเลือด 1.5% ต่อวินาที' },
];

export const BOSS_NAMES = ['ผู้นำมอท', 'ราชาโครงกระดูก', 'แม่มดหนองน้ำ', 'อัศวินไร้หัว', 'ปีศาจเพลิง', 'ทรราชน้ำแข็ง', 'เจ้าแห่งรัง', 'โกเลมศิลา', 'ผีพรายเงา', 'นักบวชคลั่ง'];

export const UPGRADES = [
  { id: 'atk', name: 'ฝึกดาบ', desc: 'พลังโจมตี +8% ต่อเลเวล', baseCost: 10, growth: 1.14 },
  { id: 'hp', name: 'ฝึกความทนทาน', desc: 'พลังชีวิต +8% ต่อเลเวล', baseCost: 10, growth: 1.14 },
  { id: 'crit', name: 'จุดตาย', desc: 'โอกาสคริ +0.5%, ดาเมจคริ +5%', baseCost: 50, growth: 1.25 },
];

export const BALANCE = {
  bossTimeLimit: 30,
  kingTimeLimit: 45,
  pauseBetweenFights: 1.2,
  inventoryCap: 30,
  offlineCapSeconds: 8 * 3600,
  offlineSecondsPerKill: 30,
  offlineChestCap: 30,
  critChanceCap: 75,
  atkSpeedCap: 4,
};
