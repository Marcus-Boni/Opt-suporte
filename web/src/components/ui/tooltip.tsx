import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Tooltip. Atraso inicial evita disparo acidental; depois do primeiro aberto,
 * os vizinhos abrem na hora e sem animação (skipDelayDuration + data-state=instant-open).
 */
function TooltipProvider({ delayDuration = 400, skipDelayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />;
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({ className, sideOffset = 8, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 origin-(--radix-tooltip-content-transform-origin) rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-pop',
          'duration-125 ease-(--ease-out-strong) data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-97 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-75',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/** Atalho: envolve um gatilho com dica. `hidden` desliga sem mudar a árvore (ex.: sidebar expandida). */
function Tip({ label, side = 'top', hidden, children }: { label: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; hidden?: boolean; children: React.ReactElement }) {
  return (
    <Tooltip open={hidden ? false : undefined}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Tip };
