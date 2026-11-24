/* ═══════════════════════════════════════════════════════════════════════════
   BeTheGrid — Common (shared nav, utilities)
   Include on every page. Editable in one place.
   ═══════════════════════════════════════════════════════════════════════════ */

window.BTG = window.BTG || {};
BTG.seriesIsVisible = function(series){return !/^(?:GT1|GT\s*Class\s*One)$/i.test(String(series||'').trim());};

/* ── Nav ────────────────────────────────────────────────────────────────────
   Auto-rendered into <nav id="btg-nav"> on every page. The top bar lives
   entirely in JS here — pages just include this script and a
   <nav id="btg-nav"></nav> placeholder. Set document.body.dataset.page
   ('standings'|'drivers'|'dashboard'|'news') to highlight the active tab.
   ─────────────────────────────────────────────────────────────────────────── */
BTG.renderNav = function(activePage) {
  var nav = document.getElementById('btg-nav');
  if (!nav) return;

  var tabs = [
    { id: 'standings', label: 'Standings', href: 'standings.html' },
    { id: 'drivers',   label: 'Drivers',   href: 'drivers.html' },
    { id: 'lineups',   label: 'Driver Lineups', href: 'lineups.html' },
    { id: 'teams',     label: 'Teams',     href: 'teams.html' },
    { id: 'race-weekend', label: 'Race Weekend', href: 'race-weekend.html' },
    { id: 'calendar', label: 'Calendar', href: 'calendar.html' },
    { id: 'dashboard', label: 'Dashboard', href: 'BTG_DriverAttributes.html' },
    { id: 'radio',     label: 'Radio Creator', href: 'radio-creator.html' },
    { id: 'news',      label: 'News',      href: 'news.html' }
  ];

  // F1-style two-row header: a thin black utility strip, then the main bar.
  var util = '<div class="f1-util">'
    + '<a href="https://www.youtube.com/@Bethegrid" target="_blank" rel="noopener" aria-label="YouTube"><img src="logos/Youtube.png" alt=""><span class="f1-util__label">YouTube</span></a>'
    + '<a href="https://discord.gg/bethegrid" target="_blank" rel="noopener" aria-label="Discord"><img src="logos/Discord.webp" alt=""><span class="f1-util__label">Discord</span></a>'
    + '<button class="f1-util__support" type="button" onclick="BTG.openDonate()">' + BTG.icon('heart', 13) + ' Support<span class="f1-util__label"> the site</span></button>'
    + '</div>';
  var main = '<div class="f1-main"><a class="btg-logo" href="index.html"><img class="btg-logo-img" src="logos/BTG.png" alt="BeTheGrid"></a>';
  tabs.forEach(function(t) {
    var cls = 'nav-tab' + (t.id === activePage ? ' active' : '');
    main += '<a class="' + cls + '" href="' + t.href + '"' + (t.id === activePage ? ' aria-current="page"' : '') + '>' + t.label + '</a>';
  });
  main += '</div>';
  nav.innerHTML = util + main;
  BTG.renderPageHead(activePage);
  BTG.renderFooter();
};

/* ── F1-style page title band + footer ─────────────────────────────────────
   Big uppercase title under the header on content pages. Tool pages that
   are full-screen apps (lineups, radio, dashboard, news writer) skip it. */
BTG.PAGE_TITLES = {
  standings: 'Championship Standings',
  drivers: 'Drivers',
  teams: 'Teams',
  calendar: 'Race Calendar',
  news: 'Latest News'
};
BTG.renderPageHead = function(page) {
  var title = BTG.PAGE_TITLES[page];
  var nav = document.getElementById('btg-nav');
  if (!title || !nav || document.querySelector('.f1-pagehead')) return;
  var head = document.createElement('header');
  head.className = 'f1-pagehead';
  head.innerHTML = '<h1 class="f1-pagehead__title">' + title + '</h1>';
  nav.parentNode.insertBefore(head, nav.nextSibling);
};
BTG.renderFooter = function() {
  if (document.querySelector('.f1-footer')) return;
  var f = document.createElement('footer');
  f.className = 'f1-footer';
  f.innerHTML = '<div class="f1-footer__inner">'
    + '<img class="f1-footer__logo" src="logos/BTG.png" alt="BeTheGrid">'
    + '<a href="https://www.youtube.com/@Bethegrid" target="_blank" rel="noopener">YouTube</a>'
    + '<a href="https://discord.gg/bethegrid" target="_blank" rel="noopener">Discord</a>'
    + '<span>&copy; ' + new Date().getFullYear() + ' BeTheGrid</span>'
    + '</div>';
  document.body.appendChild(f);
};

/* ── Donate modal (global) ─────────────────────────────────────────────── */
BTG.ensureDonateModal = function() {
  if (document.getElementById('donate-modal')) return;
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'donate-modal';
  overlay.innerHTML =
    '<div class="modal donate-modal">'
    + '<div class="modal-header"><div class="modal-title">Support this site\'s development</div>'
    + '<button class="modal-close" type="button" onclick="BTG.closeDonate()" aria-label="Close">' + BTG.icon('x', 18) + '</button></div>'
    + '<div class="modal-body">'
    + '<a class="donate-btn" href="https://paypal.me/ThatOneEd" target="_blank" rel="noopener">'
    + '<span class="donate-btn-icon">' + BTG.icon('heart', 18) + '</span>Donate via PayPal'
    + '</a>'
    + '<div class="donate-note">Opens PayPal.me in a new tab — you don\'t need a PayPal account to send a donation.</div>'
    + '</div></div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) BTG.closeDonate(); });
  document.body.appendChild(overlay);
};
BTG.openDonate = function() {
  BTG.ensureDonateModal();
  document.getElementById('donate-modal').classList.add('open');
};
BTG.closeDonate = function() {
  var m = document.getElementById('donate-modal');
  if (m) m.classList.remove('open');
};

// Auto-render the nav on every page that includes this script.
(function() {
  function boot() {
    var page = document.body && document.body.dataset ? document.body.dataset.page : null;
    if (!page && location.hash) page = location.hash.replace('#','');
    BTG.renderNav(page);
    BTG.ensureDonateModal();
    BTG.loadLogoManifest();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ── Logo manifest ──────────────────────────────────────────────────────────
   The list of images that actually exist under logos/. Several views build
   candidate paths and fall back on 404 (team crests, series logos); knowing the
   real file list up front avoids those wasted requests. Resolves to the same
   Set on every call, so it is safe to await more than once. */
BTG.LOGO_FILES = BTG.LOGO_FILES || new Set();
BTG.loadLogoManifest = function() {
  if (BTG._logoManifestPromise) return BTG._logoManifestPromise;
  BTG._logoManifestPromise = fetch('logos/logos-manifest.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) {
      (m && m.logos || []).forEach(function (p) {
        BTG.LOGO_FILES.add('logos/' + String(p).replace(/^\/+/, ''));
      });
      return BTG.LOGO_FILES;
    })
    .catch(function () { return BTG.LOGO_FILES; });
  return BTG._logoManifestPromise;
};

/* ── Data endpoint probes ───────────────────────────────────────────────────
   Auto-discovery asks the dev server for the Data/ folder listing (/api/*).
   Static hosting (GitHub Pages) has no such endpoints, so each probe is a 404,
   and pages asked more than once per load. These memos keep it to one request
   per endpoint per page load in both cases. Resolving to null means "this host
   has no such endpoint" — distinct from an empty array ("folder is empty"). */
BTG.dataManifest = function() {
  if (BTG._dataManifestPromise) return BTG._dataManifestPromise;
  BTG._dataManifestPromise = fetch('Data/data-manifest.json')
    .then(function(r) { return r.ok ? r.json() : {}; })
    .catch(function() { return {}; })
    .then(function(m) { return (m && typeof m === 'object') ? m : {}; });
  return BTG._dataManifestPromise;
};

BTG.apiSeries = function() {
  if (BTG._apiSeriesPromise) return BTG._apiSeriesPromise;
  BTG._apiSeriesPromise = fetch('/api/series')
    .then(function(r) { return r.ok ? r.json() : null; })
    .catch(function() { return null; })
    .then(function(list) { return Array.isArray(list) ? list : null; });
  return BTG._apiSeriesPromise;
};

/** File list for a series from the dev server, or null when /api is absent. */
BTG.apiSeriesFiles = function(series) {
  if (!series) return Promise.resolve(null);
  BTG._apiFiles = BTG._apiFiles || {};
  if (BTG._apiFiles[series]) return BTG._apiFiles[series];
  BTG._apiFiles[series] = BTG.apiSeries().then(function(supported) {
    if (!supported) return null;
    return fetch('/api/series-files?series=' + encodeURIComponent(series))
      .then(function(r) { return r.ok ? r.json() : null; })
      .catch(function() { return null; })
      .then(function(list) { return Array.isArray(list) ? list : null; });
  });
  return BTG._apiFiles[series];
};

/* ── Team Colors ──────────────────────────────────────────────────────────── */

/**
 * The colour to fall back to when there is no team to paint with: the interface theme's accent.
 *
 * Read live rather than captured, because the theme can change while the app is running, and the value is
 * needed as a triplet for the glow maths rather than as a finished colour.
 */
BTG.readThemeRgb = function() {
  var val = '';
  try { val = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim(); } catch (e) {}
  return val ? val.replace(/\s*,\s*/g, ' ') : '220 38 38';
};

/** Parse "r,g,b" strings and set CSS --team-* variables on <html>.
    rgb2 (secondary team colour) feeds the second background gradient. */
BTG.setTeamColors = function(rgb, rgb2) {
  var root = document.documentElement;
  if (!rgb) { BTG.resetTeamColors(); return; }
  var parts = rgb.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) { BTG.resetTeamColors(); return; }
  var r = parts[0], g = parts[1], b = parts[2];
  var r2 = Math.round(r*0.55), g2 = Math.round(g*0.45), b2 = Math.round(b*0.5);
  if (rgb2) {
    var p2 = rgb2.split(',').map(Number);
    if (p2.length === 3 && !p2.some(isNaN)) { r2 = p2[0]; g2 = p2[1]; b2 = p2[2]; }
  }
  root.style.setProperty('--team-accent', 'rgb('+r+','+g+','+b+')');
  root.style.setProperty('--team-accent-hot', 'rgb('+Math.min(255,Math.round(r*1.15))+','+Math.min(255,Math.round(g*1.15))+','+Math.min(255,Math.round(b*1.15))+')');
  root.style.setProperty('--team-accent-on', '#fff');
  root.style.setProperty('--team-surface', 'rgba('+r+','+g+','+b+',0.08)');
  root.style.setProperty('--team-edge', 'rgba('+r+','+g+','+b+',0.30)');
  root.style.setProperty('--team-glow', 'rgba('+r+','+g+','+b+',0.18)');
  root.style.setProperty('--team-glow2', 'rgba('+r2+','+g2+','+b2+',0.18)');
};

BTG.resetTeamColors = function() {
  var root = document.documentElement;
  root.style.setProperty('--team-accent', 'var(--ember)');
  root.style.setProperty('--team-accent-hot', 'var(--ember-hot)');
  root.style.setProperty('--team-accent-on', 'var(--ember-on)');
  root.style.setProperty('--team-surface', 'rgba(185,29,46,0.08)');
  root.style.setProperty('--team-edge', 'rgba(185,29,46,0.30)');
  root.style.setProperty('--team-glow', 'rgba(185,29,46,0.18)');
  root.style.setProperty('--team-glow2', 'rgba(185,29,46,0.18)');
};

/* ── Team bands ───────────────────────────────────────────────────────────── */

/**
 * A row, a chip, a header and a hero card are the same surface with a different amount of room, so the colours and the
 * ink are worked out once, here, and handed to whichever of them is being drawn.
 */

/** Luminance of an "r g b" (or "r,g,b") triplet, 0..1. */
function bandLuminance(triplet) {
  var p = String(triplet || '').trim().split(/[\s,]+/).map(Number);
  if (p.length < 3 || p.some(isNaN)) return null;
  var lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
}

/**
 * Which ink a colour, or a band of two, needs: dark on a light surface, white on a dark one.
 *
 * The band is judged as the one surface it is — the colours are averaged — because lettering spread across it sits on
 * both ends of it and has to read against the whole run.
 */
BTG.inkTone = function () {
  var tones = [].slice.call(arguments).map(bandLuminance).filter(function (v) { return v != null; });
  if (!tones.length) return 'light';
  var avg = tones.reduce(function (a, b) { return a + b; }, 0) / tones.length;
  return avg > 0.45 ? 'dark' : 'light';
};

/** The colour an ink is drawn in, as the interface paints it. */
BTG.inkColour = function (tone) {
  return tone === 'dark' ? 'rgb(24 24 27)' : 'rgb(255 255 255)';
};

/** Build the band style for a team's pair of colours, or null when there is no team to paint with. */
BTG.teamBand = function (rgb, rgb2) {
  var norm = function (v) { return String(v || '').trim().replace(/\s*,\s*/g, ' '); };
  var from = norm(rgb), to = norm(rgb2);
  if (!/^\d+ \d+ \d+$/.test(from)) return null;
  if (!/^\d+ \d+ \d+$/.test(to)) to = from;
  var tone = BTG.inkTone(from, to);
  var ink = BTG.inkColour(tone);
  var css = function (v) { return 'rgb(' + v.replace(/ /g, ',') + ')'; };
  return {
    from: css(from), to: css(to), tone: tone, ink: ink,
    style: 'background:linear-gradient(90deg, ' + css(from) + ', ' + css(to) + ');color:' + ink + ';--band-ink:' + ink
  };
};

/**
 * The team's colours as space-separated channels, which is the form every `rgb(var(--team-rgb) / a)` rule needs.
 *
 * One place works this out for every page: the DB cache is the source when it has the colour, the page's own registry
 * stands in when it does not, and the accent is the last resort. A page that already has a `teamRgb` of its own keeps
 * using it — this is for the pages that do not, and for the secondary colour no page had.
 */
BTG.teamRgbFor = function (name) {
  if (!name) return null;
  var hex = '';
  if (BTG.DBCache && BTG.DBCache.teamColorHex) {
    try { hex = BTG.DBCache.teamColorHex(name) || ''; } catch (e) { hex = ''; }
  }
  if (!hex) {
    var t = BTG.teamByName ? BTG.teamByName(name) : null;
    if (t && t.color) return String(t.color).replace(/\s*,\s*/g, ' ');
  }
  var m = String(hex).replace('#', '');
  if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
  var n = parseInt(m, 16);
  if (isNaN(n)) return null;
  return ((n >> 16) & 255) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255);
};

/** The team's second colour, for the far end of its band. Falls back to the primary when the save has none. */
BTG.teamRgbSecondaryFor = function (name) {
  if (!name) return null;
  var hex = '';
  if (BTG.DBCache && BTG.DBCache.teamColorSecondaryHex) {
    try { hex = BTG.DBCache.teamColorSecondaryHex(name) || ''; } catch (e) { hex = ''; }
  }
  // A known DB team without a second colour uses its primary, not a registry colour.
  if (!hex && BTG.DBCache && BTG.DBCache.teamColorHex && BTG.DBCache.teamColorHex(name)) {
    return BTG.teamRgbFor(name);
  }
  if (!hex) {
    var t = BTG.teamByName ? BTG.teamByName(name) : null;
    if (t && t.colorSecondary) return String(t.colorSecondary).replace(/\s*,\s*/g, ' ');
  }
  var m = String(hex).replace('#', '');
  if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
  var n = parseInt(m, 16);
  if (isNaN(n)) return BTG.teamRgbFor(name);
  return ((n >> 16) & 255) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255);
};

/** The band for a team by name, or null when there is nothing to paint with. */
BTG.teamBandFor = function (name) {
  return BTG.teamBand(BTG.teamRgbFor(name), BTG.teamRgbSecondaryFor(name));
};

/** Driver cards run from the DB secondary colour on the left to primary on the right. */
BTG.teamBandForReversed = function (name) {
  return BTG.teamBand(BTG.teamRgbSecondaryFor(name), BTG.teamRgbFor(name));
};

/* ── Flags ────────────────────────────────────────────────────────────────── */

/** IOC 3-letter code → local SVG flag <img> HTML (Flags/{a2}.svg).
 *  `cls` is an optional class for the <img> (e.g. the home-row flag size). */
BTG.flagImg = function(ioc, w, h, cls) {
  if (!ioc) return '';
  // Common IOC → A2 mappings (plus ISO 3166-1 alpha-3 variants some exports use)
  var map = {
    GBR:'gb',SWE:'se',JPN:'jp',BRA:'br',GER:'de',RUS:'ru',AUT:'at',IND:'in',
    ITA:'it',AUS:'au',NOR:'no',MEX:'mx',RSA:'za',KEN:'ke',FRA:'fr',DEN:'dk',
    ESP:'es',FIN:'fi',USA:'us',NED:'nl',CAN:'ca',CHN:'cn',MON:'mc',SUI:'ch',
    BEL:'be',POR:'pt',ARG:'ar',NZL:'nz',THA:'th',KOR:'kr',TUR:'tr',POL:'pl',
    CZE:'cz',HUN:'hu',IRL:'ie',MAS:'my',UAE:'ae',UKR:'ua',COL:'co',CHI:'cl',
    VEN:'ve',URU:'uy',PAR:'py',PER:'pe',ECU:'ec',BOL:'bo',CRO:'hr',SRB:'rs',
    GRE:'gr',ROU:'ro',BUL:'bg',SVK:'sk',SVN:'si',EST:'ee',LVA:'lv',LTU:'lt',
    ISL:'is',LUX:'lu',AND:'ad',SMR:'sm',LIE:'li',MONACO:'mc',MCO:'mc',
    // Middle East / Asia / others reachable from countryToIoc
    KSA:'sa',QAT:'qa',BHR:'bh',SGP:'sg',INA:'id',ISR:'il',
    // ISO 3166-1 alpha-3 variants (some exports use these instead of IOC)
    DEU:'de',NLD:'nl',PRT:'pt',CHE:'ch',DNK:'dk',GRC:'gr',IRL:'ie',
    ZAF:'za',MYS:'my',ARE:'ae',SAU:'sa',IDN:'id',PHI:'ph',
    // UK nations
    NIR:'gb-nir',ENG:'gb-eng',SCT:'gb-sct',WLS:'gb-wls'
  };
  var code = String(ioc).trim();
  // Skip placeholders / em-dashes that aren't real nation codes
  if (!code || code === '—' || code === '-') return '';
  var a2 = map[code] || code.toLowerCase();
  // Only emit when it looks like a valid A2 code (letters)
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(a2)) return '';
  w = w || 24; h = h || 18;
  return '<img' + (cls ? ' class="' + String(cls) + '"' : '') + ' src="Flags/' + a2 + '.svg"'
    + ' width="' + w + '" height="' + h + '" alt="' + code + '" loading="lazy"'
    + ' onerror="this.style.visibility=\'hidden\';"'
    + ' style="object-fit:cover;border-radius:1px;">';
};

/* ── Skill Weights ────────────────────────────────────────────────────────── */

BTG.SKILL_WEIGHTS = {
  cornering: 0.20, braking: 0.18, accuracy: 0.15, control: 0.14,
  reactions: 0.11, overtaking: 0.08, defending: 0.07, smoothness: 0.05,
  adaptability: 0.02
};

/** Compute weighted OVR from skills object. */
BTG.computeOvr = function(skills) {
  var sum = 0;
  for (var k in BTG.SKILL_WEIGHTS) {
    sum += (skills[k] || 0) * BTG.SKILL_WEIGHTS[k];
  }
  return Math.round(sum * 10) / 10;
};

/* ── Formatting ───────────────────────────────────────────────────────────── */

BTG.fmtOvr = function(v) { return (v || 0).toFixed(1); };

/* ── Icons (line style, 24px grid) ───────────────────────────────────────────
   BTG.icon(name, size, extraClass) → inline <svg>. Replaces emoji/symbols site-wide.
   BTG.iconize(escapedHtml) swaps ✓ ✗ ⚠ ★ ☆ → ← ↑ ↓ in already-escaped text. */
BTG.ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  'star-fill': '<path fill="currentColor" d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  finish: '<path d="M4 22V3"/><path d="M4 3h16v11H4"/><path d="M4 3h4v4H4zM12 3h4v4h-4zM8 7h4v3.5H8zM16 7h4v3.5h-4zM4 10.5h4V14H4zM12 10.5h4V14h-4z" fill="currentColor" stroke="none"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  crown: '<path d="m2 6 4.5 11h11L22 6l-6 5-4-7-4 7z"/><path d="M5 21h14"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  medal: '<path d="M7.2 2h3.6l2.2 5.5M16.8 2h-3.6l-1 2.5"/><circle cx="12" cy="15" r="6"/><path d="M12 12.5v5"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1M12 18h1M7 18h1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'trending-up': '<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 0-1 1.03V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
};
BTG.icon = function (name, size, cls) {
  BTG._iconCss();
  var s = size || 16;
  return '<svg class="ic ic-' + name + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (BTG.ICONS[name] || '') + '</svg>';
};
BTG._iconCss = function () {
  if (BTG._iconCssDone || typeof document === 'undefined' || !document.head) return;
  BTG._iconCssDone = true;
  var st = document.createElement('style');
  st.textContent = '.ic{display:inline-block;flex:none;vertical-align:-.15em}.ic-ok{color:#22c55e}.ic-err{color:#ef4444}.ic-warn{color:#f5a524}.ic-gold{color:#f5b400}'
    + '.ic-txt{display:inline-flex;align-items:center;gap:6px}button .ic,.action .ic{vertical-align:-.18em}';
  document.head.appendChild(st);
};
BTG.iconize = function (html) {
  return String(html == null ? '' : html)
    .replace(/✓/g, BTG.icon('check', 15, 'ic-ok'))
    .replace(/[✗✕]/g, BTG.icon('x', 15, 'ic-err'))
    .replace(/⚠️?/g, BTG.icon('alert', 15, 'ic-warn'))
    .replace(/★/g, BTG.icon('star-fill', 14, 'ic-gold'))
    .replace(/☆/g, BTG.icon('star', 14))
    .replace(/→/g, BTG.icon('arrow-right', 14))
    .replace(/←/g, BTG.icon('arrow-left', 14))
    .replace(/↑/g, BTG.icon('arrow-up', 14))
    .replace(/↓/g, BTG.icon('arrow-down', 14));
};
/* Status line text (e.g. '✓ Saved') → icon + escaped text. */
BTG.statusHtml = function (text) { return BTG.iconize(BTG.esc(text)); };

BTG.esc = function(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/** Group drivers by series. Returns { seriesId: [drivers] }. */
BTG.groupBySeries = function(drivers) {
  var groups = {};
  (drivers || []).forEach(function(d) {
    var s = d.series || 'Unknown';
    if (!groups[s]) groups[s] = [];
    groups[s].push(d);
  });
  return groups;
};

/* ── Modal ────────────────────────────────────────────────────────────────── */

BTG.openModal = function(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
};
BTG.closeModal = function(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  BTG.resetTeamColors();
};
BTG.bgClose = function(e, id) {
  if (e.target === document.getElementById(id)) BTG.closeModal(id);
};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(function(el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
    });
    BTG.resetTeamColors();
  }
});

/* ── Sharpest track photo ───────────────────────────────────────────────────
   Each circuit can have up to three photos (tracks/<name>.webp, <name>2.webp,
   <name>3.webp). Load them and resolve with the one that has the most pixels,
   so dropping a higher-resolution file in under any of those names upgrades
   every page automatically. Resolves to {url, w, h} or null. Cached. */
BTG._trackImgCache = BTG._trackImgCache || {};
BTG.bestTrackImage = function (base) {
  if (!base) return Promise.resolve(null);
  if (BTG._trackImgCache[base]) return BTG._trackImgCache[base];
  var names = [base, base + '2', base + '3'];
  var loads = names.map(function (n) {
    return new Promise(function (resolve) {
      var im = new Image();
      var url = 'tracks/' + encodeURIComponent(n) + '.webp';
      im.onload = function () { resolve({ url: url, w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = function () { resolve(null); };
      im.src = url;
    });
  });
  BTG._trackImgCache[base] = Promise.all(loads).then(function (list) {
    var best = null;
    list.forEach(function (x) { if (x && (!best || x.w * x.h > best.w * best.h)) best = x; });
    return best;
  });
  return BTG._trackImgCache[base];
};
/** Width (px) from which a photo is sharp enough to fill a full-width banner. */
BTG.HD_TRACK_WIDTH = 1400;
