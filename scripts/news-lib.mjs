/* Shared helpers for turning a post into a news article (used by
   discord-news.mjs and news-from-issue.mjs). */
import fs from 'node:fs/promises';
import path from 'node:path';
import { leagueFacts } from './league-facts.mjs';

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

const VISION_MODELS = [process.env.GROQ_VISION_MODEL, 'meta-llama/llama-4-scout-17b-16e-instruct', 'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-models/muse-spark-open'].filter(Boolean);

const VISION_RULES = `
The post comes with image(s). Read them carefully: use text that is written in the images (names, headlines,
results, dates, team names, logos with names) as facts. Never identify a person from their face or appearance —
only name people whose names are written in the image or the post. If the images contain no readable facts,
write a short neutral piece describing what is shown, without guessing who it is.`;

function parseArticle(raw) {
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  if (!json.title || !Array.isArray(json.paragraphs) || !json.paragraphs.length) throw new Error('Groq returned an incomplete article');
  return json;
}

async function callGroq(model, messages, jsonMode) {
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY },
    body: JSON.stringify({ model, temperature: 0.4, max_tokens: 1200, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}), messages })
  });
  if (res.status === 429) throw new RateLimited('Groq rate limit reached');
  if (!res.ok) { const e = new Error('Groq ' + model + ' ' + res.status + ': ' + (await res.text()).slice(0, 200)); e.status = res.status; throw e; }
  const data = await res.json();
  return parseArticle(data.choices?.[0]?.message?.content || '');
}

/** Local image files → data URLs (max 3, skip anything over ~3.5 MB). */
async function imageParts(files) {
  const parts = [];
  for (const f of files.slice(0, 3)) {
    try {
      const buf = await fs.readFile(f);
      if (buf.length > 3.5 * 1024 * 1024) continue;
      const ext = path.extname(f).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } });
    } catch {}
  }
  return parts;
}

/**
 * Write an article from a post. `imageFiles` are local paths of the post's images:
 * when the post has little or no text, a vision model reads the images too.
 */
export async function groqArticle(text, hasImages, imageFiles = []) {
  text = String(text || '');
  let lastErr;
  // 1. Vision: image-only or very short posts
  if (imageFiles.length && text.length < 280) {
    const imgs = await imageParts(imageFiles);
    if (imgs.length) {
      const userContent = [{ type: 'text', text: (text ? `Post text:\n"""\n${text}\n"""\n` : 'The post has no text, only the image(s) below.\n') + 'Write the article as JSON.' }, ...imgs];
      for (const model of [...new Set(VISION_MODELS)]) {
        for (const jsonMode of [true, false]) {
          try { return await callGroq(model, [{ role: 'system', content: SYSTEM + VISION_RULES }, { role: 'user', content: userContent }], jsonMode); }
          catch (e) {
            if (e instanceof RateLimited) throw e;
            lastErr = e;
            if (e.status === 404 || /model/i.test(e.message) && e.status === 400 && /not.*(found|exist|support)|decommission/i.test(e.message)) break; // try next model
          }
        }
      }
    }
    if (!text) throw lastErr || new Error('No vision model could read the image');
  }
  // 2. Text models
  for (const model of [...new Set(MODELS)]) {
    try {
      return await callGroq(model, [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Post${hasImages ? ' (has an image attached)' : ''}:\n"""\n${text.slice(0, 6000)}\n"""` }
      ], true);
    } catch (e) {
      if (e instanceof RateLimited) throw e;
      lastErr = e;
      if (e.status === 404 || e.status === 400) continue;
      throw e;
    }
  }
  throw lastErr || new Error('No Groq model worked');
}

const WRITER = `You are the news editor of BeTheGrid, a sim-racing league website with F1, F2 and XGT championships.
Write a news article of 3 to 4 paragraphs (each 2-4 sentences), in clear sports-news style, like formula1.com.
- Paragraph 1: the news itself, from THE NEWS section.
- Following paragraphs: background and context using ONLY facts listed in LEAGUE DATA (career, results, contracts,
  standings, team line-up). Weave them in naturally; explain why the news matters using those facts.
- Never invent anything: no quotes, no results, no numbers, no dates, no opinions attributed to people, and no facts
  that are not in THE NEWS or LEAGUE DATA. Do not speculate about the future beyond what the news says.
- If LEAGUE DATA is thin, write 3 shorter paragraphs rather than padding with invented detail.
- LEAGUE DATA describes this sim-racing league, not real-world motorsport; do not add real-world knowledge.
- No emojis, hashtags or markdown. Do not mention Discord, "the post", "the graphic" or "league data".
Return JSON only:
{"title": "headline, max 90 characters", "paragraphs": ["...", "...", "..."]}`;

async function textModels(messages) {
  let lastErr;
  for (const model of [...new Set(MODELS)]) {
    try { return await callGroq(model, messages, true); }
    catch (e) {
      if (e instanceof RateLimited) throw e;
      lastErr = e;
      if (e.status === 404 || e.status === 400) continue;
      throw e;
    }
  }
  throw lastErr || new Error('No Groq model worked');
}

/**
 * Full article: step 1 reads the post (and its images), step 2 writes a 3-4 paragraph
 * article that adds background from the league's own data. If step 2 fails, step 1's
 * article is used as-is.
 */
export async function writeArticle(text, hasImages, imageFiles = []) {
  const first = await groqArticle(text, hasImages, imageFiles);
  const news = [text ? 'Post text: ' + text : '', 'Summary of the announcement: ' + first.title + '. ' + (first.paragraphs || []).join(' ')].filter(Boolean).join('\n');
  const facts = await leagueFacts([text, first.title, ...(first.paragraphs || []), ...(first.tags || [])].join('\n'));
  try {
    const second = await textModels([
      { role: 'system', content: WRITER },
      { role: 'user', content: `THE NEWS:\n${news.slice(0, 5000)}\n\nLEAGUE DATA:\n${facts || '(none available)'}` }
    ]);
    const paras = (second.paragraphs || []).map((p) => String(p).trim()).filter(Boolean);
    if (paras.length >= 2) return { ...first, title: second.title || first.title, paragraphs: paras.slice(0, 5) };
  } catch (e) {
    if (e instanceof RateLimited) throw e;
  }
  return first;
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
