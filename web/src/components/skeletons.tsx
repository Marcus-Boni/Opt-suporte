/**
 * Esqueletos com o formato real de cada tela: o conteúdo entra no mesmo lugar onde o esqueleto estava,
 * sem salto de layout. Cada um anuncia "Carregando" a leitores de tela (role="status").
 */
import type { ReactNode } from 'react';
import { Skeleton, cx } from './ui';

const S = Skeleton;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Busy({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="status" aria-label="Carregando" aria-busy className={cx('fade-in', className)}>{children}</div>;
}

/** Lista em cartão: código · título + meta · status (Solicitações, atenção, portal). */
export function RowsSkeleton({ rows = 6, code = true, bare, className }: { rows?: number; code?: boolean; bare?: boolean; className?: string }) {
  return (
    <Busy className={cx('divide-y divide-line overflow-hidden', !bare && 'card', className)}>
      {range(rows).map((i) => (
        <div key={i} className={cx('flex items-center gap-4 py-3.5', !bare && 'px-4')}>
          {code && <S className="h-3.5 w-12 shrink-0" />}
          <div className="min-w-0 flex-1 grid gap-2"><S className="h-4" style={{ width: `${68 - (i % 3) * 14}%` }} /><S className="h-3 w-32" /></div>
          <S className="h-5 w-20 rounded-full shrink-0" />
        </div>
      ))}
    </Busy>
  );
}

/** Grade de cartões. `delivery` (Entregas), `client` (Clientes), `slide` (Apresentações/Resultados), `news` (Novidades). */
export function CardsSkeleton({ count = 4, variant, className }: { count?: number; variant: 'delivery' | 'client' | 'slide' | 'news'; className?: string }) {
  const grid = variant === 'slide' ? 'md:grid-cols-2 xl:grid-cols-3' : variant === 'news' ? '' : 'md:grid-cols-2';
  return (
    <Busy className={cx('grid gap-4', grid, className)}>
      {range(count).map((i) => {
        if (variant === 'slide') return (
          <div key={i} className="card overflow-hidden">
            <div className="grain-dark aspect-video p-5 flex flex-col"><S className="h-3 w-36 !bg-white/10" /><div className="mt-auto grid gap-2"><S className="h-5 w-4/5 !bg-white/10" /><S className="h-5 w-1/2 !bg-white/10" /></div></div>
            <div className="p-4 flex gap-3"><S className="h-3 w-24" /><S className="h-3 w-14" /></div>
          </div>
        );
        if (variant === 'client') return (
          <div key={i} className="card p-5">
            <div className="flex items-start gap-4"><S className="size-12 rounded-xl shrink-0" /><div className="flex-1 grid gap-2"><S className="h-5 w-1/2" /><S className="h-3.5 w-1/3" /></div></div>
            <div className="mt-5 flex gap-6"><S className="h-3 w-20" /><S className="h-3 w-24" /><S className="h-3 w-16" /></div>
          </div>
        );
        return (
          <div key={i} className={cx('card p-5', variant === 'news' ? 'border-l-[3px] border-l-line-2' : 'border-t-[3px] border-line-2')}>
            <div className="flex items-center justify-between"><S className="h-3 w-40" />{variant === 'delivery' && <S className="h-5 w-20 rounded-full" />}</div>
            <S className="mt-3 h-5 w-3/4" />
            <div className="mt-2.5 grid gap-1.5"><S className="h-3.5" /><S className="h-3.5 w-2/3" /></div>
            {variant === 'delivery' && <div className="mt-5 flex gap-4"><S className="h-3 w-24" /><S className="h-3 w-20" /></div>}
          </div>
        );
      })}
    </Busy>
  );
}

/** Indicadores: rótulo, número grande e linha de apoio. */
export function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <Busy className={cx('grid gap-3', count === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4', className)}>
      {range(count).map((i) => <div key={i} className="card p-5"><S className="h-3 w-24" /><S className="mt-3 h-9 w-16" /><S className="mt-3 h-3 w-32" /></div>)}
    </Busy>
  );
}

/** Detalhe: trilha, selos, título, texto, linha do tempo e painel lateral (Solicitação, Entrega, Novidade). */
export function DetailSkeleton({ aside = true }: { aside?: boolean }) {
  return (
    <Busy>
      <S className="mb-5 h-3.5 w-48" />
      <div className={cx('grid grid-cols-1 gap-6 items-start', aside && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
        <div className="grid gap-5 min-w-0">
          <div className="flex gap-2"><S className="h-5 w-24 rounded-full" /><S className="h-5 w-20 rounded-full" /><S className="h-5 w-16 rounded-full" /></div>
          <S className="h-8 w-3/4" />
          <div className="grid gap-2"><S className="h-4" /><S className="h-4 w-11/12" /><S className="h-4 w-2/3" /></div>
          <div className="card p-5 grid gap-5">
            {range(3).map((i) => <div key={i} className="flex gap-3"><S className="size-7 rounded-full shrink-0" /><div className="flex-1 grid gap-2"><S className="h-3.5 w-1/3" /><S className="h-3.5 w-5/6" /></div></div>)}
          </div>
        </div>
        {aside && <div className="card p-5 grid gap-4">{range(4).map((i) => <div key={i} className="grid gap-2"><S className="h-3 w-20" /><S className="h-9" /></div>)}</div>}
      </div>
    </Busy>
  );
}

/** Editor de apresentação: lista de slides, palco 16:9 e painel de narrativa. */
export function EditorSkeleton() {
  return (
    <Busy>
      <S className="h-3.5 w-48" /><S className="mt-3 h-8 w-2/3" /><S className="mt-2 h-3.5 w-1/2" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_320px] items-start">
        <div className="hidden lg:grid gap-2">{range(5).map((i) => <S key={i} className="h-16 rounded-lg" />)}</div>
        <S className="aspect-video rounded-xl" />
        <div className="card p-5 grid gap-4"><S className="h-4 w-32" /><S className="h-10" /><S className="h-28" /></div>
      </div>
    </Busy>
  );
}

/** Palco de slide único (resultado no portal). */
export function StageSkeleton() {
  return <Busy><S className="aspect-video rounded-2xl" /><div className="mt-4 flex justify-center gap-2">{range(6).map((i) => <S key={i} className="size-2 rounded-full" />)}</div></Busy>;
}
