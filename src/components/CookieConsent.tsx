import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "biju_cookie_consent"; // 'accepted' | 'rejected'

/**
 * Aviso de cookies (LGPD). Barra fixa embaixo com Aceitar/Rejeitar. A escolha
 * fica salva no navegador (localStorage) e a barra não reaparece. Aparece no
 * desktop e no mobile.
 */
const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let choice: string | null = null;
    try {
      choice = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* modo privado */
    }
    if (!choice) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const decide = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignora */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[110] px-4 pb-4"
      role="dialog"
      aria-label="Aviso de cookies"
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-background/95 backdrop-blur shadow-2xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed flex-1">
            Usamos cookies para melhorar sua experiência, analisar o tráfego e
            personalizar conteúdo e anúncios. Ao continuar, você concorda com a
            nossa{" "}
            <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">
              Política de Privacidade
            </Link>
            .
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => decide("rejected")}
              className="px-4 py-2 text-xs md:text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              Rejeitar
            </button>
            <button
              onClick={() => decide("accepted")}
              className="px-5 py-2 text-xs md:text-sm font-semibold rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
