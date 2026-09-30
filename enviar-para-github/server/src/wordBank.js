// Carrega e valida o banco de palavras (words.json).
// O arquivo pode ser editado livremente: entradas inválidas são ignoradas com
// um aviso no log em vez de derrubar o servidor.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RANDOM_CATEGORY } from './config.js';
import { compact } from './text.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORDS_PATH = process.env.WORDS_FILE || join(__dirname, 'words.json');

export const MIN_WORDS_PER_CATEGORY = 10;

export function parseWordBank(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const categories = new Map();
  const warnings = [];
  const entries = Object.entries(data?.categories ?? {});
  for (const [key, cat] of entries) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key) || key === RANDOM_CATEGORY) {
      warnings.push(`categoria "${key}" ignorada: chave inválida`);
      continue;
    }
    const seen = new Set();
    const words = [];
    for (const item of cat?.words ?? []) {
      const word = typeof item?.word === 'string' ? item.word.trim() : '';
      const similar = typeof item?.similar === 'string' ? item.similar.trim() : '';
      if (!word || !similar) {
        warnings.push(`${key}: entrada sem "word" ou "similar" ignorada`);
        continue;
      }
      if (compact(word) === compact(similar)) {
        warnings.push(`${key}: "${word}" tem o par igual à palavra`);
        continue;
      }
      const k = compact(word);
      if (seen.has(k)) {
        warnings.push(`${key}: "${word}" duplicada`);
        continue;
      }
      seen.add(k);
      words.push({ word, similar });
    }
    if (words.length < MIN_WORDS_PER_CATEGORY) {
      warnings.push(`categoria "${key}" ignorada: só ${words.length} palavras válidas`);
      continue;
    }
    categories.set(key, {
      key,
      label: String(cat.label || key).slice(0, 30),
      emoji: String(cat.emoji || '🎯').slice(0, 8),
      words,
    });
  }
  if (categories.size === 0) throw new Error('words.json não tem nenhuma categoria válida');
  return { categories, warnings };
}

class WordBank {
  constructor() {
    this.categories = new Map();
  }

  load(path = WORDS_PATH) {
    const { categories, warnings } = parseWordBank(readFileSync(path, 'utf8'));
    warnings.forEach((w) => logger.warn(`[words.json] ${w}`));
    this.categories = categories;
    logger.info(`Banco de palavras: ${categories.size} categorias, ${this.totalWords()} palavras`);
    return this;
  }

  totalWords() {
    let n = 0;
    for (const c of this.categories.values()) n += c.words.length;
    return n;
  }

  has(key) {
    return key === RANDOM_CATEGORY || this.categories.has(key);
  }

  /** Lista pública (sem as palavras!) para o cliente montar o seletor. */
  publicList() {
    return [...this.categories.values()].map(({ key, label, emoji, words }) => ({
      key, label, emoji, count: words.length,
    }));
  }

  describe(key) {
    const c = this.categories.get(key);
    return c ? { key: c.key, label: c.label, emoji: c.emoji } : null;
  }

  /**
   * Sorteia categoria (se "aleatória") e palavra, evitando repetir as palavras
   * já usadas na sala (`used` é um Set mantido pela sala).
   */
  pick(categoryKey, used = new Set(), rng = Math.random) {
    let key = categoryKey;
    if (key === RANDOM_CATEGORY || !this.categories.has(key)) {
      const keys = [...this.categories.keys()];
      key = keys[Math.floor(rng() * keys.length)];
    }
    const cat = this.categories.get(key);
    let pool = cat.words.filter((w) => !used.has(`${key}:${w.word}`));
    if (pool.length === 0) {
      for (const w of cat.words) used.delete(`${key}:${w.word}`);
      pool = cat.words;
    }
    const entry = pool[Math.floor(rng() * pool.length)];
    used.add(`${key}:${entry.word}`);
    return { category: this.describe(key), word: entry.word, similar: entry.similar };
  }
}

export const wordBank = new WordBank();
