import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame } from '../hooks/useGame.jsx';
import { profileStore } from '../lib/storage.js';
import { CODE_LENGTH, cleanCode, isValidCode } from '../lib/format.js';
import { playSound } from '../lib/sound.js';
import { Button, Chip, Panel, Spinner, cx } from '../components/ui.jsx';
import { Logo, SoundToggle } from '../components/Shell.jsx';
import { SettingsButton } from '../components/SettingsSheet.jsx';
import { ServerWaking, useSecondsWhile } from '../components/ServerWaking.jsx';
import { useInstall } from '../lib/install.js';
import { setUi } from '../lib/uiStore.js';
import { AvatarPicker } from '../components/AvatarPicker.jsx';
import { HowToPlay } from '../components/HowToPlay.jsx';

const CODE_ERRORS = new Set(['ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'INVALID_CODE', 'ROOM_FULL']);
const NICK_ERRORS = new Set(['NICK_SHORT', 'NICK_LONG', 'NICK_INVALID', 'NICK_TAKEN']);
const ERROR_ICONS = {
  ROOM_NOT_FOUND: '🔍', ROOM_EXPIRED: '⌛', INVALID_CODE: '⚠️', ROOM_FULL: '🚫', NICK_TAKEN: '👯',
  OFFLINE: '📡', TIMEOUT: '📡', RATE_LIMITED: '✋', SERVER_BUSY: '🔥',
};

function readInviteCode() {
  try {
    const code = new URLSearchParams(window.location.search).get('sala');
    return code ? cleanCode(code) : '';
  } catch {
    return '';
  }
}

export default function HomeScreen() {
  const { state, actions } = useGame();
  const saved = useMemo(() => profileStore.load(), []);
  const invite = useMemo(() => readInviteCode(), []);
  const [avatarSeed] = useState(() => Math.random());
  const [mode, setMode] = useState(invite ? 'join' : 'menu');
  const [nickname, setNickname] = useState(saved.nickname || '');
  const [pickedAvatar, setAvatar] = useState(saved.avatar || null);
  const [code, setCode] = useState(invite);
  const [codeHint, setCodeHint] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null); // { field, code, message }
  const [touched, setTouched] = useState({ nick: false, code: false });
  const nickRef = useRef(null);
  const codeRef = useRef(null);
  const nickId = useId();
  const codeId = useId();

  const avatars = state.meta?.avatars;
  const limits = state.meta?.limits || { nickMin: 2, nickMax: 16 };
  const online = state.connection === 'online';
  // Ainda não conectou nenhuma vez: depois de alguns segundos explica que o servidor está acordando.
  const waitingFirst = !online && !state.everConnected;
  const waitingFor = useSecondsWhile(waitingFirst);
  // Sem avatar salvo? Sugere um aleatório (estável durante a visita).
  const avatar = avatars?.includes(pickedAvatar)
    ? pickedAvatar
    : avatars?.[Math.floor(avatarSeed * avatars.length)] ?? null;

  useEffect(() => {
    if (mode === 'join' && !invite) codeRef.current?.focus();
  }, [mode, invite]);

  const trimmed = nickname.trim();
  const nickProblem = trimmed.length < limits.nickMin
    ? `Mínimo de ${limits.nickMin} letras.`
    : trimmed.length > limits.nickMax ? `Máximo de ${limits.nickMax} caracteres.` : null;
  const codeProblem = !isValidCode(code) ? `O código tem ${CODE_LENGTH} caracteres.` : null;

  const nickError = error?.field === 'nick' ? error.message : touched.nick ? nickProblem : null;
  const serverCodeError = error?.field === 'code' ? error.message : null;
  // Prioridade: erro do servidor > dica de caractere inválido > tamanho do código
  const codeError = serverCodeError || (!codeHint && touched.code && code.length > 0 ? codeProblem : null);

  const submit = async (kind) => {
    setTouched({ nick: true, code: kind === 'join' });
    setError(null);
    if (nickProblem) {
      nickRef.current?.focus();
      playSound('error');
      return;
    }
    if (kind === 'join' && codeProblem) {
      setError({ field: 'code', message: code.length ? codeProblem : 'Digite o código da sala.' });
      codeRef.current?.focus();
      playSound('error');
      return;
    }
    setBusy(kind);
    profileStore.save({ nickname: trimmed, avatar });
    const res = kind === 'create'
      ? await actions.createRoom({ nickname: trimmed, avatar })
      : await actions.joinRoom({ code, nickname: trimmed, avatar });
    setBusy(null);
    if (res.ok) {
      playSound('join');
      if (invite) window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    playSound('error');
    const field = CODE_ERRORS.has(res.code) ? 'code' : NICK_ERRORS.has(res.code) ? 'nick' : 'general';
    setError({ field, code: res.code, message: res.message });
  };

  const onCodeChange = (e) => {
    const raw = e.target.value;
    const next = cleanCode(raw);
    const dropped = raw.replace(/\s/g, '').length > next.length && next.length < CODE_LENGTH;
    setCodeHint(dropped ? 'Códigos usam só letras e números (sem 0, O, 1 ou I).' : '');
    setCode(next);
    if (error?.field === 'code') setError(null);
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 safe-top safe-bottom">
      <div className="flex justify-end gap-2 pt-1">
        <SoundToggle />
        <SettingsButton />
      </div>

      <motion.div
        className="mt-2 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="animate-float [@media(max-height:700px)]:scale-75">
          <Logo size="lg" />
        </div>
        <h1 className="mt-3 font-display text-[2.6rem] leading-[0.95] text-outline sm:text-6xl [@media(max-height:700px)]:mt-0 [@media(max-height:700px)]:text-[2.2rem]">
          <span className="block text-white">QUEM É O</span>
          <span className="title-gradient block">IMPOSTOR?</span>
        </h1>
        <p className="mt-3 max-w-xs text-[15px] text-ink-200">
          Todo mundo recebe a mesma palavra secreta… menos o impostor. Dê pistas, desconfie e vote!
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 [@media(max-height:700px)]:hidden">
          <Chip tone="hot">👥 3 a 6 jogadores</Chip>
          <Chip tone="sky">⚡ Partidas rápidas</Chip>
          <Chip tone="good">📱 No celular</Chip>
        </div>
      </motion.div>

      {waitingFirst && waitingFor >= 4 && (
        <ServerWaking className="mt-5" seconds={waitingFor} offline={state.connection === 'offline'} onRetry={actions.reconnectNow} />
      )}
      {!online && !(waitingFirst && waitingFor >= 4) && (
        <div
          role="status"
          className={cx(
            'mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold',
            state.everConnected || state.connection === 'offline'
              ? 'border-bad-400/50 bg-bad-500/10 text-bad-400'
              : 'border-sky-400/40 bg-sky-400/10 text-sky-400',
          )}
        >
          {state.connection === 'offline' ? '📡' : <Spinner className="size-5" />}
          <span className="flex-1">
            {state.everConnected || state.connection === 'offline'
              ? 'Erro de conexão com o servidor. Tentando reconectar…'
              : 'Conectando ao servidor…'}
          </span>
          {state.connection === 'offline' && (
            <button type="button" className="underline" onClick={actions.reconnectNow}>Tentar</button>
          )}
        </div>
      )}

      <Panel className="mt-5 [@media(max-height:700px)]:mt-3" as="form" onSubmit={(e) => { e.preventDefault(); submit(mode === 'join' ? 'join' : 'create'); }} noValidate>
        <label htmlFor={nickId} className="mb-2 block text-sm font-extrabold tracking-wide text-ink-200 uppercase">
          Seu apelido
        </label>
        <input
          id={nickId}
          ref={nickRef}
          className="field"
          value={nickname}
          maxLength={limits.nickMax}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint={mode === 'join' ? 'next' : 'go'}
          placeholder="Ex.: Pedro"
          aria-invalid={Boolean(nickError)}
          aria-describedby={nickError ? `${nickId}-err` : undefined}
          onChange={(e) => {
            setNickname(e.target.value);
            if (error?.field === 'nick') setError(null);
          }}
          onBlur={() => setTouched((t) => ({ ...t, nick: true }))}
        />
        <FieldError id={`${nickId}-err`} message={nickError} icon={ERROR_ICONS[error?.code]} />

        <p className="mt-4 mb-2 text-sm font-extrabold tracking-wide text-ink-200 uppercase">Seu avatar</p>
        {avatars?.length ? (
          <AvatarPicker avatars={avatars} value={avatar} onChange={setAvatar} compact />
        ) : (
          <div className="h-14 animate-pulse rounded-2xl bg-white/5" />
        )}

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'join' ? (
            <motion.div
              key="join"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <label htmlFor={codeId} className="mt-4 mb-2 block text-sm font-extrabold tracking-wide text-ink-200 uppercase">
                Código da sala
              </label>
              <div className="relative">
                <input
                  id={codeId}
                  ref={codeRef}
                  className="field text-center font-mono text-2xl tracking-[0.45em] uppercase"
                  value={code}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="A7K9XP"
                  maxLength={CODE_LENGTH + 4}
                  aria-invalid={Boolean(codeError)}
                  aria-describedby={`${codeId}-err`}
                  onChange={onCodeChange}
                  onBlur={() => setTouched((t) => ({ ...t, code: true }))}
                />
                {isValidCode(code) && !codeError && (
                  <span className="absolute top-1/2 right-4 -translate-y-1/2 text-good-400" aria-label="Código válido">✓</span>
                )}
              </div>
              <FieldError
                id={`${codeId}-err`}
                message={codeError || codeHint}
                icon={serverCodeError ? ERROR_ICONS[error?.code] : codeError ? '⚠️' : '💡'}
                soft={!codeError}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error?.field === 'general' && (
          <p role="alert" className="mt-4 rounded-2xl bg-bad-500/12 px-4 py-3 text-sm font-bold text-bad-400">
            {ERROR_ICONS[error.code] || '⚠️'} {error.message}
          </p>
        )}

        <div className="mt-5 grid gap-3">
          {mode === 'menu' ? (
            <>
              <Button type="submit" size="xl" block loading={busy === 'create'} disabled={!online || Boolean(busy)}>
                <span aria-hidden="true">✨</span> Criar sala
              </Button>
              <Button
                variant="secondary"
                size="xl"
                block
                disabled={Boolean(busy)}
                onClick={() => { setMode('join'); setError(null); }}
              >
                <span aria-hidden="true">🔑</span> Entrar em uma sala
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" variant="secondary" size="xl" block loading={busy === 'join'} disabled={!online || Boolean(busy)}>
                <span aria-hidden="true">🚀</span> Entrar
              </Button>
              <Button variant="ghost" size="md" block onClick={() => { setMode('menu'); setError(null); }}>
                ← Voltar
              </Button>
            </>
          )}
        </div>
      </Panel>

      <HowToPlay className="mt-4" />
      <HomeFooter />
    </div>
  );
}

function HomeFooter() {
  const inst = useInstall();
  return (
    <div className="mt-auto flex flex-col items-center gap-3 pt-6">
      {inst.available && (
        <button
          type="button"
          onClick={async () => {
            const r = await inst.install();
            if (r === 'manual') setUi({ settingsOpen: true, installHelpOpen: true });
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-4 text-sm font-extrabold text-sky-400 transition-colors hover:bg-sky-400/20"
        >
          <span aria-hidden="true">📲</span> Instalar como app
        </button>
      )}
      <p className="text-center text-xs text-ink-300">Feito para jogar com os amigos · sem cadastro</p>
    </div>
  );
}

function FieldError({ id, message, icon, soft = false }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          role={soft ? undefined : 'alert'}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, x: soft ? 0 : [0, -5, 5, -3, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cx('mt-2 text-sm font-bold', soft ? 'text-ink-300' : 'text-bad-400')}
        >
          {icon || '⚠️'} {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
