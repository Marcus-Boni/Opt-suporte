import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Número que sobe até o valor final na primeira pintura (ideia do React Bits "CountUp", sem a dependência).
 * Curto (700 ms, ease-out forte) e só uma vez por valor; com menos movimento, mostra o valor direto.
 */
export function CountUp({ to, duration = 700, className }: { to: number; duration?: number; className?: string }) {
  const [v, setV] = useState(reduced() ? to : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(to); return; }
    const start = performance.now(), a = from.current, b = to;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setV(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span className={className}>{v.toLocaleString('pt-BR')}</span>;
}
