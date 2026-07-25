import Prism from 'prismjs';

const PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#8e44ad',
  '#d35400', '#16a085', '#c0392b', '#7f8c8d', '#2c3e50',
  '#e91e63', '#00bcd4', '#ff5722', '#607d8b', '#795548',
  '#4caf50', '#ff9800', '#673ab7', '#03a9f4', '#8bc34a',
  '#ffc107', '#009688', '#f44336', '#2196f3', '#689f38',
];

function aggressiveHash(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  }
  return (4294967296 + (h2 >>> 0)) % PALETTE.length;
}

function hashColor(name: string): string {
  return PALETTE[aggressiveHash(name)];
}

function extractName(tokenContent: string, openDelim: string, closeDelim: string): string {
  const inner = tokenContent.slice(openDelim.length, -closeDelim.length);
  return inner.split('_')[0];
}

Prism.hooks.add('wrap', (env: any) => {
  if (env.type === 'bracket-label') {
    const name = extractName(env.content, '[', ']');
    env.attributes.style = 'color:' + hashColor(name);
  }
  if (env.type === 'curly-tag') {
    const name = extractName(env.content, '{', '}');
    env.attributes.style = 'color:' + hashColor(name);
  }
});

Prism.languages.gamescript = {
  'separator': {
    pattern: /^-{4,}$/m,
    alias: 'tok-separator',
  },
  'trailing-space': {
    pattern: /[^\S\n]+(?=\n|$)/,
    alias: 'tok-trailing-space',
  },
  'bracket-label': {
    pattern: /\[[A-Za-z0-9_]*\]/,
    alias: 'tok-bracket',
  },
  'curly-tag': {
    pattern: /\{[^}]*\}/,
    alias: 'tok-curly',
  },
  'angle-tag': {
    pattern: /<[A-Za-z\/][A-Za-z0-9_ ]*[^>]*>/,
    alias: 'tok-angle',
  },
  'double-space': {
    pattern: /  +/,
    alias: 'tok-double-space',
  },
  'invalid-char': {
    pattern: /\u2014/,
    alias: 'tok-invalid',
  },
};

export default Prism;
