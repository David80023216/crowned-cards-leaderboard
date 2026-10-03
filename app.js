/* Crown Hunt leaderboard renderer + Crown Helper.
   Renders ONLY what the #ch-data block contains — never invent players. */
(function () {
  'use strict';

  var dataEl = document.getElementById('ch-data');
  var data = {};
  try { data = JSON.parse(dataEl.textContent || '{}'); } catch (e) { data = {}; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rankBadge(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return String(rank);
  }

  function fmtMoney(n) {
    n = Number(n) || 0;
    return '$' + n.toLocaleString('en-US');
  }

  function streakHtml(n) {
    n = Number(n) || 0;
    return n >= 2 ? '<span class="streak">🔥' + n + '</span>'
                  : (n === 1 ? '<span class="streak-1">▸1 day</span>' : '—');
  }

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmtDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) : (iso || '');
  }
  function fmtUpdated(iso) {
    var d = new Date(iso || '');
    if (isNaN(d.getTime())) return '';
    var h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + h + ':' +
      ('0' + d.getMinutes()).slice(-2) + ' ' + ap;
  }

  function renderSeasonLabel() {
    var s = data.season || {};
    var el = document.getElementById('season-sub');
    if (el && s.label) {
      el.textContent = s.name + ' · Top Collector race · ' + s.label;
    }
  }

  /* Countdown to the end of the season (end-of-day Central on season end). */
  function tickCountdown() {
    var el = document.getElementById('countdown');
    if (!el) return;
    var s = data.season || {};
    if (!s.end) { el.textContent = '⏳ —'; return; }
    var now = new Date();
    var chi = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    var target = new Date(s.end + 'T23:59:59');
    if (data.season_state === 'ended' || chi > target) {
      el.textContent = '🏁 Season over';
      return;
    }
    var diff = Math.max(0, target - chi);
    var d = Math.floor(diff / 86400000);
    var h = Math.floor(diff % 86400000 / 3600000);
    var m = Math.floor(diff % 3600000 / 60000);
    el.textContent = '\u23F3 ' + (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
  }

  /* ---- Binder view: tap a player row to expand their digital cards. ---- */
  var openBinderIdx = null;

  function cardTile(c) {
    var r = (c.rarity || 'common').toLowerCase();
    var art = c.art
      ? '<img class="card-art" src="' + esc(c.art) + '" alt="' +
        esc(c.variant_name || (r + ' card')) + '" loading="lazy" ' +
        'onerror="this.closest(\'.card-art-wrap\').classList.add(\'no-art\');this.remove();">'
      : '';
    return '<div class="card-tile r-' + esc(r) + '">' +
      '<div class="card-art-wrap' + (c.art ? '' : ' no-art') + '">' + art +
        '<span class="rarity-badge">' + esc(r) + '</span></div>' +
      '<div class="card-name">' + esc(c.variant_name || 'Mystery Card') + '</div>' +
      '<div class="card-meta"><span class="card-value">' + fmtMoney(c.value) + '</span>' +
        ' · ' + esc(c.source_label || '') + '</div>' +
      '<div class="card-date">' + fmtDay(c.date) + '</div>' +
    '</div>';
  }

  function binderRowHTML(e, idx) {
    var cards = e.collection || [];
    var grid = cards.length
      ? cards.map(cardTile).join('')
      : '<p class="binder-empty">No pulls yet — this binder is still empty.</p>';
    var total = fmtMoney(e.collection_value);
    return '<tr class="binder-row" id="binder-' + idx + '"><td colspan="5">' +
      '<div class="binder-panel">' +
        '<div class="binder-head"><span class="binder-title">🗂️ ' +
          esc(e.handle) + '’s binder</span>' +
          '<span class="binder-total">' + cards.length + ' pulls · ' + total + '</span></div>' +
        '<div class="binder-grid">' + grid + '</div>' +
        '<div class="binder-tiebreak">Tiebreak: ' + (Number(e.mythics) || 0) + ' mythics · ' +
          (Number(e.legendaries) || 0) + ' legendaries · ' + (Number(e.streak) || 0) + 'd streak</div>' +
      '</div>' +
    '</td></tr>';
  }

  function renderStandings() {
    var rows = data.standings || [];
    var tbody = document.getElementById('rows-season');
    var rank = 0, lastVal = null;
    tbody.innerHTML = rows.map(function (e, i) {
      /* Shared rank for identical binder values (tiebreak order comes
         pre-sorted from the data block: mythics → legendaries → streak). */
      if (e.collection_value !== lastVal) { rank = i + 1; lastVal = e.collection_value; }
      var hasStreak = (Number(e.streak) || 0) >= 1;
      return '<tr class="player-row" data-idx="' + i + '" data-handle="' +
        esc((e.handle || '').toLowerCase()) + '">' +
        '<td class="rank">' + rankBadge(rank) + '</td>' +
        '<td class="player">' + esc(e.handle || '') +
          ' <span class="binder-hint">🗂 ▸</span></td>' +
        '<td class="value">' + fmtMoney(e.collection_value) + '</td>' +
        '<td class="mythics-cell">' + (Number(e.mythics) || 0) + '</td>' +
        '<td class="streak-cell' + (hasStreak ? '' : ' is-empty') + '">' + streakHtml(e.streak) + '</td>' +
      '</tr>';
    }).join('');
    openBinderIdx = null;
    var snap = document.getElementById('snapshot');
    if (data.season) {
      snap.textContent = data.season.name + ' · ' + fmtDay(data.season.start) + ' → ' +
        fmtDay(data.season.end) + ' · updated ' + fmtUpdated(data.updated_at);
    }
    /* Fewer than 3 collectors -> clean "be the first" state, never a thin table. */
    var showBoard = rows.length >= 3;
    var startSoon = document.getElementById('start-soon');
    if (startSoon) {
      startSoon.hidden = showBoard;
      var title = document.getElementById('empty-title');
      if (title && data.season && data.season.name) {
        title.textContent = data.season.name.toUpperCase() + ' — BE THE FIRST ON THE BOARD 👑';
      }
    }
    var tableWrap = document.querySelector('.table-wrap');
    if (tableWrap) tableWrap.style.display = showBoard ? '' : 'none';
    if (snap) snap.style.display = showBoard ? '' : 'none';
    var searchWrap = document.querySelector('.search-wrap');
    if (searchWrap) searchWrap.style.display = showBoard ? '' : 'none';
    applySearch();
  }

  function toggleBinder(row) {
    var idx = row.getAttribute('data-idx');
    var tbody = document.getElementById('rows-season');
    var rows = data.standings || [];
    /* Close any open binder first. */
    var old = tbody.querySelector('.binder-row');
    if (old) old.remove();
    var prevOpen = tbody.querySelector('.player-row.open');
    if (prevOpen) prevOpen.classList.remove('open');
    if (openBinderIdx === idx) { openBinderIdx = null; return; }
    openBinderIdx = idx;
    row.classList.add('open');
    var e = rows[+idx];
    if (!e) return;
    var div = document.createElement('div');
    div.innerHTML = '<table><tbody>' + binderRowHTML(e, idx) + '</tbody></table>';
    var panel = div.querySelector('.binder-row');
    row.parentNode.insertBefore(panel, row.nextSibling);
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function initBinder() {
    var tbody = document.getElementById('rows-season');
    if (!tbody) return;
    tbody.addEventListener('click', function (ev) {
      var row = ev.target.closest('.player-row');
      if (row) toggleBinder(row);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && openBinderIdx !== null) {
        var old = tbody.querySelector('.binder-row');
        if (old) old.remove();
        var prevOpen = tbody.querySelector('.player-row.open');
        if (prevOpen) prevOpen.classList.remove('open');
        openBinderIdx = null;
      }
    });
  }

  function renderSpotlight() {
    var sec = document.getElementById('spotlight');
    if (!sec) return;
    /* Spotlight shows the current leader while live; the declared winner after the season ends. */
    var w = data.top_collector || (data.standings || [])[0];
    if (!w || !w.handle) return;
    sec.hidden = false;
    document.getElementById('spot-name').textContent = w.handle;
    document.getElementById('spot-pts').textContent = fmtMoney(w.collection_value) + ' binder value';
    var st = document.getElementById('spot-streak');
    st.textContent = (Number(w.streak) || 0) >= 2 ? '🔥 ' + w.streak + '-day streak' : '';
    if (data.season_state === 'ended' && data.top_collector) {
      document.querySelector('#spotlight h2').textContent = '👑 TOP COLLECTOR — SEASON WINNER';
    }
  }

  /* Prize display: three Season 1 Crown Cards (1st/2nd/3rd), rendered from the
     data block (merged from config/prize.json by render.py). The static HTML
     carries the Season 1 prizes as a fallback so the block never renders
     empty. */
  function renderPrize() {
    var p = data.prize || {};
    var prizes = p.prizes || [];
    var grid = document.getElementById('prize-grid');
    if (!grid || !prizes.length) return;
    grid.innerHTML = '';
    prizes.forEach(function (pr) {
      var item = document.createElement('div');
      item.className = 'prize-item';
      var place = document.createElement('div');
      place.className = 'prize-place';
      place.textContent = (pr.place || '').toUpperCase() + ' PLACE';
      var photo = document.createElement('div');
      photo.className = 'prize-photo';
      var im = document.createElement('img');
      im.src = pr.image || '';
      im.alt = (pr.place || '') + ' place prize: ' + (pr.name || 'Crown Card');
      im.onerror = function () { photo.style.display = 'none'; };
      photo.appendChild(im);
      var nm = document.createElement('p');
      nm.className = 'prize-name';
      nm.textContent = pr.name || '';
      item.appendChild(place); item.appendChild(photo); item.appendChild(nm);
      grid.appendChild(item);
    });
  }

  function applySearch() {
    var q = (document.getElementById('player-search').value || '').trim().toLowerCase();
    var rows = document.querySelectorAll('#rows-season .player-row');
    var visible = 0;
    rows.forEach(function (tr) {
      var hit = !q || (tr.getAttribute('data-handle') || '').indexOf(q) !== -1;
      tr.style.display = hit ? '' : 'none';
      /* Hide an open binder panel whose row got filtered out. */
      var nxt = tr.nextElementSibling;
      if (nxt && nxt.classList.contains('binder-row')) {
        nxt.style.display = hit ? '' : 'none';
      }
      if (hit) visible++;
    });
    document.getElementById('empty-season').hidden = visible !== 0;
  }
  document.getElementById('player-search').addEventListener('input', applySearch);

  /* ---- Crown Helper: rule-based FAQ bot. Answers ONLY from the page's
     own live data (#ch-data) plus the printed rules. Never invents pulls,
     players, or standings. No external API keys. ---- */
  var HELPER_NAME = 'Crown Helper';
  var SUB_LINK = 'https://www.youtube.com/@CrownedCards?sub_confirmation=1';
  var ODDS_TABLE = '🎲 <strong>Standard pull odds:</strong><br>' +
    '· common $10–50 — 60%<br>' +
    '· rare $50–250 — 25%<br>' +
    '· epic $250–1K — 10%<br>' +
    '· legendary $1K–10K — 4%<br>' +
    '· mythic $10K–100K — 1%';

  function helperTop(n) {
    return (data.standings || []).slice().sort(function (a, b) {
      return (b.collection_value || 0) - (a.collection_value || 0);
    }).slice(0, n);
  }

  function helperTopLine(e, i) {
    return (i + 1) + '. ' + e.handle + ' — ' + fmtMoney(e.collection_value) +
      (e.mythics >= 1 ? ' · ' + e.mythics + ' mythic' + (e.mythics > 1 ? 's' : '') : '');
  }

  function helperAnswer(q) {
    var t = (' ' + (q || '').toLowerCase() + ' ');
    var has = function () {
      for (var i = 0; i < arguments.length; i++) {
        var w = arguments[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp('\\b' + w + '\\b').test(t)) return true;
      }
      return false;
    };
    var s = data.season || {};
    var p = data.prize || {};

    if (has('hi', 'hello', 'hey', 'yo', 'sup', 'morning', 'evening')) {
      return "Hey! 👑 I'm " + HELPER_NAME + ". Ask me about pulls, rarity odds, streaks, the binder, or the prize — or tap a question below!";
    }
    if (has('odds', 'rarity', 'rarities', 'chance', 'chances', 'probability')) {
      return ODDS_TABLE + '<br><br>Fan pulls are common-only ($5–25) — <strong>every comment</strong> on a hunt video mints one (max 1 per video per Central day). Streak milestones mint <strong>boosted</strong> pulls with much better odds — ask me how streaks work!';
    }
    if (has('fan', 'fans', 'dust', 'free', 'freebie')) {
      return "✨ A fan pull is the freebie: <strong>every comment</strong> on a hunt video mints one <strong>common-only pull ($5–25)</strong> — max 1 per video per Central day (comment on 3 videos = 3 fan pulls). Fan pulls never count toward the 3/day scoring-pull cap. Get a pick RIGHT on that video and your fan pull <strong>upgrades</strong> to a standard pull — just show up and rip!";
    }
    if (has('streak', 'streaks')) {
      return "🔥 Play consecutive days (any credited activity keeps the streak alive) and milestones mint <strong>boosted pulls — no commons</strong>, once per streak run:<br>" +
        '· 3 days — rare 30 / epic 40 / legendary 20 / mythic 10<br>' +
        '· 7 days — epic 50 / legendary 35 / mythic 15<br>' +
        '· 14 days — epic 30 / legendary 45 / mythic 25<br>' +
        '· 30 days — epic 20 / legendary 45 / mythic 35<br>' +
        'Miss a day and the streak resets to zero.';
    }
    if (has('binder', 'collection', 'cards', 'pulled', 'pulls')) {
      return "🗂️ Your binder is your collection of digital Crown Hunt cards — <strong>tap any collector's row on the standings</strong> to open theirs: every pull with its art, name, rarity, value, and how it was earned. " + ODDS_TABLE;
    }
    if (has('pull')) {
      return "🎲 A pull mints a digital Crown Hunt card into your binder with a whole-dollar value. Correct battle prediction or screenshot claim = <strong>standard pull</strong> (up to 3 scoring pulls per Central day). <strong>Every comment</strong> also mints a <strong>fan pull</strong> (common-only $5–25, max 1 per video per day) — and a correct pick upgrades that fan pull to a standard pull. " + ODDS_TABLE;
    }
    if (has('winning', 'lead', 'leading', 'ahead', 'top collector', 'first place')) {
      var top = helperTop(3);
      if (!top.length) return "No collectors on the board yet — be the first! Rip a pack on a hunt video.";
      return "👑 Right now it's:<br>" + top.map(helperTopLine).join('<br>') +
        "<br>Tiebreak: most mythics → most legendaries → longest streak.";
    }
    if (has('standing', 'board', 'rank')) {
      var top6 = helperTop(6);
      if (!top6.length) return "The board is empty — a new hunt video is your ticket in!";
      return "📋 Season standings:<br>" + top6.map(function (e, i) {
        return helperTopLine(e, i) + (e.streak >= 2 ? ' 🔥' + e.streak : '');
      }).join('<br>');
    }
    if (has('play', 'join', 'start', 'how')) {
      return "👑 Watch a Crown Hunt video, then comment your pick — name the card that takes the crown. Correct battle prediction or screenshot claim = a <strong>standard pull</strong> (up to 3 scoring pulls per Central day). <strong>Every comment mints a fan pull</strong> (common-only, $5–25, max 1 per video per day) — nail the pick and it upgrades to a standard pull. Biggest binder value at month's end wins the Top Collector crown!";
    }
    if (has('prize', 'prizes', 'win', 'winner', 'reward', 'mailed', 'ship')) {
      var plist = (p.prizes || []).map(function (pr) {
        return (pr.place || '') + ' — <strong>' + (pr.name || '') + '</strong>';
      }).join(', ');
      return "🏆 The monthly Top Collector wins ACTUAL physical sports cards, mailed to them — top 3 all get crowned! Free entry · 18+ · US shipping only · not sponsored or endorsed by YouTube. " +
        (plist ? "This season: " + plist + "." : "") +
        "<br>You must be <a href=\"" + SUB_LINK + "\" target=\"_blank\" rel=\"noopener\">subscribed</a> to win.";
    }
    if (has('season', 'end', 'ends', 'over', 'reset', 'month', 'october')) {
      var when = s.end ? fmtDay(s.end) : 'the end of the month';
      return "🗓️ " + (s.name || 'This season') + " runs through <strong>" + when + "</strong>. Binders accumulate all month, then reset on the 1st — nobody's ever too far behind to join!";
    }
    if (has('subscrib', 'follow')) {
      return '🔔 Hit that subscribe button — you must be <a href="' + SUB_LINK + '" target="_blank" rel="noopener">subscribed</a> to win the monthly prize!';
    }
    if (has('tie', 'tied', 'tiebreak')) {
      return "⚖️ Tiebreaker: most mythics first, then most legendaries, then longest active streak.";
    }
    if (has('cash', 'money', 'redeem', 'sell', 'trade', 'worth', 'value', 'real')) {
      return "🎮 Digital Crown Hunt cards are <strong>game pieces with no cash value</strong> — they can't be redeemed, traded, or sold. The Season 1 prizes (real physical sports cards for the top 3) are awarded by the channel and are separate from your digital binder.";
    }
    if (has('fair', 'cheat', 'spam', 'rule')) {
      return "⚖️ Fair play: one account per player, no spam-dumping past the daily cap, keep comments clean. The channel's scoring calls are final.";
    }
    if (has('thank', 'thanks', 'thx', 'cool', 'awesome')) {
      return "You got it! 👑 Go rip that pack.";
    }
    if (has('bye')) {
      return "See you at the next hunt! 👑";
    }
    return null;
  }

  function helperAddMsg(text, who) {
    var box = document.getElementById('chat-box');
    if (!box) return;
    var div = document.createElement('div');
    div.className = 'chat-msg chat-' + who;
    if (who === 'bot') {
      div.innerHTML = '<span class="chat-name">' + esc(HELPER_NAME) + '</span>' + text;
    } else {
      div.textContent = text;
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function helperAsk(q) {
    q = (q || '').trim();
    if (!q) return;
    helperAddMsg(q, 'user');
    var canned = helperAnswer(q);
    setTimeout(function () {
      helperAddMsg(canned ||
        "Good question! 👑 Check the 📜 Rules tab, or drop it in the comments of the latest hunt video — the channel answers fast.",
        'bot');
    }, 350);
  }

  function initHelper() {
    var box = document.getElementById('chat-box');
    var input = document.getElementById('chat-input');
    var send = document.getElementById('chat-send');
    var chips = document.getElementById('chat-chips');
    if (!box || !input || !send) return;
    helperAddMsg("Hey! I'm " + HELPER_NAME + " 👑 Ask me about pulls, rarity odds, streaks, the binder, or the prize — or tap a question below!", 'bot');
    send.addEventListener('click', function () { helperAsk(input.value); input.value = ''; });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { helperAsk(input.value); input.value = ''; }
    });
    if (chips) {
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-q]');
        if (b) helperAsk(b.getAttribute('data-q'));
      });
    }
  }

  /* Mobile-app shell: bottom tab bar switches views. */
  function initTabs() {
    var btns = document.querySelectorAll('.tabbar button');
    if (!btns.length) return;
    function show(id) {
      var views = document.querySelectorAll('.view');
      for (var i = 0; i < views.length; i++) views[i].classList.toggle('active', views[i].id === id);
      for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('active', btns[j].getAttribute('data-view') === id);
      if (window.scrollTo) window.scrollTo(0, 0);
    }
    for (var k = 0; k < btns.length; k++) {
      (function (b) {
        b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
      })(btns[k]);
    }
  }

  renderSeasonLabel();
  renderStandings();
  renderSpotlight();
  renderPrize();
  initHelper();
  initBinder();
  tickCountdown();
  setInterval(tickCountdown, 60000);
  initTabs();
})();

/* ---- App-shell behavior: splash screen + PWA install. ---- */
(function () {
  'use strict';

  /* Splash: hide once the app has initialized (data is embedded, so this is
     fast — the splash is the "app launching" beat). */
  function initSplash() {
    var splash = document.getElementById('splash');
    if (!splash) return;
    function hide() {
      splash.classList.add('hide');
      setTimeout(function () { splash.remove(); }, 450);
    }
    if (document.readyState === 'complete') {
      setTimeout(hide, 500);
    } else {
      window.addEventListener('load', function () { setTimeout(hide, 500); });
      /* Failsafe: never trap the user on the splash. */
      setTimeout(hide, 3000);
    }
  }

  /* Install: Android/Chrome deferred prompt + gold header button and a
     dismissible banner; iOS gets a one-time "Add to Home Screen" coach
     sheet (no install prompt exists on iOS). */
  function initInstall() {
    var btn = document.getElementById('install-btn');
    var banner = document.getElementById('install-banner');
    var bannerX = document.getElementById('install-banner-x');
    var deferred = null;

    function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    var isStandalone = false;
    try {
      isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    } catch (e) {}
    if (isStandalone) return; /* already installed — nothing to do */

    function hideBanner() { if (banner) banner.hidden = true; }
    if (bannerX) bannerX.addEventListener('click', function () {
      hideBanner();
      store('ch-install-dismissed', '1');
    });

    function doInstall() {
      if (!deferred) return;
      deferred.prompt();
      if (deferred.userChoice && deferred.userChoice.then) {
        deferred.userChoice.then(function () {
          deferred = null;
          if (btn) btn.hidden = true;
          hideBanner();
        });
      } else {
        deferred = null;
      }
    }
    if (btn) btn.addEventListener('click', doInstall);
    var bannerBtn = document.getElementById('install-banner-btn');
    if (bannerBtn) bannerBtn.addEventListener('click', doInstall);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      if (btn) btn.hidden = false;
      if (banner && read('ch-install-dismissed') !== '1') banner.hidden = false;
    });

    /* iOS coach sheet — shown once, a beat after launch. */
    if (isIOS && read('ch-ios-sheet') !== '1') {
      setTimeout(function () {
        var sheet = document.getElementById('ios-sheet');
        if (!sheet) return;
        sheet.hidden = false;
        store('ch-ios-sheet', '1');
        var close = document.getElementById('ios-sheet-close');
        if (close) close.addEventListener('click', function () { sheet.hidden = true; });
        sheet.addEventListener('click', function (ev) {
          if (ev.target === sheet) sheet.hidden = true;
        });
      }, 2200);
    }
  }

  initSplash();
  initInstall();
})();
