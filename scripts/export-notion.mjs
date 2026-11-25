#!/usr/bin/env node
/*
 * Esporta il database Notion «☄️ astrobit» in data/data.json e data/bodies.json,
 * nella stessa forma che l'app riceveva dal connettore Notion di Claude.
 *
 *   NOTION_TOKEN=secret_... node scripts/export-notion.mjs [--full]
 *
 * Variabili opzionali:
 *   FULL=1              rilegge tutti i corpi (di default solo le pagine modificate)
 *   NOTION_API_BASE     endpoint alternativo (test)
 *   MIN_INTERVAL_MS     pausa minima tra le richieste (default 350, ~3 richieste/s)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(process.env.OUT_DIR || join(ROOT, "data"));
const API = (process.env.NOTION_API_BASE || "https://api.notion.com").replace(/\/$/, "");
const VERSION = "2026-03-11";
const TOKEN = process.env.NOTION_TOKEN;
const FULL = process.env.FULL === "1" || process.argv.includes("--full");
const MIN_INTERVAL = Number(process.env.MIN_INTERVAL_MS || 350);

/* data source del database «☄️ astrobit» (gli ID delle collection:// di Notion) */
const SOURCES = {
  atomi: {
    id: "2a0752f1-f8bc-8115-9858-000b04b52557",
    props: { Nome: "title", Livello: "number", Tipologia: "select", Tag: "multi", "📚 Corsi": "rel", Sezione: "rel", "Revisione Andrea": "check", "Revisione Omar": "check", "Revisione AI": "check" }
  },
  corsi: { id: "2a0752f1-f8bc-816f-aede-000b42a6a7af", props: { Nome: "title", "Anno Accademico": "select" } },
  sezioni: { id: "f081dea5-8b95-4abe-8a69-a52857a5d9f0", props: { Nome: "title", Corso: "rel", Ordine: "number" } },
  risorse: { id: "2a0752f1-f8bc-8162-9fac-000b7995021a", props: { Nome: "title", Tipologia: "select", Corso: "rel" } }
};

if (!TOKEN) { console.error("Manca NOTION_TOKEN (secret del repository)."); process.exit(1); }

/* ---------- HTTP con limite di frequenza e nuovi tentativi ---------- */
let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, { method = "GET", body } = {}) {
  for (let n = 0; n < 8; n++) {
    const wait = last + MIN_INTERVAL - Date.now();
    if (wait > 0) { last += MIN_INTERVAL; await sleep(wait); } else last = Date.now();
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: { Authorization: "Bearer " + TOKEN, "Notion-Version": VERSION, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { await sleep(1000 * 2 ** n); continue; }
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      await sleep(Math.max(ra * 1000, 1000 * 2 ** n));
      continue;
    }
    const err = await res.json().catch(() => ({}));
    const e = new Error(`${method} ${path.split("?")[0]} -> ${res.status} ${err.code || ""} ${err.message || ""}`.trim());
    e.status = res.status; throw e;
  }
  throw new Error(`${method} ${path.split("?")[0]}: troppi tentativi falliti`);
}

/* ---------- conversione delle proprietà ---------- */
const hex = (id) => String(id).replace(/-/g, "").toLowerCase();
const urlOf = (id) => "https://www.notion.so/" + hex(id);
const idOf = (url) => String(url).slice(-32); /* id a 32 cifre esadecimali, la chiave usata dall'app */
function wrap(s, mark) { const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); return m[2] ? m[1] + mark + m[2] + mark + m[3] : s; }
function richText(arr) {
  return (arr || []).map((t) => {
    if (t.type === "equation") return "$" + t.equation.expression + "$";
    let s = t.plain_text || "";
    const a = t.annotations || {};
    if (a.code) s = wrap(s, "`");
    if (a.bold) s = wrap(s, "**");
    if (a.italic) s = wrap(s, "*");
    if (a.strikethrough) s = wrap(s, "~~");
    return s;
  }).join("");
}
function convert(page, props) {
  const row = { url: urlOf(page.id) };
  for (const [name, kind] of Object.entries(props)) {
    const p = page.properties && page.properties[name];
    if (!p) continue;
    switch (kind) {
      case "title": row[name] = richText(p.title); break;
      case "number": if (p.number != null) row[name] = p.number; break;
      case "select": if (p.select) row[name] = p.select.name; break;
      case "multi": row[name] = (p.multi_select || []).map((o) => o.name); break;
      case "rel": row[name] = (p.relation || []).map((r) => urlOf(r.id)); break;
      case "check": row[name] = p.checkbox ? "__YES__" : "__NO__"; break;
    }
  }
  return row;
}

async function queryAll(key) {
  const { id, props } = SOURCES[key];
  const fp = Object.keys(props).map((n) => "filter_properties[]=" + encodeURIComponent(n)).join("&");
  const rows = [];
  let cursor;
  do {
    const r = await api(`/v1/data_sources/${id}/query?${fp}`, { method: "POST", body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) } });
    for (const page of r.results || []) {
      if (page.object !== "page" || page.in_trash || page.archived) continue;
      const row = convert(page, props);
      row._edited = page.last_edited_time;
      rows.push(row);
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rows.sort((a, b) => (a.url < b.url ? -1 : 1));
}

/* ---------- corpi delle pagine (Markdown di Notion) ---------- */
async function pageMarkdown(id) {
  let r;
  try { r = await api(`/v1/pages/${id}/markdown?markdown_version=v2`); }
  catch (e) { if (e.status !== 400) throw e; r = await api(`/v1/pages/${id}/markdown`); }
  let md = r.markdown || "";
  if (r.truncated && (r.unknown_block_ids || []).length) {
    for (const u of r.unknown_block_ids) {
      try { const s = await api(`/v1/pages/${u}/markdown?markdown_version=v2`); if (s.markdown) md += "\n\n" + s.markdown; }
      catch (e) { if (e.status !== 404) throw e; }
    }
  }
  return md.trim();
}

/* ---------- file di uscita ---------- */
const rowLines = (arr) => "[\n" + arr.map((r) => JSON.stringify(r)).join(",\n") + "\n]";
const readJson = async (f) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return null; } };

async function main() {
  const t0 = Date.now();
  const prev = await readJson(join(OUT, "data.json"));
  const prevBodies = (await readJson(join(OUT, "bodies.json"))) || {};
  const prevEdit = new Map(((prev && prev.atomi) || []).map((a) => [idOf(a.url), a._edited]));

  const data = {};
  for (const k of Object.keys(SOURCES)) { data[k] = await queryAll(k); console.log(`${k}: ${data[k].length}`); }
  if (!data.atomi.length) throw new Error("Nessun atomo letto: controlla che l'integrazione abbia accesso al database.");

  const bodies = {};
  let fetched = 0, kept = 0;
  const todo = [];
  for (const a of data.atomi) {
    const id = idOf(a.url);
    if (!FULL && prevBodies[id] != null && prevEdit.get(id) === a._edited) { bodies[id] = prevBodies[id]; kept++; } else todo.push(a);
  }
  for (const a of todo) {
    const id = idOf(a.url);
    try { bodies[id] = await pageMarkdown(id); fetched++; }
    catch (e) {
      /* 403/404: pagina non accessibile all'integrazione, si salta; ogni altro errore interrompe senza scrivere nulla */
      if (e.status !== 403 && e.status !== 404) throw e;
      console.warn(`corpo non leggibile (${a.Nome}): ${e.message}`);
      bodies[id] = prevBodies[id] != null ? prevBodies[id] : "";
    }
    if (fetched % 50 === 0 && fetched) console.log(`  corpi letti: ${fetched}/${todo.length}`);
  }
  const ids = Object.keys(bodies).sort();
  const sortedBodies = {}; ids.forEach((i) => { sortedBodies[i] = bodies[i]; });

  const hash = createHash("sha256").update(JSON.stringify([data, sortedBodies])).digest("hex");
  if (prev && prev.hash === hash) { console.log("Nessuna modifica rispetto all'esportazione precedente."); return; }

  await mkdir(OUT, { recursive: true });
  const dataJson = `{\n"generatedAt": ${JSON.stringify(new Date().toISOString())},\n"hash": ${JSON.stringify(hash)},\n` +
    Object.keys(SOURCES).map((k) => `${JSON.stringify(k)}: ${rowLines(data[k])}`).join(",\n") + "\n}\n";
  const bodiesJson = "{\n" + ids.map((i) => `${JSON.stringify(i)}: ${JSON.stringify(sortedBodies[i])}`).join(",\n") + "\n}\n";
  await writeFile(join(OUT, "data.json"), dataJson);
  await writeFile(join(OUT, "bodies.json"), bodiesJson);
  console.log(`Esportati ${data.atomi.length} atomi (${fetched} corpi letti, ${kept} invariati) in ${Math.round((Date.now() - t0) / 1000)} s.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
