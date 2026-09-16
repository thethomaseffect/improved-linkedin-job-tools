'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  const examplePath = path.join(ROOT, '.env.example');
  const localPath = path.join(ROOT, '.env');
  const example = fs.existsSync(examplePath) ? parseEnv(read(examplePath)) : {};
  const local = fs.existsSync(localPath) ? parseEnv(read(localPath)) : {};
  return { ...example, ...local };
}

function parseKeywords(markdown) {
  const items = [];
  const seen = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    const term = match[1].replace(/\s+#.*$/, '').trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(term);
  }
  return items;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inList = null;
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!inList) return;
    html.push(`</${inList}>`);
    inList = null;
  }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
    } else if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? 'ol' : 'ul';
      if (!inList) {
        html.push(`<${tag}>`);
        inList = tag;
      } else if (inList !== tag) {
        html.push(`</${inList}>`);
        html.push(`<${tag}>`);
        inList = tag;
      }
      html.push(`<li>${inlineMarkdown(line.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''))}</li>`);
    } else if (line.trim() === '---') {
      flushParagraph();
      flushList();
      html.push('<hr>');
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  flushList();
  return html.join('\n');
}

const FEATURE_CATALOG = [
  {
    env: 'FEATURE_EXPAND_DESCRIPTION',
    title: 'Expand job descriptions',
    description: 'Clicks the visible “more” control on the About the job panel so the full posting is searchable.',
  },
  {
    env: 'FEATURE_HIGHLIGHT_SKILLS',
    title: 'Highlight skills in the posting',
    description: 'Marks strong matches green, rusty skills yellow, and unwanted terms red.',
  },
  {
    env: 'FEATURE_HIGHLIGHT_JOB_CARDS',
    title: 'Colour job cards',
    description: 'Viewed or applied listings get a light red wash; promoted listings get a light yellow wash.',
  },
  {
    env: 'FEATURE_DISMISS_POST_APPLY',
    title: 'Dismiss the post-apply modal',
    description: 'Closes “turn your resume into a profile” / “your application was sent” when a Not now button is present.',
  },
  {
    env: 'FEATURE_HIDE_AI_WIDGET',
    title: 'Hide the AI feedback widget',
    description: 'Removes the “is this information helpful?” prompt that sits on top of the description.',
  },
  {
    env: 'FEATURE_CONFIRM_APPLIED',
    title: 'Confirm “did you apply?”',
    description: 'Always clicks Yes on LinkedIn’s “did you apply for this job?” prompt so the listing is marked as seen.',
  },
];

function isFeatureEnabled(value) {
  if (value == null || String(value).trim() === '') return true;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function parseFeatures(fileEnv) {
  const flags = {};
  for (const feature of FEATURE_CATALOG) {
    flags[feature.env] = isFeatureEnabled(fileEnv[feature.env]);
  }
  return flags;
}

function applyFeatureBlocks(template, flags) {
  const pattern = /\{\{#([A-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let current = template;
  let previous;
  do {
    previous = current;
    current = current.replace(pattern, (_, key, body) => {
      if (!(key in flags)) {
        throw new Error(`Unknown feature block ${key}`);
      }
      return flags[key] ? body : '';
    });
  } while (current !== previous);
  return current;
}

function featureListHtml(flags) {
  return (
    '<ul class="feature-list">\n' +
    FEATURE_CATALOG.map((feature) => {
      const on = flags[feature.env];
      const mark = on ? '✓' : '✗';
      const state = on ? 'Included' : 'Not included';
      return [
        `  <li class="${on ? 'on' : 'off'}">`,
        `    <span class="mark" aria-hidden="true">${mark}</span>`,
        `    <div>`,
        `      <span class="visually-hidden">${state}. </span>`,
        `      <strong>${escapeHtml(feature.title)}</strong>`,
        `      <code>${escapeHtml(feature.env)}</code>`,
        `      <span class="desc">${escapeHtml(feature.description)}</span>`,
        `    </div>`,
        `  </li>`,
      ].join('\n');
    }).join('\n') +
    '\n</ul>'
  );
}

function fill(template, vars) {
  return template.replace(/\{\{\{([A-Z0-9_]+)\}\}\}|\{\{([A-Z0-9_]+)\}\}/g, (_, rawKey, escapedKey) => {
    const key = rawKey || escapedKey;
    if (!(key in vars)) {
      throw new Error(`Missing template variable ${key}`);
    }
    return String(vars[key]);
  });
}

function tidyGeneratedJs(source) {
  return source.replace(/\n{3,}/g, '\n\n');
}

function formatJsArray(items) {
  if (!items.length) return '[]';
  return '[\n        ' + items.map((item) => JSON.stringify(item)).join(',\n        ') + '\n    ]';
}

function chips(items, kind) {
  return items
    .map((item) => `<span class="chip chip-${kind}">${escapeHtml(item)}</span>`)
    .join('\n        ');
}

function joinUrl(origin, basePath, filename) {
  const originPart = origin.replace(/\/+$/, '');
  const pathPart = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const withSlash = pathPart.endsWith('/') ? pathPart : `${pathPart}/`;
  return `${originPart}${withSlash}${filename}`;
}

function siteHomepage(origin, basePath) {
  const originPart = origin.replace(/\/+$/, '');
  const pathPart = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const withSlash = pathPart.endsWith('/') ? pathPart : `${pathPart}/`;
  return `${originPart}${withSlash}`;
}

function build() {
  const fileEnv = loadEnv();
  const githubRepository =
    process.env.GITHUB_REPOSITORY || fileEnv.GITHUB_REPOSITORY;
  if (!githubRepository || !githubRepository.includes('/')) {
    throw new Error('GITHUB_REPOSITORY is missing (expected owner/repo).');
  }

  const [owner, repoName] = githubRepository.split('/');
  const siteOrigin = fileEnv.SITE_ORIGIN || `https://${owner}.github.io`;
  const siteBasePath = fileEnv.SITE_BASE_PATH || `/${repoName}/`;
  const scriptFilename = fileEnv.SCRIPT_FILENAME || 'linkedin-job-tools.user.js';
  const homepage = siteHomepage(siteOrigin, siteBasePath);
  const downloadUrl = joinUrl(siteOrigin, siteBasePath, scriptFilename);
  const repoUrl = `https://github.com/${githubRepository}`;

  const flags = parseFeatures(fileEnv);
  const strong = parseKeywords(read(path.join(DATA, 'keywords', 'strong.md')));
  const rusty = parseKeywords(read(path.join(DATA, 'keywords', 'rusty.md')));
  const unwanted = parseKeywords(read(path.join(DATA, 'keywords', 'unwanted.md')));
  const siteHtml = markdownToHtml(read(path.join(DATA, 'site.md')));

  const vars = {
    SCRIPT_NAME: fileEnv.SCRIPT_NAME,
    SCRIPT_VERSION: fileEnv.SCRIPT_VERSION,
    SCRIPT_AUTHOR: fileEnv.SCRIPT_AUTHOR,
    SCRIPT_DESCRIPTION: fileEnv.SCRIPT_DESCRIPTION,
    SCRIPT_FILENAME: scriptFilename,
    SCRIPT_NAMESPACE: homepage,
    SCRIPT_HOMEPAGE: homepage,
    SCRIPT_DOWNLOAD_URL: downloadUrl,
    SITE_TITLE: fileEnv.SITE_TITLE,
    SITE_TAGLINE: fileEnv.SITE_TAGLINE,
    GITHUB_REPOSITORY: githubRepository,
    REPO_URL: repoUrl,
    COLOR_APPLIED_VIEWED: fileEnv.COLOR_APPLIED_VIEWED,
    COLOR_PROMOTED: fileEnv.COLOR_PROMOTED,
    COLOR_STRONG_BG: fileEnv.COLOR_STRONG_BG,
    COLOR_STRONG_FG: fileEnv.COLOR_STRONG_FG,
    COLOR_RUSTY_BG: fileEnv.COLOR_RUSTY_BG,
    COLOR_RUSTY_FG: fileEnv.COLOR_RUSTY_FG,
    COLOR_UNWANTED_BG: fileEnv.COLOR_UNWANTED_BG,
    COLOR_UNWANTED_FG: fileEnv.COLOR_UNWANTED_FG,
    STRONG_MATCHES: formatJsArray(strong),
    RUSTY_MATCHES: formatJsArray(rusty),
    UNWANTED_MATCHES: formatJsArray(unwanted),
    STRONG_COUNT: String(strong.length),
    RUSTY_COUNT: String(rusty.length),
    UNWANTED_COUNT: String(unwanted.length),
    STRONG_CHIPS: chips(strong, 'strong'),
    RUSTY_CHIPS: chips(rusty, 'rusty'),
    UNWANTED_CHIPS: chips(unwanted, 'unwanted'),
    SITE_HTML: siteHtml,
    FEATURE_LIST: featureListHtml(flags),
  };

  for (const key of [
    'SCRIPT_NAME',
    'SCRIPT_VERSION',
    'SCRIPT_AUTHOR',
    'SCRIPT_DESCRIPTION',
    'SITE_TITLE',
    'SITE_TAGLINE',
    'COLOR_APPLIED_VIEWED',
    'COLOR_PROMOTED',
    'COLOR_STRONG_BG',
    'COLOR_STRONG_FG',
    'COLOR_RUSTY_BG',
    'COLOR_RUSTY_FG',
    'COLOR_UNWANTED_BG',
    'COLOR_UNWANTED_FG',
  ]) {
    if (!vars[key]) throw new Error(`Missing ${key} in .env / .env.example`);
  }

  const htmlVars = { ...vars };
  const rawHtmlKeys = new Set(['SITE_HTML', 'STRONG_CHIPS', 'RUSTY_CHIPS', 'UNWANTED_CHIPS', 'FEATURE_LIST']);
  for (const [key, value] of Object.entries(htmlVars)) {
    if (!rawHtmlKeys.has(key)) htmlVars[key] = escapeHtml(value);
  }

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(
    path.join(DIST, scriptFilename),
    tidyGeneratedJs(fill(applyFeatureBlocks(read(path.join(SRC, 'script.template.js')), flags), vars))
  );
  fs.writeFileSync(
    path.join(DIST, 'index.html'),
    fill(applyFeatureBlocks(read(path.join(SRC, 'index.template.html')), flags), htmlVars)
  );
  fs.copyFileSync(path.join(SRC, 'styles.css'), path.join(DIST, 'styles.css'));
  fs.copyFileSync(path.join(SRC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  const enabled = FEATURE_CATALOG.filter((feature) => flags[feature.env]).map((feature) => feature.env);
  console.log(`Wrote ${path.relative(ROOT, DIST)} (${strong.length} strong, ${rusty.length} rusty, ${unwanted.length} unwanted)`);
  console.log(`Features: ${enabled.join(', ') || '(none)'}`);
  console.log(`Install URL: ${downloadUrl}`);
}

function preview(port = 5173) {
  build();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
  };

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.normalize(path.join(DIST, relative));
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Preview http://127.0.0.1:${port}/`);
  });
}

if (require.main === module) {
  const command = process.argv[2];
  if (command === 'preview') preview();
  else build();
}

module.exports = { build, preview };
