// Logger mínimo com níveis. Em testes, LOG_LEVEL=silent deixa a saída limpa.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const current = () => LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

const stamp = () => new Date().toISOString().slice(11, 19);

export const logger = {
  debug: (...a) => current() <= LEVELS.debug && console.debug(stamp(), '[debug]', ...a),
  info: (...a) => current() <= LEVELS.info && console.log(stamp(), '[info]', ...a),
  warn: (...a) => current() <= LEVELS.warn && console.warn(stamp(), '[warn]', ...a),
  error: (...a) => current() <= LEVELS.error && console.error(stamp(), '[error]', ...a),
};
