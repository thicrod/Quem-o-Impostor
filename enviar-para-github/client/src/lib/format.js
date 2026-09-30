export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** Deixa só caracteres válidos de código, em maiúsculas (códigos não usam 0/O/1/I). */
export function cleanCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .split('')
    .filter((ch) => CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, CODE_LENGTH);
}

export const isValidCode = (code) => code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function roomLink(code) {
  return `${window.location.origin}/?sala=${code}`;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no fallback */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
}

export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function shareRoom(code) {
  const url = roomLink(code);
  if (canShare()) {
    try {
      await navigator.share({
        title: 'Quem é o Impostor?',
        text: `Bora jogar "Quem é o Impostor?"! Código da sala: ${code}`,
        url,
      });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
