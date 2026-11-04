import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

/**
 * Tema claro/escuro/sistema (padrão shadcn para Vite). A classe `.dark` vai no <html>;
 * o script em index.html aplica a mesma regra antes da primeira pintura, sem piscar.
 */
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'optsolv-theme';
const media = () => matchMedia('(prefers-color-scheme: dark)');

function read(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

const resolve = (theme: Theme) => theme === 'dark' || (theme === 'system' && media().matches);

function apply(theme: Theme) {
  const dark = resolve(theme);
  const root = document.documentElement;
  // Troca de tema sem transições: senão cada cor anima em tempos diferentes e a tela "escorre".
  const off = document.createElement('style');
  off.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(off);
  root.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111111' : '#F7F6F1');
  void getComputedStyle(root).opacity; // força o recálculo antes de reativar as transições
  requestAnimationFrame(() => off.remove());
}

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    apply(theme);
    try { if (theme === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, theme); } catch { /* modo privado */ }
    if (theme !== 'system') return;
    const m = media(); const on = () => apply('system');
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [theme]);
  // Troca animada: o tema novo entra da esquerda para a direita atrás de uma frente em chevron (">" do símbolo Optsolv).
  // Sem animação quando o tema resolvido não muda, com movimento reduzido ou sem View Transitions.
  const change = (next: Theme) => {
    const same = resolve(next) === document.documentElement.classList.contains('dark');
    if (same || matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) { setTheme(next); return; }
    const vt = document.startViewTransition(() => { flushSync(() => setTheme(next)); apply(next); });
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: ['polygon(0 0, -20% 0, 0 50%, -20% 100%, 0 100%)', 'polygon(0 0, 100% 0, 120% 50%, 100% 100%, 0 100%)'] },
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {}); // transição pulada (aba oculta, outra começou): o tema já foi aplicado
  };
  return <Ctx.Provider value={{ theme, setTheme: change }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
