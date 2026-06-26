// Controla o loader inicial (definido no index.html, fora do #root).
// Idempotente: pode ser chamado de vários lugares; só age uma vez.

let hidden = false;

export function hideInitialLoader(): void {
  if (hidden) return;
  hidden = true;

  const el = document.getElementById("initial-loader");
  if (!el) return;

  // Fade-out e remoção (a transição está definida no index.html).
  el.classList.add("biju-loader-hidden");
  window.setTimeout(() => el.remove(), 400);
}
