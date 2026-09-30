import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { canShare, copyText, shareRoom } from '../lib/format.js';
import { playSound } from '../lib/sound.js';
import { Button, Panel, SectionTitle, cx } from '../components/ui.jsx';
import { EmptySlot, LobbyPlayerCard } from '../components/PlayerCard.jsx';
import { AvatarPicker } from '../components/AvatarPicker.jsx';
import { Segmented } from '../components/Segmented.jsx';
import { Modal } from '../components/Shell.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { HowToPlay } from '../components/HowToPlay.jsx';

const MODE_HELP = {
  noWord: 'O impostor não recebe palavra nenhuma e precisa blefar só com as pistas dos outros.',
  similar: 'O impostor recebe uma palavra parecida (ex.: lasanha em vez de pizza) e sabe que é o impostor.',
};

function RoomCodeCard({ code }) {
  const { actions } = useGame();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(code);
    playSound('click');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      actions.toast('Não foi possível copiar. Anote o código: ' + code, 'warn');
    }
  };

  const onShare = async () => {
    const result = await shareRoom(code);
    if (result === 'copied') actions.toast('Link da sala copiado! Cole no grupo dos amigos. 🔗', 'join');
    if (result === 'failed') actions.toast('Não foi possível compartilhar. Envie o código ' + code, 'warn');
  };

  return (
    <Panel className="relative overflow-hidden text-center">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-hot-500/25 blur-3xl" aria-hidden="true" />
      <p className="text-xs font-extrabold tracking-[0.2em] text-ink-300 uppercase">Código da sala</p>
      <p className="mt-2 flex justify-center gap-1.5 sm:gap-2" aria-label={`Código ${code.split('').join(' ')}`}>
        {code.split('').map((ch, i) => (
          <motion.span
            key={`${ch}-${i}`}
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: 0.08 * i, type: 'spring', stiffness: 300, damping: 18 }}
            className="grid h-14 w-11 place-items-center rounded-xl border border-white/15 bg-ink-950/70 font-mono text-3xl font-black text-white shadow-[inset_0_-3px_0_rgb(255_255_255/0.08)] sm:h-16 sm:w-13 sm:text-4xl"
            aria-hidden="true"
          >
            {ch}
          </motion.span>
        ))}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant={copied ? 'success' : 'ghost'} size="md" className="px-2 text-[15px] whitespace-nowrap" onClick={onCopy} aria-live="polite">
          {copied ? '✓ Copiado!' : '📋 Copiar'}
        </Button>
        <Button variant="secondary" size="md" className="px-2 text-[15px] whitespace-nowrap" onClick={onShare}>
          {canShare() ? '📤 Compartilhar' : '🔗 Link'}
        </Button>
      </div>
    </Panel>
  );
}

function CategoryPicker({ categories, value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const current = categories.find((c) => c.key === value) || categories[0];
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cx(
          'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition-colors',
          disabled ? 'cursor-default border-white/10 bg-white/5' : 'border-white/15 bg-ink-950/50 hover:border-sky-400/60',
        )}
        aria-haspopup="dialog"
        aria-label={`Categoria: ${current?.label}${disabled ? '' : '. Toque para trocar'}`}
      >
        <span className="text-3xl" aria-hidden="true">{current?.emoji}</span>
        <span className="flex-1">
          <span className="block font-display text-xl text-white">{current?.label}</span>
          <span className="block text-xs font-bold text-ink-300">
            {current?.key === 'aleatoria' ? 'O servidor sorteia a cada rodada' : `${current?.count} palavras`}
          </span>
        </span>
        {!disabled && <span className="text-sky-400" aria-hidden="true">Trocar ›</span>}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Escolha a categoria"
        actions={<Button variant="ghost" size="md" onClick={() => setOpen(false)}>Fechar</Button>}
      >
        <div className="-mx-1 grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto px-1 py-1 sm:grid-cols-3">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                onChange(c.key);
                setOpen(false);
              }}
              className={cx(
                'flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 text-center',
                c.key === value ? 'border-hot-400 bg-hot-500/15' : 'border-white/10 bg-white/5 hover:border-white/30',
              )}
              aria-pressed={c.key === value}
            >
              <span className="text-2xl" aria-hidden="true">{c.emoji}</span>
              <span className="text-sm font-extrabold text-white">{c.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

function Setting({ title, help, children }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold tracking-wide text-ink-100 uppercase">{title}</h3>
      </div>
      {children}
      {help && <p className="text-[13px] leading-snug text-ink-300">{help}</p>}
    </div>
  );
}

export default function LobbyScreen() {
  const room = useRoom();
  const { state, actions } = useGame();
  const [starting, setStarting] = useState(false);
  const meta = state.meta;
  const isHost = room.you.isHost;
  const s = room.settings;
  const connected = room.players.filter((p) => p.connected).length;
  const minPlayers = meta?.limits.minPlayers ?? 3;
  const maxPlayers = meta?.limits.maxPlayers ?? 6;
  const missing = Math.max(0, minPlayers - connected);
  const taken = new Set(room.players.filter((p) => p.id !== room.you.id).map((p) => p.avatar));
  const host = room.players.find((p) => p.isHost);
  const hasScores = room.players.some((p) => p.stats.rounds > 0);

  const update = async (patch) => {
    const res = await actions.updateSettings(patch);
    if (!res.ok) actions.toast(res.message, 'error');
  };

  const start = async () => {
    setStarting(true);
    const res = await actions.startGame();
    setStarting(false);
    if (!res.ok) {
      playSound('error');
      actions.toast(res.message, 'error');
    }
  };

  const slots = Math.max(0, maxPlayers - room.players.length);

  return (
    <div className="pb-32 lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-5 lg:pb-8">
      <div className="grid content-start gap-4">
        <RoomCodeCard code={room.code} />

        <Panel>
          <SectionTitle right={<span className="font-display text-lg text-white">{room.players.length}/{maxPlayers}</span>}>
            Jogadores
          </SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {room.players.map((p) => (
                <LobbyPlayerCard key={p.id} player={p} isMe={p.id === room.you.id} />
              ))}
            </AnimatePresence>
            {Array.from({ length: slots }, (_, i) => <EmptySlot key={`empty-${i}`} />)}
          </ul>
        </Panel>

        <Panel>
          <SectionTitle>Seu avatar</SectionTitle>
          {meta && (
            <AvatarPicker
              avatars={meta.avatars}
              value={room.me?.avatar}
              taken={taken}
              onChange={async (a) => {
                const res = await actions.setAvatar(a);
                if (!res.ok) actions.toast(res.message, 'error');
              }}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid content-start gap-4 lg:mt-0">
        <Panel>
          <SectionTitle right={!isHost && <span className="text-xs font-bold text-ink-300">🔒 Só o host altera</span>}>
            Configurações
          </SectionTitle>
          <fieldset disabled={!isHost} className="grid gap-5">
            <legend className="sr-only">Configurações da partida</legend>
            <Setting title="Categoria" help="De onde vem a palavra secreta. 🎲 Aleatória sorteia uma categoria diferente a cada rodada.">
              {meta && (
                <CategoryPicker
                  categories={meta.categories}
                  value={s.category}
                  disabled={!isHost}
                  onChange={(category) => update({ category })}
                />
              )}
            </Setting>
            <Setting
              title="Impostores"
              help={room.players.length >= maxPlayers ? 'Com 6 jogadores dá para ter 2 impostores.' : `2 impostores só com ${maxPlayers} jogadores na sala.`}
            >
              <Segmented
                label="Número de impostores"
                name="impostors"
                value={s.impostorCount}
                disabled={!isHost}
                onChange={(impostorCount) => update({ impostorCount })}
                options={[
                  { value: 1, label: '1 impostor' },
                  { value: 2, label: '2 impostores', disabled: room.players.length < maxPlayers },
                ]}
              />
            </Setting>
            <Setting title="Modo do impostor" help={MODE_HELP[s.impostorMode]}>
              <Segmented
                label="Modo do impostor"
                name="mode"
                value={s.impostorMode}
                disabled={!isHost}
                onChange={(impostorMode) => update({ impostorMode })}
                options={[
                  { value: 'noWord', label: '🙈 Sem palavra' },
                  { value: 'similar', label: '🎭 Palavra parecida' },
                ]}
              />
            </Setting>
            <Setting title="Tempo por pista" help="Quanto tempo cada jogador tem para mandar a pista na sua vez.">
              <Segmented
                label="Tempo por pista"
                name="clue"
                value={s.clueSeconds}
                disabled={!isHost}
                onChange={(clueSeconds) => update({ clueSeconds })}
                options={(meta?.settingsOptions.clueSeconds || [20, 30, 45, 60]).map((v) => ({ value: v, label: `${v}s` }))}
              />
            </Setting>
            <Setting title="Tempo de discussão" help="Duração do chat antes da votação. Se todos ficarem prontos, a votação começa antes.">
              <Segmented
                label="Tempo de discussão"
                name="discussion"
                value={s.discussionSeconds}
                disabled={!isHost}
                onChange={(discussionSeconds) => update({ discussionSeconds })}
                options={(meta?.settingsOptions.discussionSeconds || [45, 60, 90, 120, 180]).map((v) => ({
                  value: v,
                  label: v >= 120 ? `${v / 60}min` : `${v}s`,
                }))}
              />
            </Setting>
          </fieldset>
        </Panel>

        {hasScores && (
          <Panel>
            <Leaderboard players={room.players} meId={room.you.id} title="Placar da sala" compact />
          </Panel>
        )}

        <HowToPlay />
      </div>

      {/* Barra de ação fixa embaixo: alcançável com o polegar */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-4 pt-6 safe-bottom lg:static lg:col-span-2 lg:mt-5 lg:bg-none lg:p-0">
        <div className="mx-auto w-full max-w-md lg:max-w-sm">
          {isHost ? (
            <>
              <Button size="xl" block onClick={start} loading={starting} disabled={missing > 0}>
                ▶ Iniciar partida
              </Button>
              <p className="mt-2 text-center text-sm font-bold text-ink-300" role="status">
                {missing > 0
                  ? `Mínimo de ${minPlayers} jogadores conectados — falta${missing > 1 ? 'm' : ''} ${missing}.`
                  : `${connected} jogadores prontos. Bora!`}
              </p>
            </>
          ) : (
            <div className="glass rounded-3xl px-4 py-4 text-center" role="status">
              <p className="shimmer-text font-display text-xl">Aguardando o host iniciar…</p>
              <p className="mt-0.5 text-sm text-ink-300">👑 {host?.nickname} começa a partida</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
