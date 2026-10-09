const $ = (id) => document.getElementById(id);
const ALL = "ทั้งหมด";
let activeCategory = ALL;

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// สีปกอัตโนมัติจากชื่อผลงาน (เมื่อไม่มีรูป)
function coverColor(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 60% 55%), hsl(${(h + 40) % 360} 65% 45%))`;
}

function coverHtml(work) {
  if (work.image) {
    return `<img class="cover" src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}" loading="lazy">`;
  }
  // ข้ามสระหน้า (เ แ โ ใ ไ) เพื่อให้แสดงพยัญชนะตัวแรก
  const letter = [...work.title].find((ch) => !"เแโใไ".includes(ch)) || "";
  return `<div class="cover" style="background:${coverColor(work.title)}">${escapeHtml(letter)}</div>`;
}

function renderProfile() {
  document.title = `${PROFILE.name} — ผลงาน`;
  $("name").textContent = PROFILE.name;
  $("role").textContent = PROFILE.role;
  $("bio").textContent = PROFILE.bio;
  $("links").innerHTML = PROFILE.links
    .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`)
    .join("");
  $("footer").innerHTML =
    `ติดต่อ: <a href="mailto:${escapeHtml(PROFILE.email)}">${escapeHtml(PROFILE.email)}</a>` +
    ` · © ${new Date().getFullYear()} ${escapeHtml(PROFILE.name)}`;
}

function renderFilters() {
  const categories = [ALL, ...new Set(WORKS.map((w) => w.category))];
  $("filters").innerHTML = categories
    .map((c) => `<button role="tab" aria-selected="${c === activeCategory}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join("");
}

function filteredWorks() {
  const q = $("search").value.trim().toLowerCase();
  return WORKS.map((w, i) => ({ ...w, i }))
    .filter((w) => activeCategory === ALL || w.category === activeCategory)
    .filter((w) => !q || [w.title, w.description, w.category, ...(w.tags || [])].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.year || 0) - (a.year || 0));
}

function renderGrid() {
  const list = filteredWorks();
  $("count").textContent = `${list.length} ผลงาน`;
  $("empty").hidden = list.length > 0;
  $("grid").innerHTML = list
    .map(
      (w) => `
      <button class="card" data-index="${w.i}">
        ${coverHtml(w)}
        <div class="card-body">
          <div class="card-meta">${escapeHtml(w.category)} · ${escapeHtml(w.year)}</div>
          <h3>${escapeHtml(w.title)}</h3>
          <div class="tags">${(w.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
        </div>
      </button>`
    )
    .join("");
}

function openModal(index) {
  const w = WORKS[index];
  $("modal-body").innerHTML = `
    ${coverHtml(w)}
    <div class="modal-content">
      <div class="card-meta">${escapeHtml(w.category)} · ${escapeHtml(w.year)}</div>
      <h2>${escapeHtml(w.title)}</h2>
      <p>${escapeHtml(w.description)}</p>
      <div class="tags">${(w.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      ${w.link ? `<a class="btn" href="${escapeHtml(w.link)}" target="_blank" rel="noopener">ดูผลงาน →</a>` : ""}
    </div>`;
  $("modal").showModal();
}

$("filters").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  renderFilters();
  renderGrid();
});
$("search").addEventListener("input", renderGrid);
$("grid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openModal(Number(card.dataset.index));
});
$("close").addEventListener("click", () => $("modal").close());
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) $("modal").close();
});

renderProfile();
renderFilters();
renderGrid();
