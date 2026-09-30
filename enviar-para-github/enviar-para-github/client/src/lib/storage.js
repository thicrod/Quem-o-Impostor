// Acesso seguro ao localStorage/sessionStorage (modo privado, cookies
// bloqueados etc. podem lançar exceção — o jogo continua funcionando).

function safe(storageName) {
  return {
    get(key, fallback = null) {
      try {
        const raw = window[storageName].getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window[storageName].setItem(key, JSON.stringify(value));
      } catch {
        /* armazenamento indisponível: ignora */
      }
    },
    remove(key) {
      try {
        window[storageName].removeItem(key);
      } catch {
        /* ignora */
      }
    },
  };
}

export const local = safe('localStorage');
export const session = safe('sessionStorage');

const KEYS = {
  primaryId: 'impostor:clientId',
  tabId: 'impostor:tabClientId',
  profile: 'impostor:profile',
  sound: 'impostor:sound',
  roomOf: (clientId) => `impostor:room:${clientId}`,
};
export { KEYS };

/** Apelido/avatar lembrados entre partidas. */
export const profileStore = {
  load: () => local.get(KEYS.profile, { nickname: '', avatar: null }),
  save: (profile) => local.set(KEYS.profile, profile),
};

/** Sala atual desta identidade (para reconectar depois de fechar o navegador). */
export const roomStore = {
  load: (clientId) => local.get(KEYS.roomOf(clientId), null),
  save: (clientId, code) => local.set(KEYS.roomOf(clientId), { code, savedAt: Date.now() }),
  clear: (clientId) => local.remove(KEYS.roomOf(clientId)),
};
