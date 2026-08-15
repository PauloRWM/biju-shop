import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useHomepageConfig } from "@/hooks/useProducts";

// Rotas onde NÃO mostramos o popup (não interromper compra).
const SUPPRESSED = ["/checkout", "/carrinho", "/cart"];

// Flag por CARREGAMENTO de página: reseta a cada reload (novo carregamento do
// JS), mas persiste durante a navegação SPA (o Layout remonta a cada rota).
// Assim o popup aparece 1x por reload, sem reabrir ao trocar de página.
let shownThisLoad = false;

/**
 * Popup promocional (modal ao entrar no site). Arte única (imagem) configurada
 * no wp-admin (Configurações → Biju Shop — Página Inicial → Popup Promocional).
 * Aparece 1x por sessão (por imagem), no desktop e no mobile. Clicar na imagem
 * leva ao link (opcional). Fecha no X, no fundo ou no Esc.
 */
const PromoPopup = () => {
  const { data: config } = useHomepageConfig();
  const popup = config?.popup;
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const enabled = !!popup?.enabled && !!popup?.image;
  const suppressed = SUPPRESSED.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!enabled || suppressed || shownThisLoad) return;
    // Pequeno atraso para não competir com o carregamento inicial. Só marca como
    // mostrado quando de fato abre → aparece 1x por reload do site.
    const t = setTimeout(() => {
      shownThisLoad = true;
      setOpen(true);
    }, 900);
    return () => clearTimeout(t);
  }, [enabled, suppressed]);

  const close = () => setOpen(false);

  // Fecha no Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled) return null;

  const handleImageClick = () => {
    const link = popup!.link?.trim();
    close();
    if (!link) return;
    let internal: string | null = null;
    if (/^https?:\/\//i.test(link)) {
      try {
        const u = new URL(link);
        if (u.origin === window.location.origin) internal = u.pathname + u.search + u.hash;
      } catch {
        /* deixa o link como está */
      }
    } else if (link.startsWith("/")) {
      internal = link;
    }
    if (internal) navigate(internal);
    else window.location.href = link; // externo
  };

  const mobileSrc = popup!.image_mobile || popup!.image;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Promoção"
        >
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão fechar */}
            <button
              onClick={close}
              aria-label="Fechar"
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
            >
              <X className="h-5 w-5" />
            </button>

            <picture>
              {popup!.image_mobile && (
                <source media="(max-width: 640px)" srcSet={mobileSrc} />
              )}
              <img
                src={popup!.image}
                alt="Promoção"
                onClick={handleImageClick}
                className={`block rounded-2xl shadow-2xl max-h-[85vh] w-auto max-w-[92vw] object-contain ${popup!.link ? "cursor-pointer" : ""}`}
              />
            </picture>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoPopup;
