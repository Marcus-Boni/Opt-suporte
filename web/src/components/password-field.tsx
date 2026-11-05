import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button, Input, cx } from '@/components/ui';
import { Tip } from '@/components/ui/tooltip';
import { generatePassword, passwordStrength } from '@/lib/password';
import { toast } from '@/lib/toast';

const TONE = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-ok', 'bg-ok'];
const TEXT = ['text-bad', 'text-bad', 'text-warn', 'text-ok', 'text-ok'];

/**
 * Campo de senha nova com medidor de força animado, gerador e cópia.
 * Senha fraca bloqueia o envio pela validação nativa do formulário (setCustomValidity), sem estado no pai.
 * `hints`: nome e e-mail da pessoa, que não devem aparecer na senha.
 */
export function PasswordField({ name, hints = [], label = 'Senha' }: { name: string; hints?: string[]; label?: string }) {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const meterId = useId();
  const s = useMemo(() => passwordStrength(value, hints), [value, hints]);

  useEffect(() => {
    ref.current?.setCustomValidity(!value || s.acceptable ? '' : 'Senha fraca: use 12+ caracteres variados, sem nome, e-mail ou senha comum.');
  }, [value, s.acceptable]);

  const generate = () => { setValue(generatePassword()); setVisible(true); };
  const copy = () => { navigator.clipboard?.writeText(value); toast.ok('Senha copiada.'); };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input ref={ref} name={name} type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={12} value={value}
            onChange={(e) => setValue(e.target.value)} placeholder="Mínimo de 12 caracteres" aria-label={label} aria-describedby={meterId}
            className={cx('pr-10', visible && 'font-mono tracking-wide')} spellCheck={false} />
          <Tip label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
            <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink"
              onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible}>
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </Tip>
        </div>
        <Tip label="Gerar senha forte"><Button type="button" variant="secondary" size="icon" onClick={generate} aria-label="Gerar senha forte"><Sparkles /></Button></Tip>
        <Tip label="Copiar senha"><Button type="button" variant="secondary" size="icon" onClick={copy} disabled={!value} aria-label="Copiar senha"><Copy /></Button></Tip>
      </div>

      <div id={meterId} className="grid gap-2" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="grid flex-1 grid-cols-4 gap-1.5" role="meter" aria-label="Força da senha" aria-valuemin={0} aria-valuemax={4} aria-valuenow={s.score} aria-valuetext={value ? s.label : 'Não informada'}>
            {[1, 2, 3, 4].map((seg) => (
              <span key={seg} className="h-1.5 overflow-hidden rounded-full bg-paper-3">
                {/* Preenche segmento a segmento (só transform), com atraso em cascata ao subir e ao descer. */}
                <span className={cx('block h-full origin-left rounded-full transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none', value ? TONE[s.score] : 'bg-paper-3')}
                  style={{ transform: `scaleX(${value && s.score >= seg ? 1 : value && seg === 1 ? 0.35 : 0})`, transitionDelay: `${(seg - 1) * 50}ms` }} />
              </span>
            ))}
          </div>
          <span key={value ? s.label : 'vazio'} className={cx('fade-in w-[84px] text-right text-xs font-semibold', value ? TEXT[s.score] : 'text-ink-5')}>{value ? s.label : 'Força'}</span>
        </div>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {s.checks.map((c) => (
            <li key={c.id} className={cx('flex items-center gap-1.5 text-xs font-normal transition-colors duration-200', c.ok ? 'text-ink-2' : 'text-ink-4')}>
              <span className={cx('grid size-4 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-200 ease-out', c.ok ? 'scale-100 bg-ok text-white' : 'scale-90 bg-paper-3 text-transparent')}>
                <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
              </span>
              <span>{c.label}<span className="sr-only">{c.ok ? ': atendido' : ': pendente'}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
