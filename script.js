/* ============ ClutchVault: easy-edit settings ============ */
const CONFIG = {
  // Paste your Formspree (or similar) form URL here to collect emails.
  // Example: "https://formspree.io/f/abcdwxyz"
  formEndpoint: "",

  // Date of your next featured tournament (ISO format, India time).
  nextTournament: "2026-11-15T18:00:00+05:30",
};

// Tier rewards. Edit names, points and rewards here. Set pts to null to hide points.
const RANKS = [
  { name: "Ace",         pts: null,  reward: "60uc",        slots: "Limited slots per season", level: 1 },
  { name: "Ace Master",           pts: null,  reward: "200uc",       slots: "Limited slots per season", level: 2 },
  { name: "Ace Dominator",    pts: 5200,  reward: "360uc", slots: "Limited slots per season", level: 3 },
  { name: "Ace Dominator", pts: 5500,  reward: "1000 Cash", slots: "Limited slots per season", level: 4 },
  { name: "Conqueror",     pts: null,  reward: "2000 Cash",       slots: "Very limited slots",       level: 5, top: true },
];

// Sample tournaments. Replace with real ones as you create them.
const TOURNAMENTS = [
  { name: "Squad Showdown #1",   sub: "Squad • 6 matches • Final top 3 win", slots: "18 / 25 teams", pool: "Sponsor-funded", date: "15 Nov, 6:00 PM", status: "open" },
  { name: "Vault Cup Qualifiers", sub: "Squad • 4 matches • Top teams advance", slots: "Opens soon",   pool: "Sponsor-funded", date: "22 Nov, 6:00 PM", status: "soon" },
  { name: "1v1 Arena Open",      sub: "1v1 • Single elimination • 8 players",  slots: "5 / 8 players", pool: "Sponsor-funded", date: "29 Nov, 5:00 PM", status: "open" },
];

// Sample leaderboard. Replace once real results exist.
const BOARD = [
  { name: "NovaStrike",  team: "Team Ember",   played: 12, pts: 214 },
  { name: "GhostRiot",   team: "Night Raid",   played: 12, pts: 198 },
  { name: "VenomX",      team: "Apex Wolves",  played: 12, pts: 187 },
  { name: "SilentFang",  team: "Iron Pulse",   played: 10, pts: 160 },
  { name: "BlazeKing",   team: "Red Orbit",    played: 10, pts: 151 },
];

/* ============ helpers ============ */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ============ rank badges (original SVG) ============ */
function badge(level, top) {
  const color = top ? "#FF4D2E" : "#F5B841";
  let chevrons = "";
  for (let i = 0; i < level; i++) {
    const y = 58 - i * 9;
    chevrons += `<path d="M30 ${y} L43 ${y - 9} L56 ${y}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg class="rank__badge" viewBox="0 0 86 86" aria-hidden="true">
    <path d="M43 4 78 22v34L43 82 8 56V22z" fill="#14161C" stroke="${color}" stroke-width="3"/>
    <path d="M43 12 70 26v28L43 74 16 54V26z" fill="${color}" opacity=".1"/>
    ${chevrons}
  </svg>`;
}

/* ============ render sections ============ */
function renderRanks() {
  const el = $("#ranks");
  if (!el) return;
  el.innerHTML = RANKS.map((r) => `
    <article class="rank ${r.top ? "rank--top" : ""} reveal">
      ${badge(r.level, r.top)}
      <h4>${esc(r.name)}</h4>
      <p class="rank__pts">${r.pts ? esc(r.pts.toLocaleString("en-IN")) + " PTS" : "&nbsp;"}</p>
      <p class="rank__reward">${esc(r.reward)}</p>
      <p class="rank__slots">${esc(r.slots)}</p>
      <a href="#join" class="btn btn--accent">Claim</a>
    </article>`).join("");
}

function renderTournaments() {
  const el = $("#tourList");
  if (!el) return;
  const label = { open: "Registration Open", soon: "Opens Soon", live: "Live Now" };
  el.innerHTML = TOURNAMENTS.map((t) => `
    <article class="t reveal">
      <div><h4>${esc(t.name)}</h4><small>${esc(t.sub)}</small></div>
      <div><span class="t__k">DATE</span><span class="t__v">${esc(t.date)}</span></div>
      <div><span class="t__k">SLOTS</span><span class="t__v">${esc(t.slots)}</span></div>
      <div><span class="t__k">PRIZE</span><span class="t__v">${esc(t.pool)}</span></div>
      <div><span class="tag tag--${esc(t.status)}">${label[t.status] || ""}</span></div>
    </article>`).join("");
}

function renderBoard() {
  const el = $("#board");
  if (!el) return;
  const head = `<div class="row row--head" role="row"><span>#</span><span>Player</span><span class="hide-m">Team</span><span class="hide-m">Matches</span><span>Points</span></div>`;
  const rows = BOARD.map((p, i) => `
    <div class="row" role="row">
      <span class="pos">${i + 1}</span>
      <span class="name">${esc(p.name)}</span>
      <span class="hide-m">${esc(p.team)}</span>
      <span class="hide-m">${esc(p.played)}</span>
      <span class="pts">${esc(p.pts)}</span>
    </div>`).join("");
  el.innerHTML = head + rows;
}

/* ============ countdown ============ */
function startCountdown() {
  const target = new Date(CONFIG.nextTournament).getTime();
  const els = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  if (!els.d || isNaN(target)) return;
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    let diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    els.d.textContent = pad(d); els.h.textContent = pad(h);
    els.m.textContent = pad(m); els.s.textContent = pad(s);
  };
  tick();
  setInterval(tick, 1000);
}

/* ============ nav ============ */
function setupNav() {
  const toggle = $("#navToggle"), links = $("#navLinks");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* ============ email form ============ */
function setupForm() {
  const form = $("#joinForm"), msg = $("#joinMsg"), input = $("#email");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    msg.className = "join__msg";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Please enter a valid email address.";
      msg.classList.add("err");
      return;
    }
    if (!CONFIG.formEndpoint) {
      msg.textContent = "Form is not connected yet. Add your Formspree link in script.js.";
      msg.classList.add("err");
      return;
    }
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("bad response");
      msg.textContent = "You're in! We'll email you tournament updates.";
      msg.classList.add("ok");
      form.reset();
    } catch (err) {
      msg.textContent = "Something went wrong. Please try again.";
      msg.classList.add("err");
    }
  });
}

/* ============ scroll reveal ============ */
function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((i) => i.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  items.forEach((i) => io.observe(i));
}

/* ============ init ============ */
document.addEventListener("DOMContentLoaded", () => {
  renderRanks();
  renderTournaments();
  renderBoard();
  startCountdown();
  setupNav();
  setupForm();
  setupReveal();
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
});
