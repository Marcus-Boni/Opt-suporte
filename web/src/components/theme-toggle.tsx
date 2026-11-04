import { Monitor, Moon, Sun } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { Button, cx } from '@/components/ui';
import { useTheme, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Tema escuro', icon: Moon },
  { value: 'system', label: 'Seguir o sistema', icon: Monitor },
];

/**
 * Seletor de tema. `segmented` mostra as três opções (claro/escuro/sistema);
 * `icon` é um botão único que alterna entre elas (sidebar recolhida).
 * `tone="night"` para superfícies sempre escuras (sidebar).
 */
export function ThemeToggle({ variant = 'segmented', tone = 'paper', side = 'top' }: { variant?: 'segmented' | 'icon'; tone?: 'paper' | 'night'; side?: 'top' | 'right' | 'bottom' }) {
  const { theme, setTheme } = useTheme();
  const night = tone === 'night';
  if (variant === 'icon') {
    const i = OPTIONS.findIndex((o) => o.value === theme);
    const cur = OPTIONS[i]; const next = OPTIONS[(i + 1) % OPTIONS.length];
    return (
      <Tip side={side} label={<>{cur.label} · clique para {next.label.toLowerCase()}</>}>
        <Button variant="ghost" size="icon-sm" onClick={() => setTheme(next.value)} aria-label={`${cur.label}. Mudar para ${next.label.toLowerCase()}`} className={night ? 'text-dusk hover:text-paper hover:bg-white/[0.06]' : 'text-ink-4'}>
          <cur.icon />
        </Button>
      </Tip>
    );
  }
  return (
    <ToggleGroup type="single" value={theme} onValueChange={(v) => { if (v) setTheme(v as Theme); }} spacing={0} aria-label="Tema" className={cx('inline-flex rounded-lg p-0.5 gap-0.5', night ? 'bg-white/[0.05] ring-1 ring-inset ring-white/[0.05]' : 'bg-paper-3')}>
      {OPTIONS.map((o) => (
        <Tip key={o.value} side={side} label={o.label}>
          <ToggleGroupItem value={o.value} aria-label={o.label} className={cx('pressable size-7 min-w-0 rounded-md border-0 p-0 first:rounded-md last:rounded-md hover:bg-transparent [&_svg]:size-3.5',
            night ? 'text-dusk hover:text-paper data-[state=on]:bg-white/[0.1] data-[state=on]:text-paper' : 'text-ink-4 hover:text-ink data-[state=on]:bg-card data-[state=on]:text-ink data-[state=on]:shadow-card')}>
            <o.icon />
          </ToggleGroupItem>
        </Tip>
      ))}
    </ToggleGroup>
  );
}
