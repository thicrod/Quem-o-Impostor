import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, validate, ValidationError } from '../src/validation.js';
import { RateLimiter } from '../src/rateLimiter.js';

const schema = { code: t.code(), text: t.string(20), mode: t.enumOf(['a', 'b'], { optional: true }) };

test('valida e normaliza payloads', () => {
  assert.deepEqual(validate(schema, { code: ' abcdef ', text: 'oi', extra: 1 }), { code: 'ABCDEF', text: 'oi' });
  assert.deepEqual(validate(null, 'qualquer coisa'), {});
});

test('rejeita payloads inválidos', () => {
  const bad = [
    null, 'texto', 42, [], { code: 'ABC', text: 'x' }, { code: 'ABCDE0', text: 'x' },
    { code: 'ABCDEF' }, { code: 'ABCDEF', text: 5 }, { code: 'ABCDEF', text: 'x'.repeat(500) },
    { code: 'ABCDEF', text: 'ok', mode: 'c' }, Object.create({ code: 'ABCDEF', text: 'x' }),
  ];
  for (const payload of bad) {
    assert.throws(() => validate(schema, payload), ValidationError, JSON.stringify(payload));
  }
});

test('ids e clientIds', () => {
  assert.throws(() => validate({ id: t.id() }, { id: '../../etc' }), ValidationError);
  assert.throws(() => validate({ c: t.clientId() }, { c: 'curto' }), ValidationError);
  assert.doesNotThrow(() => validate({ c: t.clientId() }, { c: 'abcdefghijklmnopqrstuv' }));
});

test('rate limiter (token bucket)', () => {
  let now = 0;
  const limiter = new RateLimiter({ default: { capacity: 3, refillPerSec: 1 } }, () => now);
  assert.equal(limiter.consume(), true);
  assert.equal(limiter.consume(), true);
  assert.equal(limiter.consume(), true);
  assert.equal(limiter.consume(), false);
  now += 1000;
  assert.equal(limiter.consume(), true);
  assert.equal(limiter.consume(), false);
});
