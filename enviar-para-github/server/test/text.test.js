import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compact, editDistance, isCorrectGuess, isVariationOf, sanitizeText, stem, validateClue, validateNickname,
} from '../src/text.js';

test('pistas bloqueiam a palavra secreta e variações óbvias', () => {
  for (const clue of ['pizza', 'Pizza', 'pizzas', 'PIZZA', 'pizzA', 'piza', 'pizzaria', 'Pízza', 'pizza!']) {
    const r = validateClue(clue, { protectedWords: ['Pizza'] });
    assert.equal(r.ok, false, `"${clue}" deveria ser bloqueada`);
  }
});

test('pistas legítimas continuam funcionando', () => {
  for (const clue of ['forno', 'queijo', 'Itália', 'massa', 'redonda', 'delivery']) {
    const r = validateClue(clue, { protectedWords: ['Pizza'] });
    assert.equal(r.ok, true, `"${clue}" deveria ser aceita (${r.message})`);
  }
  // Palavras parecidas só no começo não são bloqueadas por engano
  assert.equal(validateClue('bolacha', { protectedWords: ['Bola'] }).ok, true);
  assert.equal(validateClue('mesada', { protectedWords: ['Mesa'] }).ok, true);
  assert.equal(validateClue('bola', { protectedWords: ['Futebol'] }).ok, true);
  assert.equal(validateClue('paris', { protectedWords: ['Torre Eiffel'] }).ok, true);
});

test('singular/plural, diminutivo e palavras compostas', () => {
  assert.ok(isVariationOf('gatos', 'Gato'));
  assert.ok(isVariationOf('gatinho', 'Gato'));
  assert.ok(isVariationOf('cachorrinho', 'Cachorro'));
  assert.ok(isVariationOf('leões', 'Leão'));
  assert.ok(isVariationOf('animais', 'Animal'));
  assert.ok(isVariationOf('flores', 'Flor'));
  assert.ok(isVariationOf('pães', 'Pão'));
  assert.ok(isVariationOf('eiffel', 'Torre Eiffel'));
  assert.ok(isVariationOf('torre', 'Torre Eiffel'));
  assert.ok(isVariationOf('guardachuva', 'Guarda-chuva'));
  assert.ok(isVariationOf('mundo', 'Copa do Mundo'));
  assert.ok(isVariationOf('pão', 'Pão de queijo'));
  assert.ok(isVariationOf('paes', 'Pão de queijo'));
  assert.ok(!isVariationOf('do', 'Copa do Mundo'));
});

test('formato da pista: uma palavra, sem símbolos, tamanho', () => {
  assert.equal(validateClue('duas palavras').code, 'CLUE_ONE_WORD');
  assert.equal(validateClue('').code, 'CLUE_EMPTY');
  assert.equal(validateClue('   ').code, 'CLUE_EMPTY');
  assert.equal(validateClue('<script>').code, 'CLUE_INVALID');
  assert.equal(validateClue('a').code, 'CLUE_TOO_SHORT');
  assert.equal(validateClue('x'.repeat(30)).code, 'CLUE_TOO_LONG');
  assert.equal(validateClue('guarda-roupa').ok, true);
  assert.equal(validateClue('queijo', { usedClues: ['Queijo'] }).code, 'CLUE_REPEATED');
  assert.equal(validateClue('queijos', { usedClues: ['queijo'] }).code, 'CLUE_REPEATED');
});

test('palpite final tolera acento, caixa, plural e erro de digitação', () => {
  assert.ok(isCorrectGuess('PIZZA', 'Pizza'));
  assert.ok(isCorrectGuess('pizzas', 'Pizza'));
  assert.ok(isCorrectGuess('pao de queijo', 'Pão de queijo'));
  assert.ok(isCorrectGuess('torre eifel', 'Torre Eiffel'));
  assert.ok(!isCorrectGuess('lasanha', 'Pizza'));
  assert.ok(!isCorrectGuess('', 'Pizza'));
  assert.ok(!isCorrectGuess('gata', 'Pato'));
});

test('apelidos', () => {
  assert.equal(validateNickname('Jo').ok, true);
  assert.equal(validateNickname('J').code, 'NICK_SHORT');
  assert.equal(validateNickname('x'.repeat(17)).code, 'NICK_LONG');
  assert.equal(validateNickname('<b>oi</b>').code, 'NICK_INVALID');
  assert.equal(validateNickname('  Ana   Clara ').nickname, 'Ana Clara');
  assert.equal(validateNickname('João Pedro').ok, true);
});

test('sanitização remove caracteres invisíveis e colapsa espaços', () => {
  assert.equal(sanitizeText('oi​‮  mundo\n\n', 50), 'oi mundo');
  assert.equal(sanitizeText(123, 10), '');
  assert.equal(sanitizeText('a'.repeat(300), 200).length, 200);
});

test('helpers de normalização', () => {
  assert.equal(compact('Pão-de-Açúcar!'), 'paodeacucar');
  assert.equal(stem('pizzas'), 'pizza');
  assert.equal(stem('leoes'), 'leao');
  assert.equal(editDistance('pizza', 'piza'), 1);
  assert.equal(editDistance('leao', 'leoa'), 1);
});
