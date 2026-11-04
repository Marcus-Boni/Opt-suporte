import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** shadcn/ui Command (cmdk) com a linguagem visual do produto. */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn('flex h-full w-full flex-col overflow-hidden rounded-2xl bg-card text-ink', className)} {...props} />;
}

/**
 * Paleta aberta por atalho de teclado: sem animação de entrada/saída de propósito.
 * Ações repetidas dezenas de vezes por dia precisam parecer instantâneas.
 */
function CommandDialog({ title = 'Paleta de comandos', description = 'Busque uma solicitação ou navegue pelo sistema.', children, value, onValueChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root> & { title?: string; description?: string; value?: string; onValueChange?: (v: string) => void }) {
  return (
    <DialogPrimitive.Root data-slot="command-dialog" {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 supports-backdrop-filter:backdrop-blur-[2px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-2xl bg-card shadow-pop ring-1 ring-line outline-none">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          <Command label={title} shouldFilter={false} value={value} onValueChange={onValueChange} className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-2xs **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wide **:[[cmdk-group-heading]]:text-ink-4">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-12 items-center gap-2.5 border-b border-line px-4">
      <SearchIcon className="size-4 shrink-0 text-ink-4" />
      <CommandPrimitive.Input data-slot="command-input" className={cn('flex h-10 w-full bg-transparent text-md outline-none placeholder:text-ink-5 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn('max-h-[min(60vh,420px)] scroll-py-1 overflow-x-hidden overflow-y-auto p-1.5', className)} {...props} />;
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-8 text-center text-sm text-ink-4" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn('overflow-hidden text-ink', className)} {...props} />;
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator data-slot="command-separator" className={cn('my-1 h-px bg-line', className)} {...props} />;
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn('relative flex cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-base outline-none data-[selected=true]:bg-orange-50 data-[selected=true]:text-ink data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 [&_svg]:text-ink-4 data-[selected=true]:[&_svg]:text-orange-600', className)}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="command-shortcut" className={cn('ml-auto text-2xs font-medium tnum text-ink-5', className)} {...props} />;
}

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut };
