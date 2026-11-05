/**
 * Camada fina sobre shadcn/ui (src/components/ui/*): mantém a API usada pelas páginas
 * (Button com loading/icon, Field, Dialog com título, SimpleSelect com opções, Segmented, Stat…)
 * e concentra a linguagem visual em um lugar só.
 */
import { useEffect, useState, type ReactNode, type ComponentProps } from 'react';
import { Link } from 'react-router';
import { CalendarDays, Inbox, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toInputDate } from '@/lib/labels';
import { ApiError } from '@/lib/api';
import { MissingRecord } from '@/components/status-screens';
import { CountUp } from '@/components/count-up';
import { Sparkline } from '@/components/charts';
import { cn } from '@/lib/utils';
import { Button as ShadButton, type buttonVariants } from '@/components/ui/button';
import { Input as ShadInput } from '@/components/ui/input';
import { Textarea as ShadTextarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge as ShadBadge } from '@/components/ui/badge';
import { Avatar as ShadAvatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog as ShadDialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select as ShadSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { VariantProps } from 'class-variance-authority';

export const cx = cn;
export { Label, Checkbox } from './ui/checkbox-label';
export { Card, CardContent } from '@/components/ui/card';
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
export { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type Size = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export type ButtonProps = ComponentProps<typeof ShadButton> & { loading?: boolean; icon?: ReactNode; variant?: Variant; size?: Size };
export function Button({ loading, icon, children, disabled, variant = 'primary', size = 'md', ...rest }: ButtonProps) {
  return (
    <ShadButton variant={variant} size={size} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </ShadButton>
  );
}

export function ButtonLink({ to, variant = 'primary', size = 'md', icon, className, children }: { to: string; variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <ShadButton asChild variant={variant} size={size} className={className}>
      <Link to={to}>{icon}{children}</Link>
    </ShadButton>
  );
}

export function Input({ className, ...rest }: ComponentProps<typeof ShadInput>) {
  return <ShadInput className={cn('h-10 rounded-lg bg-card px-3.5 text-lg md:text-md border-line-2 hover:border-ink-5 focus-visible:ring-orange-100 placeholder:text-ink-5', className)} {...rest} />;
}
export function Textarea({ className, ...rest }: ComponentProps<typeof ShadTextarea>) {
  return <ShadTextarea className={cn('min-h-[96px] rounded-lg bg-card px-3.5 py-2.5 text-lg md:text-md leading-relaxed border-line-2 hover:border-ink-5 focus-visible:ring-orange-100 placeholder:text-ink-5', className)} {...rest} />;
}

const EMPTY = '__empty__';
export type Option = { value: string; label: string; disabled?: boolean };
/**
 * Select do shadcn com lista de opções; aceita "" como valor (mapeado internamente) e `name` para formulários.
 * Estados inteligentes: `loading` mostra "Carregando…"; sem nada para escolher mostra `empty` (com `emptyAction`
 * opcional, ex.: link para cadastrar) no lugar de um select vazio. Com `empty`, opções de valor "" ("Todos…")
 * não contam como escolha.
 */
export function SimpleSelect({ value, defaultValue, onValueChange, options, placeholder = 'Selecione…', name, disabled, className, size = 'md', required, loading, empty, emptyAction, 'aria-label': ariaLabel }: {
  value?: string; defaultValue?: string; onValueChange?: (v: string) => void; options: Option[]; placeholder?: string; name?: string; disabled?: boolean; className?: string; size?: 'sm' | 'md'; required?: boolean;
  loading?: boolean; empty?: string; emptyAction?: ReactNode; 'aria-label'?: string;
}) {
  // Sempre controlado por dentro: o rótulo exibido vem das opções, não da coleção interna do Radix.
  const [inner, setInner] = useState(value ?? defaultValue ?? '');
  useEffect(() => { if (value !== undefined) setInner(value); }, [value]);
  const current = value !== undefined ? value : inner;
  const label = options.find((o) => o.value === current)?.label;
  const enc = (v: string) => (v === '' ? EMPTY : v);
  const dec = (v: string) => (v === EMPTY ? '' : v);
  const box = size === 'sm' ? 'h-9 rounded-lg px-3 text-sm' : 'h-10 rounded-lg px-3.5 text-md';
  const isEmpty = !loading && (empty ? !options.some((o) => o.value !== '') : options.length === 0);
  if (loading || isEmpty) {
    return (
      <div role="status" aria-label={ariaLabel} className={cn('fade-in flex w-full items-center gap-2 border border-dashed border-line-2 bg-paper-2/60 text-ink-4', box, className)}>
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Inbox className="size-4 shrink-0" aria-hidden />}
        <span className="min-w-0 truncate font-normal">{loading ? 'Carregando…' : empty ?? 'Nenhuma opção disponível'}</span>
        {!loading && emptyAction && <span className="ml-auto shrink-0 text-sm font-semibold">{emptyAction}</span>}
        {/* Mantém a validação nativa do formulário: campo obrigatório sem opção bloqueia o envio. */}
        {name && required && <input tabIndex={-1} aria-hidden name={name} required value="" onChange={() => {}} className="sr-only" />}
      </div>
    );
  }
  return (
    <ShadSelect value={enc(current)} onValueChange={(v) => { const d = dec(v); setInner(d); onValueChange?.(d); }} name={name} disabled={disabled} required={required}>
      <SelectTrigger aria-label={ariaLabel} className={cn('w-full bg-card border-line-2 hover:border-ink-5 focus-visible:ring-orange-100 font-medium text-ink data-[placeholder]:font-normal data-[placeholder]:text-ink-5', box, className)}>
        <SelectValue placeholder={placeholder}>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" className="rounded-xl shadow-pop ring-line">
        {options.map((o) => <SelectItem key={o.value || EMPTY} value={o.value || EMPTY} disabled={o.disabled} className="text-base py-1.5">{o.label}</SelectItem>)}
      </SelectContent>
    </ShadSelect>
  );
}

/**
 * Seletor de data (shadcn Popover + Calendar). Envia `name` como AAAA-MM-DD num input oculto,
 * então formulários com FormData continuam iguais ao <input type="date"> que substitui.
 */
export function DatePicker({ name, value, defaultValue, onChange, min, required, className, 'aria-label': ariaLabel }: {
  name?: string; value?: Date; defaultValue?: Date; onChange?: (d: Date) => void; min?: Date; required?: boolean; className?: string; 'aria-label'?: string;
}) {
  const [inner, setInner] = useState<Date | undefined>(value ?? defaultValue);
  const [open, setOpen] = useState(false);
  const date = value ?? inner;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ShadButton type="button" variant="secondary" aria-label={ariaLabel} className={cn('h-10 w-full justify-start gap-2 bg-card px-3.5 text-lg md:text-md font-normal border-line-2 hover:border-ink-5 hover:bg-card', !date && 'text-ink-5', className)}>
          <CalendarDays className="text-ink-4" />
          <span className="tnum">{date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Escolha a data'}</span>
        </ShadButton>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar mode="single" required selected={date} defaultMonth={date} disabled={min ? { before: min } : undefined}
          onSelect={(d) => { if (!d) return; setInner(d); onChange?.(d); setOpen(false); }} />
      </PopoverContent>
      {name && <input type="hidden" name={name} value={date ? toInputDate(date) : ''} required={required} />}
    </Popover>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <Label className={cn('flex flex-col items-stretch gap-1.5 text-sm font-semibold text-ink-3', className)}>
      <span>{label}</span>
      {children}
      {error ? <span className="text-sm font-normal text-bad">{error}</span> : hint ? <span className="text-sm font-normal text-ink-4">{hint}</span> : null}
    </Label>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'info' | 'warn' | 'ok' | 'bad' | 'orange' | 'ink'; children: ReactNode; className?: string }) {
  return <ShadBadge variant={tone} className={className}>{children}</ShadBadge>;
}

export function Avatar({ name, size = 28, tone = 'paper' }: { name: string; size?: number; tone?: 'paper' | 'orange' | 'ink' }) {
  const init = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  const t = { paper: 'bg-paper-3 text-ink-2', orange: 'bg-orange-100 text-orange-800', ink: 'bg-ink text-paper' }[tone];
  return (
    <ShadAvatar className="after:hidden" style={{ width: size, height: size }} aria-hidden>
      <AvatarFallback className={cn('font-semibold', t)} style={{ fontSize: size * 0.38 }}>{init}</AvatarFallback>
    </ShadAvatar>
  );
}

// Sem o animate-pulse do shadcn: o brilho que varre (.shimmer, só transform) é o único movimento.
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) { return <div data-slot="skeleton" aria-hidden className={cn('shimmer rounded-md', className)} style={style} />; }

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center text-center px-6 py-14 rounded-2xl border border-dashed border-line-2 bg-paper-2/60">
      {icon && <div className="mb-3 text-orange-500">{icon}</div>}
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-[42ch] text-base text-ink-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  if (error instanceof ApiError && error.status === 404) return <MissingRecord message={error.message} />;
  const msg = error instanceof Error ? error.message : 'Algo deu errado.';
  return (
    <div role="alert" className="rise rounded-2xl border border-bad/30 bg-bad-soft px-5 py-4 text-base text-bad flex items-center justify-between gap-4">
      <span>{msg}</span>
      {retry && <Button variant="secondary" size="sm" onClick={retry}>Tentar de novo</Button>}
    </div>
  );
}

export function PageHeader({ title, lead, actions, crumbs }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <header className="rise mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs && <div className="mb-2 text-sm text-ink-4 flex items-center gap-1.5">{crumbs}</div>}
        <h1 className="text-4xl md:text-5xl leading-[1.05] font-semibold tracking-tight text-ink">{title}</h1>
        {lead && <p className="mt-2 text-md text-ink-3 max-w-[64ch]">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function Dialog({ open, onClose, title, description, children, width = 520 }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; width?: number }) {
  return (
    <ShadDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-3xl bg-card p-6 text-ink shadow-pop ring-line sm:max-w-[var(--dlg-w)]" style={{ '--dlg-w': `${width}px` } as React.CSSProperties}>
        <DialogHeader className="mb-1 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription className="text-base text-ink-3">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </ShadDialog>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: 'sm' | 'md' }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={(v) => { if (v) onChange(v as T); }} spacing={0} className="inline-flex bg-paper-3 rounded-lg p-0.5 gap-0.5">
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={cn('pressable rounded-md font-semibold text-ink-3 hover:text-ink hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-ink data-[state=on]:shadow-card border-0 first:rounded-md last:rounded-md', size === 'sm' ? 'px-2.5 h-7 text-xs' : 'px-3.5 h-8 text-sm')}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Indicador: número sobe na primeira pintura; `trend` desenha uma linha de tendência discreta ao lado. */
export function Stat({ label, value, sub, accent, trend }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean; trend?: number[] }) {
  return (
    <div className="min-w-0 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="eyebrow text-ink-4">{label}</div>
        <div className={cn('mt-1 text-4xl leading-none font-semibold tracking-tighter tnum', accent ? 'text-orange-600' : 'text-ink')}>{typeof value === 'number' ? <CountUp to={value} /> : value}</div>
        {sub && <div className="mt-1.5 text-sm text-ink-3 text-pretty">{sub}</div>}
      </div>
      {trend && trend.length > 1 && <Sparkline data={trend} color={accent ? '#FF6B3D' : '#AEAC9F'} className="mt-5 shrink-0 hidden md:block" />}
    </div>
  );
}

/** Confirmação de ação irreversível: nomeia a consequência antes do botão. */
export function Confirm({ open, onClose, title, description, confirmLabel = 'Confirmar', onConfirm, loading, danger }: { open: boolean; onClose: () => void; title: string; description: string; confirmLabel?: string; onConfirm: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} width={440}>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

/** Chip de filtro (botão alternável) usado em listas. */
export function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <ShadButton type="button" variant={active ? 'dark' : 'secondary'} size="sm" onClick={onClick} aria-pressed={active} className={cn('rounded-full h-8', className)}>{children}</ShadButton>
  );
}
