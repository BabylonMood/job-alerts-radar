'use strict';

const STATUS_KEY = 'job-alert-status';
const PREFS_KEY = 'job-alert-prefs';
const AUTO_REFRESH_MS = 15 * 60 * 1000;
const MAX_AGE_DAYS = 14;

const SOURCE_LABELS = {
  linkedin: 'LinkedIn',
  computrabajo: 'Computrabajo',
  bumeran: 'Bumeran',
  zonajobs: 'ZonaJobs',
  indeed: 'Indeed'
};

const STATUS_LABELS = {
  new: 'Nuevo',
  reviewed: 'Revisado',
  discarded: 'Descartado'
};

const LANG_LABELS = {
  es: 'Español',
  en: 'Inglés',
  pt: 'Portugués'
};

const LANG_HINTS = {
  es: ['el', 'la', 'los', 'las', 'de', 'para', 'con', 'experiencia', 'conocimientos',
       'requisitos', 'funciones', 'empresa', 'trabajo', 'remoto', 'sueldo', 'busqueda',
       'puesto', 'tareas', 'espanol', 'castellano', 'anos', 'mas', 'desde', 'entre',
       'sobre', 'usted', 'nuestro', 'nuestra'],
  en: ['the', 'and', 'with', 'experience', 'requirements', 'skills', 'job', 'work',
       'remote', 'salary', 'apply', 'company', 'team', 'you', 'we', 'our', 'english',
       'years', 'from', 'this', 'that', 'will', 'are', 'your', 'looking', 'position'],
  pt: ['para', 'com', 'experiencia', 'conhecimentos', 'requisitos', 'funcoes', 'empresa',
       'trabalho', 'remoto', 'salario', 'vaga', 'portugues', 'anos', 'mais', 'como',
       'dos', 'das', 'nao', 'voce', 'nosso', 'nossa', 'atuacao', 'beneficios']
};

let JOBS = [];
let STATUS = {};

const $ = (id) => document.getElementById(id);

function normalize(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseTerms(value) {
  return normalize(value)
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function jobText(job) {
  return normalize([
    job.title || '',
    job.company || '',
    job.snippet || '',
    (job.matched_keywords || []).join(' ')
  ].join(' '));
}

function detectLang(job) {
  const text = jobText(job);
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  const counts = new Set(tokens);
  const scores = { es: 0, en: 0, pt: 0 };
  Object.keys(LANG_HINTS).forEach((lang) => {
    LANG_HINTS[lang].forEach((word) => {
      if (counts.has(word)) scores[lang] += 1;
    });
  });
  const best = Object.keys(scores).reduce((a, b) => (scores[b] > scores[a] ? b : a), 'es');
  return scores[best] >= 2 ? best : '';
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('No se pudo guardar localmente', e);
  }
}

function timeAgo(iso) {
  const then = new Date(iso);
  if (isNaN(then)) return '—';
  const min = Math.floor((Date.now() - then.getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return 'hace ' + min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return 'hace ' + h + ' h';
  const d = Math.floor(h / 24);
  return 'hace ' + d + ' d';
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderStats() {
  $('stat-total').textContent = JOBS.length;
  $('stat-new').textContent = JOBS.filter((j) => STATUS[j.id] === 'new').length;
  $('stat-sources').textContent = new Set(JOBS.map((j) => j.source)).size;
  $('stat-last').textContent = JOBS[0] ? formatDate(JOBS[0].found_at) : '—';
}

function populateSourceFilter() {
  const sel = $('filter-source');
  sel.innerHTML = '<option value="">Todas las fuentes</option>';
  const sources = [...new Set(JOBS.map((j) => j.source))];
  sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = SOURCE_LABELS[s] || s;
    sel.appendChild(opt);
  });
  sel.value = loadJSON(PREFS_KEY, {}).source || '';
}

function restorePrefs() {
  const p = loadJSON(PREFS_KEY, {});
  $('search').value = p.search || '';
  $('filter-status').value = p.status || '';
  $('hide-discarded').checked = p.hideDiscarded !== false;
  $('hide-old').checked = p.hideOld !== false;
  $('filter-source').value = p.source || '';
  $('kw-include').value = p.kwInclude || '';
  $('kw-exclude').value = p.kwExclude || '';
  $('filter-lang').value = p.lang || '';
}

function persistPrefs() {
  saveJSON(PREFS_KEY, {
    search: $('search').value,
    source: $('filter-source').value,
    status: $('filter-status').value,
    hideDiscarded: $('hide-discarded').checked,
    hideOld: $('hide-old').checked,
    kwInclude: $('kw-include').value,
    kwExclude: $('kw-exclude').value,
    lang: $('filter-lang').value
  });
}

function buildDraft(job) {
  const kws = (job.matched_keywords || []).join(', ');
  return [
    'Asunto: Postulación - ' + job.title,
    '',
    'Hola,',
    '',
    'Me contacto en referencia a la búsqueda de ' + job.title +
      ' publicada en ' + (SOURCE_LABELS[job.source] || job.source) + '.',
    '',
    'Adjunto mi CV. Cuento con experiencia relacionada a ' + kws +
      ', y me interesa mucho la oportunidad en ' + job.company + '.',
    '',
    'Quedo atento/a a sus comentarios.',
    '',
    'Saludos cordiales,',
    '[Tu nombre]'
  ].join('\n');
}

function jobHTML(job) {
  const status = STATUS[job.id] || 'new';
  const lang = detectLang(job);
  const langChip = lang ? '<span class="lang-chip">' + LANG_LABELS[lang] + '</span>' : '';
  const kwChips = (job.matched_keywords || [])
    .map((k) => '<span class="kw">' + esc(k) + '</span>')
    .join('');
  const sourceName = SOURCE_LABELS[job.source] || esc(job.source) || 'otro';
  return [
    '<div class="job-top">',
    '  <span class="badge ' + esc(job.source) + '"><span class="dot"></span>' + esc(sourceName) + '</span>',
    '  <span class="status-tag ' + esc(status) + '">' + STATUS_LABELS[status] + '</span>',
    '</div>',
    '<h3>' + esc(job.title) + '</h3>',
    '<div class="company">' + esc(job.company) + '</div>',
    '<div class="meta"><span>' + timeAgo(job.found_at) + '</span><span>' + formatDate(job.found_at) + '</span>' + langChip + '</div>',
    '<div class="snippet">' + esc(job.snippet || '') + '</div>',
    '<div class="kw-row">' + kwChips + '</div>',
    '<div class="job-actions">',
    '  <a href="' + esc(job.url) + '" target="_blank" rel="noopener">Ver oferta &#8599;</a>',
    '  <button type="button" class="draft-btn">Generar borrador de mail</button>',
    '  <select class="status-select">',
    '    <option value="new" ' + (status === 'new' ? 'selected' : '') + '>Nuevo</option>',
    '    <option value="reviewed" ' + (status === 'reviewed' ? 'selected' : '') + '>Revisado</option>',
    '    <option value="discarded" ' + (status === 'discarded' ? 'selected' : '') + '>Descartado</option>',
    '  </select>',
    '</div>',
    '<div class="draft-box">',
    '  <textarea></textarea>',
    '  <div class="draft-actions">',
    '    <button type="button" class="copy-btn">Copiar texto</button>',
    '    <a class="link-btn" href="#">Abrir en mi correo</a>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function filteredJobs() {
  const q = normalize($('search').value.trim());
  const src = $('filter-source').value;
  const st = $('filter-status').value;
  const hideDiscarded = $('hide-discarded').checked;
  const hideOld = $('hide-old').checked;
  const include = parseTerms($('kw-include').value);
  const exclude = parseTerms($('kw-exclude').value);
  const lang = $('filter-lang').value;
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  return JOBS.filter((j) => {
    const status = STATUS[j.id] || 'new';
    const hay = jobText(j);
    const isOld = new Date(j.found_at).getTime() < cutoff;
    const matchesInclude = !include.length || include.some((t) => hay.includes(t));
    const matchesExclude = exclude.some((t) => hay.includes(t));
    const matchesLang = !lang || detectLang(j) === lang;
    return (
      (!q || hay.includes(q)) &&
      (!src || j.source === src) &&
      (!st || status === st) &&
      (!hideDiscarded || status !== 'discarded') &&
      (!hideOld || !isOld) &&
      matchesInclude &&
      !matchesExclude &&
      matchesLang
    );
  });
}

function render() {
  const list = $('job-list');
  const filtered = filteredJobs();

  list.innerHTML = '';
  $('empty-state').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach((job) => {
    const el = document.createElement('article');
    el.className = 'job';
    el.dataset.id = job.id;
    el.innerHTML = jobHTML(job);
    bindCard(el, job);
    list.appendChild(el);
  });
}

function bindCard(el, job) {
  const draftBox = el.querySelector('.draft-box');
  const textarea = el.querySelector('textarea');
  textarea.value = buildDraft(job);

  el.querySelector('.draft-btn').addEventListener('click', () => {
    draftBox.classList.toggle('open');
  });

  el.querySelector('.copy-btn').addEventListener('click', async () => {
    const ok = await copyText(textarea.value);
    const btn = el.querySelector('.copy-btn');
    const old = btn.textContent;
    btn.textContent = ok ? 'Copiado' : 'No se pudo copiar';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });

  el.querySelector('.link-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const lines = textarea.value.split('\n');
    const subject = lines[0].replace(/^Asunto:\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();
    window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  });

  el.querySelector('.status-select').addEventListener('change', (e) => {
    setStatus(job.id, e.target.value);
    if ($('hide-discarded').checked && e.target.value === 'discarded') {
      el.remove();
      $('empty-state').style.display = filteredJobs().length ? 'none' : 'block';
    }
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

function setStatus(id, status) {
  STATUS[id] = status;
  saveJSON(STATUS_KEY, STATUS);
  const card = document.querySelector('.job[data-id="' + CSS.escape(id) + '"] .status-tag');
  if (card) {
    card.className = 'status-tag ' + status;
    card.textContent = STATUS_LABELS[status];
  }
  renderStats();
}

async function loadJobs() {
  try {
    const res = await fetch('jobs.json?_=' + Date.now());
    if (!res.ok) throw new Error('no jobs.json');
    const data = await res.json();
    JOBS = Array.isArray(data) ? data : [];
    JOBS.sort((a, b) => new Date(b.found_at) - new Date(a.found_at));
  } catch (e) {
    $('job-list').innerHTML =
      '<div class="empty">No pude leer jobs.json (¿lo estás abriendo con doble clic? los ' +
      'navegadores bloquean fetch() sobre archivos locales). Corré ' +
      '<code>python3 -m http.server</code> en esta carpeta y abrí ' +
      '<code>http://localhost:8000</code>, o publicá la carpeta con GitHub Pages.</div>';
    return;
  }
  const stored = loadJSON(STATUS_KEY, {});
  STATUS = {};
  JOBS.forEach((j) => { STATUS[j.id] = stored[j.id] || j.status || 'new'; });
  populateSourceFilter();
  renderStats();
  render();
}

function resetStatus() {
  if (!confirm('¿Restablecer todos los estados a "Nuevo" en este navegador?')) return;
  STATUS = {};
  saveJSON(STATUS_KEY, {});
  renderStats();
  render();
}

function exportStatus() {
  const blob = new Blob([JSON.stringify(STATUS, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'job-alert-status.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function markAllReviewed() {
  const changed = [];
  JOBS.forEach((j) => {
    if ((STATUS[j.id] || 'new') === 'new') { STATUS[j.id] = 'reviewed'; changed.push(j.id); }
  });
  if (!changed.length) return;
  saveJSON(STATUS_KEY, STATUS);
  renderStats();
  render();
}

function applyURLParams() {
  const params = new URLSearchParams(location.search);
  if (![...params.keys()].length) return;
  const prefs = loadJSON(PREFS_KEY, {});
  if (params.has('q')) prefs.search = params.get('q');
  if (params.has('src')) prefs.source = params.get('src');
  if (params.has('status')) prefs.status = params.get('status');
  if (params.has('kw')) prefs.kwInclude = params.get('kw');
  if (params.has('ex')) prefs.kwExclude = params.get('ex');
  if (params.has('lang')) prefs.lang = params.get('lang');
  if (params.has('old')) prefs.hideOld = params.get('old') !== '0';
  if (params.has('disc')) prefs.hideDiscarded = params.get('disc') !== '0';
  saveJSON(PREFS_KEY, prefs);
}

function buildShareURL() {
  const params = new URLSearchParams();
  const search = $('search').value.trim();
  if (search) params.set('q', search);
  const src = $('filter-source').value;
  if (src) params.set('src', src);
  const status = $('filter-status').value;
  if (status) params.set('status', status);
  const kw = $('kw-include').value.trim();
  if (kw) params.set('kw', kw);
  const ex = $('kw-exclude').value.trim();
  if (ex) params.set('ex', ex);
  const lang = $('filter-lang').value;
  if (lang) params.set('lang', lang);
  if (!$('hide-old').checked) params.set('old', '0');
  if (!$('hide-discarded').checked) params.set('disc', '0');
  const qs = params.toString();
  return location.origin + location.pathname + (qs ? '?' + qs : '');
}

async function shareSearch() {
  const url = buildShareURL();
  const ok = await copyText(url);
  const btn = $('btn-share');
  const original = btn.textContent;
  btn.textContent = ok ? '¡Link copiado!' : 'No se pudo copiar';
  if (!ok) window.prompt('Copiá este link:', url);
  setTimeout(() => { btn.textContent = original; }, 1600);
}

function init() {
  applyURLParams();
  restorePrefs();

  let debounce;
  $('search').addEventListener('input', () => {
    persistPrefs();
    clearTimeout(debounce);
    debounce = setTimeout(render, 150);
  });
  $('kw-include').addEventListener('input', () => {
    persistPrefs();
    clearTimeout(debounce);
    debounce = setTimeout(render, 150);
  });
  $('kw-exclude').addEventListener('input', () => {
    persistPrefs();
    clearTimeout(debounce);
    debounce = setTimeout(render, 150);
  });
  $('filter-source').addEventListener('change', () => { persistPrefs(); render(); });
  $('filter-status').addEventListener('change', () => { persistPrefs(); render(); });
  $('filter-lang').addEventListener('change', () => { persistPrefs(); render(); });
  $('hide-discarded').addEventListener('change', () => { persistPrefs(); render(); });
  $('hide-old').addEventListener('change', () => { persistPrefs(); render(); });
  $('btn-share').addEventListener('click', shareSearch);
  $('btn-refresh').addEventListener('click', () => {
    loadJobs();
  });
  $('btn-mark-all').addEventListener('click', markAllReviewed);
  $('btn-reset-status').addEventListener('click', resetStatus);
  $('btn-export-status').addEventListener('click', exportStatus);

  setInterval(loadJobs, AUTO_REFRESH_MS);
  loadJobs();
}

init();
