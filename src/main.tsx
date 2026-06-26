import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { hideInitialLoader } from "./lib/initialLoader";

// ────────────────────────────────────────────────────────────────────────────
// Limpeza de Service Worker (modo kill switch permanente)
//
// O SW estava causando telas brancas aleatórias. Por enquanto, em vez de
// registrar SW novo, apenas garantimos que qualquer SW antigo + caches sejam
// desregistrados/limpos em todo cliente que entrar no site. O site passa a
// funcionar como SPA tradicional (cache só via HTTP/.htaccess).
// ────────────────────────────────────────────────────────────────────────────
async function killServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    let removed = false;
    for (const reg of regs) {
      await reg.unregister();
      removed = true;
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (keys.length > 0) removed = true;
    }
    // Se removemos algo, força um reload limpo uma única vez por sessão
    // para que a página recarregue sem o SW interceptando.
    if (removed && !sessionStorage.getItem("biju_sw_killed")) {
      sessionStorage.setItem("biju_sw_killed", "1");
      window.location.reload();
    }
  } catch {
    // ignora — site funciona sem SW
  }
}

createRoot(document.getElementById("root")!).render(<App />);

// Rede de segurança final: se algo impedir o LoaderGate de rodar (erro fatal de
// render), garante que o loader inicial não fique preso na tela.
window.setTimeout(hideInitialLoader, 8000);

if (typeof window !== "undefined") {
  // Dispara depois do load para não atrapalhar o paint inicial
  window.addEventListener("load", () => {
    killServiceWorkers();
  });
}
