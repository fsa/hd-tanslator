import nspell from 'nspell';

const checkers: Map<string, any> = new Map();
const loading: Map<string, Promise<any>> = new Map();

async function loadCheckerRu(): Promise<any> {
  if (checkers.has('ru')) return checkers.get('ru');
  if (loading.has('ru')) return loading.get('ru');

  const promise = loadDictFromApi('ru', 'ru_RU.aff', 'ru_RU.dic');
  loading.set('ru', promise);
  return promise;
}

async function loadCheckerEn(): Promise<any> {
  if (checkers.has('en')) return checkers.get('en');
  if (loading.has('en')) return loading.get('en');

  const promise = loadDictFromApi('en', 'en_US.aff', 'en_US.dic');
  loading.set('en', promise);
  return promise;
}

async function loadDictFromApi(lang: string, affFile: string, dicFile: string): Promise<any> {
  try {
    const affUrl = `/api/dict?file=${encodeURIComponent(affFile)}`;
    const dicUrl = `/api/dict?file=${encodeURIComponent(dicFile)}`;

    const affResp = await fetch(affUrl);
    const dicResp = await fetch(dicUrl);

    if (!affResp.ok || !dicResp.ok) {
      console.error(`[spellcheck:${lang}] Fetch failed: aff=${affResp.status} dic=${dicResp.status}`);
      return null;
    }

    // Decode as UTF-8 strings — the server already converts KOI8-R → UTF-8.
    // nspell accepts strings in addition to Buffer/Uint8Array.
    const affText = await affResp.text();
    const dicText = await dicResp.text();

    const sc = nspell(affText, dicText);

    checkers.set(lang, sc);
    return sc;
  } catch (err) {
    console.error(`[spellcheck:${lang}] Error:`, err);
    return null;
  } finally {
    loading.delete(lang);
  }
}

export async function checkSpelling(text: string): Promise<{ word: string; line: number; column: number; length: number }[]> {
  const [scRu, scEn] = await Promise.all([loadCheckerRu(), loadCheckerEn()]);
  const results: { word: string; line: number; column: number; length: number }[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
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
      if (/[а-яА-ЯёЁ]/.test(word) && scRu) {
        correct = scRu.correct(word);
      } else if (/[a-zA-Z]/.test(word) && scEn) {
        correct = scEn.correct(word);
      }
      if (!correct) {
        results.push({ word, line: lineNum, column: m.index + 1, length: word.length });
      }
    }
  }
  return results;
}

export async function hasSpellCheck(): Promise<boolean> {
  return true;
}
