import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import { ApiError } from './lib/api';
import { App } from './app';
import { AuthProvider, resetSession } from './lib/auth';
import { toast } from './lib/toast';
import { ScopeProvider } from './lib/scope';
import { Toaster } from './lib/toast';
import { RouteProgress } from './components/route-progress';
import { ThemeProvider } from './lib/theme';
import { TooltipProvider } from './components/ui/tooltip';

// Erros 4xx (ex.: recurso fora do escopo) não são repetidos: a resposta do servidor é definitiva.
// Sessão expirada em qualquer chamada (401): volta ao login uma vez, com aviso, em vez de espalhar erros pela tela.
const onAuthError = (err: unknown) => {
  if (!(err instanceof ApiError && err.status === 401) || qc.getQueryData(['me']) === null) return;
  resetSession(qc);
  toast.info('Sua sessão expirou. Entre novamente.');
};
const qc: QueryClient = new QueryClient({ queryCache: new QueryCache({ onError: onAuthError }), mutationCache: new MutationCache({ onError: onAuthError }), defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status < 500) } } });

// Spotlight dos cartões clicáveis (.card-interactive::after) e da página de apresentação (.spot::before): um listener delegado, só com mouse.
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  addEventListener('pointermove', (e) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('.card-interactive, .spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
    <TooltipProvider>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <ScopeProvider>
            <RouteProgress />
            <App />
            <Toaster />
          </ScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
