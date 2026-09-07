#!/usr/bin/env node
/**
 * Kiểm tra tính toàn vẹn của bản dịch — chặn "dịch sót" ngay từ CI.
 *
 * Vì sao cần: `t` hiện là một object, nên `t.khongCoThat` trả về `undefined` chứ không ném
 * lỗi, và ở hầu hết chỗ gọi nó lại được che bằng `|| "chuỗi tiếng Việt"`. Hệ quả là một
 * khoá gõ sai, hoặc một khoá quên thêm vào bảng, sẽ hiện tiếng Việt cho người dùng tiếng
 * Anh mà không có gì báo — không log, không test đỏ, không ai biết. Script này thay cho
 * cái cảnh báo đang thiếu đó: đọc bảng dịch, đọc mọi chỗ gọi trong src/, rồi đối chiếu.
 *
 * Nguyên tắc "bánh cóc" (ratchet): kho hiện đã có sẵn hàng trăm chuỗi cứng và fallback
 * trùng lặp. Bắt sửa hết mới cho build thì không ai chạy nổi, còn chỉ cảnh báo suông thì
 * lẫn vào đống cũ và vô nghĩa. Nên toàn bộ nợ cũ được đóng băng trong
 * scripts/i18n-baseline.json; script chỉ đánh trượt những chỗ PHÁT SINH THÊM so với bản
 * chụp đó. Nợ cũ chỉ có thể giảm, không thể tăng.
 *
 * Chạy:  npm run i18n:check
 *        npm run i18n:check -- --update-baseline   (sau khi đã dọn bớt nợ cũ)
 *        npm run i18n:check -- --strict            (coi mọi cảnh báo là lỗi)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'i18n-baseline.json');

/**
 * Nguồn bản dịch. Hiện cả 4 ngôn ngữ nằm chung trong LanguageContext.jsx; khi nào tách ra
 * src/i18n/locales/*.json thì chỉ cần đổi loadLocales(), phần còn lại giữ nguyên.
 */
const LOCALE_FILE = path.join(SRC, 'context', 'LanguageContext.jsx');

/**
 * Chữ trong mail gửi đi, phía backend.
 *
 * Kiểm luôn ở đây thay vì làm một script Java riêng vì đây là cùng một câu hỏi: "có chỗ
 * nào gọi ra chữ mà không có chữ để trả về không". Mail còn dễ sót hơn giao diện — khoá
 * thiếu chỉ lộ ra trong hòm thư của khách, không ai mở DevTools ở đó được.
 *
 * messages.properties là bản mặc định (tiếng Anh), messages_vi.properties là bản tiếng Việt.
 */
const MAIL_DIR = path.resolve(ROOT, '..', 'backend', 'ticket-booking', 'src', 'main', 'resources');
const MAIL_JAVA_DIR = path.resolve(ROOT, '..', 'backend', 'ticket-booking', 'src', 'main', 'java');
const MAIL_BASE_FILE = path.join(MAIL_DIR, 'messages.properties');
const MAIL_VI_FILE = path.join(MAIL_DIR, 'messages_vi.properties');

const BASE_LOCALE = 'vi';
/** Thiếu khoá ở đây là LỖI: giao diện tiếng Anh là mặt tiền chính sau tiếng Việt. */
const REQUIRED_LOCALES = ['en'];
/** Thiếu khoá ở đây chỉ CẢNH BÁO: ja/zh đang hoãn có chủ ý, đã có fallback vi → en đỡ. */
const DEFERRED_LOCALES = ['ja', 'zh'];

/**
 * Khoá được ghép động (ví dụ `t[labelKey]` với labelKey lấy từ một bảng tra) nên không
 * xuất hiện tĩnh. Tiền tố ở đây được miễn khỏi báo cáo "khoá thừa".
 */
const DYNAMIC_KEY_PREFIXES = ['vchDesc_'];

/** Ký tự có dấu tiếng Việt. Không bắt được tiếng Việt viết không dấu — hạn chế đã biết. */
const VIETNAMESE_RE =
  /[À-ÿĂăĐđĨĩŨũƠơƯưẠ-ỹ]/;

const args = new Set(process.argv.slice(2));
const UPDATE_BASELINE = args.has('--update-baseline');
const STRICT = args.has('--strict');

const errors = [];
const warnings = [];
const notes = [];

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function fail(msg) {
  console.error('\n✖ ' + msg + '\n');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Đọc bảng dịch
// ---------------------------------------------------------------------------

/** Tra số dòng từ vị trí ký tự. Dựng bảng mốc một lần thay vì slice lại chuỗi mỗi lần gọi. */
function makeLineOf(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') starts.push(i + 1);
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** Đọc một chuỗi (kể cả nhiều mảnh nối bằng `+`) bắt đầu từ vị trí i. */
function readStringValue(code, i) {
  let pos = i;
  let read = false;
  for (;;) {
    while (pos < code.length && /\s/.test(code[pos])) pos++;
    const quote = code[pos];
    if (quote !== '"' && quote !== "'" && quote !== '`') break;
    pos++;
    while (pos < code.length && code[pos] !== quote) pos += code[pos] === '\\' ? 2 : 1;
    pos++;
    read = true;
    const after = /^\s*\+/.exec(code.slice(pos, pos + 40));
    if (!after) break;
    pos += after[0].length;
  }
  return read ? pos : null;
}

/**
 * Đọc bảng dịch bằng cách quét ký tự chứ không quét dòng.
 *
 * Bản đầu quét theo dòng và trượt mất 4 khoá viết xuống dòng kiểu `key:\n  "giá trị"` —
 * đúng loại im lặng mà script này sinh ra để chặn. Quét ký tự thì cách xuống dòng, cách
 * thụt lề hay việc nối chuỗi bằng `+` đều không ảnh hưởng. Chỗ nào thật sự không đọc được
 * vẫn bị ghi vào `oddities` và báo ra, để script không bao giờ đếm thiếu rồi kết luận
 * "mọi thứ ổn".
 */
function loadLocales() {
  const raw = fs.readFileSync(LOCALE_FILE, 'utf8');
  const code = stripComments(raw);
  const lineOf = makeLineOf(code);
  const anchor = code.indexOf('const translations = {');
  if (anchor < 0) {
    fail('Không tìm thấy "const translations = {" trong ' + rel(LOCALE_FILE) + ' — bảng dịch dời đi đâu rồi? Cập nhật loadLocales().');
  }

  const locales = new Map();
  const oddities = [];
  const entry = /(?:([A-Za-z_][A-Za-z0-9_]*)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*:\s*/y;

  let i = code.indexOf('{', anchor);
  let depth = 0;
  let current = null;

  while (i < code.length) {
    const c = code[i];
    if (c === '{') { depth++; i++; continue; }
    if (c === '}') {
      depth--;
      if (depth <= 1) current = null;
      if (depth === 0) break;
      i++;
      continue;
    }
    if (c === ',' || /\s/.test(c)) { i++; continue; }

    entry.lastIndex = i;
    const m = entry.exec(code);
    if (!m) {
      oddities.push(rel(LOCALE_FILE) + ':' + lineOf(i) + '  không đọc được: ' + code.slice(i, i + 70).split('\n')[0]);
      i++;
      continue;
    }
    const key = m[1] ?? m[2] ?? m[3];
    let j = entry.lastIndex;

    if (code[j] === '{') {
      if (depth === 1) {
        current = new Map();
        locales.set(key, current);
      } else {
        oddities.push(rel(LOCALE_FILE) + ':' + lineOf(j) + '  object lồng trong "' + key + '" — khoá bên trong không được đếm');
      }
      i = j;
      continue;
    }

    const end = readStringValue(code, j);
    if (end === null) {
      oddities.push(rel(LOCALE_FILE) + ':' + lineOf(j) + '  giá trị của "' + key + '" không phải chuỗi thuần');
      i = j;
      continue;
    }
    if (current) {
      if (current.has(key)) {
        oddities.push(rel(LOCALE_FILE) + ':' + lineOf(i) + '  khoá lặp "' + key + '" (bản sau ghi đè bản trước)');
      }
      current.set(key, lineOf(i));
    }
    i = end;
  }

  return { locales, oddities };
}

// ---------------------------------------------------------------------------
// Quét mã nguồn
// ---------------------------------------------------------------------------

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__snapshots__') continue;
      collectSourceFiles(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name) && p !== LOCALE_FILE) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Bỏ chú thích nhưng giữ nguyên số dòng và mọi chuỗi. Cần bước này vì kho có rất nhiều
 * chú thích tiếng Việt dài và cả khối code cũ bị comment lại — không lọc thì báo cáo ngập
 * trong thứ không phải câu chữ giao diện.
 */
function stripComments(code) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < code.length) {
    const c = code[i];
    const d = code[i + 1];
    if (quote) {
      if (c === '\\') {
        out += c + (d ?? '');
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    // Text block của Java ("""…"""). Không bắt riêng thì bộ quét đọc ba dấu nháy thành
    // "mở rồi đóng một chuỗi rỗng, rồi mở tiếp", và từ đó về sau nó nhầm lẫn code với
    // chuỗi trên suốt phần còn lại của file — EmailService dựng khung mail bằng đúng
    // kiểu chuỗi này.
    if (c === '"' && d === '"' && code[i + 2] === '"') {
      out += '"""';
      i += 3;
      while (i < code.length && !(code[i] === '"' && code[i + 1] === '"' && code[i + 2] === '"')) {
        if (code[i] === '\n') out += '\n';
        i += code[i] === '\\' ? 2 : 1;
      }
      out += '"""';
      i += 3;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Các cách gọi khoá dịch tra được tĩnh. Chỉ những cách này mới đối chiếu được với bảng.
 *
 * Lookbehind `(?<![\p{L}\p{N}_$.])` quan trọng hơn vẻ ngoài của nó: `\b` của JavaScript chỉ
 * biết [A-Za-z0-9_], nên trong câu tiếng Việt "…duyệt. Bạn có thể…" nó coi `ệ` là ranh giới
 * từ và khớp `t. B` thành khoá "B". Chặn theo chữ cái Unicode thì hết hẳn loại nhiễu đó.
 */
const STATIC_USE_PATTERNS = [
  /(?<![\p{L}\p{N}_$.])t\??\.([A-Za-z_][A-Za-z0-9_]*)/gu,
  /(?<![\p{L}\p{N}_$.])t\??\.?\[\s*(["'])([A-Za-z_][A-Za-z0-9_]*)\1\s*\]/gu,
  /(?<![\p{L}\p{N}_$.])tr\(\s*(["'])([A-Za-z_][A-Za-z0-9_]*)\1/gu,
];

/** Gọi động: không đối chiếu được, chỉ đếm để biết vùng mù còn rộng bao nhiêu. */
const DYNAMIC_USE_PATTERN = /(?<![\p{L}\p{N}_$.])t\??\.?\[\s*(?!["'])/gu;

/** Fallback trùng lặp: `t.key || "..."` và `tr("key", "...")`. */
const FALLBACK_PATTERNS = [
  /(?<![\p{L}\p{N}_$.])t\??\.[A-Za-z0-9_]+\s*\|\|\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/gu,
  /(?<![\p{L}\p{N}_$.])tr\(\s*(["'])[A-Za-z0-9_]+\1\s*,\s*(["'])((?:(?!\2)[^\\\n]|\\.)*)\2/gu,
];

/**
 * Chuỗi tiếng Việt nằm ở vị trí người dùng đọc được. Cố tình KHÔNG bắt mọi chuỗi có dấu:
 * bảng tên ga, tên tỉnh, log console… đều có dấu nhưng không phải câu chữ giao diện; bắt
 * hết thì nhiễu tới mức không ai thèm đọc kết quả.
 */
const HARDCODED_PATTERNS = [
  // Text node của JSX:  <span>Đặt vé</span>
  { name: 'jsx-text', re: />([^<>{}\n]*)</g, group: 1 },
  // Thuộc tính hiển thị:  placeholder="Nhập email"
  {
    name: 'jsx-attr',
    re: /\b(?:placeholder|title|alt|label|aria-label|content|heading|tooltip|confirmLabel|cancelLabel|emptyText)\s*=\s*\{?\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    group: 2,
  },
  // Thuộc tính object thường được render thẳng:  { label: "Đã hủy" }
  {
    name: 'obj-prop',
    re: /\b(?:label|title|text|message|placeholder|description|heading|hint|note|caption|tooltip|errorText|helperText)\s*:\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    group: 2,
  },
  // Thông báo bật thẳng ra người dùng
  {
    name: 'dialog',
    re: /\b(?:alert|confirm|prompt)\s*\(\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    group: 2,
  },
  // Lỗi ném ra rồi hiển thị lại trên giao diện
  {
    name: 'throw',
    re: /\bnew Error\s*\(\s*(["'])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    group: 2,
  },
];

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

function emptyBaseline() {
  return { hardcoded: {}, fallback: {}, notTranslationKeys: {} };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return emptyBaseline();
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return {
      hardcoded: parsed.hardcoded ?? {},
      fallback: parsed.fallback ?? {},
      notTranslationKeys: parsed.notTranslationKeys ?? {},
    };
  } catch (e) {
    fail('Không đọc được ' + rel(BASELINE_FILE) + ': ' + e.message);
    return emptyBaseline();
  }
}

/**
 * So khớp theo bội (multiset) chứ không theo số dòng: dời code lên xuống thì dấu vân tay
 * vẫn khớp, còn thêm một chuỗi mới thì lệch ra ngay. So theo số dòng thì mỗi lần thêm một
 * dòng import là baseline hỏng toàn bộ.
 */
function diffAgainstBaseline(found, baselineForCategory) {
  const added = [];
  const removed = [];
  const files = new Set([...Object.keys(found), ...Object.keys(baselineForCategory)]);
  for (const file of files) {
    const remaining = new Map();
    for (const literal of baselineForCategory[file] ?? []) {
      remaining.set(literal, (remaining.get(literal) ?? 0) + 1);
    }
    for (const item of found[file] ?? []) {
      const left = remaining.get(item.literal) ?? 0;
      if (left > 0) remaining.set(item.literal, left - 1);
      else added.push({ file, ...item });
    }
    for (const [literal, count] of remaining) {
      for (let i = 0; i < count; i++) removed.push({ file, literal });
    }
  }
  return { added, removed };
}

// ---------------------------------------------------------------------------
// Chạy
// ---------------------------------------------------------------------------

const { locales, oddities } = loadLocales();
const base = locales.get(BASE_LOCALE);
if (!base) fail('Không tìm thấy ngôn ngữ gốc "' + BASE_LOCALE + '" trong bảng dịch.');

for (const odd of oddities) warnings.push('Bảng dịch có dòng lạ — ' + odd);

const files = collectSourceFiles(SRC);
const usedKeys = new Map(); // khoá -> [nơi dùng]
const foundHardcoded = {};
const foundFallback = {};
let dynamicUses = 0;
const wordsInSource = new Set(); // mọi định danh trong src, để dò khoá ghép động

for (const file of files) {
  const relFile = rel(file);
  const isTest = /\.test\.[jt]sx?$/.test(file);
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const lineOf = makeLineOf(code);

  for (const m of code.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) wordsInSource.add(m[0]);

  for (const pattern of STATIC_USE_PATTERNS) {
    for (const m of code.matchAll(pattern)) {
      const key = m[2] ?? m[1];
      if (!usedKeys.has(key)) usedKeys.set(key, []);
      usedKeys.get(key).push(relFile + ':' + lineOf(m.index));
    }
  }
  dynamicUses += [...code.matchAll(DYNAMIC_USE_PATTERN)].length;

  // Chuỗi trong file test là dữ liệu kiểm thử, không phải câu chữ giao diện.
  if (isTest) continue;

  const fallbackSpans = [];
  for (const pattern of FALLBACK_PATTERNS) {
    for (const m of code.matchAll(pattern)) {
      const literal = (m[3] ?? m[2]).trim();
      fallbackSpans.push([m.index, m.index + m[0].length]);
      if (literal === '') continue;
      (foundFallback[relFile] ??= []).push({ literal, line: lineOf(m.index) });
    }
  }

  for (const { name, re, group } of HARDCODED_PATTERNS) {
    for (const m of code.matchAll(re)) {
      const literal = m[group].trim();
      if (literal === '' || !VIETNAMESE_RE.test(literal)) continue;
      // Chuỗi nằm trong một fallback đã tính ở trên thì không đếm hai lần.
      if (fallbackSpans.some(([a, b]) => m.index >= a && m.index < b)) continue;
      (foundHardcoded[relFile] ??= []).push({ literal, line: lineOf(m.index), kind: name });
    }
  }
}

const baseline = loadBaseline();

// --- 1. Khoá dùng trong code nhưng không có trong bảng gốc -------------------
//
// Lọc qua `notTranslationKeys` trước: trong kho có những biến cục bộ cũng tên `t` (một
// chuyến bay, một mốc thời gian…), nên `t.arrivalTime` là đọc field của dữ liệu chứ không
// phải tra bản dịch. Phân biệt cho đúng thì phải phân tích phạm vi biến bằng parser thật;
// số ca như vậy đủ ít để liệt kê thẳng trong baseline, và liệt kê thẳng thì người đọc thấy
// được vì sao chúng được bỏ qua — hơn là giấu trong một luật đoán mò.
const ignoredKeys = new Set(Object.keys(baseline.notTranslationKeys));
const missingInBase = [...usedKeys.entries()]
  .filter(([key]) => !base.has(key) && !ignoredKeys.has(key))
  .sort((a, b) => a[0].localeCompare(b[0]));

for (const [key, places] of missingInBase) {
  errors.push(
    'Khoá "' + key + '" được dùng nhưng KHÔNG có trong bảng ' + BASE_LOCALE +
      ' → người dùng thấy chỗ trống hoặc chuỗi dự phòng.\n      ' +
      places.slice(0, 4).join('\n      ') +
      (places.length > 4 ? '\n      … và ' + (places.length - 4) + ' chỗ nữa' : '')
  );
}

// --- 2. Ngôn ngữ bắt buộc thiếu khoá ----------------------------------------
for (const code of REQUIRED_LOCALES) {
  const table = locales.get(code);
  if (!table) {
    errors.push('Thiếu hẳn bảng dịch cho "' + code + '".');
    continue;
  }
  const missing = [...base.keys()].filter((k) => !table.has(k));
  if (missing.length) {
    errors.push(
      'Bảng "' + code + '" thiếu ' + missing.length + ' khoá so với "' + BASE_LOCALE + '": ' +
        missing.slice(0, 12).join(', ') +
        (missing.length > 12 ? ' … (+' + (missing.length - 12) + ')' : '')
    );
  }
  const extra = [...table.keys()].filter((k) => !base.has(k));
  if (extra.length) {
    warnings.push(
      'Bảng "' + code + '" có ' + extra.length + ' khoá mà "' + BASE_LOCALE + '" không có: ' +
        extra.slice(0, 12).join(', ') +
        (extra.length > 12 ? ' … (+' + (extra.length - 12) + ')' : '')
    );
  }
}

// --- 3. Ngôn ngữ hoãn lại ----------------------------------------------------
for (const code of DEFERRED_LOCALES) {
  const table = locales.get(code);
  if (!table) {
    warnings.push('Chưa có bảng dịch cho "' + code + '".');
    continue;
  }
  const missing = [...base.keys()].filter((k) => !table.has(k));
  if (missing.length) {
    warnings.push(
      'Bảng "' + code + '" thiếu ' + missing.length + '/' + base.size +
        ' khoá (hoãn có chủ ý — fallback vi → en đỡ chỗ này).'
    );
  }
}

// --- 4. Khoá thừa ------------------------------------------------------------
const unused = [...base.keys()].filter(
  (k) => !usedKeys.has(k) && !wordsInSource.has(k) && !DYNAMIC_KEY_PREFIXES.some((p) => k.startsWith(p))
);
if (unused.length) {
  notes.push(
    unused.length + ' khoá trong bảng "' + BASE_LOCALE + '" không thấy dùng ở đâu — ứng viên để xoá:\n      ' +
      unused.slice(0, 15).join(', ') +
      (unused.length > 15 ? ' … (+' + (unused.length - 15) + ')' : '')
  );
}

// --- 5. Chữ trong mail (backend) --------------------------------------------
//
// Bỏ qua im lặng nếu không thấy thư mục backend: kho có thể được lấy về một mình phần
// frontend, và khi đó "thiếu file" không phải lỗi của ai cả.
let mailStats = null;
if (fs.existsSync(MAIL_BASE_FILE)) {
  const readProps = (file) => {
    const keys = new Map();
    if (!fs.existsSync(file)) return keys;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (line === '' || line.startsWith('#') || line.startsWith('!')) return;
      const eq = line.indexOf('=');
      if (eq <= 0) {
        warnings.push('Dòng lạ trong ' + path.basename(file) + ':' + (i + 1) + ' — ' + line.slice(0, 70));
        return;
      }
      keys.set(line.slice(0, eq).trim(), i + 1);
    });
    return keys;
  };

  const mailBase = readProps(MAIL_BASE_FILE);
  const mailVi = readProps(MAIL_VI_FILE);

  // Khoá được gọi trong code Java: t(locale, "mail.x", ...) và messages.t(locale, "mail.x").
  const mailUsed = new Set();
  const javaFiles = [];
  (function walkJava(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walkJava(p);
      else if (entry.name.endsWith('.java')) javaFiles.push(p);
    }
  })(MAIL_JAVA_DIR);
  for (const file of javaFiles) {
    // Bỏ chú thích trước: Javadoc của Messages.java có ví dụ t(locale, "mail.x"), và nếu
    // đếm cả ví dụ thì script tự báo lỗi về một khoá không hề tồn tại trong code thật.
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    for (const m of code.matchAll(/\bt\(\s*[A-Za-z_][A-Za-z0-9_]*\s*,\s*"([A-Za-z0-9_.]+)"/g)) {
      mailUsed.add(m[1]);
    }
  }

  const mailMissing = [...mailUsed].filter((k) => !mailBase.has(k)).sort();
  for (const key of mailMissing) {
    errors.push(
      'Khoá mail "' + key + '" được gọi trong Java nhưng KHÔNG có trong messages.properties ' +
        '→ lá thư sẽ in ra chính tên khoá.'
    );
  }

  const viMissing = [...mailBase.keys()].filter((k) => !mailVi.has(k));
  if (viMissing.length) {
    errors.push(
      'messages_vi.properties thiếu ' + viMissing.length + ' khoá → mail tiếng Việt sẽ chen một dòng tiếng Anh: ' +
        viMissing.slice(0, 12).join(', ') +
        (viMissing.length > 12 ? ' … (+' + (viMissing.length - 12) + ')' : '')
    );
  }

  const viExtra = [...mailVi.keys()].filter((k) => !mailBase.has(k));
  if (viExtra.length) {
    warnings.push(
      'messages_vi.properties có ' + viExtra.length + ' khoá mà messages.properties không có (thừa hoặc gõ sai tên): ' +
        viExtra.slice(0, 12).join(', ')
    );
  }

  const mailUnused = [...mailBase.keys()].filter((k) => !mailUsed.has(k));
  if (mailUnused.length) {
    notes.push(
      mailUnused.length + ' khoá mail không thấy gọi ở đâu: ' +
        mailUnused.slice(0, 10).join(', ') +
        (mailUnused.length > 10 ? ' … (+' + (mailUnused.length - 10) + ')' : '')
    );
  }

  mailStats = { base: mailBase.size, vi: mailVi.size, used: mailUsed.size };
}

// --- 6. Bánh cóc chuỗi cứng & fallback --------------------------------------
const countOf = (obj) => Object.values(obj).reduce((n, arr) => n + arr.length, 0);
const totalHard = countOf(foundHardcoded);
const totalFb = countOf(foundFallback);

if (UPDATE_BASELINE) {
  const serialize = (found) => {
    const out = {};
    for (const file of Object.keys(found).sort()) {
      out[file] = found[file].map((x) => x.literal).sort((a, b) => a.localeCompare(b));
    }
    return out;
  };
  const payload = {
    _note:
      'Ảnh chụp nợ i18n hiện có. scripts/i18n-check.mjs chỉ đánh trượt những chỗ phát sinh THÊM so với file này. ' +
      'Dọn được chỗ nào thì chạy `npm run i18n:check -- --update-baseline` để con số tụt xuống và không leo lại được.',
    _generatedBy: 'npm run i18n:check -- --update-baseline',
    // Giữ nguyên: mục này viết tay, không sinh tự động được.
    notTranslationKeys: baseline.notTranslationKeys,
    hardcoded: serialize(foundHardcoded),
    fallback: serialize(foundFallback),
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('✔ Đã ghi ' + rel(BASELINE_FILE) + ' — chuỗi cứng: ' + totalHard + ', fallback trùng lặp: ' + totalFb);
} else {
  const hard = diffAgainstBaseline(foundHardcoded, baseline.hardcoded);
  const fb = diffAgainstBaseline(foundFallback, baseline.fallback);

  for (const item of hard.added) {
    errors.push(
      'Chuỗi tiếng Việt cứng MỚI (' + item.kind + ') — ' + item.file + ':' + item.line +
        '\n      "' + item.literal.slice(0, 100) + '"' +
        '\n      Chuyển sang khoá dịch; nếu là dữ liệu chứ không phải câu chữ thì thêm vào baseline.'
    );
  }
  for (const item of fb.added) {
    errors.push(
      'Fallback trùng lặp MỚI — ' + item.file + ':' + item.line +
        '\n      "' + item.literal.slice(0, 100) + '"' +
        '\n      Bỏ phần `|| "…"`; bảng "' + BASE_LOCALE + '" là nguồn duy nhất, còn thiếu thì thêm khoá vào đó.'
    );
  }
  const cleaned = hard.removed.length + fb.removed.length;
  if (cleaned > 0) {
    notes.push(
      'Có ' + cleaned + ' mục trong baseline nay không còn trong code. Chạy `npm run i18n:check -- --update-baseline` để hạ mốc xuống.'
    );
  }
}

// ---------------------------------------------------------------------------
// Báo cáo
// ---------------------------------------------------------------------------

console.log('');
console.log('  Bản dịch  (' + rel(LOCALE_FILE) + ')');
for (const [code, table] of locales) {
  const missing = code === BASE_LOCALE ? 0 : [...base.keys()].filter((k) => !table.has(k)).length;
  const tag = code === BASE_LOCALE ? 'gốc' : missing === 0 ? 'đủ' : 'thiếu ' + missing;
  console.log('    ' + code.padEnd(6) + String(table.size).padStart(5) + ' khoá   ' + tag);
}
if (mailStats) {
  console.log('');
  console.log('  Chữ trong mail  (backend/…/resources/messages*.properties)');
  console.log('    en     ' + String(mailStats.base).padStart(5) + ' khoá   mặc định, cũng là bản dự phòng cho ja/zh');
  console.log('    vi     ' + String(mailStats.vi).padStart(5) + ' khoá   ' + (mailStats.vi >= mailStats.base ? 'đủ' : 'thiếu ' + (mailStats.base - mailStats.vi)));
  console.log('    gọi trong Java: ' + mailStats.used + ' khoá');
}
console.log('');
console.log('  Chỗ gọi trong src/');
console.log('    tra được tĩnh   ' + usedKeys.size + ' khoá');
console.log('    ghép động       ' + dynamicUses + ' chỗ (không đối chiếu được)');
console.log('    chuỗi cứng      ' + totalHard + '  (mốc baseline: ' + countOf(baseline.hardcoded) + ')');
console.log('    fallback lặp    ' + totalFb + '  (mốc baseline: ' + countOf(baseline.fallback) + ')');
console.log('');

for (const n of notes) console.log('  ℹ  ' + n);
if (notes.length) console.log('');
for (const w of warnings) console.log('  ⚠  ' + w);
if (warnings.length) console.log('');
for (const e of errors) console.log('  ✖  ' + e);
if (errors.length) console.log('');

if (errors.length) {
  console.log('✖ i18n-check: ' + errors.length + ' lỗi.');
  process.exit(1);
}
if (STRICT && warnings.length) {
  console.log('✖ i18n-check: ' + warnings.length + ' cảnh báo (chế độ --strict).');
  process.exit(1);
}
console.log('✔ i18n-check: không có lỗi' + (warnings.length ? ', ' + warnings.length + ' cảnh báo' : '') + '.');
