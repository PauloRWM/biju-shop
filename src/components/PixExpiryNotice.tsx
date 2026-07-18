import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Aviso de validade do PIX — destacado e legível em mobile e desktop.
 *
 * Mostra um contador regressivo ao vivo até o QR expirar. O prazo NÃO é
 * hardcoded: vem do expires_at que o Mercado Pago devolve, que o backend
 * calcula como (woocommerce_hold_stock_minutes - margem). Hoje isso dá 15 min,
 * mas se a loja mudar o hold de estoque, o texto acompanha sozinho.
 *
 * Quando o tempo acaba, o pedido é cancelado e o estoque volta pra prateleira —
 * daí o aviso explícito de que o carrinho será perdido.
 */
const PixExpiryNotice = ({ expiresAt }: { expiresAt: string }) => {
  const target = new Date(expiresAt).getTime();
  const [msLeft, setMsLeft] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setMsLeft(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  // Data inválida: não arrisca mostrar "NaN" — melhor omitir o bloco.
  if (Number.isNaN(target)) return null;

  const expired = msLeft <= 0;
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  // Minutos totais do prazo, arredondado — para o texto "Você tem X minutos".
  const minutesLabel = Math.max(1, Math.round(totalSec / 60));

  if (expired) {
    return (
      <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 p-3 text-center">
        <p className="text-sm font-bold text-destructive">
          O tempo para pagamento expirou.
        </p>
        <p className="text-xs text-destructive/80 mt-0.5">
          Este PIX não é mais válido. Refaça o pedido para gerar um novo código.
        </p>
      </div>
    );
  }

  // Últimos 5 min: fica vermelho para criar urgência.
  const urgent = totalSec <= 5 * 60;

  return (
    <div
      className={`rounded-lg border-2 p-3 text-center ${
        urgent
          ? "border-destructive/40 bg-destructive/10"
          : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <Clock className={`h-5 w-5 shrink-0 ${urgent ? "text-destructive" : "text-amber-600"}`} />
        <span
          className={`font-bold tabular-nums text-2xl md:text-3xl leading-none ${
            urgent ? "text-destructive" : "text-amber-700"
          }`}
        >
          {mm}:{ss}
        </span>
      </div>
      <p
        className={`text-sm md:text-base font-semibold mt-2 leading-snug ${
          urgent ? "text-destructive" : "text-amber-800"
        }`}
      >
        Você tem {minutesLabel} {minutesLabel === 1 ? "minuto" : "minutos"} para efetuar o
        pagamento ou o seu carrinho será excluído
      </p>
    </div>
  );
};

export default PixExpiryNotice;
