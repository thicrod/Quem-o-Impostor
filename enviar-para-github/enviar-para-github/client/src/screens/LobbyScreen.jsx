import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { canShare, copyText, shareRoom } from '../lib/format.js';
import { playSound } from '../lib/sound.js';
import { Button, Panel, SectionTitle } from '../components/ui.jsx';
import { EmptySlot, LobbyPlayerCard } from '../components/PlayerCard.jsx';
import { AvatarPicker } from '../components/AvatarPicker.jsx';
import { Segmented } from '../components/Segmented.jsx';
import { CategoryPicker } from '../components/CategoryPicker.jsx';
import { Leaderboard } from '../components/Leaderboard.jsx';
import { HowToPlay } from '../components/HowToPlay.jsx';

const MODE_HELP = {
  noWord: 'O impostor não recebe palavra nenhuma e precisa blefar só com as pistas dos outros.',
  similar: 'O impostor recebe uma palavra parecida (ex.: lasanha em vez de pizza) e sabe que é o impostor.',
};

const HINT_HELP = {
  hard: '🔥 Difícil: o impostor não sabe nem a categoria.',
  normal: '🙂 Normal: o impostor sabe só a categoria.',
  easy: '🍀 Fácil: sabe a categoria e quantas letras a palavra tem.',
};

// Ritmos prontos: mudam só os tempos e as voltas de pista.
const PRESETS = [
  { key: 'fast', label: '⚡ Rápido', settings: { clueSeconds: 20, discussionSeconds: 60, votingSeconds: 30, clueRounds: 1 } },
  { key: 'classic', label: '🎯 Clássico', settings: { clueSeconds: 30, discussionSeconds: 90, votingSeconds: 45, clueRounds: 1 } },
  { key: 'long', label: '🧠 Longo', settings: { clueSeconds: 45, discussionSeconds: 120, votingSeconds: 60, clueRounds: 2 } },
];

const matchPreset = (s) => PRESETS.find((p) => Object.entries(p.settings).every(([k, v]) => s[k] === v))?.key ?? null;

const fmtSeconds = (v) => (v >= 120 ? `${v / 60}min` : `${v}s`);

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

function AdvancedSettings({ s, meta, isHost, update }) {
  const [open, setOpen] = useState(false);
  const changed = s.clueRounds !== 1 || s.votingSeconds !== 45 || s.anonymousVotes || s.targetScore > 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left text-sm font-extrabold tracking-wide text-ink-100 uppercase"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>🛠️ Mais opções {changed && <span className="ml-1 inline-block size-2 rounded-full bg-sun-400 align-middle" aria-label="(alteradas)" />}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} aria-hidden="true">⌄</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-5 px-4 pt-1 pb-4">
              <Setting title="Voltas de pistas" help="Quantas pistas cada jogador dá antes da discussão.">
                <Segmented
                  label="Voltas de pistas"
                  name="clueRounds"
                  value={s.clueRounds}
                  disabled={!isHost}
                  onChange={(clueRounds) => update({ clueRounds })}
                  options={(meta?.settingsOptions.clueRounds || [1, 2]).map((v) => ({ value: v, label: v === 1 ? '1 pista' : `${v} pistas` }))}
                />
              </Setting>
              <Setting title="Tempo de votação">
                <Segmented
                  label="Tempo de votação"
                  name="voting"
                  value={s.votingSeconds}
                  disabled={!isHost}
                  onChange={(votingSeconds) => update({ votingSeconds })}
                  options={(meta?.settingsOptions.votingSeconds || [30, 45, 60]).map((v) => ({ value: v, label: fmtSeconds(v) }))}
                />
              </Setting>
              <Setting
                title="Votos"
                help={s.anonymousVotes ? 'Secretos: aparece só quantos votos cada um levou, não quem votou em quem.' : 'Abertos: todo mundo vê quem votou em quem.'}
              >
                <Segmented
                  label="Tipo de voto"
                  name="anon"
                  value={s.anonymousVotes}
                  disabled={!isHost}
                  onChange={(anonymousVotes) => update({ anonymousVotes })}
                  options={[
                    { value: false, label: '👀 Abertos' },
                    { value: true, label: '🕶️ Secretos' },
                  ]}
                />
              </Setting>
              <Setting
                title="Partida até"
                help={s.targetScore > 0 ? `Quem chegar a ${s.targetScore} pontos primeiro é o campeão. Depois o placar zera.` : 'Sem limite: o placar só acumula.'}
              >
                <Segmented
                  label="Pontuação para vencer"
                  name="target"
                  value={s.targetScore}
                  disabled={!isHost}
                  onChange={(targetScore) => update({ targetScore })}
                  options={(meta?.settingsOptions.targetScore || [0, 10, 15, 20]).map((v) => ({ value: v, label: v === 0 ? '∞' : `${v} pts` }))}
                />
              </Setting>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            <Setting title="Ritmo" help="Atalhos que ajustam todos os tempos de uma vez.">
              <Segmented
                label="Ritmo da partida"
                name="preset"
                value={matchPreset(s)}
                disabled={!isHost}
                onChange={(key) => update(PRESETS.find((p) => p.key === key).settings)}
                options={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
              />
            </Setting>
            <Setting title="Categorias" help="Escolha uma ou várias: a cada rodada o jogo sorteia uma delas.">
              {meta && (
                <CategoryPicker
                  categories={meta.categories}
                  value={s.categories || []}
                  disabled={!isHost}
                  onChange={(categories) => update({ categories })}
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
            <AnimatePresence initial={false}>
              {s.impostorMode === 'noWord' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <Setting title="Ajuda do impostor" help={HINT_HELP[s.impostorHint]}>
                    <Segmented
                      label="Ajuda do impostor"
                      name="hint"
                      value={s.impostorHint}
                      disabled={!isHost}
                      onChange={(impostorHint) => update({ impostorHint })}
                      options={[
                        { value: 'hard', label: '🔥 Difícil' },
                        { value: 'normal', label: '🙂 Normal' },
                        { value: 'easy', label: '🍀 Fácil' },
                      ]}
                    />
                  </Setting>
                </motion.div>
              )}
            </AnimatePresence>
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
                  label: fmtSeconds(v),
                }))}
              />
            </Setting>
            <AdvancedSettings s={s} meta={meta} isHost={isHost} update={update} />
          </fieldset>
        </Panel>

        {hasScores && (
          <Panel>
            <Leaderboard players={room.players} meId={room.you.id} title="Placar da sala" compact />
            {s.targetScore > 0 && (
              <p className="mt-3 text-center text-sm font-bold text-sun-400">🏁 Partida até {s.targetScore} pontos</p>
            )}
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
