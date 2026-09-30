// Identidade persistente do jogador (clientId).
//
// - O clientId fica no localStorage: fechar e reabrir o navegador mantém o
//   mesmo jogador (mesmo papel, mesma pontuação).
// - Ele é SECRETO: o servidor nunca o envia para outros jogadores (os outros
//   só veem um id público). Por isso ninguém consegue "se passar" por você.
// - Várias abas no mesmo navegador: a primeira usa o id principal; as outras
//   ganham um id próprio (guardado no sessionStorage), detectado via Web Locks.
//   Assim dá para testar vários jogadores no mesmo computador.

import { KEYS, local, session } from './storage.js';

function randomId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VALID = /^[A-Za-z0-9_-]{16,64}$/;

/** Tenta "segurar" o id enquanto a aba estiver aberta. */
function tryHold(id) {
  if (!navigator.locks?.request) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks
      .request(`impostor-identity-${id}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        return new Promise(() => {}); // mantém o lock até a aba fechar
      })
      .catch(() => resolve(true));
  });
}

async function resolveIdentity() {
  const tabId = session.get(KEYS.tabId);
  if (typeof tabId === 'string' && VALID.test(tabId) && (await tryHold(tabId))) return tabId;

  let primary = local.get(KEYS.primaryId);
  if (typeof primary !== 'string' || !VALID.test(primary)) {
    primary = randomId();
    local.set(KEYS.primaryId, primary);
  }
  if (await tryHold(primary)) {
    session.remove(KEYS.tabId);
    return primary;
  }
  // Outra aba já está usando o id principal: esta aba vira outro jogador.
  const alt = randomId();
  session.set(KEYS.tabId, alt);
  await tryHold(alt);
  return alt;
}

let pending = null;
/** Resolve a identidade uma única vez por aba (seguro com StrictMode/HMR). */
export function resolveClientId() {
  pending ??= resolveIdentity();
  return pending;
}
