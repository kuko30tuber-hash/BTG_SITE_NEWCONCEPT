/* ═══════════════════════════════════════════════════════════════════════════
   League facts for news articles
   Looks up drivers and teams named in a post in the site's own data
   (cache/public-data.json) and returns plain-text facts the AI may use as
   background. Everything here is real league data — nothing is guessed.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = process.env.LEAGUE_DATA || path.join(process.cwd(), 'cache', 'public-data.json');
const NATIONS = {
  AUS: 'Australia', AUT: 'Austria', BEL: 'Belgium', BRA: 'Brazil', CAN: 'Canada', CHN: 'China', CZE: 'Czech Republic',
  DEN: 'Denmark', ESP: 'Spain', EST: 'Estonia', FIN: 'Finland', FRA: 'France', GBR: 'Great Britain', GER: 'Germany',
  GRE: 'Greece', HUN: 'Hungary', IND: 'India', IRL: 'Ireland', ITA: 'Italy', JPN: 'Japan', KEN: 'Kenya', KOR: 'South Korea',
  MEX: 'Mexico', MON: 'Monaco', NED: 'Netherlands', NOR: 'Norway', NZL: 'New Zealand', POL: 'Poland', POR: 'Portugal',
  RSA: 'South Africa', RUS: 'Russia', SUI: 'Switzerland', SVK: 'Slovakia', SWE: 'Sweden', THA: 'Thailand', TUR: 'Turkey',
  UKR: 'Ukraine', USA: 'United States', ARG: 'Argentina', CHI: 'Chile', COL: 'Colombia', UAE: 'United Arab Emirates'
};
const ord = (n) => { n = Number(n); const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let DATA = null;
async function data() {
  if (DATA) return DATA;
  try { DATA = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); } catch { DATA = {}; }
  return DATA;
}

export async function leagueFacts(text) {
  const D = await data();
  if (!D.drivers) return '';
  const hay = ' ' + norm(text) + ' ';
  const seasonYear = {}, seasonSeries = {};
  (D.race_seasons || []).forEach((s) => { seasonYear[s.season_id] = Number(s.year); seasonSeries[s.season_id] = s.series_id; });
  const raceSeason = {};
  (D.races || []).forEach((r) => { raceSeason[r.race_id] = r.season_id; });
  const teamName = (id) => { const t = (D.teams || []).find((x) => String(x.team_id) === String(id)); return t ? (t.team_name || t.team_key) : null; };
  const teamSeries = (id) => { const t = (D.teams || []).find((x) => String(x.team_id) === String(id)); return t ? t.series : ''; };
  const latestYear = Math.max(0, ...Object.values(seasonYear));
  const lines = [];

  /* ── Drivers named in the post (full name, or a unique surname) ── */
  const lastCount = {};
  (D.drivers || []).forEach((d) => { const l = norm(d.full_name).split(' ').pop(); lastCount[l] = (lastCount[l] || 0) + 1; });
  const drivers = (D.drivers || []).filter((d) => {
    const full = norm(d.full_name); if (!full) return false;
    if (hay.includes(' ' + full + ' ')) return true;
    const last = full.split(' ').pop();
    return last.length > 3 && lastCount[last] === 1 && hay.includes(' ' + last + ' ');
  }).slice(0, 4);

  drivers.forEach((d) => {
    const name = d.full_name;
    const facts = [];
    if (d.nation) facts.push(`nationality: ${NATIONS[d.nation] || d.nation}`);
    if (d.driver_number != null) facts.push(`race number: ${d.driver_number}`);
    if (d.age) facts.push(`age: ${d.age}`);
    lines.push(`DRIVER ${name} — ${facts.join(', ')}`);
    (D.contract_history || []).filter((h) => norm(h.entity_name) === norm(name))
      .sort((a, b) => Number(a.from_year || 0) - Number(b.from_year || 0))
      .forEach((h) => {
        const years = h.from_year && h.till_year ? (h.from_year === h.till_year ? `${h.from_year}` : `${h.from_year}–${h.till_year}`) : (h.from_year ? `from ${h.from_year}` : (h.till_year ? `until ${h.till_year}` : ''));
        lines.push(`- contract: ${h.role || 'role unknown'} for ${teamName(h.team_id) || 'a team'} (${h.series || teamSeries(h.team_id)})${years ? ', ' + years : ''}${h.is_current ? ', current' : ''}`);
      });
    (D.season_driver_standings || []).filter((s) => norm(s.driver_name) === norm(name))
      .sort((a, b) => (seasonYear[a.season_id] || 0) - (seasonYear[b.season_id] || 0))
      .forEach((s) => lines.push(`- ${seasonYear[s.season_id] || ''} ${seasonSeries[s.season_id] || ''} championship: ${ord(s.position)} with ${s.points} points, ${s.wins || 0} wins, ${s.podiums || 0} podiums`));
    const res = (D.race_results || []).filter((r) => norm(r.driver_name) === norm(name));
    if (res.length) {
      const fin = res.map((r) => Number(r.finish_position)).filter((p) => p > 0 && p < 99);
      const teams = [...new Set(res.map((r) => teamName(r.team_id)).filter(Boolean))];
      lines.push(`- career in this league: ${res.length} race starts, ${fin.filter((p) => p === 1).length} wins, ${fin.filter((p) => p <= 3).length} podiums, best finish ${fin.length ? ord(Math.min(...fin)) : 'n/a'}${teams.length ? ', raced for ' + teams.join(', ') : ''}`);
    } else {
      lines.push('- no race results recorded in this league yet');
    }
  });

  /* ── Teams named in the post ── */
  const identity = D.team_identity || [];
  const teams = (D.teams || []).filter((t) => {
    const names = [t.team_name, String(t.team_key || '').replace(/_/g, ' ')]
      .concat(identity.filter((i) => String(i.team_id) === String(t.team_id)).flatMap((i) => [i['Short Name'], i['Full Name']]))
      .map(norm).filter((n) => n.length > 2);
    return names.some((n) => hay.includes(' ' + n + ' '));
  }).slice(0, 3);

  teams.forEach((t) => {
    const name = t.team_name || t.team_key;
    lines.push(`TEAM ${name} — series: ${t.series}`);
    const st = (D.season_team_standings || []).filter((s) => String(s.team_id) === String(t.team_id))
      .sort((a, b) => (seasonYear[b.season_id] || 0) - (seasonYear[a.season_id] || 0))[0];
    if (st) lines.push(`- ${seasonYear[st.season_id]} ${seasonSeries[st.season_id] || t.series} constructors' standings: ${ord(st.position)} with ${st.points} points`);
    const current = (D.contract_history || []).filter((h) => String(h.team_id) === String(t.team_id) && h.is_current);
    const byRole = {};
    current.forEach((h) => {
      const isDriver = String(h.entity_type || '').toLowerCase() === 'driver';
      const label = isDriver ? `${String(h.role || 'other').toLowerCase()} driver(s)` : String(h.role || 'staff').toLowerCase();
      (byRole[label] = byRole[label] || []).push(h.entity_name);
    });
    Object.keys(byRole).forEach((label) => lines.push(`- current ${label}: ${[...new Set(byRole[label])].join(', ')}`));
    const sid = Object.keys(seasonYear).find((k) => seasonYear[k] === latestYear && seasonSeries[k] === t.series);
    const res = (D.race_results || []).filter((r) => String(r.team_id) === String(t.team_id) && String(raceSeason[r.race_id]) === String(sid));
    if (res.length) {
      const wins = res.filter((r) => Number(r.finish_position) === 1).length;
      const pods = res.filter((r) => { const p = Number(r.finish_position); return p >= 1 && p <= 3; }).length;
      lines.push(`- team results in the ${latestYear} season so far: ${wins} wins, ${pods} podiums`);
    }
  });

  return lines.join('\n');
}
