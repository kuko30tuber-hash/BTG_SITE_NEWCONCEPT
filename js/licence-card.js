/* League licence card — three styles (official, holo, pass).
   BTG.LicenceCard.render(style, data) → HTML string
   BTG.LicenceCard.bindTilt(rootEl)    → hover tilt + shine            */
(function () {
  'use strict';
  var BTG = window.BTG = window.BTG || {};
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = seed || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

  /* Decorative barcode from the licence number (not scannable). */
  function barcode(text, w, h, color) {
    var r = rng(hash(text)), x = 0, out = '';
    while (x < w) { var bw = 1 + Math.floor(r() * 3.2); if (r() > 0.42) out += '<rect x="' + x + '" y="0" width="' + bw + '" height="' + h + '"/>'; x += bw + 1; }
    return '<svg class="lc-barcode" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" fill="' + (color || 'currentColor') + '">' + out + '</svg>';
  }
  /* Decorative QR-style block (not scannable). */
  function qr(text, color) {
    var n = 21, r = rng(hash(text + 'qr')), cells = '';
    function finder(x, y) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="#fff"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3"/>'; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inF && r() > 0.52) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg class="lc-qr" viewBox="-1 -1 23 23" fill="' + (color || '#111') + '"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/>' + cells + finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7) + '</svg>';
  }
  function sig(name) { return '<span class="lc-sig">' + esc(name) + '</span>'; }
  function fld(k, v, cls) { return '<div class="lc-f' + (cls ? ' ' + cls : '') + '"><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }

  /* ── 1. Official licence (ID card) ─────────────────────────────────── */
  function official(d) {
    return '<div class="lc lc--official" style="--lc-team:' + d.color + ';--lc-team2:' + d.color2 + '">'
      + '<div class="lc-tilt"><div class="lc-card">'
      + '<div class="lc-guilloche"></div>'
      + '<header class="lc-o-head"><img src="logos/BTG.png" alt=""><div><b>BTG Racing League</b><span>International racing licence</span></div><em>' + esc(d.year) + '</em></header>'
      + '<div class="lc-o-body">'
      +   '<div class="lc-o-photo">' + d.photoHtml + '</div>'
      +   '<dl class="lc-o-fields">'
      +     fld('Surname / Given name', '<span class="lc-o-name">' + esc(d.last) + '</span> ' + esc(d.first), 'span2')
      +     fld('Licence no.', esc(d.licNo), 'mono')
      +     fld('Category', esc(d.category))
      +     fld('Nationality', (d.flagHtml || '') + ' ' + esc(d.nation || '—'))
      +     fld(d.isDriver ? 'Car no.' : 'Role', d.isDriver ? '<span class="lc-o-num">' + esc(d.number || '—') + '</span>' : esc(d.role))
      +     fld('Team', (d.teamLogoHtml || '') + ' ' + esc(d.team || '—'), 'span2')
      +   '</dl>'
      + '</div>'
      + '<div class="lc-o-foot"><div class="lc-o-sign">' + sig(d.name) + '<small>Holder\'s signature</small></div>' + barcode(d.licNo, 150, 34, '#1b1b22') + '</div>'
      + '<div class="lc-o-seal"><span>BTG</span></div>'
      + '<div class="lc-shine"></div>'
      + '</div></div></div>';
  }

  /* ── 2. Carbon holo (premium card) ─────────────────────────────────── */
  function holo(d) {
    return '<div class="lc lc--holo" style="--lc-team:' + d.color + ';--lc-team2:' + d.color2 + '">'
      + '<div class="lc-tilt"><div class="lc-card">'
      + '<div class="lc-h-carbon"></div><div class="lc-h-band"></div>'
      + '<div class="lc-h-bignum">' + esc(d.isDriver ? (d.number || '') : '') + '</div>'
      + '<header class="lc-h-head"><img src="logos/BTG.png" alt=""><span>Licence &middot; ' + esc(d.category) + '</span>' + (d.teamLogoHtml ? '<i class="lc-h-logo">' + d.teamLogoHtml + '</i>' : '') + '</header>'
      + '<div class="lc-h-photo">' + d.photoHtml + '</div>'
      + '<div class="lc-h-info">'
      +   '<div class="lc-h-role">' + esc(d.role) + '</div>'
      +   '<div class="lc-h-name">' + esc(d.first) + ' <b>' + esc(d.last) + '</b></div>'
      +   '<div class="lc-h-meta">' + (d.flagHtml ? '<span>' + d.flagHtml + ' ' + esc(d.nation) + '</span>' : '') + (d.team ? '<span>' + esc(d.team) + '</span>' : '') + (d.isDriver && d.number ? '<span>#' + esc(d.number) + '</span>' : '') + '</div>'
      +   '<div class="lc-h-bottom"><div>' + sig(d.name) + '<div class="lc-h-no">' + esc(d.licNo) + ' &middot; ' + esc(d.year) + '</div></div>' + qr(d.licNo) + '</div>'
      + '</div>'
      + '<div class="lc-foil"></div><div class="lc-shine"></div>'
      + '</div></div></div>';
  }

  /* ── 3. Paddock pass (lanyard credential) ──────────────────────────── */
  function pass(d) {
    var zones = d.isDriver ? ['1', '2', '3', '4'] : ['1', '2', '3', '4', '5'];
    return '<div class="lc lc--pass" style="--lc-team:' + d.color + ';--lc-team2:' + d.color2 + '">'
      + '<div class="lc-lanyard"></div>'
      + '<div class="lc-tilt"><div class="lc-card">'
      + '<div class="lc-p-slot"></div>'
      + '<header class="lc-p-head"><img src="logos/BTG.png" alt=""><div><b>Paddock pass</b><span>Season ' + esc(d.year) + '</span></div>' + (d.teamLogoHtml ? '<i class="lc-p-logo">' + d.teamLogoHtml + '</i>' : '') + '</header>'
      + '<div class="lc-p-photo">' + d.photoHtml + (d.isDriver && d.number ? '<span class="lc-p-num">' + esc(d.number) + '</span>' : '') + '</div>'
      + '<div class="lc-p-name">' + esc(d.first) + ' <b>' + esc(d.last) + '</b></div>'
      + '<div class="lc-p-meta">' + (d.flagHtml ? d.flagHtml + ' ' + esc(d.nation) + ' &middot; ' : '') + esc(d.team || 'BTG League') + '</div>'
      + '<div class="lc-p-role">' + esc(d.role) + '</div>'
      + '<div class="lc-p-zones">' + zones.map(function (z) { return '<span>' + z + '</span>'; }).join('') + '<small>Access</small></div>'
      + '<div class="lc-p-foot">' + sig(d.name) + barcode(d.licNo, 200, 30, '#111') + '<div class="lc-p-no">' + esc(d.licNo) + '</div></div>'
      + '<div class="lc-shine"></div>'
      + '</div></div></div>';
  }

  function bindTilt(root) {
    if (!root) return;
    root.querySelectorAll('.lc-tilt').forEach(function (t) {
      if (t.dataset.tilt) return; t.dataset.tilt = '1';
      t.addEventListener('pointermove', function (e) {
        var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(2) + 'deg');
        t.style.setProperty('--ry', ((x - 0.5) * 18).toFixed(2) + 'deg');
        t.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        t.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        t.classList.add('is-hover');
      });
      t.addEventListener('pointerleave', function () { t.classList.remove('is-hover'); t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); });
    });
  }

  BTG.LicenceCard = {
    styles: { official: official, holo: holo, pass: pass },
    render: function (style, d) { return (this.styles[style] || official)(d); },
    bindTilt: bindTilt
  };
})();
