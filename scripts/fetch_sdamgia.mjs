import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = '/Users/danis0n/site ege';
const BASE = 'https://inf-oge.sdamgia.ru';
const SEED_PATH = path.join(ROOT_DIR, 'server/src/seed-data.json');
const IMAGES_DIR = path.join(ROOT_DIR, 'server/public/task-images');

const VARIANTS = [
  { sourceId: 26618624, label: 'Вариант 2507' },
  { sourceId: 26600119, label: 'Вариант 2508' },
  { sourceId: 26619120, label: 'Вариант 2509' },
  { sourceId: 26619451, label: 'Вариант 2510' },
  { sourceId: 26715236, label: 'Вариант 2511' },
  { sourceId: 26753000, label: 'Вариант 2512' },
  { sourceId: 26753791, label: 'Вариант 2513' },
  { sourceId: 26753966, label: 'Вариант 2514' },
  { sourceId: 26758293, label: 'Вариант 2515' },
  { sourceId: 26758666, label: 'Вариант 2516' }
];

const TASK_LIMIT = 16;
const AUTO_CHECK_LIMIT = 12;
const responseCache = new Map();
const imageCache = new Map();

function decodeEntities(input) {
  const named = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    hellip: '...',
    mdash: '-',
    ndash: '-',
    laquo: '"',
    raquo: '"',
    shy: '',
    euro: '€'
  };

  return input
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([\da-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => (name in named ? named[name] : match));
}

function stripHtml(input) {
  const normalized = input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*p\b[^>]*>/gi, '\n')
    .replace(/<\s*\/tr\s*>/gi, '\n')
    .replace(/<\s*tr\b[^>]*>/gi, '\n')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<\s*div\b[^>]*>/gi, '\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(normalized)
    .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .replace(/\s+([)])/g, '$1')
    .trim();
}

function resolveUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }
  if (rawUrl.startsWith('/')) {
    return `${BASE}${rawUrl}`;
  }
  return `${BASE}/${rawUrl}`;
}

function contentTypeToExt(contentType) {
  const clean = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (clean === 'image/jpeg') return 'jpg';
  if (clean === 'image/png') return 'png';
  if (clean === 'image/gif') return 'gif';
  if (clean === 'image/webp') return 'webp';
  if (clean === 'image/svg+xml') return 'svg';
  if (clean === 'image/bmp') return 'bmp';
  return null;
}

function urlExt(remoteUrl) {
  try {
    const pathname = new URL(remoteUrl).pathname;
    const ext = path.extname(pathname).replace('.', '').toLowerCase();
    if (ext) return ext;
    return null;
  } catch (_error) {
    return null;
  }
}

async function clearImagesDir() {
  await fs.rm(IMAGES_DIR, { recursive: true, force: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

async function fetchText(url) {
  if (responseCache.has(url)) {
    return responseCache.get(url);
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CodexBot/1.0)'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed ${res.status} for ${url}`);
  }

  const text = await res.text();
  responseCache.set(url, text);
  return text;
}

function extractImageSources(htmlBlock) {
  const matches = [...htmlBlock.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  const seen = new Set();
  const unique = [];

  for (const match of matches) {
    const rawSrc = String(match[1] || '').trim();
    if (!rawSrc) continue;
    const abs = resolveUrl(rawSrc);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    unique.push(abs);
  }

  return unique;
}

function sanitizeTaskHtml(rawHtml, imagePathMap) {
  let html = String(rawHtml || '');

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?import[\s\S]*?\?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  html = html.replace(
    /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi,
    (match, before, _quote, rawSrc, after) => {
      const abs = resolveUrl(String(rawSrc || '').trim());
      const localOrRemote = imagePathMap.get(abs) || abs || rawSrc;
      return `<img${before}src="${localOrRemote}"${after}>`;
    }
  );

  html = html.replace(/\bhref=(["'])([^"']+)\1/gi, (match, _quote, rawHref) => {
    const href = String(rawHref || '').trim();
    if (!href || href.toLowerCase().startsWith('javascript:')) {
      return 'href="#"';
    }
    const abs = resolveUrl(href) || href;
    return `href="${abs}"`;
  });

  return html.trim();
}

function extractTasksFromVariantPage(html) {
  const blocks = html.split('<div class="prob_num">').slice(1);
  const tasks = [];

  for (const block of blocks) {
    const numMatch = block.match(/^(\d+)\s*<\/div>/);
    if (!numMatch) continue;

    const examNumber = Number(numMatch[1]);
    if (!Number.isFinite(examNumber) || examNumber < 1 || examNumber > TASK_LIMIT) {
      continue;
    }

    const problemIdMatch = block.match(/\/problem\?id=(\d+)/);
    if (!problemIdMatch) continue;
    const sourceProblemId = Number(problemIdMatch[1]);

    const bodyMatch = block.match(
      /class="pbody">([\s\S]*?)<\/div><\/div><div style="clear:both;margin-bottom:15px;" class="minor">/
    );
    if (!bodyMatch) continue;

    const bodyHtml = bodyMatch[1];
    const prompt = stripHtml(bodyHtml);
    if (!prompt) continue;

    const imageSources = extractImageSources(bodyHtml);

    tasks.push({
      examNumber,
      sourceProblemId,
      prompt,
      bodyHtml,
      imageSources
    });
  }

  return tasks.sort((a, b) => a.examNumber - b.examNumber);
}

function extractAnswer(problemHtml) {
  const answerMatch = problemHtml.match(
    /<div class="answer"[^>]*>\s*<span[^>]*>\s*[\s\S]*?Ответ:\s*([\s\S]*?)<\/span>/i
  );

  if (!answerMatch) return null;

  const answer = stripHtml(answerMatch[1])
    .replace(/^[:\-\s]+/, '')
    .replace(/[.\s]+$/, '')
    .trim();

  return answer || null;
}

async function fetchAnswer(problemId) {
  const url = `${BASE}/problem?id=${problemId}`;
  const html = await fetchText(url);
  return extractAnswer(html);
}

async function downloadImage(remoteUrl, sourceProblemId, imageIndex) {
  if (imageCache.has(remoteUrl)) {
    return imageCache.get(remoteUrl);
  }

  const response = await fetch(remoteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CodexBot/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed image ${response.status} for ${remoteUrl}`);
  }

  const ext = contentTypeToExt(response.headers.get('content-type')) || urlExt(remoteUrl) || 'bin';
  const filename = `${sourceProblemId}_${String(imageIndex + 1).padStart(2, '0')}.${ext}`;
  const fullPath = path.join(IMAGES_DIR, filename);

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  const publicPath = `/task-images/${filename}`;
  imageCache.set(remoteUrl, publicPath);
  return publicPath;
}

async function main() {
  await clearImagesDir();

  const data = {
    source: {
      site: BASE,
      extractedAt: new Date().toISOString(),
      variantSourceIds: VARIANTS.map((variant) => variant.sourceId),
      notes:
        'ОГЭ информатика, варианты 2507-2516, задания 1-16; задачи 13-16 без автопроверки; картинки скачаны локально.'
    },
    examTaskCount: TASK_LIMIT,
    autoCheckTaskCount: AUTO_CHECK_LIMIT,
    variants: []
  };

  const answerCache = new Map();

  for (let idx = 0; idx < VARIANTS.length; idx += 1) {
    const variant = VARIANTS[idx];
    const variantUrl = `${BASE}/test?id=${variant.sourceId}`;
    const html = await fetchText(variantUrl);
    const tasks = extractTasksFromVariantPage(html);

    const preparedTasks = [];

    for (const task of tasks) {
      const isCheckable = task.examNumber <= AUTO_CHECK_LIMIT;
      let answer = null;

      if (isCheckable) {
        if (!answerCache.has(task.sourceProblemId)) {
          const fetched = await fetchAnswer(task.sourceProblemId);
          answerCache.set(task.sourceProblemId, fetched);
        }

        answer = answerCache.get(task.sourceProblemId);
        if (!answer) {
          throw new Error(
            `Missing answer for checkable task ${task.sourceProblemId} (${variant.label}, #${task.examNumber})`
          );
        }
      }

      const imagePaths = [];
      const imagePathMap = new Map();
      for (let imageIdx = 0; imageIdx < task.imageSources.length; imageIdx += 1) {
        const remoteImage = task.imageSources[imageIdx];
        try {
          const localPath = await downloadImage(remoteImage, task.sourceProblemId, imageIdx);
          imagePaths.push(localPath);
          imagePathMap.set(remoteImage, localPath);
        } catch (error) {
          console.warn(`[warn] Failed to download image: ${remoteImage}`, error.message);
        }
      }

      const promptHtml = sanitizeTaskHtml(task.bodyHtml, imagePathMap);

      preparedTasks.push({
        examNumber: task.examNumber,
        sourceProblemId: task.sourceProblemId,
        prompt: task.prompt,
        promptHtml,
        isCheckable,
        answer,
        imagePaths
      });
    }

    const taskMap = new Map();
    for (const task of preparedTasks) {
      taskMap.set(task.examNumber, task);
    }

    const compactTasks = [];
    for (let examNumber = 1; examNumber <= TASK_LIMIT; examNumber += 1) {
      if (taskMap.has(examNumber)) {
        compactTasks.push(taskMap.get(examNumber));
      }
    }

    data.variants.push({
      internalId: idx + 1,
      title: variant.label,
      sourceTestId: variant.sourceId,
      tasks: compactTasks
    });
  }

  const missing = data.variants.filter((variant) => variant.tasks.length < TASK_LIMIT);
  if (missing.length > 0) {
    const details = missing
      .map((variant) => `${variant.title}: ${variant.tasks.length}/${TASK_LIMIT}`)
      .join(', ');
    throw new Error(`Some variants have missing tasks: ${details}`);
  }

  await fs.writeFile(SEED_PATH, JSON.stringify(data, null, 2), 'utf8');

  const imageFiles = await fs.readdir(IMAGES_DIR);
  console.log(`Saved ${data.variants.length} variants to seed-data.json`);
  console.log(`Saved ${imageFiles.length} local image files to ${IMAGES_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
