/* Driver profile tabs — Overview / Stats / Career, three visual styles each.
   A = Broadcast (F1 TV graphics), B = Editorial (clean, typographic), C = Dashboard (charts/widgets).
   BTG.DriverTabs.render(tab, style, ctx) → HTML
   BTG.DriverTabs.data(fullName, series, season) → race rows from the league DB */
(function () {
  'use strict';
  var BTG = window.BTG = window.BTG || {};
  var esc = function (v) { return BTG.esc(v == null ? '' : v); };
  var icon = function (n, s, c) { return BTG.icon ? BTG.icon(n, s || 14, c) : ''; };

  /* ── data ─────────────────────────────────────────────────────────── */
  var CODES = { Bahrain: 'BHR', Sakhir: 'BHR', Jeddah: 'SAU', Melbourne: 'AUS', Shanghai: 'CHN', Suzuka: 'JPN', Miami: 'MIA', 'Miami Gardens': 'MIA', Imola: 'EMI',
    Monaco: 'MON', Montreal: 'CAN', Barcelona: 'ESP', 'Montmeló': 'ESP', Spielberg: 'AUT', Silverstone: 'GBR', Budapest: 'HUN', 'Mogyoród': 'HUN', Spa: 'BEL',
    Stavelot: 'BEL', Zandvoort: 'NED', Monza: 'ITA', Baku: 'AZE', Singapore: 'SIN', Austin: 'USA', 'Mexico City': 'MEX', 'São Paulo': 'BRA', Interlagos: 'BRA',
    'Las Vegas': 'LVG', Lusail: 'QAT', 'Yas Marina': 'ABU', 'Yas Island': 'ABU',
    AlbertPark: 'AUS', Bathurst: 'BAT', Brno: 'BRN', BuenosAires: 'ARG', CircuitOfTheAmericas: 'USA', Daytona: 'DAY', DubaiAutodrome: 'DUB', HermanosRodriguez: 'MEX',
    Hungaroring: 'HUN', Kyalami: 'RSA', LeMans: 'LMS', MarinaBay: 'SIN', Nurburgring: 'NUR', Qatar: 'QAT', RedBullRing: 'AUT', Sonoma: 'SON', SpaFrancorchamps: 'BEL',
    TermasRioHondo: 'TRH', Vegas: 'LVG', YasMarina: 'ABU' };
  /* "AlbertPark" → "Albert Park" */
  function nice(n) { return String(n || '').replace(/([a-z])([A-Z])/g, '$1 $2'); }
  function code(name) { name = String(name || ''); return CODES[name] || name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '—'; }
  function norm(s) { return String(s || '').trim().toLowerCase(); }

  function data(fullName, series, season) {
    var D = (BTG.DBCache && BTG.DBCache.data && BTG.DBCache.data()) || {};
    var seasonIds = (D.race_seasons || []).filter(function (s) { return String(s.series_id) === String(series) && Number(s.year) === Number(season); }).map(function (s) { return s.season_id; });
    var races = {}; (D.races || []).forEach(function (r) { if (seasonIds.indexOf(r.season_id) !== -1) races[r.race_id] = r; });
    var me = norm(fullName);
    function rowsFor(table) { return (D[table] || []).filter(function (r) { return races[r.race_id] && norm(r.driver_name) === me; }); }
    var sprints = {}; rowsFor('race_sprints').forEach(function (r) { sprints[r.race_id] = r; });
    var rows = rowsFor('race_results').map(function (r) {
      var race = races[r.race_id], sp = sprints[r.race_id];
      return { raceId: r.race_id, round: Number(race.round_number) || 0, circuit: race.circuit || race.name, country: race.country, code: code(race.circuit || race.name),
        pos: Number(r.finish_position) || null, grid: Number(r.grid_position) || null, pts: Number(r.points) || 0, bonus: Number(r.bonus_points) || 0,
        dnf: !!Number(r.dnf), status: r.status, fl: Number(r.fastest_lap_seconds) || null, ot: Number(r.successful_overtakes) || 0, otF: Number(r.failed_overtakes) || 0,
        def: Number(r.successful_defends) || 0, defF: Number(r.failed_defends) || 0, pits: Number(r.pit_stops) || 0, pen: Number(r.grid_penalty) || 0,
        sprintPos: sp ? Number(sp.finish_position) || null : null, sprintPts: sp ? Number(sp.points) || 0 : 0 };
    }).sort(function (a, b) { return a.round - b.round; });
    var all = Object.keys(races).map(function (k) { return races[k]; }).sort(function (a, b) { return a.round_number - b.round_number; });
    return { rows: rows, calendar: all };
  }

  function sum(a, f) { return a.reduce(function (n, x) { return n + (f(x) || 0); }, 0); }
  function avg(a, f) { var v = a.map(f).filter(function (x) { return x != null && !isNaN(x); }); return v.length ? v.reduce(function (n, x) { return n + x; }, 0) / v.length : null; }
  function fmt1(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function lapTime(s) { if (!s) return '—'; var m = Math.floor(s / 60), r = s - m * 60; return '<span class="dt-time">' + m + ':' + (r < 10 ? '0' : '') + r.toFixed(3) + '</span>'; }
  function posClass(r) { if (!r || r.dnf) return 'dnf'; if (r.pos === 1) return 'p1'; if (r.pos === 2) return 'p2'; if (r.pos === 3) return 'p3'; if (r.pts > 0) return 'pts'; return 'nopts'; }
  function posLabel(r) { return r.dnf ? 'DNF' : (r.pos ? 'P' + r.pos : '—'); }

  function totals(rows) {
    var fin = rows.filter(function (r) { return !r.dnf && r.pos; });
    return {
      races: rows.length, wins: rows.filter(function (r) { return r.pos === 1 && !r.dnf; }).length,
      podiums: fin.filter(function (r) { return r.pos <= 3; }).length, top10: fin.filter(function (r) { return r.pts > 0; }).length,
      poles: rows.filter(function (r) { return r.grid === 1; }).length, dnfs: rows.filter(function (r) { return r.dnf; }).length,
      pts: sum(rows, function (r) { return r.pts + r.bonus + r.sprintPts; }), sprintPts: sum(rows, function (r) { return r.sprintPts; }),
      avgGrid: avg(rows, function (r) { return r.grid; }), avgFin: avg(fin, function (r) { return r.pos; }),
      best: fin.length ? Math.min.apply(null, fin.map(function (r) { return r.pos; })) : null,
      gained: sum(fin, function (r) { return r.grid && r.pos ? r.grid - r.pos : 0; }),
      ot: sum(rows, function (r) { return r.ot; }), otF: sum(rows, function (r) { return r.otF; }),
      def: sum(rows, function (r) { return r.def; }), defF: sum(rows, function (r) { return r.defF; }),
      pits: sum(rows, function (r) { return r.pits; }), pens: sum(rows, function (r) { return r.pen; }),
      fl: rows.map(function (r) { return r.fl; }).filter(Boolean).sort(function (a, b) { return a - b; })[0] || null,
      sprints: rows.filter(function (r) { return r.sprintPos; }).length, sprintWins: rows.filter(function (r) { return r.sprintPos === 1; }).length
    };
  }
  function h2h(mine, theirs) {
    var by = {}; theirs.forEach(function (r) { by[r.raceId] = r; });
    var o = { race: [0, 0], quali: [0, 0], pts: [sum(mine, function (r) { return r.pts + r.bonus + r.sprintPts; }), sum(theirs, function (r) { return r.pts + r.bonus + r.sprintPts; })] };
    mine.forEach(function (r) { var t = by[r.raceId]; if (!t) return;
      var a = r.dnf ? 99 : r.pos || 99, b = t.dnf ? 99 : t.pos || 99; if (a !== b) o.race[a < b ? 0 : 1]++;
      if (r.grid && t.grid && r.grid !== t.grid) o.quali[r.grid < t.grid ? 0 : 1]++; });
    return o;
  }

  /* ── tiny SVG charts ──────────────────────────────────────────────── */
  function lineChart(series, opt) {
    opt = opt || {}; var W = opt.w || 560, H = opt.h || 200, P = { l: 34, r: 14, t: 14, b: 26 };
    var n = Math.max.apply(null, series.map(function (s) { return s.values.length; }).concat([1]));
    var max = opt.max || Math.max.apply(null, [1].concat(series.map(function (s) { return Math.max.apply(null, s.values.filter(function (v) { return v != null; }).concat([0])); })));
    var min = opt.min != null ? opt.min : 0, inv = !!opt.invert;
    function X(i) { return P.l + (n <= 1 ? (W - P.l - P.r) / 2 : i * (W - P.l - P.r) / (n - 1)); }
    function Y(v) { var t = (v - min) / ((max - min) || 1); return inv ? P.t + t * (H - P.t - P.b) : H - P.b - t * (H - P.t - P.b); }
    var g = '', ticks = opt.ticks || [min, Math.round((min + max) / 2), max];
    ticks.forEach(function (t) { g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" class="ch-grid"/><text x="' + (P.l - 8) + '" y="' + (Y(t) + 4) + '" class="ch-ylab" text-anchor="end">' + (opt.yfmt ? opt.yfmt(t) : t) + '</text>'; });
    (opt.labels || []).forEach(function (l, i) { g += '<text x="' + X(i) + '" y="' + (H - 6) + '" class="ch-xlab" text-anchor="middle">' + esc(l) + '</text>'; });
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return v == null ? null : [X(i), Y(v)]; }).filter(Boolean);
      if (s.area && pts.length > 1) g += '<path class="ch-area" style="fill:' + s.color + '" d="M' + pts[0][0] + ',' + Y(inv ? max : min) + ' L' + pts.map(function (p) { return p.join(','); }).join(' L') + ' L' + pts[pts.length - 1][0] + ',' + Y(inv ? max : min) + 'Z"/>';
      if (pts.length > 1) g += '<polyline class="ch-line' + (s.dash ? ' ch-dash' : '') + '" style="stroke:' + s.color + '" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
      pts.forEach(function (p) { g += '<circle class="ch-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (s.r || 4) + '" style="fill:' + s.color + '"/>'; });
    });
    return '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + g + '</svg>';
  }
  function radar(vals, labels, color) {
    var S = 240, c = S / 2, R = 88, n = vals.length, g = '';
    function pt(i, r) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; }
    [0.25, 0.5, 0.75, 1].forEach(function (k) { g += '<polygon class="rd-ring" points="' + vals.map(function (_, i) { return pt(i, R * k).join(','); }).join(' ') + '"/>'; });
    vals.forEach(function (_, i) { var p = pt(i, R); g += '<line class="rd-axis" x1="' + c + '" y1="' + c + '" x2="' + p[0] + '" y2="' + p[1] + '"/>'; var q = pt(i, R + 18); g += '<text class="rd-lab" x="' + q[0] + '" y="' + (q[1] + 4) + '" text-anchor="middle">' + esc(labels[i]) + '</text>'; });
    g += '<polygon class="rd-shape" style="fill:' + color + ';stroke:' + color + '" points="' + vals.map(function (v, i) { return pt(i, R * Math.max(.04, Math.min(1, (v || 0) / 100))).join(','); }).join(' ') + '"/>';
    vals.forEach(function (v, i) { var p = pt(i, R * Math.max(.04, Math.min(1, (v || 0) / 100))); g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" style="fill:' + color + '"/>'; });
    return '<svg class="rd" viewBox="0 0 ' + S + ' ' + S + '">' + g + '</svg>';
  }
  function ring(p, label, sub, color) {
    var r = 34, C = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p || 0));
    return '<div class="rg"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="' + r + '" class="rg-bg"/><circle cx="42" cy="42" r="' + r + '" class="rg-fg" style="stroke:' + (color || '#e10600') + ';stroke-dasharray:' + (C * v / 100) + ' ' + C + '"/></svg>'
      + '<b>' + Math.round(v) + '%</b><span>' + esc(label) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
  }
  function splitBar(label, a, b, ca, cb) {
    var t = (a + b) || 1;
    return '<div class="sb"><div class="sb-top"><b>' + a + '</b><span>' + esc(label) + '</span><b>' + b + '</b></div>'
      + '<div class="sb-bar"><i style="width:' + (a / t * 100) + '%;background:' + ca + '"></i><i style="width:' + (b / t * 100) + '%;background:' + cb + '"></i></div></div>';
  }
  function gradeColor(g) { g = String(g || ''); if (/^S/.test(g)) return '#c084fc'; if (/^A/.test(g)) return '#22c55e'; if (/^B/.test(g)) return '#84cc16'; if (/^C/.test(g)) return '#f5b400'; if (/^D/.test(g)) return '#f97316'; return '#ef4444'; }
  function sec(title, body, cls, extra) { return '<section class="dt-card' + (cls ? ' ' + cls : '') + '">' + (title ? '<header class="dt-card__h"><h3>' + title + '</h3>' + (extra || '') + '</header>' : '') + body + '</section>'; }
  function last(name) { var p = String(name || '').split(' '); return p[p.length - 1]; }

  /* ═══ OVERVIEW ═══════════════════════════════════════════════════════ */
  function overviewA(x) {
    var t = totals(x.rows), tm = x.mate, H = tm ? h2h(x.rows, tm.rows) : null;
    var form = '<div class="oa-form">' + x.calendar.map(function (race) {
      var r = x.rows.filter(function (y) { return y.raceId === race.race_id; })[0];
      return '<div class="oa-rnd ' + (r ? posClass(r) : 'future') + '"><span>' + code(race.circuit || race.name) + '</span><b>' + (r ? posLabel(r).replace('P', '') : '·') + '</b><i>' + (r && r.pts ? '+' + r.pts : '') + '</i></div>';
    }).join('') + '</div>';
    var bars = x.ratings.map(function (k) {
      return '<div class="oa-bar"><span>' + esc(k.label) + '</span><div class="oa-bar__t"><i style="width:' + Math.max(3, k.val) + '%;background:' + gradeColor(k.grade) + '"></i></div><b style="color:' + gradeColor(k.grade) + '">' + esc(k.grade) + '</b></div>';
    }).join('');
    var mate = tm ? sec('Teammate battle', '<div class="oa-h2h"><div class="oa-h2h__who"><b>' + esc(last(x.name)) + '</b><span>vs</span><b>' + esc(last(tm.name)) + '</b></div>'
      + splitBar('Race', H.race[0], H.race[1], x.color, '#8a8a94') + splitBar('Qualifying', H.quali[0], H.quali[1], x.color, '#8a8a94') + splitBar('Points', H.pts[0], H.pts[1], x.color, '#8a8a94') + '</div>', 'oa-slant') : '';
    var fav = x.fav ? sec('Favourite track', '<div class="oa-fav">' + (x.fav.flag && BTG.flagImg ? BTG.flagImg(x.fav.flag, 40, 28) : icon('flag', 28)) + '<div><b>' + esc(nice(x.fav.name || x.fav.track)) + '</b><span>' + (x.fav.best ? 'Best finish P' + x.fav.best : '') + (x.fav.type ? ' &middot; ' + esc(x.fav.type) : '') + '</span></div></div>', 'oa-slant') : '';
    return '<div class="dt dt-a">'
      + sec('Season form', form + '<div class="oa-legend"><i class="p1"></i>Win<i class="p3"></i>Podium<i class="pts"></i>Points<i class="nopts"></i>No points<i class="dnf"></i>DNF</div>', 'oa-wide oa-slant', '<span class="dt-pill">' + t.pts + ' pts</span>')
      + '<div class="oa-row">'
      +   sec('Performance', '<div class="oa-perf"><div class="oa-grade" style="--g:' + gradeColor(x.grade) + '"><b>' + esc(x.grade) + '</b><span>Season grade</span></div><div class="oa-bars">' + bars + '</div></div>', 'oa-slant')
      +   '<div class="oa-col">' + sec('', '<div class="oa-verdict" style="--c:' + x.color + '"><span>Verdict</span><b>' + esc(x.verdict) + '</b><em>' + esc(x.h2hPct) + ' head-to-head &middot; ' + esc(x.ptsShare) + ' of team points</em></div>', 'oa-flush') + mate + fav + '</div>'
      + '</div></div>';
  }
  function overviewB(x) {
    var t = totals(x.rows), tm = x.mate, H = tm ? h2h(x.rows, tm.rows) : null;
    var labels = x.rows.map(function (r) { return r.code; });
    var chart = x.rows.length ? lineChart([
      { values: x.rows.map(function (r) { return r.grid; }), color: 'rgba(255,255,255,.35)', dash: true, r: 3 },
      { values: x.rows.map(function (r) { return r.dnf ? null : r.pos; }), color: x.color, r: 5 }], { invert: true, min: 1, max: 20, ticks: [1, 10, 20], yfmt: function (v) { return 'P' + v; }, labels: labels, h: 220 }) : '<p class="dt-muted">No races yet.</p>';
    var sent = [];
    if (t.races) sent.push(t.races + ' races, ' + t.wins + ' win' + (t.wins === 1 ? '' : 's') + ' and ' + t.podiums + ' podium' + (t.podiums === 1 ? '' : 's') + '.');
    if (t.avgFin != null) sent.push('Averaging P' + fmt1(t.avgFin) + ' at the flag from P' + fmt1(t.avgGrid) + ' on the grid.');
    if (x.fav) sent.push('Strongest at ' + nice(x.fav.name || x.fav.track) + (x.fav.type ? ', a ' + String(x.fav.type).toLowerCase() + ' circuit' : '') + '.');
    return '<div class="dt dt-b">'
      + '<div class="ob-lead"><span class="ob-kicker">Season verdict</span><h2>' + esc(x.verdict) + '</h2><p>' + esc(sent.join(' ')) + '</p></div>'
      + '<div class="ob-grid">'
      +   '<div class="ob-main"><h4>Grid to flag</h4><div class="ob-key"><i style="background:' + x.color + '"></i>Finish <i class="ob-dash"></i>Grid</div>' + chart + '</div>'
      +   '<aside class="ob-side"><h4>Ratings</h4><ol class="ob-rate">' + x.ratings.map(function (k) { return '<li><span>' + esc(k.label) + '</span><em><i style="width:' + Math.max(3, k.val) + '%"></i></em><b>' + esc(k.grade) + '</b></li>'; }).join('') + '</ol>'
      +   '<div class="ob-overall">Overall <b style="color:' + gradeColor(x.grade) + '">' + esc(x.grade) + '</b></div></aside>'
      + '</div>'
      + (tm ? '<div class="ob-mate"><h4>Against ' + esc(tm.name) + '</h4><div class="ob-score">'
          + [['Races', H.race], ['Qualifying', H.quali], ['Points', H.pts]].map(function (p) { return '<div><b>' + p[1][0] + '<span>–</span>' + p[1][1] + '</b><em>' + p[0] + '</em></div>'; }).join('') + '</div></div>' : '')
      + '</div>';
  }
  function overviewC(x) {
    var t = totals(x.rows), tm = x.mate, H = tm ? h2h(x.rows, tm.rows) : null, cum = 0;
    var pts = x.rows.map(function (r) { cum += r.pts + r.bonus + r.sprintPts; return cum; });
    var tcum = 0, tpts = tm ? x.rows.map(function (r) { var o = tm.rows.filter(function (y) { return y.raceId === r.raceId; })[0]; tcum += o ? o.pts + o.bonus + o.sprintPts : 0; return tcum; }) : null;
    var series = [{ values: pts, color: x.color, area: true }]; if (tpts) series.push({ values: tpts, color: '#8a8a94', dash: true, r: 3 });
    var heat = '<div class="oc-heat">' + x.calendar.map(function (race) { var r = x.rows.filter(function (y) { return y.raceId === race.race_id; })[0];
      return '<div class="oc-cell ' + (r ? posClass(r) : 'future') + '" title="' + esc(nice(race.circuit)) + '"><b>' + (r ? posLabel(r) : '') + '</b><span>' + code(race.circuit || race.name) + '</span></div>'; }).join('') + '</div>';
    function kpi(v, k) { return '<div class="oc-kpi"><b>' + v + '</b><span>' + k + '</span></div>'; }
    return '<div class="dt dt-c"><div class="oc-grid">'
      + sec('Ratings', radar(x.ratings.map(function (k) { return k.val; }), x.ratings.map(function (k) { return k.short; }), x.color) + '<div class="oc-grade">Overall <b style="color:' + gradeColor(x.grade) + '">' + esc(x.grade) + '</b></div>', 'oc-radar')
      + sec('Points progression', lineChart(series, { labels: x.rows.map(function (r) { return r.code; }), h: 210 }) + (tm ? '<div class="ob-key"><i style="background:' + x.color + '"></i>' + esc(last(x.name)) + ' <i class="ob-dash"></i>' + esc(last(tm.name)) + '</div>' : ''), 'oc-span2')
      + sec('Results', heat, 'oc-span2')
      + sec('Verdict', '<div class="oc-verdict"><b>' + esc(x.verdict) + '</b><div class="oc-kpis">' + kpi(t.pts, 'Points') + kpi(t.wins, 'Wins') + kpi(t.podiums, 'Podiums') + kpi(esc(x.ptsShare), 'Team share') + '</div></div>')
      + (tm ? sec('Head-to-head', '<div class="oc-rings">' + ring(pct(H.race[0], H.race[0] + H.race[1]), 'Race', H.race[0] + '–' + H.race[1], x.color) + ring(pct(H.quali[0], H.quali[0] + H.quali[1]), 'Quali', H.quali[0] + '–' + H.quali[1], x.color) + '</div><div class="dt-muted oc-vs">vs ' + esc(tm.name) + '</div>') : '')
      + (x.fav ? sec('Favourite track', '<div class="oc-fav">' + (x.fav.flag && BTG.flagImg ? BTG.flagImg(x.fav.flag, 34, 24) : '') + '<b>' + esc(nice(x.fav.name || x.fav.track)) + '</b><span>' + (x.fav.best ? 'Best P' + x.fav.best : '') + (x.fav.type ? ' · ' + esc(x.fav.type) : '') + '</span></div>') : '')
      + '</div></div>';
  }

  /* ═══ STATS ══════════════════════════════════════════════════════════ */
  function statsA(x) {
    var t = totals(x.rows), l = x.lastSeason;
    function tile(v, k, prev, lowerBetter) {
      var d = '';
      if (prev != null && v !== '—' && !isNaN(Number(v)) && !isNaN(Number(prev))) { var diff = Number(v) - Number(prev); if (diff) { var up = lowerBetter ? diff < 0 : diff > 0; d = '<em class="' + (up ? 'up' : 'down') + '">' + icon(diff > 0 ? 'arrow-up' : 'arrow-down', 11) + Math.abs(Math.round(diff * 10) / 10) + '</em>'; } }
      return '<div class="sa-tile"><span>' + k + '</span><b>' + v + '</b>' + d + '</div>';
    }
    return '<div class="dt dt-a">'
      + sec('Feature races', '<div class="sa-tiles">' + tile(t.races, 'Starts', l && l.races) + tile(t.wins, 'Wins', l && l.wins) + tile(t.podiums, 'Podiums', l && l.podiums) + tile(t.poles, 'Poles') + tile(t.top10, 'Points finishes') + tile(t.dnfs, 'DNFs', l && l.dnfs, true)
        + tile(fmt1(t.avgGrid), 'Avg grid') + tile(fmt1(t.avgFin), 'Avg finish', l && l.avgFinish, true) + tile(t.best ? 'P' + t.best : '—', 'Best finish') + tile((t.gained > 0 ? '+' : '') + t.gained, 'Places gained') + tile(lapTime(t.fl), 'Best lap') + tile(t.pts, 'Points', l && l.points) + '</div>', 'oa-slant', l ? '<span class="dt-pill">vs ' + esc(l.season) + '</span>' : '')
      + '<div class="sa-two">'
      +   sec('Racecraft', '<div class="sa-craft">' + splitBar('Overtakes', t.ot, t.otF, '#22c55e', '#ef4444') + splitBar('Defences', t.def, t.defF, '#22c55e', '#ef4444') + '<div class="sa-craft__k"><i style="background:#22c55e"></i>Successful <i style="background:#ef4444"></i>Failed</div></div>', 'oa-slant')
      +   sec('Sprints & pit lane', '<div class="sa-tiles sa-tiles--3">' + tile(t.sprints, 'Sprints') + tile(t.sprintWins, 'Sprint wins') + tile(t.sprintPts, 'Sprint points') + tile(t.pits, 'Pit stops') + tile(t.pens || 0, 'Grid penalties') + tile(fmt1(t.races ? t.pits / t.races : null), 'Stops / race') + '</div>', 'oa-slant')
      + '</div></div>';
  }
  function statsB(x) {
    var t = totals(x.rows), tm = x.mate ? totals(x.mate.rows) : null, l = x.lastSeason;
    var rows = [['Starts', t.races, tm && tm.races, l && l.races], ['Wins', t.wins, tm && tm.wins, l && l.wins], ['Podiums', t.podiums, tm && tm.podiums, l && l.podiums], ['Poles', t.poles, tm && tm.poles, null],
      ['Points', t.pts, tm && tm.pts, l && l.points], ['Points finishes', t.top10, tm && tm.top10, null], ['DNFs', t.dnfs, tm && tm.dnfs, l && l.dnfs], ['Average grid', fmt1(t.avgGrid), tm && fmt1(tm.avgGrid), null],
      ['Average finish', fmt1(t.avgFin), tm && fmt1(tm.avgFin), l && l.avgFinish], ['Best finish', t.best ? 'P' + t.best : '—', tm && (tm.best ? 'P' + tm.best : '—'), null], ['Places gained', t.gained, tm && tm.gained, null],
      ['Overtakes', t.ot + ' / ' + (t.ot + t.otF), tm && (tm.ot + ' / ' + (tm.ot + tm.otF)), null], ['Defences', t.def + ' / ' + (t.def + t.defF), tm && (tm.def + ' / ' + (tm.def + tm.defF)), null],
      ['Sprint points', t.sprintPts, tm && tm.sprintPts, null], ['Pit stops', t.pits, tm && tm.pits, null], ['Best lap', lapTime(t.fl), tm && lapTime(tm.fl), null]];
    return '<div class="dt dt-b"><table class="sb-table"><thead><tr><th></th><th>' + esc(last(x.name)) + '</th>' + (tm ? '<th>' + esc(last(x.mate.name)) + '</th>' : '') + '<th>' + (l ? esc(l.season) : 'Last season') + '</th></tr></thead><tbody>'
      + rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + (r[1] == null ? '—' : r[1]) + '</td>' + (tm ? '<td>' + (r[2] == null ? '—' : r[2]) + '</td>' : '') + '<td class="sb-dim">' + (r[3] == null || r[3] === '' ? '—' : r[3]) + '</td></tr>'; }).join('')
      + '</tbody></table><p class="dt-muted">Feature-race figures for ' + esc(x.season) + '. Overtakes and defences shown as successful / attempted.</p></div>';
  }
  function statsC(x) {
    var t = totals(x.rows), fin = t.races - t.dnfs;
    var dumb = x.rows.length ? '<div class="sc-dumb">' + x.rows.map(function (r) {
      var g = r.grid || 20, f = r.dnf ? 20 : (r.pos || 20), a = Math.min(g, f), b = Math.max(g, f);
      return '<div class="sc-d"><span>' + r.code + '</span><div class="sc-d__t"><i class="sc-d__l ' + (f < g ? 'gain' : f > g ? 'loss' : '') + '" style="left:' + ((a - 1) / 19 * 100) + '%;width:' + ((b - a) / 19 * 100) + '%"></i>'
        + '<i class="sc-d__g" style="left:' + ((g - 1) / 19 * 100) + '%"></i><i class="sc-d__f ' + (r.dnf ? 'dnf' : '') + '" style="left:' + ((f - 1) / 19 * 100) + '%"></i></div><b>' + (r.grid ? 'P' + r.grid : '—') + ' ' + icon('arrow-right', 11) + ' ' + posLabel(r) + '</b></div>';
    }).join('') + '<div class="sc-dumb__k"><i class="sc-d__g"></i>Grid <i class="sc-d__f"></i>Finish <i class="gain"></i>Gained <i class="loss"></i>Lost</div></div>' : '<p class="dt-muted">No races yet.</p>';
    var bars = lineChart([{ values: x.rows.map(function (r) { return r.ot; }), color: '#22c55e' }, { values: x.rows.map(function (r) { return r.def; }), color: '#38bdf8' }], { labels: x.rows.map(function (r) { return r.code; }), h: 170 });
    return '<div class="dt dt-c"><div class="oc-grid">'
      + sec('Conversion', '<div class="oc-rings oc-rings--4">' + ring(pct(t.wins, t.races), 'Win rate', t.wins + ' of ' + t.races, x.color) + ring(pct(t.podiums, t.races), 'Podium rate', t.podiums + ' of ' + t.races, x.color)
        + ring(pct(t.top10, t.races), 'In the points', t.top10 + ' of ' + t.races, x.color) + ring(pct(fin, t.races), 'Finish rate', fin + ' of ' + t.races, '#22c55e') + '</div>', 'oc-span3')
      + sec('Grid vs finish', dumb, 'oc-span2')
      + sec('Racecraft', ring(pct(t.ot, t.ot + t.otF), 'Overtakes', t.ot + ' of ' + (t.ot + t.otF), '#22c55e') + ring(pct(t.def, t.def + t.defF), 'Defences', t.def + ' of ' + (t.def + t.defF), '#38bdf8'), 'oc-stack')
      + sec('Overtakes & defences per race', bars + '<div class="ob-key"><i style="background:#22c55e"></i>Overtakes <i style="background:#38bdf8"></i>Defences</div>', 'oc-span2')
      + sec('Numbers', '<div class="oc-kpis oc-kpis--col"><div class="oc-kpi"><b>' + fmt1(t.avgGrid) + '</b><span>Avg grid</span></div><div class="oc-kpi"><b>' + fmt1(t.avgFin) + '</b><span>Avg finish</span></div><div class="oc-kpi"><b>' + lapTime(t.fl) + '</b><span>Best lap</span></div><div class="oc-kpi"><b>' + t.pits + '</b><span>Pit stops</span></div><div class="oc-kpi"><b>' + t.sprintPts + '</b><span>Sprint pts</span></div><div class="oc-kpi"><b>' + (t.pens || 0) + '</b><span>Penalties</span></div></div>')
      + '</div></div>';
  }

  /* ═══ CAREER ═════════════════════════════════════════════════════════ */
  function careerSeasons(x) { return (x.history || []).slice().sort(function (a, b) { return b.season - a.season || (a.series < b.series ? -1 : 1); }); }
  function teamLogo(team, series, s) { return team && BTG.teamLogoImg ? BTG.teamLogoImg(team, series, s || 22) : ''; }
  function careerA(x) {
    var cr = x.career || {}, hs = careerSeasons(x);
    function big(v, k) { return '<div class="ca-big"><b>' + (v == null || v === '' ? '—' : v) + '</b><span>' + k + '</span></div>'; }
    return '<div class="dt dt-a">'
      + sec('', '<div class="ca-band" style="--c:' + x.color + '">' + big(cr.starts, 'Starts') + big(cr.wins, 'Wins') + big(cr.podiums, 'Podiums') + big(cr.points, 'Points') + big(cr.bestFinish ? 'P' + String(cr.bestFinish).replace(/^P/, '') : null, 'Best finish') + big(x.titles, 'Titles') + '</div>', 'oa-flush')
      + sec('Season by season', hs.length ? '<div class="ca-tower">' + hs.map(function (h) {
          var c = x.teamColor(h.team);
          return '<div class="ca-row" style="--c:' + c + '"><span class="ca-yr">' + esc(h.season) + '</span><span class="ca-ser">' + esc(h.series) + '</span><span class="ca-team">' + teamLogo(h.team, h.series, 20) + esc(h.team || '—') + (h.role && h.role !== 'Driving' ? '<em>' + esc(h.role) + '</em>' : '') + '</span>'
            + '<span class="ca-pos ' + (String(h.pos) === '1' ? 'p1' : '') + '">' + (h.pos && h.pos !== '—' ? 'P' + esc(h.pos) : '—') + '</span><span class="ca-n">' + (h.wins || 0) + '<i>W</i></span><span class="ca-n">' + (h.podiums || 0) + '<i>Pod</i></span><span class="ca-pts">' + (h.points != null ? esc(h.points) : '—') + '<i>pts</i></span></div>';
        }).join('') + '</div>' : '<p class="dt-muted">No completed seasons yet.</p>', 'oa-slant')
      + (x.contracts.length ? sec('Contracts', '<div class="ca-con">' + x.contracts.map(function (c) { return '<div class="ca-con__r" style="--c:' + x.teamColor(c.team_key) + '">' + teamLogo(c.team_key, c.series, 18) + '<b>' + esc(c.team_name || c.team_key) + '</b><span>' + esc(c.role) + ' &middot; ' + esc(c.series) + '</span><em>' + esc(c.from_year || '?') + '–' + esc(c.till_year || '?') + '</em></div>'; }).join('') + '</div>', 'oa-slant') : '')
      + '</div>';
  }
  function careerB(x) {
    var cr = x.career || {}, items = [];
    x.contracts.slice().sort(function (a, b) { return (b.from_year || 0) - (a.from_year || 0); }).forEach(function (c) {
      var seasons = (x.history || []).filter(function (h) { return Number(h.season) >= Number(c.from_year) && Number(h.season) <= Number(c.till_year) && (!h.series || h.series === c.series); });
      items.push({ y: (c.from_year || '?') + (c.till_year && c.till_year !== c.from_year ? '–' + c.till_year : ''), team: c.team_name || c.team_key, key: c.team_key, series: c.series, role: c.role, seasons: seasons, future: Number(c.from_year) > Number(x.season) });
    });
    if (!items.length) (x.history || []).forEach(function (h) { items.push({ y: h.season, team: h.team, key: h.team, series: h.series, role: h.role || 'Driving', seasons: [h] }); });
    return '<div class="dt dt-b"><div class="cb-intro"><span class="ob-kicker">Career</span><h2>' + esc(cr.starts || 0) + ' starts, ' + esc(cr.wins || 0) + ' wins, ' + esc(cr.points || 0) + ' points</h2>'
      + '<p>' + (cr.yrs ? esc(cr.yrs) + ' season' + (Number(cr.yrs) === 1 ? '' : 's') + ' in ' + esc(x.series) + '. ' : '') + (cr.bestFinish ? 'Best result P' + esc(String(cr.bestFinish).replace(/^P/, '')) + '.' : '') + '</p></div>'
      + '<ol class="cb-tl">' + items.map(function (it) {
        return '<li class="' + (it.future ? 'is-future' : '') + '" style="--c:' + x.teamColor(it.key) + '"><span class="cb-y">' + esc(it.y) + '</span><div class="cb-body"><div class="cb-team">' + teamLogo(it.key, it.series, 24) + '<b>' + esc(it.team) + '</b><span>' + esc(it.series) + ' &middot; ' + esc(it.role) + (it.future ? ' &middot; signed' : '') + '</span></div>'
          + (it.seasons.length ? '<p>' + it.seasons.map(function (h) { return esc(h.season) + ': ' + (h.pos && h.pos !== '—' ? 'P' + esc(h.pos) + ' in the championship, ' : '') + (h.wins || 0) + ' win' + (h.wins == 1 ? '' : 's') + ', ' + (h.podiums || 0) + ' podium' + (h.podiums == 1 ? '' : 's') + ', ' + (h.points != null ? h.points : 0) + ' points'; }).join('. ') + '.</p>' : '') + '</div></li>';
      }).join('') + '</ol></div>';
  }
  function careerC(x) {
    var cr = x.career || {}, hs = careerSeasons(x).slice().reverse();
    var years = []; x.contracts.forEach(function (c) { for (var y = Number(c.from_year); y <= Number(c.till_year); y++) if (y && years.indexOf(y) === -1) years.push(y); });
    hs.forEach(function (h) { if (years.indexOf(Number(h.season)) === -1) years.push(Number(h.season)); }); years.sort();
    var y0 = years[0], y1 = years[years.length - 1], span = (y1 - y0 + 1) || 1;
    var gantt = years.length ? '<div class="cc-gantt"><div class="cc-axis" style="--n:' + span + '">' + years.filter(function (y, i, a) { return true; }).map(function (y) { return '<span style="grid-column:' + (y - y0 + 1) + '">' + y + '</span>'; }).join('') + '</div>'
      + x.contracts.map(function (c) { var a = Number(c.from_year) || y0, b = Number(c.till_year) || a; return '<div class="cc-lane" style="--n:' + span + '"><i style="grid-column:' + (a - y0 + 1) + ' / ' + (b - y0 + 2) + ';--c:' + x.teamColor(c.team_key) + '">' + teamLogo(c.team_key, c.series, 16) + '<b>' + esc(c.team_name || c.team_key) + '</b><em>' + esc(c.role) + '</em></i></div>'; }).join('') + '</div>' : '<p class="dt-muted">No contracts on file.</p>';
    var posChart = hs.length > 1 ? lineChart([{ values: hs.map(function (h) { return Number(h.pos) || null; }), color: x.color }], { invert: true, min: 1, max: 20, ticks: [1, 10, 20], yfmt: function (v) { return 'P' + v; }, labels: hs.map(function (h) { return h.season; }), h: 180 })
      : '<div class="cc-one"><b>' + (hs[0] && hs[0].pos && hs[0].pos !== '—' ? 'P' + esc(hs[0].pos) : '—') + '</b><span>' + (hs[0] ? esc(hs[0].season) + ' championship' : 'No seasons yet') + '</span><small>Chart fills in from a second season</small></div>';
    var st = Number(cr.starts) || 0;
    return '<div class="dt dt-c"><div class="oc-grid">'
      + sec('Contract timeline', gantt, 'oc-span3')
      + sec('Championship position', posChart, 'oc-span2')
      + sec('Career rates', ring(pct(Number(cr.wins) || 0, st), 'Wins', (cr.wins || 0) + ' of ' + st, x.color) + ring(pct(Number(cr.podiums) || 0, st), 'Podiums', (cr.podiums || 0) + ' of ' + st, x.color), 'oc-stack')
      + sec('Totals', '<div class="oc-kpis oc-kpis--col">' + [['Starts', cr.starts], ['Wins', cr.wins], ['Podiums', cr.podiums], ['Points', cr.points], ['DNFs', cr.dnfs], ['Avg finish', cr.avgFinish]].map(function (k) { return '<div class="oc-kpi"><b>' + (k[1] == null || k[1] === '' ? '—' : esc(k[1])) + '</b><span>' + k[0] + '</span></div>'; }).join('') + '</div>', 'oc-span3')
      + '</div></div>';
  }

  var R = { overview: { A: overviewA, B: overviewB, C: overviewC }, stats: { A: statsA, B: statsB, C: statsC }, career: { A: careerA, B: careerB, C: careerC } };
  BTG.DriverTabs = {
    data: data, totals: totals,
    render: function (tab, style, ctx) { var f = (R[tab] || {})[style] || (R[tab] || {}).A; try { return f ? f(ctx) : ''; } catch (e) { console.error(e); return '<p class="dt-muted">Could not draw this section.</p>'; } }
  };
})();
