import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORDS_PATH, parseWordBank, wordBank } from '../src/wordBank.js';
import { compact } from '../src/text.js';

process.env.LOG_LEVEL = 'silent';

const REQUIRED = [
  'comida', 'animais', 'futebol', 'filmes', 'objetos', 'lugares', 'geral',
  'profissoes', 'tecnologia', 'jogos', 'musica', 'marcas', 'paises', 'esportes',
  'escola', 'internet', 'culturaPop', 'veiculos', 'roupas', 'natureza', 'brasil', 'casa', 'fantasia',
];

test('words.json é válido e tem todas as categorias com 50+ palavras', () => {
  const raw = JSON.parse(readFileSync(WORDS_PATH, 'utf8'));
  const { categories, warnings } = parseWordBank(raw);
  assert.deepEqual(warnings, [], `avisos: ${warnings.join('; ')}`);
  for (const key of REQUIRED) {
    const cat = categories.get(key);
    assert.ok(cat, `categoria ${key} ausente`);
    assert.ok(cat.words.length >= 50, `${key} tem só ${cat.words.length} palavras`);
    assert.ok(cat.label && cat.emoji, `${key} sem label/emoji`);
    for (const { word, similar } of cat.words) {
      assert.notEqual(compact(word), compact(similar), `${key}: par igual (${word})`);
    }
  }
});

test('entradas inválidas são ignoradas com aviso (não derrubam o servidor)', () => {
  const words = Array.from({ length: 12 }, (_, i) => ({ word: `w${i}`, similar: `s${i}` }));
  const { categories, warnings } = parseWordBank({
    categories: {
      boa: { label: 'Boa', emoji: '✅', words: [...words, { word: 'x' }, { word: 'Igual', similar: 'igual' }, words[0]] },
      pequena: { label: 'Pequena', words: words.slice(0, 3) },
      'Chave Ruim': { words },
    },
  });
  assert.equal(categories.size, 1);
  assert.equal(categories.get('boa').words.length, 12);
  assert.ok(warnings.length >= 4);
});

test('sorteio evita repetir palavras e categoria aleatória escolhe uma categoria real', () => {
  wordBank.load();
  const used = new Set();
  const seen = new Set();
  const total = wordBank.categories.get('comida').words.length;
  for (let i = 0; i < total; i += 1) {
    const pick = wordBank.pick('comida', used);
    assert.ok(!seen.has(pick.word), `repetiu ${pick.word}`);
    seen.add(pick.word);
  }
  // esgotou: recomeça sem travar
  assert.ok(wordBank.pick('comida', used).word);
  const random = wordBank.pick('aleatoria', new Set());
  assert.ok(wordBank.categories.has(random.category.key));
  assert.ok(random.category.label && random.category.emoji);
});

test('lista pública nunca contém as palavras', () => {
  const list = wordBank.publicList();
  assert.ok(list.length >= 23);
  for (const c of list) assert.deepEqual(Object.keys(c).sort(), ['count', 'emoji', 'key', 'label']);
});
