/* ============ ClutchVault: easy-edit settings ============ */
const CONFIG = {
  // Paste your Formspree (or similar) form URL here to collect emails.
  // Example: "https://formspree.io/f/abcdwxyz"
  formEndpoint: "",

  // Google Sheet links (File > Share > Publish to web > pick the tab > CSV).
  // Leave a link empty ("") to keep using the sample data below for that section.
  sheets: {
    settings: "",
    ranks: "",
    tournaments: "",
    leaderboard: "",
  },

  // Your WhatsApp Channel or Community invite link, e.g. "https://chat.whatsapp.com/XXXX".
  // Leave empty ("") to hide the WhatsApp buttons.
  whatsappLink: "",

  // How often (in minutes) the page re-reads your sheet while it is open.
  refreshMinutes: 5,
};

/* ============ Sample data (shown until your sheet is connected) ============ */
let SETTINGS = { nextTournament: "2026-11-15T18:00:00+05:30" };

let RANKS = [
  { name: "Crown",         pts: null,  reward: "UC Reward",        slots: "Limited slots per season", level: 1 },
  { name: "Ace",           pts: null,  reward: "UC Reward+",       slots: "Limited slots per season", level: 2 },
  { name: "Ace Master",    pts: null,  reward: "Bigger UC Reward", slots: "Limited slots per season", level: 3 },
  { name: "Ace Dominator", pts: 6000,  reward: "Cash / UC Reward", slots: "Limited slots per season", level: 4 },
  { name: "Conqueror",     pts: null,  reward: "Top Reward",       slots: "Very limited slots",       level: 5, top: true },
];

let TOURNAMENTS = [
  { name: "Squad Showdown #1",    sub: "Squad • 6 matches • Final top 3 win",   slots: "18 / 25 teams", pool: "Sponsor-funded", date: "15 Nov, 6:00 PM", status: "open" },
  { name: "Vault Cup Qualifiers", sub: "Squad • 4 matches • Top teams advance", slots: "Opens soon",    pool: "Sponsor-funded", date: "22 Nov, 6:00 PM", status: "soon" },
  { name: "1v1 Arena Open",       sub: "1v1 • Single elimination • 8 players",  slots: "5 / 8 players", pool: "Sponsor-funded", date: "29 Nov, 5:00 PM", status: "open" },
];

let BOARD = [
  { name: "NovaStrike", team: "Team Ember",  played: 12, pts: 214 },
  { name: "GhostRiot",  team: "Night Raid",  played: 12, pts: 198 },
  { name: "VenomX",     team: "Apex Wolves", played: 12, pts: 187 },
  { name: "SilentFang", team: "Iron Pulse",  played: 10, pts: 160 },
  { name: "BlazeKing",  team: "Red Orbit",   played: 10, pts: 151 },
];

/* ============ helpers ============ */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toNum = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/* ============ Google Sheets (CSV) loading ============ */
// Small CSV parser that handles quotes, commas and line breaks inside cells.
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  const src = String(text ?? "").replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Turns CSV text into a list of objects keyed by the (lower-case) header row.
function csvToObjects(text) {
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

async function loadSheet(url) {
  if (!url) return null;
  try {
    const bucket = Math.floor(Date.now() / (Math.max(1, CONFIG.refreshMinutes) * 60000));
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "cb=" + bucket);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return csvToObjects(await res.text());
  } catch (err) {
    console.warn("ClutchVault: could not load a sheet, using the previous data.", err);
    return null;
  }
}

/* ---- map sheet rows to the shapes the page uses ---- */
function mapRanks(rows) {
  const out = rows
    .map((r, i) => ({
      name: r.name,
      pts: toNum(r.points),
      reward: r.reward || "",
      slots: r.slots || "",
      level: Math.min(5, Math.max(1, Math.round(toNum(r.level) || i + 1))),
      top: /^(yes|true|1)$/i.test(r.top || ""),
    }))
    .filter((r) => r.name);
  return out.length ? out : null;
}

function mapTournaments(rows) {
  const ok = ["open", "soon", "live", "closed"];
  const out = rows
    .map((r) => {
      const status = String(r.status || "").toLowerCase();
      return {
        name: r.name,
        sub: r.details || "",
        date: r.date || "",
        slots: r.slots || "",
        pool: r.prize || "",
        status: ok.includes(status) ? status : "soon",
      };
    })
    .filter((t) => t.name);
  return out.length ? out : null;
}

function mapBoard(rows) {
  const out = rows
    .map((r) => ({ name: r.player, team: r.team || "", played: r.matches || "", pts: toNum(r.points) || 0 }))
    .filter((p) => p.name)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10);
  return out.length ? out : null;
}

// Settings tab: two columns, "key" and "value".
// Uses next_tournament_date (YYYY-MM-DD) and next_tournament_time (HH:MM, India time).
function mapSettings(rows) {
  const kv = {};
  rows.forEach((r) => { if (r.key) kv[r.key.trim().toLowerCase()] = r.value; });
  const date = (kv.next_tournament_date || "").trim();
  const time = (kv.next_tournament_time || "00:00").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{1,2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(":");
    return { nextTournament: `${date}T${h.padStart(2, "0")}:${m}:00+05:30` };
  }
  return null;
}

async function refreshFromSheets() {
  const s = CONFIG.sheets;
  const [settings, ranks, tournaments, board] = await Promise.all([
    loadSheet(s.settings), loadSheet(s.ranks), loadSheet(s.tournaments), loadSheet(s.leaderboard),
  ]);
  const newSettings = settings && mapSettings(settings);
  if (newSettings) SETTINGS = newSettings;
  const newRanks = ranks && mapRanks(ranks);
  if (newRanks) RANKS = newRanks;
  const newTours = tournaments && mapTournaments(tournaments);
  if (newTours) TOURNAMENTS = newTours;
  const newBoard = board && mapBoard(board);
  if (newBoard) BOARD = newBoard;
  renderAll();
}

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
      <a href="claim.html" class="btn btn--accent">Claim</a>
    </article>`).join("");
}

function renderTournaments() {
  const el = $("#tourList");
  if (!el) return;
  const label = { open: "Registration Open", soon: "Opens Soon", live: "Live Now", closed: "Closed" };
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

function renderAll() {
  renderRanks();
  renderTournaments();
  renderBoard();
  setupReveal();
}

/* ============ countdown ============ */
let countdownTimer = null;
function startCountdown() {
  const els = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  if (!els.d) return;
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const target = new Date(SETTINGS.nextTournament).getTime();
    let diff = Number.isNaN(target) ? 0 : Math.max(0, target - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    els.d.textContent = pad(d); els.h.textContent = pad(h);
    els.m.textContent = pad(m); els.s.textContent = pad(s);
  };
  tick();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
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
let revealObserver = null;
function setupReveal() {
  const items = document.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) {
    items.forEach((i) => i.classList.add("in"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
  }
  items.forEach((i) => revealObserver.observe(i));
}

/* ============ init ============ */
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  startCountdown();
  setupNav();
  setupForm();
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  // WhatsApp join buttons: shown only when a link is set and it is a WhatsApp URL.
  const wa = CONFIG.whatsappLink;
  if (/^https:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel|wa\.me)\//.test(wa)) {
    document.querySelectorAll("[data-wa]").forEach((a) => { a.href = wa; a.hidden = false; });
  }

  const hasSheets = Object.values(CONFIG.sheets).some(Boolean);
  if (hasSheets) {
    refreshFromSheets().then(startCountdown);
    setInterval(() => refreshFromSheets().then(startCountdown), Math.max(1, CONFIG.refreshMinutes) * 60000);
  }
});
