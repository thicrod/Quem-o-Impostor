// Utilitários de texto: sanitização, normalização e as regras "inteligentes"
// de pistas e palpites. Tudo roda no servidor — o cliente só faz checagens
// cosméticas para dar feedback imediato.

import { LIMITS } from './config.js';

// Caracteres de controle, zero-width e overrides bidirecionais (usados para
// "esconder" texto ou inverter a exibição).
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;

/** Remove caracteres invisíveis/controle, colapsa espaços e corta no limite. */
export function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** minúsculas, sem acentos, sem pontuação. "Pão-de-Açúcar!" -> "pao de acucar" */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Forma compacta sem espaços: "Torre Eiffel" -> "torreeiffel" */
export const compact = (value) => normalize(value).replace(/ /g, '');

/**
 * Singulariza de forma aproximada (português). Não precisa ser perfeito,
 * só precisa pegar os plurais óbvios: pizzas, flores, animais, pães, homens.
 */
export function stem(word) {
  let w = word;
  if (w.length <= 3) return w;
  if (/(oes|aes|aos)$/.test(w)) return `${w.slice(0, -3)}ao`;
  if (w.endsWith('ais')) return `${w.slice(0, -3)}al`;
  if (w.endsWith('eis') && w.length > 4) return `${w.slice(0, -3)}el`;
  if (w.endsWith('ois')) return `${w.slice(0, -3)}ol`;
  if (w.endsWith('ns')) return `${w.slice(0, -2)}m`;
  if (/(res|zes|ses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

/** Distância de Damerau-Levenshtein (versão OSA: troca de letras vizinhas = 1). */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const STOPWORDS = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'the', 'of']);

/** Quantas edições toleramos para considerar "a mesma palavra escrita diferente". */
function tolerance(length) {
  if (length >= 8) return 2;
  if (length >= 4) return 1;
  return 0;
}

/** Radical sem diminutivo e sem vogal final: "cachorrinho" e "cachorro" -> "cachorr". */
function root(word) {
  return word.replace(/(zinh[oa]|inh[oa])$/, '').replace(/[aeo]$/, '');
}

/** Duas palavras (já normalizadas, sem espaço) são "praticamente idênticas"? */
function nearlySame(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = stem(a);
  const sb = stem(b);
  if (sa === sb) return true;
  const minLen = Math.min(sa.length, sb.length);
  if (editDistance(sa, sb) <= tolerance(minLen)) return true;
  const ra = root(sa);
  if (ra.length >= 3 && ra === root(sb)) return true;
  // Derivações óbvias: "pizzaria" contém "pizza", "sorveteria" contém "sorvete".
  // Só vale para palavras de 5+ letras que formam boa parte da pista, para não
  // bloquear coisas legítimas como "bolacha" (bola) ou "mesada" (mesa).
  const [short, long] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  if (short.length >= 5 && long.includes(short) && short.length / long.length >= 0.6) return true;
  return false;
}

/**
 * A pista é uma variação da palavra protegida?
 * Compara a palavra inteira (compacta) e cada termo relevante de palavras
 * compostas ("Torre Eiffel" protege "torre" e "eiffel").
 */
export function isVariationOf(clue, protectedWord) {
  const c = compact(clue);
  const whole = compact(protectedWord);
  if (!c || !whole) return false;
  if (nearlySame(c, whole)) return true;
  const tokens = normalize(protectedWord)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (tokens.length > 1 || (tokens.length === 1 && tokens[0] !== whole)) {
    return tokens.some((t) => nearlySame(c, t));
  }
  return false;
}

/**
 * Valida uma pista. Retorna { ok: true, clue } ou { ok: false, code, message }.
 * `protectedWords` = palavras que ESTE jogador não pode usar (a própria carta).
 * `usedClues` = pistas já dadas nesta rodada (evita repetição literal).
 */
export function validateClue(raw, { protectedWords = [], usedClues = [] } = {}) {
  const clue = sanitizeText(raw, LIMITS.CLUE_MAX + 10);
  if (!clue) return { ok: false, code: 'CLUE_EMPTY', message: 'Digite uma pista.' };
  if (/\s/.test(clue)) {
    return { ok: false, code: 'CLUE_ONE_WORD', message: 'A pista deve ser uma única palavra.' };
  }
  if (clue.length > LIMITS.CLUE_MAX) {
    return { ok: false, code: 'CLUE_TOO_LONG', message: `Máximo de ${LIMITS.CLUE_MAX} letras.` };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}'-]*$/u.test(clue)) {
    return { ok: false, code: 'CLUE_INVALID', message: 'Use apenas letras, números ou hífen.' };
  }
  const c = compact(clue);
  if (c.length < LIMITS.CLUE_MIN) {
    return { ok: false, code: 'CLUE_TOO_SHORT', message: 'Pista curta demais.' };
  }
  if (protectedWords.some((w) => w && isVariationOf(clue, w))) {
    return { ok: false, code: 'CLUE_IS_SECRET', message: 'Não vale usar a palavra secreta (nem variações dela)!' };
  }
  if (usedClues.some((u) => compact(u) === c || stem(compact(u)) === stem(c))) {
    return { ok: false, code: 'CLUE_REPEATED', message: 'Essa pista já foi usada nesta rodada.' };
  }
  return { ok: true, clue };
}

/** O palpite final do impostor acerta a palavra? (tolerante a acento, plural e erro de digitação) */
export function isCorrectGuess(guess, secretWord) {
  const g = compact(guess);
  const w = compact(secretWord);
  if (!g || !w) return false;
  if (g === w || stem(g) === stem(w)) return true;
  return editDistance(g, w) <= tolerance(w.length) && w.length >= 5;
}

/** Apelido: 2–16 caracteres, letras/números/espaço e alguns símbolos. */
export function validateNickname(raw) {
  const nickname = sanitizeText(raw, LIMITS.NICK_MAX + 20);
  if (nickname.length < LIMITS.NICK_MIN) {
    return { ok: false, code: 'NICK_SHORT', message: `O apelido precisa de pelo menos ${LIMITS.NICK_MIN} letras.` };
  }
  if (nickname.length > LIMITS.NICK_MAX) {
    return { ok: false, code: 'NICK_LONG', message: `O apelido pode ter no máximo ${LIMITS.NICK_MAX} caracteres.` };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(nickname)) {
    return { ok: false, code: 'NICK_INVALID', message: 'Use letras, números, espaço, ponto, hífen ou _.' };
  }
  return { ok: true, nickname };
}

/** Chave usada para detectar apelidos duplicados ("João" == "joao" == "JOÃO"). */
export const nicknameKey = (nickname) => compact(nickname);
