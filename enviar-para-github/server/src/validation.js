// Validação de payloads dos eventos Socket.IO, sem dependências.
// Cada schema descreve os campos aceitos; campos extras são descartados e
// tipos errados geram erro. Nada que vem do cliente é usado sem passar aqui.

import { LIMITS } from './config.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
export const CODE_REGEX = new RegExp(`^[${CODE_ALPHABET}]{${LIMITS.CODE_LENGTH}}$`);
export { CODE_ALPHABET };

const CLIENT_ID_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

export class ValidationError extends Error {
  constructor(message = 'Dados inválidos.', code = 'BAD_REQUEST') {
    super(message);
    this.code = code;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;

// Tipos de campo reutilizáveis
export const t = {
  string: (max, { optional = false } = {}) => ({ kind: 'string', max, optional }),
  clientId: () => ({ kind: 'clientId' }),
  code: () => ({ kind: 'code' }),
  enumOf: (values, { optional = false } = {}) => ({ kind: 'enum', values, optional }),
  id: () => ({ kind: 'id' }),
  literalTrue: () => ({ kind: 'true' }),
};

function checkField(name, rule, value) {
  if (value === undefined || value === null) {
    if (rule.optional) return undefined;
    throw new ValidationError(`Campo obrigatório ausente: ${name}.`);
  }
  switch (rule.kind) {
    case 'string':
      if (typeof value !== 'string') throw new ValidationError(`Campo inválido: ${name}.`);
      // Corte "bruto" contra strings gigantes; a sanitização fina acontece depois.
      if (value.length > rule.max * 4) throw new ValidationError(`Texto grande demais: ${name}.`);
      return value;
    case 'clientId':
      if (typeof value !== 'string' || !CLIENT_ID_REGEX.test(value)) {
        throw new ValidationError('Identificador de sessão inválido.', 'BAD_CLIENT_ID');
      }
      return value;
    case 'code': {
      if (typeof value !== 'string') throw new ValidationError('Código inválido.', 'INVALID_CODE');
      const code = value.trim().toUpperCase();
      if (!CODE_REGEX.test(code)) throw new ValidationError('Código inválido.', 'INVALID_CODE');
      return code;
    }
    case 'enum':
      if (!rule.values.includes(value)) throw new ValidationError(`Valor inválido: ${name}.`);
      return value;
    case 'id':
      if (typeof value !== 'string' || !/^[a-z0-9]{6,20}$/.test(value)) {
        throw new ValidationError(`Jogador inválido.`);
      }
      return value;
    case 'true':
      if (value !== true) throw new ValidationError(`Campo inválido: ${name}.`);
      return true;
    default:
      throw new ValidationError();
  }
}

/** Valida `payload` contra `schema` ({ campo: regra }). Retorna objeto limpo. */
export function validate(schema, payload) {
  if (schema === null) return {};
  if (!isPlainObject(payload)) throw new ValidationError();
  const out = {};
  for (const [name, rule] of Object.entries(schema)) {
    const v = checkField(name, rule, payload[name]);
    if (v !== undefined) out[name] = v;
  }
  return out;
}
