import * as Sentry from "@sentry/react";

// ────────────────────────────────────────────────────────────────────────────
// Monitoramento de erros de front (Sentry)
//
// Captura erros JS que acontecem no navegador dos CLIENTES (não só no nosso) e
// envia pro dashboard do Sentry, que alerta por email. Resolve o caso "às vezes
// dá erro no cliente e eu não sei porque comigo funciona".
//
// Config enxuta de propósito: SÓ erros (sem performance/replay) pra ficar bem
// dentro da cota grátis (5k erros/mês). O DSN é público (vai no bundle) — vem da
// env VITE_SENTRY_DSN.
// ────────────────────────────────────────────────────────────────────────────

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();

// Mensagens de ruído que não são bugs nossos (extensões, adblock, quirks de
// browser). Não vale gastar cota/alerta com elas.
const IGNORE = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  // Extensões de navegador
  /extension\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  // SDKs de terceiros bloqueados por adblock (MP/Meta) — não é bug nosso
  /mercadopago/i,
  /connect\.facebook\.net/i,
  /fbevents/i,
];

export function initSentry() {
  // Só liga em produção e quando o DSN estiver configurado.
  if (!DSN || !import.meta.env.PROD) return;

  Sentry.init({
    dsn: DSN,
    environment: "production",
    // Só relatório de erro — sem tracing nem replay (economiza cota).
    tracesSampleRate: 0,
    ignoreErrors: IGNORE,
    // Não manda evento se a stack inteira veio de uma extensão do navegador.
    beforeSend(event) {
      const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
      const fromExtension = frames.some((f) =>
        /(^|\/)(chrome|moz)-extension:\/\//.test(f.filename ?? ""),
      );
      if (fromExtension) return null;
      return event;
    },
  });
}
