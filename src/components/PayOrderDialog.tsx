import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PixExpiryNotice from "@/components/PixExpiryNotice";
import {
  QrCode,
  CreditCard,
  Check,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { fetchOrder, payOrder, type Order, type PaymentDetails } from "@/services/orders";
import { ApiError } from "@/services/api";
import CreditCardPreview, { type CardFocus } from "@/components/CreditCardPreview";

type Method = "pix" | "credit";

// Valor mínimo por parcela aceito pelo Mercado Pago (alinhado ao checkout).
const MIN_AMOUNT = 2;

const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const formatCardNumber = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
// Aceita CPF (11 dígitos) ou CNPJ (14) e aplica a máscara correspondente —
// o pedido pode ter sido feito com qualquer um dos dois.
const formatDoc = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};
const isValidDoc = (digits: string) => digits.length === 11 || digits.length === 14;

// Tradução curta das recusas mais comuns do MP — mensagens completas já vêm do
// backend, isso é só fallback para o caso de a string vir técnica.
function friendlyPaymentError(raw?: string): string {
  if (!raw) return "Pagamento recusado. Tente outro cartão ou meio de pagamento.";
  if (/^[a-z_\s.]+$/i.test(raw) && raw.length < 80 && /_/.test(raw)) {
    return "Não foi possível processar o pagamento. Tente novamente ou escolha outro meio de pagamento.";
  }
  return raw;
}

interface Props {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o pagamento é confirmado (para recarregar a lista de pedidos). */
  onPaid: () => void;
}

const PayOrderDialog = ({ order, open, onOpenChange, onPaid }: Props) => {
  const [method, setMethod] = useState<Method>("pix");
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [cardFocus, setCardFocus] = useState<CardFocus>(null);
  const [installments, setInstallments] = useState(1);
  const [cpf, setCpf] = useState(order.cpf ? formatDoc(order.cpf) : "");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reseta o estado sempre que o modal abre para um pedido.
  useEffect(() => {
    if (open) {
      setMethod("pix");
      setPayment(null);
      setConfirmed(false);
      setPaying(false);
      setCard({ number: "", name: "", expiry: "", cvv: "" });
      setInstallments(1);
      setCpf(order.cpf ? formatDoc(order.cpf) : "");
    }
  }, [open, order.id, order.cpf]);

  // Polling do status do pedido enquanto o PIX não foi pago. Para assim que o
  // pedido vira processing/completed (webhook do MP confirmou a transferência).
  useEffect(() => {
    const isPaid = (s?: string) => !!s && ["processing", "completed"].includes(s);
    // Faz polling sempre que um PIX foi gerado (independente de ter copia-e-cola).
    const shouldPoll = open && method === "pix" && !!payment && !confirmed;
    if (!shouldPoll) return;

    pollRef.current = setInterval(async () => {
      try {
        const fresh = await fetchOrder(order.id);
        if (isPaid(fresh.status)) {
          setConfirmed(true);
          onPaid();
        }
      } catch {
        // ignora falhas pontuais de rede — o próximo tick tenta de novo
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, method, payment, confirmed, order.id, onPaid]);

  const total = order.total;

  const handlePixPay = async () => {
    setPaying(true);
    try {
      const updated = await payOrder(order.id, { payment_method: "pix" });
      if (updated.payment?.error) {
        toast.error(friendlyPaymentError(updated.payment.message ?? updated.payment.error), {
          duration: 10000,
        });
        return;
      }
      if (!updated.payment?.qr_code_base64 && !updated.payment?.qr_code) {
        toast.error("Não foi possível gerar o PIX agora. Tente novamente em instantes.");
        return;
      }
      setPayment(updated.payment);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar o PIX. Tente novamente.");
    } finally {
      setPaying(false);
    }
  };

  const handleCardPay = async () => {
    const docDigits = cpf.replace(/\D/g, "");
    if (!isValidDoc(docDigits)) {
      toast.error("Informe um CPF ou CNPJ válido.");
      return;
    }
    if (card.number.replace(/\D/g, "").length < 13) {
      toast.error("Número do cartão inválido.");
      return;
    }
    if (!card.name.trim()) {
      toast.error("Informe o nome impresso no cartão.");
      return;
    }
    const [mm, yy] = card.expiry.split("/");
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) {
      toast.error("Validade inválida (MM/AA).");
      return;
    }
    if (card.cvv.length < 3) {
      toast.error("CVV inválido.");
      return;
    }
    if (total / installments < MIN_AMOUNT) {
      toast.error(`Cada parcela deve ser de pelo menos ${formatBRL(MIN_AMOUNT)}.`);
      return;
    }

    setPaying(true);
    try {
      const { tokenizeCard } = await import("@/services/mercadoPago");
      const cardPayload = await tokenizeCard(
        {
          cardNumber: card.number,
          cardholderName: card.name,
          cardExpirationMonth: mm,
          cardExpirationYear: `20${yy}`,
          securityCode: card.cvv,
          identificationType: docDigits.length === 14 ? "CNPJ" : "CPF",
          identificationNumber: docDigits,
        },
        installments,
        total,
      );

      const updated = await payOrder(order.id, {
        payment_method: "credit_card",
        card: cardPayload,
      });

      if (updated.payment?.error) {
        toast.error(friendlyPaymentError(updated.payment.message ?? updated.payment.error), {
          duration: 10000,
        });
        return;
      }

      const approved =
        ["processing", "completed"].includes(updated.status) ||
        updated.payment?.status === "approved";
      if (approved) {
        setConfirmed(true);
        onPaid();
      } else {
        // Pagamento em análise (on-hold) — informa e fecha; o webhook confirma depois.
        toast.success("Pagamento em análise. Você será avisado assim que for aprovado.");
        onPaid();
        onOpenChange(false);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Falha ao processar o cartão. Confira os dados e tente novamente.";
      toast.error(msg, { duration: 8000 });
    } finally {
      setPaying(false);
    }
  };

  const installmentOptions = [1, 2, 3].filter((n) => total / n >= MIN_AMOUNT);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagar pedido #{order.id}</DialogTitle>
          <DialogDescription>
            Total: <span className="font-semibold text-foreground">{formatBRL(total)}</span>
          </DialogDescription>
        </DialogHeader>

        {confirmed ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 rounded-full bg-pix/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-pix" />
            </div>
            <h3 className="font-display text-xl font-bold">Pagamento confirmado! 🎉</h3>
            <p className="text-sm text-muted-foreground">
              Recebemos seu pagamento. Em breve seu pedido será preparado.
            </p>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : payment && method === "pix" ? (
          <div className="space-y-4">
            <div className="border-2 border-pix/30 bg-pix/5 rounded-xl p-5 space-y-4 text-center">
              <div className="flex items-center gap-2 justify-center text-pix font-semibold">
                <QrCode className="h-5 w-5" />
                <span>Pague com PIX</span>
              </div>
              {payment.qr_code_base64 && (
                <img
                  src={
                    payment.qr_code_base64.startsWith("data:")
                      ? payment.qr_code_base64
                      : `data:image/png;base64,${payment.qr_code_base64}`
                  }
                  alt="QR Code PIX"
                  className="w-52 h-52 mx-auto rounded-lg bg-white p-2"
                />
              )}
              {payment.qr_code && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-left">Ou copie o código PIX:</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={payment.qr_code}
                      className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono truncate"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(payment.qr_code!);
                        toast.success("Código PIX copiado!");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              )}
              {payment.expires_at && (
                <PixExpiryNotice expiresAt={payment.expires_at} />
              )}
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mx-auto w-full justify-center">
              <Loader2 className="h-3 w-3 animate-spin" />
              Aguardando confirmação do pagamento...
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Seletor de método */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "pix" as Method, label: "PIX", icon: QrCode },
                { id: "credit" as Method, label: "Cartão", icon: CreditCard },
              ]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                    method === m.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>

            {method === "pix" ? (
              <div className="bg-pix/5 border border-pix/20 rounded-lg p-4 text-center space-y-1">
                <QrCode className="h-7 w-7 text-pix mx-auto" />
                <p className="text-sm text-pix font-semibold">Pagamento instantâneo</p>
                <p className="text-xs text-muted-foreground">
                  O QR Code será gerado ao confirmar abaixo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <CreditCardPreview
                  number={card.number}
                  name={card.name}
                  expiry={card.expiry}
                  cvv={card.cvv}
                  focus={cardFocus}
                />
                {!order.cpf && (
                  <Input
                    placeholder="CPF ou CNPJ do titular"
                    inputMode="numeric"
                    maxLength={18}
                    value={cpf}
                    onChange={(e) => setCpf(formatDoc(e.target.value))}
                  />
                )}
                <Input
                  placeholder="Número do cartão"
                  inputMode="numeric"
                  maxLength={23}
                  value={card.number}
                  onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                  onFocus={() => setCardFocus("number")}
                  onBlur={() => setCardFocus(null)}
                />
                <Input
                  placeholder="Nome impresso no cartão"
                  value={card.name}
                  onChange={(e) => setCard((c) => ({ ...c, name: e.target.value.toUpperCase() }))}
                  onFocus={() => setCardFocus("name")}
                  onBlur={() => setCardFocus(null)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="MM/AA"
                    inputMode="numeric"
                    maxLength={5}
                    value={card.expiry}
                    onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    onFocus={() => setCardFocus("expiry")}
                    onBlur={() => setCardFocus(null)}
                  />
                  <Input
                    placeholder="CVV"
                    inputMode="numeric"
                    maxLength={4}
                    value={card.cvv}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                    }
                    onFocus={() => setCardFocus("cvv")}
                    onBlur={() => setCardFocus(null)}
                  />
                </div>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {installmentOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}x de {formatBRL(total / n)}
                      {n === 1 ? " à vista" : " sem juros"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              className="w-full h-11 gap-2"
              disabled={paying}
              onClick={method === "pix" ? handlePixPay : handleCardPay}
            >
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {paying
                ? "Processando..."
                : method === "pix"
                ? "Gerar PIX"
                : `Pagar ${formatBRL(total)}`}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Pagamento 100% seguro via Mercado Pago
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PayOrderDialog;
