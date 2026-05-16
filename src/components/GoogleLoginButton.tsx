import { useEffect, useRef, useState } from "react";
import { fetchGoogleConfig, loginWithGoogle } from "@/services/auth";
import { toast } from "sonner";

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number | string;
      locale?: string;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisLoadPromise: Promise<void> | null = null;

const loadGoogleScript = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GIS load error")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS load error"));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
};

interface Props {
  onSuccess: () => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
}

const GoogleLoginButton = ({ onSuccess, text = "continue_with", disabled }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gisReady, setGisReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const config = await fetchGoogleConfig();
        if (cancelled) return;

        if (!config.enabled || !config.client_id) {
          setLoadError("Configuração ausente");
          return;
        }

        await loadGoogleScript();
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: config.client_id,
          callback: async (response) => {
            if (!response.credential) return;
            try {
              await loginWithGoogle(response.credential);
              toast.success("Login com Google realizado!");
              onSuccessRef.current();
            } catch (err) {
              const message = err instanceof Error ? err.message : "Falha no login com Google";
              toast.error(message);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "pill",
          logo_alignment: "left",
          width: containerRef.current.clientWidth || 320,
          locale: "pt-BR",
        });

        setGisReady(true);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Erro ao carregar login Google";
        setLoadError(message);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [text]);

  // Botão sempre visível.
  // - Quando o GIS termina de carregar, o div abaixo é preenchido pelo Google.
  // - Enquanto carrega (ou em caso de falha), exibimos um fallback custom
  //   que dispara o prompt do Google quando clicado, se disponível.
  const triggerFallback = () => {
    if (loadError) {
      toast.error("Login com Google indisponível no momento. Tente novamente em instantes.");
      return;
    }
    if (window.google?.accounts?.id) {
      // tenta acionar o prompt One Tap caso o botão oficial ainda não tenha sido renderizado
      try {
        window.google.accounts.id.renderButton?.(containerRef.current!, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "pill",
          logo_alignment: "left",
          width: containerRef.current?.clientWidth || 320,
          locale: "pt-BR",
        });
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className={`relative min-h-[44px] ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Container onde o Google renderiza o botão oficial */}
      <div ref={containerRef} className="flex justify-center" />

      {/* Fallback enquanto o GIS não carregou (ou se falhar). Some assim
          que o botão real estiver pronto. */}
      {!gisReady && (
        <button
          type="button"
          onClick={triggerFallback}
          className="absolute inset-0 flex items-center justify-center gap-3 h-11 w-full rounded-full border border-border bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-foreground/80"
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 7.1 29.6 5 24 5 16.3 5 9.7 9 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.8-5.4l-6.4-5.4C29.3 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.5 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.4 5.4C39.1 35.5 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          <span>Continuar com o Google</span>
        </button>
      )}
    </div>
  );
};

export default GoogleLoginButton;
