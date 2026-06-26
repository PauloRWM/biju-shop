import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import ScrollToTop from "@/components/ScrollToTop";
import MetaPageViewTracker from "@/components/MetaPageViewTracker";
import { hideInitialLoader } from "@/lib/initialLoader";
import Index from "./pages/Index";

// Code-splitting: a landing (Index) carrega imediatamente; as demais páginas
// viram chunks separados, reduzindo o bundle inicial.
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Account = lazy(() => import("./pages/Account"));
const FAQ = lazy(() => import("./pages/FAQ"));
const TrocasDevolucoes = lazy(() => import("./pages/TrocasDevolucoes"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

/**
 * Esconde o loader inicial do index.html quando os dados da primeira rota terminam
 * de carregar (cobre qualquer página de entrada). Redes de segurança garantem que
 * ele nunca fique preso: some logo em páginas sem fetch e tem timeout máximo.
 */
const LoaderGate = () => {
  const isFetching = useIsFetching();
  const startedFetching = useRef(false);

  useEffect(() => {
    if (isFetching > 0) {
      startedFetching.current = true;
    } else if (startedFetching.current) {
      // Buscas iniciais concluíram (sucesso ou erro) → conteúdo pronto.
      hideInitialLoader();
    }
  }, [isFetching]);

  useEffect(() => {
    // Página sem nenhum fetch (estática): some logo, sem esperar.
    const noDataTimer = window.setTimeout(() => {
      if (!startedFetching.current) hideInitialLoader();
    }, 600);
    // Rede de segurança absoluta: nunca deixa o loader preso.
    const safetyTimer = window.setTimeout(hideInitialLoader, 5000);
    return () => {
      window.clearTimeout(noDataTimer);
      window.clearTimeout(safetyTimer);
    };
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LoaderGate />
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <ScrollToTop />
          <MetaPageViewTracker />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/produto/:id" element={<ProductDetail />} />
              <Route path="/carrinho" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/conta" element={<Account />} />
              <Route path="/duvidas-frequentes" element={<FAQ />} />
              <Route path="/trocas-e-devolucoes" element={<TrocasDevolucoes />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
