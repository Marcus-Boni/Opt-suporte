import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Rolagem suave (Lenis) só em páginas imersivas: resultados compartilhados e prévia de impressão.
 * Painéis operacionais ficam com a rolagem nativa. Desligada com prefers-reduced-motion.
 */
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.9, anchors: { offset: -80 } }); // âncoras (#secao) também rolam suave
    let raf = requestAnimationFrame(function loop(t) { lenis.raf(t); raf = requestAnimationFrame(loop); });
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, [enabled]);
}
