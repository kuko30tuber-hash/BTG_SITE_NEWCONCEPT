/* Public Driver Lineups — dark F1 poster.
   BTG.LineupPoster.render(host, payload, support)
   payload: { series, year, seasonLabel, logo, teams:[{id,c,c2,team,logo,dr:[{fullName,first,name,img,flag,num,numberImage,numberHidden,vacant}]}] }
   support: { [teamId]: [{name, role}] }  — reserves / juniors / affiliates */
(function () {
  'use strict';
  var BTG = window.BTG = window.BTG || {};
  var esc = function (s) { return BTG.esc ? BTG.esc(s) : String(s == null ? '' : s); };
  function lum(h) {
    var n = parseInt(String(h || '#777777').replace('#', ''), 16);
    var f = function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(n >> 16) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255);
  }
  function hex(c) { c = String(c || '#777777'); return /^#[0-9a-f]{6}$/i.test(c) ? c : (/^[0-9a-f]{6}$/i.test(c) ? '#' + c : '#777777'); }

  function driverHref(p, payload) {
    return 'drivers.html?driver=' + encodeURIComponent(p.fullName) + '&series=' + encodeURIComponent(payload.series) + '&season=' + encodeURIComponent(payload.year);
  }
  function teamHref(t, payload) {
    return 'teams.html?series=' + encodeURIComponent(payload.series) + '&season=' + encodeURIComponent(payload.year) + '&team=' + encodeURIComponent(t.id);
  }

  function driver(p, t, payload, side) {
    var num = '';
    if (!p.vacant && p.num && !p.numberHidden) {
      num = p.numberImage ? '<img class="lp-num lp-num--img" src="' + esc(p.numberImage) + '" alt="' + esc(p.num) + '">'
        : '<span class="lp-num">' + esc(p.num) + '</span>';
    }
    var photo = p.img ? '<img class="lp-photo" src="' + esc(p.img) + '" alt="" loading="lazy">' : '<span class="lp-photo lp-photo--empty"></span>';
    var name = '<span class="lp-name"><small>' + esc(p.first || '') + '</small><b>' + esc(p.name || '') + '</b></span>';
    var flag = p.flag ? '<img class="lp-flag" src="' + esc(p.flag) + '" alt="">' : '';
    var inner = '<span class="lp-drv__fig">' + num + photo + '</span><span class="lp-drv__plate">' + flag + name + '</span>';
    if (p.vacant || !p.fullName) return '<div class="lp-drv lp-drv--vacant lp-drv--' + side + '">' + inner + '</div>';
    return '<a class="lp-drv lp-drv--' + side + '" href="' + driverHref(p, payload) + '" title="' + esc(p.fullName) + '">' + inner + '</a>';
  }

  function supportRow(list, t, payload) {
    if (!list || !list.length) return '';
    return '<div class="lp-res"><span class="lp-res__label">Reserves &amp; juniors</span><div class="lp-res__list">'
      + list.map(function (d) {
          var ph = BTG.driverPhotoImg ? BTG.driverPhotoImg(d.name, 34, 'lp-res__img', payload.year) : '';
          return '<a class="lp-chip" href="' + driverHref({ fullName: d.name }, payload) + '">' + '<span class="lp-chip__ph">' + ph + '</span>'
            + '<span class="lp-chip__txt"><b>' + esc(d.name) + '</b><em>' + esc(d.role) + '</em></span></a>';
        }).join('')
      + '</div></div>';
  }

  function team(t, i, payload, support) {
    var c = hex(t.c), c2 = hex(t.c2 || t.c), ink = lum(c) > .45 ? '#111' : '#fff';
    var drs = t.dr || [], half = Math.ceil(drs.length / 2);
    var left = drs.slice(0, half).map(function (p) { return driver(p, t, payload, 'l'); }).join('');
    var right = drs.slice(half).map(function (p) { return driver(p, t, payload, 'r'); }).join('');
    var logo = t.logo ? '<img src="' + esc(t.logo) + '" alt="' + esc(t.team) + '">' : '<span>' + esc(t.team) + '</span>';
    return '<article class="lp-team" data-n="' + drs.length + '" style="--c:' + c + ';--c2:' + c2 + ';--ink:' + ink + ';--i:' + i + '">'
      + '<div class="lp-team__stage">'
      +   '<div class="lp-team__band"></div>'
      +   '<div class="lp-side lp-side--l">' + left + '</div>'
      +   '<a class="lp-logo" href="' + teamHref(t, payload) + '" title="' + esc(t.team) + '">' + logo + '</a>'
      +   '<div class="lp-side lp-side--r">' + right + '</div>'
      + '</div>'
      + '<a class="lp-team__bar" href="' + teamHref(t, payload) + '"><span>' + esc(t.team) + '</span>' + (BTG.icon ? BTG.icon('arrow-right', 14) : '') + '</a>'
      + supportRow(support && support[String(t.id)], t, payload)
      + '</article>';
  }

  function render(host, payload, support) {
    if (!host || !payload) return;
    var teams = payload.teams || [];
    var drivers = teams.reduce(function (n, t) { return n + (t.dr || []).filter(function (d) { return !d.vacant; }).length; }, 0);
    host.innerHTML = '<section class="lp-poster" data-series="' + esc(payload.series) + '">'
      + '<div class="lp-poster__bg"></div>'
      + '<header class="lp-head">'
      +   (payload.logo ? '<img class="lp-head__series" src="' + esc(payload.logo) + '" alt="' + esc(payload.series) + '">' : '')
      +   '<div class="lp-head__title"><span class="lp-head__kicker">' + esc(payload.seasonLabel || payload.year) + ' season</span><h2>Driver <b>line-up</b></h2></div>'
      +   '<div class="lp-head__stats"><div><b>' + teams.length + '</b><span>Teams</span></div><div><b>' + drivers + '</b><span>Drivers</span></div></div>'
      + '</header>'
      + '<div class="lp-grid">' + teams.map(function (t, i) { return team(t, i, payload, support); }).join('') + '</div>'
      + '<footer class="lp-foot"><img src="logos/BTG.png" alt="BeTheGrid"><span>BeTheGrid league</span></footer>'
      + '</section>';
  }

  BTG.LineupPoster = { render: render };
})();
