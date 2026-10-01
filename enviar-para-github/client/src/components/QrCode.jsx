// QR code do convite da sala. A biblioteca só é baixada quando o QR é aberto.

import { useEffect, useState } from 'react';
import { Spinner } from './ui.jsx';

export function QrCode({ text, size = 232 }) {
  const [path, setPath] = useState(null);
  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode-generator')
      .then(({ default: qrcode }) => {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const n = qr.getModuleCount();
        let d = '';
        for (let r = 0; r < n; r += 1) {
          for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
        }
        if (!cancelled) {
          setCount(n);
          setPath(d);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (failed) return <p className="text-sm text-bad-400">Não foi possível gerar o QR code.</p>;
  if (!path) {
    return (
      <div className="grid place-items-center" style={{ width: size, height: size }}>
        <Spinner className="size-8 text-sky-400" />
      </div>
    );
  }
  const margin = 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${count + margin * 2} ${count + margin * 2}`}
      role="img"
      aria-label="QR code para entrar na sala"
      shapeRendering="crispEdges"
      className="rounded-2xl bg-white"
    >
      <rect x={-margin} y={-margin} width={count + margin * 2} height={count + margin * 2} fill="#ffffff" />
      <path d={path} fill="#0d0927" />
    </svg>
  );
}
