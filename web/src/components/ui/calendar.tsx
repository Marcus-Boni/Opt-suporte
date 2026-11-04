import * as React from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** shadcn/ui Calendar (react-day-picker v9) em pt-BR, com os tokens do produto. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames();
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn('[--cell:--spacing(9)] select-none', className)}
      classNames={{
        root: cn('w-fit', d.root),
        months: cn('relative flex flex-col gap-4', d.months),
        month: cn('flex w-full flex-col gap-3', d.month),
        nav: cn('absolute inset-x-0 top-0 flex items-center justify-between', d.nav),
        button_previous: cn('pressable inline-flex size-(--cell) items-center justify-center rounded-lg text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-40', d.button_previous),
        button_next: cn('pressable inline-flex size-(--cell) items-center justify-center rounded-lg text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-40', d.button_next),
        month_caption: cn('flex h-(--cell) items-center justify-center', d.month_caption),
        caption_label: cn('text-base font-semibold capitalize', d.caption_label),
        month_grid: 'w-full border-collapse',
        weekdays: cn('flex', d.weekdays),
        weekday: cn('w-(--cell) text-2xs font-medium uppercase text-ink-4', d.weekday),
        week: cn('mt-1 flex w-full', d.week),
        day: cn('relative size-(--cell) p-0 text-center', d.day),
        today: 'font-semibold text-orange-700',
        selected: '',
        outside: cn('text-ink-5 opacity-60', d.outside),
        disabled: cn('opacity-35', d.disabled),
        hidden: cn('invisible', d.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c, ...rest }) => (orientation === 'left' ? <ChevronLeft className={cn('size-4', c)} {...rest} /> : <ChevronRight className={cn('size-4', c)} {...rest} />),
        DayButton: ({ className: c, modifiers, day: _day, ...rest }) => (
          <button
            {...rest}
            data-selected={modifiers.selected || undefined}
            className={cn(
              'pressable inline-flex size-(--cell) items-center justify-center rounded-lg text-sm tnum outline-none hover:bg-paper-2 focus-visible:ring-3 focus-visible:ring-ring/40',
              'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:font-semibold data-[selected]:hover:bg-primary-hover',
              c,
            )}
          />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
