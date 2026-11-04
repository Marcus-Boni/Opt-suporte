import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

/** shadcn/ui Badge com os tons semânticos usados em status, categorias e avisos. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap transition-colors [&_svg]:size-3 [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        neutral: 'bg-paper-3 text-ink-3',
        secondary: 'bg-paper-3 text-ink-3',
        info: 'bg-info-soft text-info',
        warn: 'bg-warn-soft text-warn',
        ok: 'bg-ok-soft text-ok',
        bad: 'bg-bad-soft text-bad',
        destructive: 'bg-bad-soft text-bad',
        orange: 'bg-orange-100 text-orange-800',
        ink: 'bg-ink text-paper',
        outline: 'border border-line-2 text-ink-2',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant = 'default', asChild = false, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';
  return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
