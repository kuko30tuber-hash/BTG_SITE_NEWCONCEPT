/* Shared helpers for turning a post into a news article (used by
   discord-news.mjs and news-from-issue.mjs). */
import fs from 'node:fs/promises';
import path from 'node:path';

const GROQ_API = process.env.GROQ_API || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const MODELS = [process.env.GROQ_MODEL, 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'].filter(Boolean);
export const SERIES = ['F1', 'F2', 'XGT'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const hasGroq = () => !!GROQ_KEY;

export async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
export async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

export async function downloadImage(url, dir, baseName, headers = {}) {
  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (type && !/^image\//.test(type)) return null;
    const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : /gif/.test(type) ? 'gif' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 15 * 1024 * 1024) return null;
    const file = `${baseName}.${ext}`;
    await fs.writeFile(path.join(dir, file), buf);
    return file;
  } catch { return null; }
}

export function publishedMeta(dateLike) {
  const d = new Date(dateLike);
  return `Published: ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* ── Groq ────────────────────────────────────────────────────────────────── */
const SYSTEM = `You are the news editor of BeTheGrid, a sim-racing league website with F1, F2 and XGT championships.
Turn one Discord announcement into a short news article. Rules:
- Use ONLY facts stated in the post. Never invent results, quotes, numbers, dates or names.
- If the post is very short, write a short article (1-2 paragraphs). Do not pad it.
- Write in English, clear sports-news style. No emojis, no hashtags, no markdown.
- Do not mention Discord or "the post".
Return JSON only:
{"title": "headline, max 90 characters",
 "kicker": "1-3 word label, e.g. Race Report, Transfer, Announcement, Results, Calendar",
 "series": "F1" | "F2" | "XGT" | "General",
 "tags": ["up to 3 short tags, e.g. team or driver names"],
 "paragraphs": ["paragraph 1", "paragraph 2", "..."],
 "caption": "short image caption, or empty string"}`;

export class RateLimited extends Error {}

export async function groqArticle(text, hasImages) {
  let lastErr;
  for (const model of [...new Set(MODELS)]) {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Post${hasImages ? ' (has an image attached)' : ''}:\n"""\n${text.slice(0, 6000)}\n"""` }
        ]
      })
    });
    if (res.status === 429) throw new RateLimited('Groq rate limit reached');
    if (res.status === 404 || res.status === 400) { lastErr = new Error('Groq model ' + model + ': ' + (await res.text()).slice(0, 200)); continue; }
    if (!res.ok) throw new Error('Groq ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (!json.title || !Array.isArray(json.paragraphs) || !json.paragraphs.length) throw new Error('Groq returned an incomplete article');
    return json;
  }
  throw lastErr || new Error('No Groq model worked');
}

/** No-AI fallback: first line = headline, rest = body, series by keyword. */
export function plainArticle(text) {
  const lines = text.split('\n').map((l) => l.replace(/[*_~`>#]+/g, '').trim()).filter(Boolean);
  const title = (lines.shift() || 'News from the paddock').slice(0, 110);
  const series = SERIES.find((s) => new RegExp('\\b' + s + '\\b', 'i').test(text)) || 'General';
  const paragraphs = lines.join('\n').split(/\n{2,}|\n/).filter(Boolean);
  return { title, kicker: 'News', series, tags: [], paragraphs: paragraphs.length ? paragraphs : [title], caption: '' };
}



/** Write news/<slug>.json and add it to the top of news/manifest.json. */
export async function saveArticle(newsDir, slug, art, files, dateLike, extra = {}) {
  const series = SERIES.includes(String(art.series).toUpperCase()) ? String(art.series).toUpperCase() : null;
  const tags = [...new Set([series, ...(art.tags || [])].filter(Boolean).map((t) => String(t).slice(0, 30)))].slice(0, 4);
  const body = (art.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('\n')
    + files.slice(1).map((f) => `\n<p><img src="images/${esc(f)}" alt=""></p>`).join('');
  await writeJson(path.join(newsDir, slug + '.json'), {
    kicker: String(art.kicker || 'News').slice(0, 30),
    section: series || 'Paddock',
    tags,
    title: String(art.title).slice(0, 140),
    meta: publishedMeta(dateLike),
    image: files[0] ? 'images/' + files[0] : '',
    caption: files[0] ? String(art.caption || '').slice(0, 160) : '',
    body: body || '<p></p>',
    ...extra
  });
  const manifestFile = path.join(newsDir, 'manifest.json');
  const manifest = await readJson(manifestFile, { articles: [] });
  if (!Array.isArray(manifest.articles)) manifest.articles = [];
  if (!manifest.articles.includes(slug)) manifest.articles.unshift(slug);
  await writeJson(manifestFile, manifest);
}
