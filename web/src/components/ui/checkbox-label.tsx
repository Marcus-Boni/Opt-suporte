import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox as ShadCheckbox } from '@/components/ui/checkbox';
import { Label as ShadLabel } from '@/components/ui/label';

/** Checkbox do shadcn na cor da interface; `name`/`value` continuam funcionando em formulários. */
export function Checkbox({ className, ...rest }: ComponentProps<typeof ShadCheckbox>) {
  return <ShadCheckbox className={cn('size-4 rounded-[4px] border-line-2 bg-card data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground focus-visible:ring-orange-100', className)} {...rest} />;
}

export function Label({ className, ...rest }: ComponentProps<typeof ShadLabel>) {
  return <ShadLabel className={cn('text-base font-medium text-ink leading-snug', className)} {...rest} />;
}
