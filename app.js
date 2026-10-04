
const CH_DATA = JSON.parse(document.getElementById('ch-data').textContent || '{}');
const PLAYERS = (CH_DATA.standings || []).map((s, i) => ({
  handle: s.handle, rank: i + 1, value: s.collection_value,
  streak: s.streak || 0, grails: s.grails || 0, legendaries: s.legendaries || 0,
  pulls: (s.collection || []).map(c => ({
    card: c.variant_id, rarity: c.rarity, value: c.value, date: c.date,
    // binder card-back shows the comment-card line for comment cards and
    // for leveled-up winning picks (both started life as a comment card)
    source: (c.source === 'fan' || c.leveled_from) ? 'comment' : c.source,
    leveled_from: c.leveled_from || null,
  })),
  set_bonuses: s.set_bonuses || {},
}));
const ART = {"common-1": "assets/digital-cards/common-1.png", "common-2": "assets/digital-cards/common-2.png", "common-3": "assets/digital-cards/common-3.png", "rare-1": "assets/digital-cards/rare-1.png", "rare-2": "assets/digital-cards/rare-2.png", "rare-3": "assets/digital-cards/rare-3.png", "epic-1": "assets/digital-cards/epic-1.png", "epic-2": "assets/digital-cards/epic-2.png", "epic-3": "assets/digital-cards/epic-3.png", "legendary-1": "assets/digital-cards/legendary-1.png", "legendary-2": "assets/digital-cards/legendary-2.png", "legendary-3": "assets/digital-cards/legendary-3.png", "grail-1": "assets/digital-cards/grail-1.png", "grail-2": "assets/digital-cards/grail-2.png", "grail-3": "assets/digital-cards/grail-3.png"};
const CARDS = {"common-1": {"file": "common-1.png", "id": "common-1", "name": "Jax Moreno", "rarity": "common", "sport": "basketball"}, "common-2": {"file": "common-2.png", "id": "common-2", "name": "Cole Drummond", "rarity": "common", "sport": "baseball"}, "common-3": {"file": "common-3.png", "id": "common-3", "name": "Theo Marsh", "rarity": "common", "sport": "football"}, "rare-1": {"file": "rare-1.png", "id": "rare-1", "name": "Dane Calloway", "rarity": "rare", "sport": "football"}, "rare-2": {"file": "rare-2.png", "id": "rare-2", "name": "Milo Grant", "rarity": "rare", "sport": "basketball"}, "rare-3": {"file": "rare-3.png", "id": "rare-3", "name": "Brock Halden", "rarity": "rare", "sport": "hockey"}, "epic-1": {"file": "epic-1.png", "id": "epic-1", "name": "Finn Lockhart", "rarity": "epic", "sport": "hockey"}, "epic-2": {"file": "epic-2.png", "id": "epic-2", "name": "Reyes Dalton", "rarity": "epic", "sport": "baseball"}, "epic-3": {"file": "epic-3.png", "id": "epic-3", "name": "Dre Coleman", "rarity": "epic", "sport": "football"}, "legendary-1": {"file": "legendary-1.png", "id": "legendary-1", "name": "Zane Cross", "rarity": "legendary", "sport": "basketball"}, "legendary-2": {"file": "legendary-2.png", "id": "legendary-2", "name": "Hank Vargas", "rarity": "legendary", "sport": "baseball"}, "legendary-3": {"file": "legendary-3.png", "id": "legendary-3", "name": "Sven Kaldor", "rarity": "legendary", "sport": "hockey"}, "grail-1": {"file": "grail-1.png", "id": "grail-1", "name": "Jet Okafor", "rarity": "grail", "sport": "football"}, "grail-2": {"file": "grail-2.png", "id": "grail-2", "name": "Rico Vance", "rarity": "grail", "sport": "basketball"}, "grail-3": {"file": "grail-3.png", "id": "grail-3", "name": "Tommy Blaze", "rarity": "grail", "sport": "baseball"}};
const money = v => v >= 100 ? "$" + Math.round(v).toLocaleString("en-US") : "$" + v.toFixed(2);

const BY_RARITY = {"common": ["common-1", "common-2", "common-3"], "rare": ["rare-1", "rare-2", "rare-3"], "epic": ["epic-1", "epic-2", "epic-3"], "legendary": ["legendary-1", "legendary-2", "legendary-3"], "grail": ["grail-1", "grail-2", "grail-3"]};
const RARITY_LABEL = {common:'Common', rare:'Rare', epic:'Epic', legendary:'Legendary', grail:'Grail'};
const CHECK_ORDER = ['common','rare','epic','legendary','grail'];

/* Compact value labels for checklist slots: owned cards show their pulled
   value (first copy — the same value feeding the set-bonus math); missing
   cards show the rarity's value range. */
function shortMoney(v){
  if (v >= 1000) { const k = v / 1000; return '$' + (Number.isInteger(k) ? k : k.toFixed(1)) + 'K'; }
  return '$' + v;
}
function rangeLabel(r){
  const R = (typeof SPIN_RANGES !== 'undefined' && SPIN_RANGES[r]) || [0, 0];
  return shortMoney(R[0]) + '–' + shortMoney(R[1]);
}

/* Rarity odds as "N in M packs" (from the 60/25/10/4/1 spin odds). */
function _gcd(a,b){ return b ? _gcd(b, a % b) : a; }
function oddsLine(r){
  const pct = {common:60, rare:25, epic:10, legendary:4, grail:1}[r] || 0;
  const g = _gcd(pct, 100);
  return (pct / g) + ' in ' + (100 / g) + ' packs';
}

/* Tap a checklist card: flip it over (stopPropagation so the standings row
   doesn't collapse the binder). */
function flipSlot(e, el){
  if (e && e.stopPropagation) e.stopPropagation();
  if (el && el.classList) el.classList.toggle('flipped');
}

const CB_CROWN = '<svg class="cb-crown" viewBox="0 0 36 27" aria-hidden="true"><path d="M3 21 L3 8 L10 13 L15 3 L18 12 L21 3 L26 13 L33 8 L33 21 Z" fill="#c9a227"/><rect x="3" y="22" width="30" height="3.4" rx="1.7" fill="#c9a227"/></svg>';

/* Back face of a checklist card. Owned: big value + pull date + rarity pill +
   set position. Missing: not-pulled notice + true odds + value range. */
function slotBackHtml(id, r, has, val, date, src, leveledFrom){
  if (has) {
    const cardNum = (id.split('-')[1] || '?');
    const srcLine = src === 'comment' ? '<div class="cb-src">💬 Comment card</div>' : '';
    const lvlLine = leveledFrom ? '<div class="cb-lvl">⬆ ' + RARITY_LABEL[leveledFrom] + ' → ' + RARITY_LABEL[r] + '</div>' : '';
    return '<div class="checklist-face checklist-back">' + CB_CROWN +
      '<div class="cb-value">' + money(val) + '</div>' +
      '<div class="cb-pulled">Pulled ' + esc(date || 'Season 1') + '</div>' + srcLine + lvlLine +
      '<span class="rcount ' + r + '">' + RARITY_LABEL[r] + '</span>' +
      '<div class="cb-set">' + RARITY_LABEL[r].toUpperCase() + ' SET &middot; card ' + cardNum + ' of 3</div></div>';
  }
  return '<div class="checklist-face checklist-back">' + CB_CROWN +
    '<div class="cb-missing">NOT PULLED YET</div>' +
    '<div class="cb-odds">' + oddsLine(r) + '</div>' +
    '<div class="cb-range">Worth ' + rangeLabel(r) + '</div></div>';
}

/* Checklist binder: 5 rarity sections x 3 card slots. Owned cards render full
   color; missing cards are faint (grayscale + dim + low opacity) so the expanded
   panel reads as a collection checklist, not a gallery. Each card is tappable:
   tap flips it over to reveal details on the back (value/date for owned,
   true odds for missing). */
function checklistHtml(p) {
  const owned = {};
  const firstVal = {};
  const firstDate = {};
  const cardSrc = {};
  const cardLvl = {};
  p.pulls.forEach(function(x){ owned[x.card] = (owned[x.card] || 0) + 1;
    if (!(x.card in firstVal)) { firstVal[x.card] = x.value; firstDate[x.card] = x.date;
      cardSrc[x.card] = x.source; cardLvl[x.card] = x.leveled_from || null; } });
  const sb = p.set_bonuses || {};
  const bonusTotal = Object.keys(sb).reduce(function(s,k){ return s + (+sb[k] || 0); }, 0);
  let totalOwned = 0;
  const secs = CHECK_ORDER.map(function(r){
    const ids = BY_RARITY[r] || [];
    const n = ids.filter(function(id){ return owned[id]; }).length;
    totalOwned += n;
    const slots = ids.map(function(id){
      const c = CARDS[id] || {name:id};
      const has = !!owned[id];
      const valHtml = has
        ? '<div class="checklist-value">' + money(firstVal[id]) + '</div>'
        : '<div class="checklist-value">' + rangeLabel(r) + '</div>';
      const dupN = owned[id] || 0;
      const dupBadge = dupN > 1 ? '<span class="dup-badge">×' + dupN + '</span>' : '';
      const lvlTag = cardLvl[id] ? '<span class="leveled-tag" role="img" aria-label="Card leveled up">⬆ LEVELED</span>' : '';
      return '<div class="checklist-slot' + (has ? '' : ' missing') + '">' + dupBadge + lvlTag +
        '<div class="checklist-flip" onclick="flipSlot(event,this)">' +
        '<div class="checklist-face checklist-front"><img loading="lazy" src="' + (ART[id] || '') + '" alt="' + esc(c.name) + (has ? '' : ' (not owned)') + '"></div>' +
        slotBackHtml(id, r, has, firstVal[id], firstDate[id], cardSrc[id], cardLvl[id]) + '</div>' +
        '<div class="checklist-name">' + esc(c.name) + '</div>' + valHtml + '</div>';
    }).join('');
    return '<div class="checklist-sec"><div class="checklist-sec-head">' +
      '<span class="rcount ' + r + '">' + RARITY_LABEL[r] + '</span>' +
      '<span class="checklist-sec-count">' + n + '/3</span>' +
      (sb[r] ? '<span class="set-complete">SET COMPLETE +' + money(sb[r]) + '</span>' : '') + '</div>' +
      '<div class="checklist-grid">' + slots + '</div></div>';
  }).join('');
  const pct = Math.round(totalOwned / 15 * 100);
  return '<div class="binder-panel checklist">' +
    '<div class="checklist-head"><span class="checklist-title">' + esc(p.handle) + ' checklist</span>' +
    '<span class="checklist-count">' + totalOwned + ' of 15 cards · <span class="checklist-worth">Worth ' + money(p.value) + '</span></span></div>' +
    '<div class="checklist-bar"><div class="checklist-fill" style="width:' + pct + '%"></div></div>' +
    (bonusTotal > 0 ? '<div class="checklist-bonus-note">Includes ' + money(bonusTotal) + ' in set bonuses</div>' : '') +
    secs + '</div>';
}

const PRIZE_SHORT = [
  {name:"Bird PSA 10", takes:"the Bird"},
  {name:"Wemby Mosaic RC", takes:"the Wemby"},
  {name:"Jeter '93 Topps", takes:"the Jeter"},
];
function prizeImgSrc(place) {
  const img = document.querySelector('#v-prizes .prize-item[data-place="' + place + '"] img');
  return img ? img.src : "";
}
function prizeChip(p) {
  if (p.rank > 3) return "";
  const s = PRIZE_SHORT[p.rank - 1];
  return `<td class="prize-cell"><div class="prize-chip">`
    + `<img class="prize-chip-img" loading="lazy" src="${prizeImgSrc(p.rank)}" alt="Currently winning: ${s.name}">`
    + `<span class="prize-chip-name">${s.name}</span><span class="prize-chip-tag">WINNING</span></div></td>`;
}

let standingsQuery = '';
function renderStandings() {
  const el = document.getElementById("standings-body");
  if (!PLAYERS.length) {
    el.innerHTML = "";
    const _race = document.getElementById("prize-race"); if (_race) _race.innerHTML = "";
    const _empty = document.getElementById("empty-board"); if (_empty) _empty.hidden = false;
    renderSeasonBanner(); renderPullFeed(); renderPackCta(); return;
  }
  const all = [...PLAYERS].sort((a,b) => a.rank - b.rank);
  const q = standingsQuery.trim().toLowerCase();
  const ordered = q ? all.filter(p => (p.handle || '').toLowerCase().includes(q)) : all;
  el.innerHTML = ordered.length ? ordered.map(p => `
    <tr class="${p.rank===1?'leader':''}" data-rank="${p.rank}">
      <td class="rank">${p.rank===1?'👑':p.rank}</td>
      <td class="player">${p.handle}</td>
      <td class="value">${money(p.value)}</td>
      <td class="pills">${p.grails?('<span class="rcount grail">'+p.grails+' Grail</span>'):(p.legendaries?('<span class="rcount legendary">'+p.legendaries+' Legendary</span>'):'')}<span class="streak-wrap">${p.streak>1?('<span class="streak-pill">'+p.streak+'-day streak</span>'):('<span class="streak-1">day '+p.streak+'</span>')}</span></td>${prizeChip(p)}
    </tr>`).join("") :
    `<tr class="no-results"><td colspan="6" style="text-align:center;color:var(--muted);padding:1.4rem;cursor:default">No players match &ldquo;${esc(standingsQuery.trim())}&rdquo;.</td></tr>`;
  el.querySelectorAll("tr").forEach(row => row.addEventListener("click", function(){ if (!row.classList.contains("no-results")) toggleBinder(row); }));
  const top3 = all.slice(0, 3);
  const race = document.getElementById("prize-race");
  if (race) race.innerHTML = `🏆 <b>As it stands:</b> ` + top3.map((p,i) => `${p.handle} takes ${PRIZE_SHORT[i].takes}`).join(" · ");
  renderSeasonBanner();
  renderPullFeed();
  renderPackCta();
}
function bindStandingsSearch() {
  const sq = document.getElementById('standings-search');
  if (sq && sq.addEventListener) sq.addEventListener('input', function(){ standingsQuery = sq.value; renderStandings(); });
}

let openRank = null;
function toggleBinder(row) {
  const rank = +row.dataset.rank;
  const next = row.nextElementSibling;
  if (next && next.classList.contains("binder-row")) { next.remove(); openRank = null;
    row.classList.remove("open"); return; }
  document.querySelectorAll(".binder-row").forEach(r => r.remove());
  document.querySelectorAll("#standings-body tr").forEach(r => r.classList.remove("open"));
  const p = PLAYERS.find(x => x.rank === rank);
  const tr = document.createElement("tr");
  tr.className = "binder-row";
  tr.innerHTML = '<td colspan="6">' + checklistHtml(p) + '</td>';
  row.after(tr); row.classList.add("open"); openRank = rank;
}

/* Back face of an All Cards gallery tile: true odds + value range + set position
   (the gallery shows the full set, not owned/missing state). */
function galleryBackHtml(c, r){
  const cardNum = (c.id.split('-')[1] || '?');
  return '<div class="checklist-face checklist-back">' + CB_CROWN +
    '<div class="cb-odds">' + oddsLine(r) + '</div>' +
    '<div class="cb-range">Worth ' + rangeLabel(r) + '</div>' +
    '<span class="rcount ' + r + '">' + RARITY_LABEL[r] + '</span>' +
    '<div class="cb-set">' + RARITY_LABEL[r].toUpperCase() + ' SET &middot; card ' + cardNum + ' of 3</div>' +
    '<div class="cb-pulled cb-galnote">CROWNED CARDS &middot; DIGITAL &mdash; GAME ONLY</div></div>';
}

function renderGallery() {
  const order = ["grail","legendary","epic","rare","common"];
  const ranges = {common:"$5–$25",rare:"$50–$250",epic:"$250–$1K",legendary:"$1K–$10K",grail:"$10K–$100K"};
  document.getElementById("gallery").innerHTML = order.map(r =>
    Object.values(CARDS).filter(c=>c.rarity===r).map(c =>
      `<div class="card-tile r-${r}"><div class="checklist-flip" onclick="flipSlot(event,this)">
       <div class="checklist-face checklist-front"><img class="card-art" loading="lazy" src="${ART[c.id]}" alt="${c.name}">
       <span class="rarity-badge">${r}</span></div>
       ${galleryBackHtml(c, r)}</div>
       <div class="card-name">${c.name}</div>
       <div class="card-meta">${c.sport} · <span class="card-value">${ranges[r]}</span></div>
       <div class="card-date">CROWNED CARDS · DIGITAL — GAME ONLY</div></div>`
    ).join("")).join("");
}

function show(id, btn) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  window.scrollTo(0,0);
}
/* ============ Best-experience upgrades (Shawn 2026-10-03) ============ */
/* Pack CTA state: the Bonus tab is the source of truth; the Standings hero button mirrors it. */
let packUiState = 'unknown'; /* unknown | locked | ready | ripped */
function setPackState(st){ packUiState = st; renderPackCta(); }
function renderPackCta(){
  const el = document.getElementById('pack-cta'); if (!el) return;
  if (packUiState === 'unknown') { el.style.display = 'none'; return; }
  el.style.display = '';
  el.className = 'pack-cta' + (packUiState === 'ripped' ? ' ripped' : packUiState === 'locked' ? ' locked' : '');
  if (packUiState === 'ripped')
    el.innerHTML = '✅ TODAY’S PACK RIPPED<span class="pack-cta-sub">Tap to view your pull · next pack at midnight Central</span>';
  else if (packUiState === 'locked')
    el.innerHTML = '\u{1F512} UNLOCK TODAY’S PACK<span class="pack-cta-sub">Subscribe to @CrownedCards to rip</span>';
  else
    el.innerHTML = '\u{1F381} RIP TODAY’S PACK<span class="pack-cta-sub">Free · one pack every day</span>';
}
/* Hero tap: always jump to the Bonus tab (in ripped state it shows your pull);
   if the pack is ready, rip it immediately. */
function goPrizes(){
  const tabs = document.querySelectorAll('.tabbar button');
  if (tabs.length > 1) show('v-prizes', tabs[1]);
}
function goRip(){
  const tabs = document.querySelectorAll('.tabbar button');
  if (tabs.length) show('v-members', tabs[tabs.length - 1]);
  if (packUiState === 'ready') setTimeout(function(){ doSpin(); }, 350);
}
/* Haptics: guarded, mobile-only effect. */
function buzz(p){ try { if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }
/* Tiny WebAudio SFX — synthesized in code, zero audio files. Tear = filtered noise
   burst; reveal = rising chime, richer for rarer pulls. AudioContext is created on the
   first user gesture (doSpin is a tap), so autoplay policies are satisfied. */
const SFX = {
  muted: (function(){ try { return localStorage.getItem('ch_sfx') === 'off'; } catch(e){ return false; } })(),
  ctx: null,
  ensure(){
    if (this.ctx || this.muted) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch(e){}
    return this.ctx;
  },
  tear(){
    const ctx = this.ensure(); if (!ctx) return;
    try {
      const dur = 0.4, buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
    } catch(e){}
  },
  reveal(rarity){
    const ctx = this.ensure(); if (!ctx) return;
    try {
      const steps = {common: [523.25, 659.25, 783.99],
                     rare: [523.25, 659.25, 783.99, 1046.5],
                     epic: [523.25, 659.25, 783.99, 1046.5, 1318.5],
                     legendary: [392, 523.25, 659.25, 783.99, 1046.5, 1318.5],
                     grail: [392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]}[rarity] || [523.25, 659.25, 783.99];
      const t0 = ctx.currentTime;
      steps.forEach(function(f, i){
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        const t = t0 + i * 0.09;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.55);
      });
    } catch(e){}
  },
  toggle(){
    this.muted = !this.muted;
    try { localStorage.setItem('ch_sfx', this.muted ? 'off' : 'on'); } catch(e){}
    if (!this.muted) this.ctx = null;
  }
};
function isBigPull(r){ return r === 'epic' || r === 'legendary' || r === 'grail'; }
/* Rare-pull celebration: full-screen gold veil + confetti burst. Commons stay quick and quiet. */
function celebratePull(){
  try {
    const veil = document.createElement('div'); veil.className = 'celebrate-veil';
    document.body.appendChild(veil);
    setTimeout(function(){ veil.remove(); }, 1700);
    const colors = ['#ffd34d','#fff7dd','#e0a92e','#ffffff','#ffb700'];
    for (let i = 0; i < 46; i++){
      const b = document.createElement('div'); b.className = 'confetti-bit';
      b.style.background = colors[i % colors.length];
      const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 200;
      b.style.setProperty('--cx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      b.style.setProperty('--cy', (Math.sin(ang) * dist).toFixed(0) + 'px');
      b.style.setProperty('--cr', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      document.body.appendChild(b);
      (function(el){ setTimeout(function(){ el.remove(); }, 1650); })(b);
    }
  } catch(e){}
}
/* Season countdown banner (day granularity — not security-critical, device clock is fine). */
function renderSeasonBanner(){
  const el = document.getElementById('season-banner'); if (!el) return;
  let now;
  try { now = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})); }
  catch(e){ now = new Date(); }
  const end = new Date(2026, 9, 31, 23, 59, 59); /* Oct 31 2026, Central wall-clock */
  const days = Math.ceil((end - now) / 86400000);
  el.textContent = days > 1 ? '⏳ SEASON 1 ENDS OCT 31 · ' + days + ' DAYS LEFT'
    : days === 1 ? '⏳ SEASON 1 ENDS TOMORROW · FINAL DAY'
    : '⏳ SEASON 1 ENDS TODAY';
}
/* Fresh-pulls ticker. DEMO: synthesized from the fake-player pull lists.
   REAL BOARD: overridden by the adapter below — reads CH_DATA.fresh_pulls
   (latest ledger entries, baked by render.py). */
function renderPullFeed(){
  const tick = document.getElementById('pull-ticker'); if (!tick || typeof PLAYERS === 'undefined') return;
  const items = [];
  PLAYERS.forEach(function(p){
    (p.pulls || []).forEach(function(pl){
      items.push({h: p.handle, r: pl.rarity, v: +pl.value || 0, c: ((typeof CARDS === 'undefined' ? {} : CARDS)[pl.card] || {}).name || pl.card});
    });
  });
  items.sort(function(a, b){ return b.v - a.v; });
  const chip = function(it){
    return '<span class="pull-chip"><span class="pc-handle">' + esc(it.h) + '</span>' +
      '<span class="pc-r ' + esc(it.r) + '">' + esc(it.r).toUpperCase() + '</span>' +
      '<span>' + esc(it.c) + '</span><span class="pc-v">' + money(it.v) + '</span></span>';
  };
  const half = items.slice(0, 12).map(chip).join('');
  tick.innerHTML = half + half; /* doubled for the seamless marquee loop */
}
// ================= Firebase auth + Members daily spin =================
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

let fbUser = null;
let db = null;
let spinning = false;
let countdownTimer = null;
let subUnlocked = false;   /* honor-based subscribe attestation (players/{uid}.subscribed) */
let subCheckDone = false;  /* attestation read finished */

/* ============ Mystery pack rip (Shawn 2026-10-03: wheel -> pack) ============
   A wheel is a casino mechanic — ripping a pack is the sports-card ritual.
   PRESENTATION ONLY: computeSpin (deterministic roll), the Firestore 'spins'
   collection + rules + doc-id scheme, the audit contract, and the fail-closed
   network-time date logic are all unchanged. One card per daily pack. */
let ripTimers = [];
let ripData = null;
let ripSd = null;
function ripLater(fn, ms){ ripTimers.push(setTimeout(fn, ms)); }
function clearRipTimers(){ for (var i = 0; i < ripTimers.length; i++) clearTimeout(ripTimers[i]); ripTimers = []; }
function packStage(){ return document.getElementById('pack-stage'); }
function stageCls(add, remove){
  var st = packStage(); if (!st) return;
  if (remove) for (var i = 0; i < remove.length; i++) st.classList.remove(remove[i]);
  if (add) for (var j = 0; j < add.length; j++) st.classList.add(add[j]);
}
/* Tap mid-rip to skip straight to the reveal — never trap the user. */
function skipRip(){
  if (!spinning || !ripData) return;
  SFX.reveal(ripData.rarity); buzz([40,40,60]);
  if (isBigPull(ripData.rarity)) celebratePull();
  finishRip(ripData, ripSd);
}
/* Rip sequence (~2.9s, skippable): shake -> tear (strip flies, gold burst) ->
   card slides out face-down -> flips to reveal with rarity glow ->
   card glides to center hero as the torn pack fades. */
function startRip(data, sd){
  ripData = data; ripSd = sd || null;
  var img = document.getElementById('ripped-img');
  var glow = document.getElementById('ripped-card-glow');
  var card = document.getElementById('ripped-card');
  var st = packStage();
  if (img) { img.src = ART[data.cardId] || ''; img.alt = data.cardName || ''; }
  /* Glow lives on the WRAPPER only: filter on .ripped-card would flatten its
     preserve-3d context and kill the flip (CSS spec: filter forces flat). */
  if (glow) { glow.style.display = ''; glow.className = 'ripped-card-glow glow-r-' + data.rarity; }
  if (card) { card.className = 'ripped-card'; }
  if (st) {
    st.classList.remove('tearing','ripped','flipped','revealed','no-anim');
    st.classList.remove('shaking'); void st.offsetWidth; st.classList.add('shaking'); /* re-trigger */
    st.onclick = skipRip;
  }
  ripLater(function(){ stageCls(['tearing'], ['shaking']); SFX.tear(); buzz(35); }, 620);
  ripLater(function(){ stageCls(['ripped']); }, 1150);
  ripLater(function(){ stageCls(['flipped']); }, 1950);
  ripLater(function(){ stageCls(['revealed']); SFX.reveal(data.rarity); buzz([40,40,60]);
    if (isBigPull(data.rarity)) celebratePull(); }, 2600); /* card glides to center hero, torn pack fades */
  ripLater(function(){ finishRip(data, sd); }, 2950);
}
function finishRip(data, sd){
  clearRipTimers();
  var st = packStage();
  if (st) { st.classList.add('tearing','ripped','flipped','revealed'); st.onclick = null; }
  var glow = document.getElementById('ripped-card-glow');
  if (glow) {
    glow.style.display = '';
    if ((' ' + glow.className + ' ').indexOf(' glow-r-') < 0) glow.className = 'ripped-card-glow glow-r-' + data.rarity;
  }
  var card = document.getElementById('ripped-card');
  if (card) card.className = 'ripped-card';
  var res = document.getElementById('spin-result');
  if (res) res.innerHTML = spinResultHtml(data);
  var btn = document.getElementById('spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'RIPPED ✓'; }
  setPackState('ripped');
  if (sd) startCountdown(sd.secondsIntoDay);
  loadSpins();
  spinning = false; ripData = null; ripSd = null;
}
/* Sealed foil pack markup: crimped top strip (flies off on tear), crown emblem,
   branding, and true odds printed like a real product. */
function packStageHtml(){
  return '<div class="pack-stage" id="pack-stage">' +
    '<div class="rip-flash"></div>' +
    '<div class="ripped-card-glow" id="ripped-card-glow" style="display:none"><div class="ripped-card" id="ripped-card">' +
      '<div class="card-face card-back"><svg viewBox="0 0 36 27" aria-hidden="true"><path d="M3 21 L3 8 L10 13 L15 3 L18 12 L21 3 L26 13 L33 8 L33 21 Z" fill="#ffd34d"/><rect x="3" y="22" width="30" height="3.4" rx="1.7" fill="#ffd34d"/></svg></div>' +
      '<div class="card-face card-front"><img id="ripped-img" alt=""></div>' +
    '</div></div>' +
    '<div class="pack" id="pack">' +
      '<div class="pack-opening"></div>' +
      '<div class="pack-inner">' +
        '<svg class="pack-crown" viewBox="0 0 36 27" aria-hidden="true"><path d="M3 21 L3 8 L10 13 L15 3 L18 12 L21 3 L26 13 L33 8 L33 21 Z" fill="#141002"/><rect x="3" y="22" width="30" height="3.4" rx="1.7" fill="#141002"/></svg>' +
        '<div class="pack-brand">CROWN HUNT</div>' +
        '<div class="pack-sub">DAILY PACK</div>' +
        '<div class="pack-cards">1 CARD INSIDE</div>' +
        '<div class="pack-odds">GRAIL 1:100 · LEGENDARY 1:25 · EPIC 1:10<br>RARE 1:4 · COMMON 3:5</div>' +
      '</div>' +
      '<div class="pack-crimp bot"></div>' +
      '<div class="rip-line"></div>' +
    '</div>' +
    '<div class="pack-topstrip"></div>' +
  '</div>';
}
const SPIN_RANGES = {common:[5,25], rare:[50,250], epic:[250,1000], legendary:[1000,10000], grail:[10000,100000]};

/* DETERMINISTIC DAILY SPIN ROLL — audit contract (keep in sync with any audit reimplementation):
   date: 'YYYY-MM-DD' in America/Chicago from NETWORK TIME via fetchServerDate()
   (primary: timeapi.io, fallback: worldtimeapi.org) — NEVER the device clock, which a
   player can change. centralDate() (device clock) is deprecated and must not feed spin logic.
   h = cyrb53(uid + '|' + date)
   roll = h % 100  -> rarity: roll<60 common, <85 rare, <95 epic, <99 legendary, else grail
   cardIdx = Math.floor(h / 256) % 3  -> cardId = rarity + '-' + (cardIdx+1); card ids sort ascending within rarity
   frac = (Math.floor(h / 65536) % 100000) / 100000
   value = round2(min + frac * (max - min)); ranges: common 5-25, rare 50-250, epic 250-1000, legendary 1000-10000, grail 10000-100000
   Firestore: collection 'spins', doc id uid + '_' + date,
   fields {uid, date, rarity, cardId, cardName, value, createdAt: serverTimestamp()}.
   The roll ALGORITHM is byte-identical to before; only the date source changed (network time).
   Audit reimplementation: recompute from (uid, doc.date) exactly as documented.
   Deterministic: concurrent or repeated writes produce byte-identical docs, so read-back wins any race. */
function cyrb53(str, seed) {
  seed = seed || 0;
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334675);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/* DEPRECATED: device-clock date. Kept for reference only — spin logic MUST use
   fetchServerDate() (network time). A player can change their device date to spin again. */
function centralDate(d) {
  d = d || new Date();
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit'}).format(d);
}

/* Network time for the daily spin. Returns {date:'YYYY-MM-DD', secondsIntoDay:N}
   for America/Chicago. Primary: timeapi.io; fallback: worldtimeapi.org.
   THROWS if both providers fail or payloads fail validation — callers fail closed. */
async function fetchServerDate() {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const parse = function(dt) {
    const s = String(dt);
    const date = s.slice(0, 10);
    const tp = s.slice(11, 19).split(':');
    if (!re.test(date) || tp.length !== 3) throw new Error('bad time payload');
    const h = +tp[0], m = +tp[1], sec = +tp[2];
    const sod = h * 3600 + m * 60 + sec;
    if (!(h >= 0 && h < 24 && m >= 0 && m < 60 && sec >= 0 && sec < 60)) throw new Error('bad time payload');
    return {date: date, secondsIntoDay: sod};
  };
  try {
    const r = await fetch('https://timeapi.io/api/time/current/zone?timeZone=America/Chicago');
    const j = await r.json();
    if (j && j.dateTime) return parse(j.dateTime);
  } catch(e) { /* fall through to the fallback provider */ }
  const r2 = await fetch('https://worldtimeapi.org/api/timezone/America/Chicago');
  const j2 = await r2.json();
  if (j2 && j2.datetime) return parse(j2.datetime);
  throw new Error('network time unavailable');
}

function computeSpin(uid, date) {
  const h = cyrb53(uid + '|' + date);
  const roll = h % 100;
  const rarity = roll < 60 ? 'common' : roll < 85 ? 'rare' : roll < 95 ? 'epic' : roll < 99 ? 'legendary' : 'grail';
  const cardIdx = Math.floor(h / 256) % 3;
  const cardId = rarity + '-' + (cardIdx + 1);
  const frac = (Math.floor(h / 65536) % 100000) / 100000;
  const lo = SPIN_RANGES[rarity][0], hi = SPIN_RANGES[rarity][1];
  const value = Math.round((lo + frac * (hi - lo)) * 100) / 100;
  return {h:h, roll:roll, rarity:rarity, cardId:cardId, cardName:CARDS[cardId].name, value:value};
}

/* Silent anonymous auth (Shawn 2026-10-03: "Get rid of google login").
   No login UI, no consent screens, no Google sign-in of any kind.
   The anonymous uid keys spins/{uid}_{date}, players/{uid} and spin history —
   everything per-browser. If anonymous sign-in fails (not enabled in the
   Firebase console), the Members tab shows an error card and the pack stays
   disabled. There is NO fallback to Google login. */
let authFailed = false;  /* anonymous sign-in failed */
let handleSaved = '';    /* YouTube @handle from players/{uid}.displayName */

function initFirebase() {
  if (typeof FB_ENABLED === 'undefined' || !FB_ENABLED || typeof firebase === 'undefined') return false;
  try {
    firebase.initializeApp(FB_CONFIG);
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(function(u){
      fbUser = u; subUnlocked = false; subCheckDone = false;
      if (u) { authFailed = false; readSubAttestation(u); startLiveTicker(); } else renderMembers();
    });
    if (!firebase.auth().currentUser) {
      firebase.auth().signInAnonymously().catch(function(){ authFailed = true; renderMembers(); });
    }
    return true;
  } catch(e){ authFailed = true; return false; }
}

/* ============ Members: silent anonymous auth, no login of any kind ============
   Strategy call 2026-10-03 (Shawn): "Get rid of google login" — the page
   works with zero login UI. firebase.auth().signInAnonymously() runs on
   page init; the anonymous uid keys spins, the unlock attestation and
   history. Firestore rules are untouched (they only require request.auth
   != null and a uid match, which anonymous auth satisfies).
   "SUBSCRIBE TO SPIN" gate (Shawn 2026-10-03): a visitor must tap
   "I'm subscribed — unlock my spin" before the pack appears. This writes
   their OWN claim to players/{uid}.subscribed — an honor-based attestation,
   never presented as a verified check. REAL verification happens at prize
   time via the winner-verification link (built before season end). */
const YT_SUBSCRIBE_URL = 'https://www.youtube.com/@CrownedCards?sub_confirmation=1';

/* Optional YouTube @handle — so winners can be reached. Saved to
   players/{uid}.displayName. Shown under the pack and under the lock
   panel, in both Members states.
   Firestore rules (2026-10-04): spins allow public list queries capped at
   12 (the live fresh-pulls ticker) and per-user get/create; players docs
   allow public single-doc get (ticker handle join) with writes restricted
   to the owning uid. Anonymous auth satisfies request.auth != null. */
function handleHtml() {
  return '<div class="handle-box"><label class="handle-label" for="yt-handle">Your YouTube @handle</label>' +
    '<div class="handle-row"><input id="yt-handle" class="handle-input" type="text" maxlength="31" ' +
    'placeholder="@yourhandle" value="' + esc(handleSaved) + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<button class="handle-save" id="handle-save">Save</button></div>' +
    '<p class="handle-help">So we can reach you if you win.</p>' +
    '<p class="handle-err" id="handle-err" style="display:none"></p></div>';
}

/* @ + 2–29 chars (3–30 total), letters/numbers/._- only */
function validHandle(h) {
  return /^@[A-Za-z0-9._-]{2,29}$/.test(String(h || '').trim());
}

/* Best-known @handle for writes: freshly typed if valid, else the saved one. */
function currentHandle(){
  const inp = document.getElementById('yt-handle');
  const typed = inp ? inp.value.trim() : '';
  if (validHandle(typed)) return typed;
  return handleSaved || '';
}

async function saveHandle() {
  const inp = document.getElementById('yt-handle');
  const err = document.getElementById('handle-err');
  if (!inp) return;
  const v = inp.value.trim();
  const showErr = function(m, ok){ if (err) { err.textContent = m; err.style.display = ''; err.className = ok ? 'handle-ok' : 'handle-err'; } };
  if (err) err.style.display = 'none';
  if (!validHandle(v)) { showErr('Use your YouTube handle: starts with @, 3–30 characters, letters/numbers/._- only.'); return; }
  if (!db || !fbUser) { showErr('Session not ready — try again in a moment.'); return; }
  try {
    await db.collection('players').doc(fbUser.uid).set({ displayName: v }, { merge: true });
    handleSaved = v;
    showErr('Saved ✓', true);
  } catch(e) { showErr('Could not save — check your connection and try again.'); }
}

function bindHandle() {
  const b = document.getElementById('handle-save');
  if (b) b.onclick = saveHandle;
  const inp = document.getElementById('yt-handle');
  if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') saveHandle(); });
}

/* Read the user's own subscribe attestation + saved @handle. Missing doc or
   subscribed!==true means locked. Never fail open: errors leave the user locked. */
function readSubAttestation(u) {
  if (!db || !u) { subUnlocked = false; subCheckDone = true; renderMembers(); return; }
  renderMembers(); /* show the checking state immediately */
  db.collection('players').doc(u.uid).get().then(function(snap){
    const d = (snap && snap.exists) ? snap.data() : null;
    subUnlocked = !!(d && d.subscribed === true);
    if (d && typeof d.displayName === 'string' && d.displayName) handleSaved = d.displayName;
    subCheckDone = true; renderMembers();
  }).catch(function(){ subUnlocked = false; subCheckDone = true; renderMembers(); });
}

/* Honor-based unlock: the user taps "I've subscribed". This records THEIR
   claim in players/{uid}.subscribed — it is NOT a verified check.
   Real verification happens at prize time via the winner-verification link. */
async function unlockSpin() {
  if (!db || !fbUser) return;
  const btn = document.getElementById('unlock-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Unlocking…'; }
  /* include the @handle as displayName when a valid one is on screen */
  const typed = ((document.getElementById('yt-handle') || {}).value || '').trim();
  const dn = validHandle(typed) ? typed : '';
  const write = { subscribed: true, subCheckedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (dn) write.displayName = dn;
  try {
    await db.collection('players').doc(fbUser.uid).set(write, { merge: true });
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "I'm subscribed — unlock my spin"; }
    return; /* write failed — stay locked */
  }
  if (dn) handleSaved = dn;
  subUnlocked = true; subCheckDone = true; renderMembers();
}

function membersLockedHtml(msg) {
  return '<div class="locked-panel"><div class="locked-ico">🔒</div>' +
    '<h3 class="locked-title">BONUS</h3><p class="view-sub">' + msg + '</p></div>';
}

function renderMembers() {
  const body = document.getElementById('members-body');
  if (!body) return;
  stopCountdown();
  if (typeof FB_ENABLED === 'undefined' || !FB_ENABLED || typeof firebase === 'undefined') {
    body.innerHTML = membersLockedHtml('The bonus section is launching soon. Check back after the next update.');
    setPackState('unknown');
    return;
  }
  if (authFailed) {
    body.innerHTML = '<div class="locked-panel"><div class="locked-ico">⚠️</div>' +
      '<h3 class="locked-title">SESSION UNAVAILABLE</h3>' +
      '<p class="view-sub">Could not start your session — please check back soon.</p></div>' +
      handleHtml();
    bindHandle();
    setPackState('unknown');
    return;
  }
  if (!fbUser) {
    /* anonymous sign-in still in flight — not an error, just wait */
    body.innerHTML = membersLockedHtml('Starting your session…');
    setPackState('unknown');
    return;
  }
  if (!subCheckDone) {
    body.innerHTML = membersLockedHtml('Checking your membership…');
    setPackState('unknown');
    return;
  }
  if (!subUnlocked) {
    body.innerHTML =
      '<div class="locked-panel gold"><div class="locked-ico">🔔</div>' +
      '<h3 class="locked-title">SUBSCRIBE TO SPIN</h3>' +
      '<p class="view-sub">The daily pack is for @CrownedCards subscribers. Already subscribed? Just unlock below.</p>' +
      '<a class="spin-btn sub-btn" href="' + YT_SUBSCRIBE_URL + '" target="_blank" rel="noopener">Subscribe to @CrownedCards</a><br>' +
      '<button class="unlock-btn" id="unlock-btn">I\'m subscribed — unlock my spin</button>' +
      '<p class="unlock-note">Season winners are verified before prizes ship.</p></div>' +
      handleHtml();
    const ub = document.getElementById('unlock-btn');
    if (ub) ub.onclick = unlockSpin;
    bindHandle();
    setPackState('locked');
    return;
  }
  const handleNudge = handleSaved ? '' :
    '<p class="handle-nudge">⚠️ Add your @handle below so we can find you if you win.</p>';
  body.innerHTML =
    '<div class="spin-panel"><div class="spin-title-row"><h3 class="spin-title"><svg class="spin-crown" viewBox="0 0 36 27" width="30" height="22" aria-hidden="true"><path d="M3 21 L3 8 L10 13 L15 3 L18 12 L21 3 L26 13 L33 8 L33 21 Z" fill="#ffd34d"/><rect x="3" y="22" width="30" height="3.4" rx="1.7" fill="#ffd34d"/></svg>DAILY PACK</h3><button class="sound-toggle" id="sound-toggle" aria-label="Toggle pack sounds"></button></div>' +
    '<p class="view-sub">One free pack every day — tap the pack to rip it open</p>' +
    packStageHtml() +
    '<button class="spin-btn" id="spin-btn">RIP THE PACK</button>' +
    '<div id="spin-countdown" class="spin-countdown"></div>' +
    '<div id="spin-result"></div>' +
    '<div class="sub-note"><p class="view-sub">🎡 Daily packs are for @CrownedCards subscribers — winners are verified before prizes ship.</p>' +
    '<a class="spin-btn sub-btn" href="' + YT_SUBSCRIBE_URL + '" target="_blank" rel="noopener">Subscribe on YouTube</a></div>' +
    handleNudge + '</div>' +
    handleHtml() +
    '<div class="spins-history"><h3 class="view-title" style="font-size:1.05rem">🃏 YOUR PACKS</h3>' +
    '<p class="view-sub" id="spins-total"></p><div id="spins-list"></div></div>';
  const sb = document.getElementById('spin-btn');
  if (sb) sb.onclick = doSpin;
  const stg = document.getElementById('sound-toggle');
  if (stg) { stg.textContent = SFX.muted ? '\u{1F507}' : '\u{1F50A}';
    stg.onclick = function(){ SFX.toggle(); stg.textContent = SFX.muted ? '\u{1F507}' : '\u{1F50A}'; }; }
  const st0 = document.getElementById('pack-stage');
  if (st0) st0.onclick = function(){ doSpin(); }; /* tapping the pack rips it too */
  bindHandle();
  checkTodaySpin();
  loadSpins();
}

function spinResultHtml(d) {
  const c = CARDS[d.cardId] || {name: d.cardName || d.cardId, sport: ''};
  return '<div class="spin-result r-' + esc(d.rarity) + '">' +
    '<div class="spin-result-title">🎉 YOU WON</div>' +
    '<div class="card-art-wrap"><img class="card-art" src="' + (ART[d.cardId] || '') + '" alt="' + esc(c.name) + '">' +
    '<span class="rarity-badge">' + esc(d.rarity) + '</span></div>' +
    '<div class="card-name">' + esc(c.name) + '</div>' +
    '<div class="card-meta">' + esc(c.sport || '') + ' · <span class="card-value">' + money(+d.value || 0) + '</span></div>' +
    '<div class="card-date">' + esc(d.date || '') + ' · Daily pack</div></div>';
}

async function checkTodaySpin() {
  const btn = document.getElementById('spin-btn');
  if (!db || !fbUser || !btn) return;
  let sd;
  try { sd = await fetchServerDate(); }
  catch(e) {
    btn.disabled = true; btn.textContent = 'RIP THE PACK';
    const res = document.getElementById('spin-result');
    if (res) res.innerHTML = '<p class="spin-error">Couldn\'t verify today\'s date — check your connection and try again.</p>';
    return; /* fail closed: no network time, no pack state */
  }
  try {
    const snap = await db.collection('spins').doc(fbUser.uid + '_' + sd.date).get();
    if (snap.exists) {
      /* already ripped today: show the torn pack + revealed card, no animation */
      const d = snap.data();
      const st = packStage();
      if (st) { st.classList.add('no-anim','tearing','ripped','flipped','revealed'); st.onclick = null; }
      const glow = document.getElementById('ripped-card-glow');
      if (glow) {
        glow.style.display = '';
        glow.className = 'ripped-card-glow glow-r-' + d.rarity;
        const card = document.getElementById('ripped-card');
        if (card) card.className = 'ripped-card';
        const img = document.getElementById('ripped-img');
        if (img) { img.src = ART[d.cardId] || ''; img.alt = d.cardName || ''; }
      }
      const res = document.getElementById('spin-result');
      if (res) res.innerHTML = spinResultHtml(d);
      btn.disabled = true; btn.textContent = 'RIPPED ✓';
      setPackState('ripped');
      startCountdown(sd.secondsIntoDay);
    } else {
      btn.disabled = false; btn.textContent = 'RIP THE PACK';
      setPackState('ready');
    }
  } catch(e){ /* offline or permission error: leave button enabled, rip will surface the error */ }
}

async function doSpin() {
  if (spinning || !db || !fbUser || !subUnlocked) return;
  spinning = true;
  const btn = document.getElementById('spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'RIPPING…'; }
  let sd;
  try { sd = await fetchServerDate(); } /* fresh network time on EVERY tap — never a stale date */
  catch(e) {
    spinning = false;
    const res = document.getElementById('spin-result');
    if (res) res.innerHTML = '<p class="spin-error">Couldn\'t verify today\'s date — check your connection and try again.</p>';
    if (btn) { btn.disabled = false; btn.textContent = 'RIP THE PACK'; }
    setPackState('ready');
    return; /* fail closed: abort the rip */
  }
  try {
    const uid = fbUser.uid, date = sd.date;
    const docId = uid + '_' + date;
    const ref = db.collection('spins').doc(docId);
    let data = null;
    const snap = await ref.get();
    if (snap.exists) { data = snap.data(); }
    else {
      const r = computeSpin(uid, date);
      data = {uid:uid, date:date, rarity:r.rarity, cardId:r.cardId, cardName:r.cardName,
              value:r.value, createdAt: firebase.firestore.FieldValue.serverTimestamp()};
      /* stamp the @handle on the spin so the live ticker can show it with no join */
      const dnw = currentHandle();
      if (dnw) data.displayName = dnw;
      try { await ref.set(data); }
      catch(e) { const s2 = await ref.get(); if (s2.exists) data = s2.data(); else throw e; }
    }
    startRip(data, sd);
  } catch(e) {
    spinning = false;
    const res = document.getElementById('spin-result');
    if (res) res.innerHTML = '<p class="spin-error">Rip failed — check your connection and try again.</p>';
    if (btn) { btn.disabled = false; btn.textContent = 'RIP THE PACK'; }
    setPackState('ready');
  }
}

/* Countdown anchored to NETWORK time (secondsIntoDay from fetchServerDate).
   Elapsed time is measured with performance.now() (monotonic — unaffected by the
   user changing the device clock), so the countdown cannot be gamed. */
function startCountdown(secondsIntoDay) {
  stopCountdown();
  const el = document.getElementById('spin-countdown');
  if (!el) return;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const nowFn = function(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); };
  const tick = function(){
    const ms = Math.max(0, (86400 - secondsIntoDay) * 1000 - (nowFn() - t0));
    el.textContent = 'Next pack in ' + Math.floor(ms / 3600000) + 'h ' + Math.floor(ms % 3600000 / 60000) + 'm';
  };
  tick();
  countdownTimer = setInterval(tick, 30000);
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

async function loadSpins() {
  const list = document.getElementById('spins-list');
  if (!list || !db || !fbUser) return;
  try {
    const snap = await db.collection('spins').where('uid', '==', fbUser.uid).limit(50).get();
    const docs = [];
    snap.forEach(function(d){ docs.push(d.data()); });
    docs.sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    const shown = docs.slice(0, 20);
    const total = docs.reduce(function(s, d){ return s + (+d.value || 0); }, 0);
    const totEl = document.getElementById('spins-total');
    if (totEl) totEl.textContent = docs.length + ' packs · ' + money(total) + ' total';
    list.innerHTML = shown.map(function(d){
      return '<div class="pull-row"><span>' + esc(d.date) + '</span>' +
        '<span class="rarity-badge inline r-' + esc(d.rarity) + '">' + esc(d.rarity) + '</span>' +
        '<span>' + esc(d.cardName || '') + '</span>' +
        '<span class="card-value">' + money(+d.value || 0) + '</span></div>';
    }).join('') || '<p class="view-sub">No packs ripped yet.</p>';
  } catch(e){
    list.innerHTML = '<p class="view-sub">Could not load pack history.</p>';
  }
}

document.getElementById("splash").classList.add("hide");
renderStandings(); renderGallery(); bindStandingsSearch();
initFirebase();
renderMembers();

/* ---- REAL BOARD adapter (overrides demo synthesizers) ---- */
/* Fresh-pulls ticker: real game-play pulls from the ledger (render.py bakes
   the latest entries, newest first). */
function renderPullFeed(){
  const tick = document.getElementById('pull-ticker'); if (!tick) return;
  const pulls = (typeof CH_DATA !== 'undefined' && CH_DATA.fresh_pulls) || [];
  const chip = function(it){
    return '<span class="pull-chip"><span class="pc-handle">' + esc(it.handle) + '</span>' +
      '<span class="pc-r ' + esc(it.rarity) + '">' + esc((it.rarity || '').toUpperCase()) + '</span>' +
      '<span>' + esc(it.card || '') + '</span><span class="pc-v">' + money(+it.value || 0) + '</span></span>';
  };
  const half = pulls.map(chip).join('') ||
    '<span class="pull-chip"><span>No pulls yet — be the first on the board</span></span>';
  tick.innerHTML = half + half; /* doubled for the seamless marquee loop */
}

/* ---- LIVE ticker: Firestore onSnapshot keeps the fresh-pulls strip instant.
   A new spin appears for every viewer within a second — no render cycle,
   no page refresh. The baked CH_DATA feed above stays as the seed and the
   fallback (listener errors leave it in place). Handles resolve from the
   spin's own displayName stamp, falling back to a cached players/{uid}
   lookup, then 'Anonymous'. ---- */
var tickerUnsub = null;
var liveRawPulls = [];
var tickerHandles = {};  /* uid -> displayName cache */
function paintLiveTicker(){
  const tick = document.getElementById('pull-ticker'); if (!tick) return;
  const half = liveRawPulls.map(function(v){
    const uid = v.uid || '';
    const h = v.displayName || tickerHandles[uid] || 'Anonymous';
    return '<span class="pull-chip"><span class="pc-handle">' + esc(h) + '</span>' +
      '<span class="pc-r ' + esc(v.rarity) + '">' + esc((v.rarity || '').toUpperCase()) + '</span>' +
      '<span>' + esc(v.cardName || '') + '</span><span class="pc-v">' + money(+v.value || 0) + '</span></span>';
  }).join('') || '<span class="pull-chip"><span>No pulls yet — be the first on the board</span></span>';
  tick.innerHTML = half + half;
}
function startLiveTicker(){
  if (!db || !fbUser || tickerUnsub) return;
  try {
    tickerUnsub = db.collection('spins').orderBy('createdAt', 'desc').limit(12)
      .onSnapshot(function(snap){
        const raws = [], need = [];
        snap.forEach(function(d){
          const v = d.data() || {};
          raws.push(v);
          const uid = v.uid || '';
          if (!v.displayName && uid && !(uid in tickerHandles)) need.push(uid);
        });
        liveRawPulls = raws;
        paintLiveTicker();
        need.forEach(function(uid){
          db.collection('players').doc(uid).get().then(function(s){
            tickerHandles[uid] = (s.exists && s.data().displayName) || '';
            paintLiveTicker();
          }).catch(function(){ tickerHandles[uid] = ''; paintLiveTicker(); });
        });
      }, function(){ /* listener denied/offline — baked feed stays */ });
  } catch(e){ /* baked feed stays */ }
}
/* Season banner + header subtitle + updated timestamp from the ledger snapshot. */
function renderSeasonBanner(){
  const el = document.getElementById('season-banner'); if (!el) return;
  const sn = (typeof CH_DATA !== 'undefined' && CH_DATA.season) || {};
  const parts = (sn.end || '2026-10-31').split('-');
  const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const endShort = MON[+parts[1] - 1] + ' ' + (+parts[2]);
  const seasonName = (sn.name || 'Season 1').toUpperCase();
  let now; try { now = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})); }
  catch(e){ now = new Date(); }
  const end = new Date(+parts[0], +parts[1] - 1, +parts[2], 23, 59, 59);
  const days = Math.ceil((end - now) / 86400000);
  el.textContent = days > 1 ? '\u23f3 ' + seasonName + ' ENDS ' + endShort + ' \u00b7 ' + days + ' DAYS LEFT'
    : days === 1 ? '\u23f3 ' + seasonName + ' ENDS TOMORROW \u00b7 FINAL DAY'
    : '\u23f3 ' + seasonName + ' ENDS TODAY';
  const sub = document.getElementById('season-sub');
  if (sub && sn.name) sub.textContent = sn.name + (sn.label ? ' \u00b7 ' + sn.label : '');
  const uts = document.getElementById('updated-ts');
  if (uts && CH_DATA.updated_at) {
    try {
      uts.textContent = 'Board updated ' + new Date(CH_DATA.updated_at).toLocaleString('en-US',
        {timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
         hour: 'numeric', minute: '2-digit'});
    } catch(e){}
  }
}
