import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

/** shadcn/ui Button com as variantes e tamanhos da linguagem visual Optsolv Suporte. */
const buttonVariants = cva(
  'pressable group/button inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring/40 shadow-[0_1px_2px_rgba(23,22,15,0.12),inset_0_1px_0_rgba(255,255,255,0.18)]',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring/40 shadow-[0_1px_2px_rgba(23,22,15,0.12),inset_0_1px_0_rgba(255,255,255,0.18)]',
        secondary: 'bg-card text-ink border border-line-2 hover:border-ink-5 hover:bg-paper-2',
        outline: 'bg-transparent text-ink border border-line-2 hover:bg-paper-2',
        ghost: 'bg-transparent text-ink-2 hover:bg-paper-2',
        danger: 'bg-bad-soft text-bad hover:bg-[#F6D3CE]',
        destructive: 'bg-bad-soft text-bad hover:bg-[#F6D3CE]',
        dark: 'bg-ink text-paper hover:bg-ink-2',
        link: 'text-orange-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm gap-1.5 rounded-md [&_svg:not([class*=size-])]:size-3.5',
        md: 'h-10 px-4 text-base gap-2 rounded-lg [&_svg:not([class*=size-])]:size-4',
        default: 'h-10 px-4 text-base gap-2 rounded-lg [&_svg:not([class*=size-])]:size-4',
        lg: 'h-12 px-5 text-md gap-2 rounded-xl [&_svg:not([class*=size-])]:size-[18px]',
        icon: 'size-10 rounded-lg [&_svg:not([class*=size-])]:size-4',
        'icon-sm': 'size-8 rounded-md [&_svg:not([class*=size-])]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({ className, variant = 'default', size = 'default', asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
