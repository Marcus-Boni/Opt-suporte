import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { isInternalRole, useAuth } from './lib/auth';
import { ErrorBoundary, NotFoundPage, Orbit } from './components/status-screens';
import { InternalLayout } from './layouts/InternalLayout';
import { PortalLayout } from './layouts/PortalLayout';
import { LoginPage } from './pages/Login';
import { OverviewPage } from './pages/app/Overview';
import { ClientsPage, ClientDetailPage } from './pages/app/Clients';
import { IntakePage } from './pages/app/Intake';
import { RequestsPage } from './pages/app/Requests';
import { RequestDetailPage } from './pages/app/RequestDetail';
import { DeliveriesPage, NewDeliveryPage } from './pages/app/Deliveries';
import { DeliveryDetailPage } from './pages/app/DeliveryDetail';
import { PresentationsPage } from './pages/app/Presentations';
import { PresentationEditorPage } from './pages/app/PresentationEditor';
import { AccessPage } from './pages/app/Access';
import { PortalHomePage } from './pages/portal/Home';
import { PortalRequestsPage, PortalNewRequestPage } from './pages/portal/Requests';
import { PortalRequestDetailPage } from './pages/portal/RequestDetail';
import { PortalNewsPage, PortalNewsDetailPage } from './pages/portal/News';
import { PortalResultsPage, PortalResultDetailPage } from './pages/portal/Results';

// Modo apresentação e impressão carregam GSAP só quando abertos: ficam fora do bundle principal.
const PresentPage = lazy(() => import('./pages/shared/Present').then((m) => ({ default: m.PresentPage })));
const PrintPage = lazy(() => import('./pages/shared/Present').then((m) => ({ default: m.PrintPage })));

function Splash() {
  return <div role="status" aria-label="Carregando" className="min-h-dvh grid place-items-center bg-paper fade-in"><Orbit /></div>;
}

function RequireRole({ internal, children }: { internal: boolean; children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!me) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  const isInt = isInternalRole(me.actor.role);
  if (internal && !isInt) return <Navigate to="/portal" replace />;
  if (!internal && isInt) return <Navigate to="/app" replace />;
  return <>{children}</>;
}


export function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/" element={<Navigate to="/entrar" replace />} />
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/app" element={<RequireRole internal><InternalLayout /></RequireRole>}>
        <Route index element={<OverviewPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="captura" element={<IntakePage />} />
        <Route path="solicitacoes" element={<RequestsPage />} />
        <Route path="solicitacoes/:id" element={<RequestDetailPage />} />
        <Route path="entregas" element={<DeliveriesPage />} />
        <Route path="entregas/nova" element={<NewDeliveryPage />} />
        <Route path="entregas/:id" element={<DeliveryDetailPage />} />
        <Route path="apresentacoes" element={<PresentationsPage />} />
        <Route path="apresentacoes/:id" element={<PresentationEditorPage />} />
        <Route path="acessos" element={<AccessPage />} />
        <Route path="*" element={<NotFoundPage inline />} />
      </Route>
      <Route path="/app/apresentacoes/:id/apresentar" element={<RequireRole internal><PresentPage /></RequireRole>} />
      <Route path="/app/apresentacoes/:id/imprimir" element={<RequireRole internal><PrintPage /></RequireRole>} />
      <Route path="/portal" element={<RequireRole internal={false}><PortalLayout /></RequireRole>}>
        <Route index element={<PortalHomePage />} />
        <Route path="solicitacoes" element={<PortalRequestsPage />} />
        <Route path="solicitacoes/nova" element={<PortalNewRequestPage />} />
        <Route path="solicitacoes/:id" element={<PortalRequestDetailPage />} />
        <Route path="novidades" element={<PortalNewsPage />} />
        <Route path="novidades/:id" element={<PortalNewsDetailPage />} />
        <Route path="resultados" element={<PortalResultsPage />} />
        <Route path="resultados/:id" element={<PortalResultDetailPage />} />
        <Route path="*" element={<NotFoundPage inline />} />
      </Route>
      <Route path="/portal/resultados/:id/apresentar" element={<RequireRole internal={false}><PresentPage /></RequireRole>} />
      <Route path="/portal/resultados/:id/imprimir" element={<RequireRole internal={false}><PrintPage /></RequireRole>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
