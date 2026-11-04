import { useEffect, useRef, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useLocation } from 'react-router';

/**
 * Barra fina no topo enquanto a tela busca dados (troca de rota ou recarga).
 * Só aparece se a espera passar de 150ms (carregamento rápido não pisca); avança devagar até ~85%
 * e completa ao terminar. Anima só transform/opacity.
 */
export function RouteProgress() {
  const fetching = useIsFetching() > 0;
  const loc = useLocation();
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const timer = useRef<number>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (fetching) timer.current = window.setTimeout(() => setPhase('run'), 150);
    else setPhase((p) => (p === 'run' ? 'done' : p));
    return () => clearTimeout(timer.current);
  }, [fetching, loc.key]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = window.setTimeout(() => setPhase('idle'), 450);
    return () => clearTimeout(t);
  }, [phase]);

  const scale = phase === 'idle' ? 0 : phase === 'run' ? 0.85 : 1;
  return (
    <div aria-hidden className="route-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 shadow-[0_0_10px_rgba(255,107,61,0.6)]"
      style={{
        transform: `scaleX(${scale})`,
        opacity: phase === 'done' ? 0 : phase === 'run' ? 1 : 0,
        // Avança devagar (ease-out longo) e completa rápido; voltar a zero é instantâneo e invisível.
        transition: phase === 'run' ? 'transform 2.4s cubic-bezier(0.23, 1, 0.32, 1), opacity 120ms ease' : phase === 'done' ? 'transform 200ms ease-out, opacity 250ms ease 180ms' : 'none',
      }}
    />
  );
}
