import nspell from 'nspell';

interface DictInfo {
  lang: string;
  aff: string;
  dic: string;
}

const checkers: Map<string, any> = new Map();
const loading: Map<string, Promise<any>> = new Map();
let availableDicts: DictInfo[] | null = null;

async function fetchAvailableDicts(): Promise<DictInfo[]> {
  if (availableDicts) return availableDicts;
  try {
    const resp = await fetch('/api/dict?action=list');
    const data = await resp.json();
    availableDicts = data.dictionaries || [];
    return availableDicts;
  } catch {
    availableDicts = [];
    return [];
  }
}

async function loadChecker(dict: DictInfo): Promise<any> {
  if (checkers.has(dict.lang)) return checkers.get(dict.lang);
  if (loading.has(dict.lang)) return loading.get(dict.lang);

  const promise = (async () => {
    try {
      const affResp = await fetch('/api/dict?file=' + encodeURIComponent(dict.aff));
      const dicResp = await fetch('/api/dict?file=' + encodeURIComponent(dict.dic));
      if (!affResp.ok || !dicResp.ok) return null;
      const affBuf = await affResp.arrayBuffer();
      const dicBuf = await dicResp.arrayBuffer();
      const sc = nspell(Buffer.from(affBuf), Buffer.from(dicBuf));
      checkers.set(dict.lang, sc);
      return sc;
    } catch {
      return null;
    } finally {
      loading.delete(dict.lang);
    }
  })();

  loading.set(dict.lang, promise);
  return promise;
}

function isCyrillic(word: string): boolean {
  return /[а-яА-ЯёЁ]/.test(word);
}

function isLatin(word: string): boolean {
  return /[a-zA-Z]/.test(word);
}

export interface SpellCheckResult {
  word: string;
  line: number;
  column: number;
  length: number;
}

export async function checkSpelling(text: string): Promise<SpellCheckResult[]> {
  const dicts = await fetchAvailableDicts();
  if (dicts.length === 0) return [];

  const ruDict = dicts.find(d => d.lang.startsWith('ru'));
  const enDict = dicts.find(d => d.lang.startsWith('en'));

  const [scRu, scEn] = await Promise.all([
    ruDict ? loadChecker(ruDict) : null,
    enDict ? loadChecker(enDict) : null,
  ]);

  console.log('[spellcheck] ru:', !!scRu, 'en:', !!scEn);

  const results: SpellCheckResult[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip game script tokens
    if (/^\[.*\]$/.test(line.trim())) continue;
    if (/^\{.*\}$/.test(line.trim())) continue;
    if (/^<.*>$/.test(line.trim())) continue;
    if (/^-{4,}$/.test(line.trim())) continue;

    const wordRe = /[a-zA-Zа-яА-ЯёЁ]+/g;
    let m;
    while ((m = wordRe.exec(line)) !== null) {
      const word = m[0];
      if (word.length < 3) continue;

      let correct = true;
      if (isCyrillic(word) && scRu) {
        correct = scRu.correct(word);
        console.log('[spellcheck] checking:', word, 'correct:', correct);
      } else if (isLatin(word) && scEn) {
        correct = scEn.correct(word);
      }

      if (!correct) {
        results.push({
          word,
          line: lineNum,
          column: m.index + 1,
          length: word.length,
        });
      }
    }
  }

  return results;
}

export async function getSuggestions(word: string): Promise<string[]> {
  const dicts = await fetchAvailableDicts();
  const isCyr = isCyrillic(word);
  const dict = isCyr ? dicts.find(d => d.lang.startsWith('ru')) : dicts.find(d => d.lang.startsWith('en'));
  if (!dict) return [];
  const sc = await loadChecker(dict);
  return sc ? sc.suggest(word).slice(0, 5) : [];
}

export async function hasSpellCheck(): Promise<boolean> {
  const dicts = await fetchAvailableDicts();
  return dicts.length > 0;
}
