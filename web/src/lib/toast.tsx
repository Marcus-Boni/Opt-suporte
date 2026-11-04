import { Toaster as SonnerToaster, toast as sonner } from 'sonner';

/** Toasts com Sonner (shadcn/ui). API curta usada pelas páginas. */
export const toast = {
  ok: (text: string) => sonner.success(text),
  bad: (text: string) => sonner.error(text, { duration: 7000 }),
  info: (text: string) => sonner.info(text),
  /** Sucesso com janela de arrependimento: a ação some com o toast. */
  undo: (text: string, onUndo: () => void) => sonner.success(text, { duration: 8000, action: { label: 'Desfazer', onClick: onUndo } }),
};

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      mobileOffset={{ bottom: 76 }}
      closeButton
      toastOptions={{
        classNames: {
          toast: '!bg-[#17160F] !text-[#F7F6F1] !border-0 !rounded-xl !shadow-pop !text-base !font-sans dark:!bg-popover dark:!text-ink',
          description: '!text-[#D1CDC0] dark:!text-ink-3',
          success: '[&_svg]:!text-orange-400',
          error: '[&_svg]:!text-[#FF8A7A]',
          closeButton: '!bg-[#2B2A22] !text-[#D1CDC0] !border-0 dark:!bg-paper-3 dark:!text-ink-3',
          actionButton: '!bg-primary !text-primary-foreground !font-semibold !rounded-md',
        },
      }}
    />
  );
}
