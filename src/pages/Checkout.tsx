import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { useCreateOrder, useOrder } from "@/hooks/useOrder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  CreditCard,
  Check,
  Lock,
  Truck,
  Shield,
  QrCode,
  Barcode,
  UserPlus,
  Package,
  Zap,
  Store,
  Loader2,
  Tag,
  Trash2,
} from "lucide-react";
import { validateCoupon } from "@/services/coupons";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getAuthToken, ApiError } from "@/services/api";
import { fetchAccount } from "@/services/auth";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { calculateShippingViaWoo, ShippingMethod } from "@/services/shipping";
import {
  trackInitiateCheckout,
  trackPurchase,
  trackAddPaymentInfo,
  setUserData as setMetaUserData,
  getMetaCookies,
} from "@/services/metaPixel";
import CreditCardPreview, { type CardFocus } from "@/components/CreditCardPreview";

type PaymentMethod = "credit" | "pix" | "boleto";

// UFs do Brasil (código usado pelo WooCommerce no campo billing_state).
const BR_STATES: { uf: string; name: string }[] = [
  { uf: "AC", name: "Acre" }, { uf: "AL", name: "Alagoas" }, { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" }, { uf: "BA", name: "Bahia" }, { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" }, { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" }, { uf: "MT", name: "Mato Grosso" }, { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" }, { uf: "PA", name: "Pará" }, { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" }, { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" }, { uf: "RN", name: "Rio Grande do Norte" }, { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" }, { uf: "RR", name: "Roraima" }, { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" }, { uf: "SE", name: "Sergipe" }, { uf: "TO", name: "Tocantins" },
];

// Códigos de recusa do MP que retornam quando o emissor (Visa/Master/banco)
// rejeita a cobrança. Tradução referencial:
// https://www.mercadopago.com.br/developers/pt/docs/checkout-api/response-handling/collection-results
const PAYMENT_REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Número do cartão incorreto. Confira os dígitos.",
  cc_rejected_bad_filled_date: "Data de validade incorreta.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) incorreto.",
  cc_rejected_bad_filled_other: "Dados do cartão incorretos. Confira e tente novamente.",
  cc_rejected_call_for_authorize: "O emissor pediu autorização. Ligue para o banco e libere a compra.",
  cc_rejected_card_disabled: "Cartão desabilitado. Entre em contato com o banco.",
  cc_rejected_card_error: "Não conseguimos processar o pagamento. Tente outro cartão.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento com esse valor. Se precisar pagar novamente, use outro cartão.",
  cc_rejected_high_risk: "Pagamento recusado por segurança. Tente outro meio de pagamento.",
  cc_rejected_insufficient_amount: "Saldo/limite insuficiente no cartão.",
  cc_rejected_invalid_installments: "Cartão não aceita esse parcelamento. Tente outra opção.",
  cc_rejected_max_attempts: "Limite de tentativas atingido. Tente novamente mais tarde.",
  cc_rejected_other_reason: "Cartão recusado pelo emissor. Tente outro cartão.",
  cc_rejected_blacklist: "Cartão recusado. Tente outro meio de pagamento.",
  cc_rejected_card_type_not_allowed: "Tipo de cartão não aceito.",
};

// Erros crus que a API do Mercado Pago devolve quando o pagamento sequer chega
// no emissor (validação de payload, valor inválido, etc). Sempre traduzir antes
// de mostrar ao cliente — "Invalid transaction_amount" assusta.
const MP_API_ERROR_MESSAGES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid.*transaction_amount/i, message: "Valor do pedido inválido. Tente um valor maior ou contate o suporte." },
  { pattern: /amount.*is.*required|amount.*missing/i, message: "Valor do pedido ausente. Atualize a página e tente novamente." },
  { pattern: /invalid.*payer.*email/i, message: "E-mail inválido. Confira o e-mail informado." },
  { pattern: /invalid.*identification.*number|invalid.*payer.*identification/i, message: "CPF inválido. Confira os dígitos." },
  { pattern: /invalid.*token|card.*token.*not.*found|token.*expired/i, message: "Sessão do cartão expirou. Recarregue a página e digite os dados novamente." },
  { pattern: /invalid.*payment_method/i, message: "Bandeira do cartão não aceita. Tente outro cartão." },
  { pattern: /invalid.*installments/i, message: "Parcelamento inválido. Escolha outra opção de parcelas." },
  { pattern: /collector.*not.*allowed|invalid.*access_token|unauthorized/i, message: "Erro de configuração do gateway. Avise o suporte." },
];

function mapPaymentRejectionMessage(raw: string): string {
  if (!raw) return "Pagamento recusado. Tente outro cartão.";

  // 1) Tenta cc_rejected_* (recusa do emissor)
  const ccMatch = raw.match(/cc_rejected_[a-z_]+/i);
  if (ccMatch) {
    const key = ccMatch[0].toLowerCase();
    if (PAYMENT_REJECTION_MESSAGES[key]) return PAYMENT_REJECTION_MESSAGES[key];
  }

  // 2) Tenta erros crus da API do MP
  for (const { pattern, message } of MP_API_ERROR_MESSAGES) {
    if (pattern.test(raw)) return message;
  }

  // 3) Erros genéricos do gateway (PHP, sessão, etc.)
  if (/method_exists|null given|cart_contents_total/i.test(raw)) {
    return "Erro interno do gateway. Avise o suporte.";
  }

  // 4) Se a string parece técnica (em inglês, com underscore), não vaza
  if (/^[a-z_\s.]+$/i.test(raw) && raw.length < 80) {
    return "Não foi possível processar o pagamento. Tente novamente ou escolha outro meio de pagamento.";
  }

  return raw;
}

// Mínimo aceito por pedido e por parcela (regra de negócio + alinhada ao MP).
const MIN_AMOUNT = 2;
// Pedido mínimo (atacado) — calculado sobre o subtotal de produtos, sem frete.
const MIN_SUBTOTAL = 197.99;

const Checkout = () => {
  const { items, totalPrice, clearCart, coupon, setCoupon, setGuestContact, removeItem, updateQuantity } = useCart();
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const [step, setStep] = useState<"form" | "success">("form");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<import("@/services/orders").PaymentDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

  // Polling de status do pedido — só ativo na tela de sucesso PIX enquanto não pago.
  // Backend marca o pedido como 'processing'/'completed' quando o webhook do MP chega
  // confirmando a transferência. Aqui a gente reflete isso na UI sem reload.
  const isPaidStatus = (s?: string) =>
    !!s && ["processing", "completed"].includes(s);
  const { data: polledOrder } = useOrder(
    step === "success" && paymentMethod === "pix" && orderId ? orderId : undefined,
    {
      // Checa a cada 4s, mas PARA assim que o pedido for pago — evita polling
      // infinito no endpoint /order/:id depois da confirmação.
      refetchInterval: (query) =>
        isPaidStatus(query.state.data?.status) ? false : 4000,
    },
  );
  const pixConfirmed = paymentMethod === "pix" && isPaidStatus(polledOrder?.status);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getAuthToken());
  const [accountCreated, setAccountCreated] = useState<boolean>(false);
  const [selectedShippingId, setSelectedShippingId] = useState<string>("pac");
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const applyCouponHere = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setValidatingCoupon(true);
    try {
      const r = await validateCoupon({
        code,
        subtotal: totalPrice,
        items: items.map((i) => ({
          product_id: Number(i.product.id),
          qty: i.quantity,
          price: i.unitPrice ?? i.product.price,
        })),
      });
      setCoupon({
        code: r.code,
        discount: r.discount,
        discount_type: r.discount_type,
        amount: r.amount,
        free_shipping: r.free_shipping,
      });
      toast.success(`Cupom ${r.code.toUpperCase()} aplicado!`);
      setCouponInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cupom inválido.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Cartão de crédito
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [cardFocus, setCardFocus] = useState<CardFocus>(null);
  const [installments, setInstallments] = useState<number>(1);

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", cpf: "",
    postcode: "", address: "", number: "", complement: "",
    neighborhood: "", city: "", state: "",
  });

  // Sincroniza identificadores do guest com o CartContext (para carrinho abandonado).
  // Debounce de 800ms para esperar o usuário terminar de digitar.
  // O sync para o servidor tem outro debounce de 3s no CartContext.
  useEffect(() => {
    const t = setTimeout(() => {
      const email = form.email.trim();
      const phoneDigits = form.phone.replace(/\D/g, "");
      const name = `${form.firstName} ${form.lastName}`.trim();
      setGuestContact({
        email: email || undefined,
        phone: phoneDigits || undefined,
        name: name || undefined,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [form.email, form.phone, form.firstName, form.lastName, setGuestContact]);

  // Atualiza Advanced Matching do Meta Pixel conforme o usuário preenche o checkout.
  // O pixel re-inicializa silenciosamente; eventos seguintes (AddPaymentInfo, Purchase)
  // já saem com os dados de matching e elevam o EMQ.
  useEffect(() => {
    const t = setTimeout(() => {
      void setMetaUserData({
        email: form.email || undefined,
        phone: form.phone || undefined,
        first_name: form.firstName || undefined,
        last_name: form.lastName || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zp: form.postcode || undefined,
        country: "br",
        external_id: form.cpf || undefined,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [
    form.email, form.phone, form.firstName, form.lastName,
    form.city, form.state, form.postcode, form.cpf,
  ]);

  // Pré-preenche dados do cliente logado ao montar o checkout.
  // Falhas silenciosas — usuário pode preencher manualmente.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchAccount()
      .then((acc) => {
        if (cancelled) return;
        const billing = (acc.billing ?? {}) as Record<string, string>;
        setForm((prev) => ({
          ...prev,
          firstName: prev.firstName || acc.user.firstName || billing.first_name || "",
          lastName: prev.lastName || acc.user.lastName || billing.last_name || "",
          email: prev.email || acc.user.email || billing.email || "",
          phone: prev.phone || billing.phone || "",
          cpf: prev.cpf || billing.cpf || "",
          postcode: prev.postcode || billing.postcode || "",
          address: prev.address || billing.address_1 || "",
          number: prev.number || billing.number || "",
          neighborhood: prev.neighborhood || billing.neighborhood || billing.address_2 || "",
          complement: prev.complement || "",
          city: prev.city || billing.city || "",
          state: prev.state || billing.state || "",
        }));
      })
      .catch(() => {
        // token expirado ou backend off — segue sem prefill
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  useEffect(() => {
    const clean = (form.postcode || "").replace(/\D/g, "");
    if (clean.length !== 8 || items.length === 0) {
      setShippingMethods([]);
      return;
    }
    let cancelled = false;
    // Debounce: evita recalcular o frete a cada clique em +/- na quantidade.
    const t = setTimeout(() => {
      calculateShippingViaWoo(
        clean,
        items.map((it) => ({
          product_id: Number(it.product.id),
          quantity: it.quantity,
          ...(it.variationId ? { variation_id: it.variationId } : {}),
        })),
        totalPrice,
      )
        .then((opts) => {
          if (!cancelled) setShippingMethods(opts);
        })
        .catch((err) => {
          if (cancelled) return;
          setShippingMethods([]);
          console.error("Falha ao calcular frete:", err);
          toast.error("Não foi possível calcular o frete agora. Verifique o CEP ou tente novamente.");
        });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.postcode, totalPrice, items]);

  const selectedShipping = shippingMethods.find((m) => m.id === selectedShippingId) ?? shippingMethods[0];
  const rawShipping = selectedShipping?.cost ?? 0;
  const shipping = coupon?.free_shipping ? 0 : rawShipping;

  const couponDiscount = coupon?.discount ?? 0;
  const pixDiscount = paymentMethod === "pix" ? Math.max(0, totalPrice - couponDiscount) * 0.1 : 0;
  const discount = couponDiscount + pixDiscount;
  const total = Math.max(0, totalPrice - discount) + shipping;

  // Quando o total muda (cupom aplicado/removido, frete mudou, etc.),
  // re-valida o número de parcelas selecionado. Se a parcela atual ficar
  // abaixo do mínimo aceito pelo MP, força volta para 1x. Isso impede
  // que o usuário envie um cartão com parcelamento inválido.
  useEffect(() => {
    if (paymentMethod !== "credit") return;
    if (installments > 1 && total / installments < MIN_AMOUNT) {
      setInstallments(1);
    }
  }, [total, installments, paymentMethod]);

  const initiateCheckoutFired = useRef(false);
  const addPaymentInfoFired = useRef<Set<PaymentMethod>>(new Set());

  // Dispara AddPaymentInfo (Meta Pixel + CAPI). Idempotente por método —
  // se já disparou para esse pm nesta sessão de checkout, não repete.
  const fireAddPaymentInfo = (pm: PaymentMethod) => {
    if (addPaymentInfoFired.current.has(pm) || items.length === 0) return;
    addPaymentInfoFired.current.add(pm);
    void trackAddPaymentInfo({
      contents: items.map(({ product, quantity }) => ({
        id: product.id,
        quantity,
        item_price: product.price,
      })),
      value: total,
      paymentType: pm === "credit" ? "credit_card" : pm,
      userData: {
        email: form.email || undefined,
        phone: form.phone || undefined,
        first_name: form.firstName || undefined,
        last_name: form.lastName || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zp: form.postcode || undefined,
        country: "br",
        external_id: form.cpf || undefined,
      },
    });
  };

  // onClick dos botões de método de pagamento.
  const handleSelectPaymentMethod = (pm: PaymentMethod) => {
    setPaymentMethod(pm);
    fireAddPaymentInfo(pm);
  };
  useEffect(() => {
    if (initiateCheckoutFired.current || items.length === 0) return;
    initiateCheckoutFired.current = true;
    trackInitiateCheckout({
      contents: items.map(({ product, quantity }) => ({
        id: product.id,
        quantity,
        item_price: product.price,
      })),
      value: total,
      userData: {
        email: form.email || undefined,
        phone: form.phone || undefined,
        first_name: form.firstName || undefined,
        last_name: form.lastName || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zp: form.postcode || undefined,
        country: "br",
        external_id: form.cpf || undefined,
      },
    });
  }, [items, total]);

  const [loadingCep, setLoadingCep] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Guarda o último CEP solicitado para descartar respostas fora de ordem:
  // sem isso, uma busca lenta de um CEP antigo poderia sobrescrever o endereço
  // de um CEP digitado depois.
  const cepRequestRef = useRef<string>("");

  // fetch com timeout para não pendurar a UI em rede lenta.
  const fetchWithTimeout = (url: string, timeoutMs = 8000) =>
    fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

  // Buscar CEP automaticamente
  const fetchAddress = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    cepRequestRef.current = cleanCep;
    // Só aplica o resultado se este ainda for o CEP mais recente solicitado.
    const isStale = () => cepRequestRef.current !== cleanCep;

    setLoadingCep(true);
    try {
      // Tentar ViaCEP primeiro
      let response = await fetchWithTimeout(`https://viacep.com.br/ws/${cleanCep}/json/`);
      let data = await response.json();

      // Se ViaCEP falhar, tentar API alternativa (BrasilAPI)
      if (data.erro) {
        response = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
        data = await response.json();

        // Mapear resposta da BrasilAPI para formato ViaCEP
        data = {
          logradouro: data.street,
          bairro: data.neighborhood,
          localidade: data.city,
          uf: data.state,
        };
      }

      if (isStale()) return;

      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          address: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }));
        toast.success("Endereço encontrado!");
      } else {
        toast.error("CEP não encontrado");
      }
    } catch (error) {
      // Tentar última alternativa: API dos Correios (via proxy)
      try {
        const response = await fetchWithTimeout(`https://cdn.apicep.com/file/apicep/${cleanCep}.json`);
        const data = await response.json();

        if (isStale()) return;

        setForm((prev) => ({
          ...prev,
          address: data.address || "",
          neighborhood: data.district || "",
          city: data.city || "",
          state: data.state || "",
        }));
        toast.success("Endereço encontrado!");
      } catch {
        if (!isStale()) toast.error("Erro ao buscar CEP. Digite manualmente.");
      }
    } finally {
      if (!isStale()) setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    const formatted = value.replace(/^(\d{5})(\d)/, "$1-$2");
    setForm((prev) => ({ ...prev, postcode: formatted }));

    if (value.length === 8) {
      fetchAddress(value);
    }
  };

  // Aceita CPF (11) ou CNPJ (14). Aplica a máscara correspondente ao
  // tamanho dos dígitos digitados.
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 14);
    let f = v;
    if (v.length <= 11) {
      f = v
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      f = v
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    setForm((prev) => ({ ...prev, cpf: f }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
    const f = v
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
    setForm((prev) => ({ ...prev, phone: f }));
  };

  const isValidCpf = (cpf: string) => {
    const s = cpf.replace(/\D/g, "");
    if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
    const calc = (base: string, factor: number) => {
      let sum = 0;
      for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
      const mod = (sum * 10) % 11;
      return mod === 10 ? 0 : mod;
    };
    const d1 = calc(s.slice(0, 9), 10);
    const d2 = calc(s.slice(0, 10), 11);
    return d1 === Number(s[9]) && d2 === Number(s[10]);
  };

  const isValidCnpj = (cnpj: string) => {
    const s = cnpj.replace(/\D/g, "");
    if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
    const calc = (base: string, weights: number[]) => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(s.slice(0, 12), w1);
    const d2 = calc(s.slice(0, 13), w2);
    return d1 === Number(s[12]) && d2 === Number(s[13]);
  };

  const isValidCpfOrCnpj = (doc: string) => {
    const s = doc.replace(/\D/g, "");
    if (s.length === 11) return isValidCpf(doc);
    if (s.length === 14) return isValidCnpj(doc);
    return false;
  };

  // Email: regex rigorosa (RFC 5322 simplificada) + checa domínio com TLD.
  // Rejeita "joao@gmail" (sem .com), "joao@@gmail.com" (duplo @), espaços, etc.
  const isValidEmail = (email: string) => {
    const e = email.trim();
    if (!e || e.length > 254) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e);
  };

  // Telefone BR: precisa ter 10 ou 11 dígitos (DDD + número, com ou sem 9).
  const isValidPhone = (phone: string) => {
    const s = phone.replace(/\D/g, "");
    return s.length === 10 || s.length === 11;
  };

  // Número do endereço: aceita "123", "123A", "S/N", "SN" — mas não vazio
  // nem apenas espaços/símbolos.
  const isValidAddressNumber = (num: string) => {
    const s = num.trim();
    if (!s) return false;
    // Pelo menos 1 dígito OU "S/N"/"SN" (sem número)
    return /\d/.test(s) || /^s\/?n$/i.test(s);
  };

  useEffect(() => {
    if (items.length === 0 && step !== "success") {
      navigate("/carrinho", { replace: true });
    }
  }, [items.length, step, navigate]);

  // Carrega o device fingerprint do Mercado Pago cedo, para o
  // MP_DEVICE_SESSION_ID estar pronto na hora de tokenizar/cobrar o cartão.
  useEffect(() => {
    import("@/services/mercadoPago").then((m) => m.initDeviceId()).catch(() => {});
  }, []);

  if (items.length === 0 && step !== "success") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paymentMap: Record<PaymentMethod, "pix" | "billet" | "credit_card"> = {
      pix: "pix", boleto: "billet", credit: "credit_card",
    };

    // WhatsApp (obrigatório) — validado antes do e-mail, refletindo a ordem do form.
    if (!form.phone.trim()) {
      toast.error("WhatsApp é obrigatório para finalizar a compra.");
      return;
    }
    if (!isValidPhone(form.phone)) {
      toast.error("WhatsApp inválido. Use formato (00) 00000-0000.");
      return;
    }
    // E-mail
    if (!isValidEmail(form.email)) {
      toast.error("E-mail inválido. Confira o endereço digitado.");
      return;
    }
    // CPF/CNPJ obrigatório (cartão, PIX, boleto) — exigido pelo Mercado Pago
    // como identification do payer e usado para gerar a etiqueta de envio.
    if (!form.cpf) {
      toast.error("CPF ou CNPJ é obrigatório para finalizar a compra.");
      return;
    }
    if (!isValidCpfOrCnpj(form.cpf)) {
      toast.error("CPF ou CNPJ inválido. Confira os dígitos.");
      return;
    }
    // Número do endereço
    if (!isValidAddressNumber(form.number)) {
      toast.error("Número do endereço inválido. Use o número da residência (ou S/N).");
      return;
    }

    if (!selectedShipping) {
      toast.error("Informe um CEP válido para calcular o frete.");
      return;
    }

    if (totalPrice < MIN_SUBTOTAL) {
      toast.error(
        `Pedido mínimo de R$ ${MIN_SUBTOTAL.toFixed(2).replace(".", ",")} em produtos. Faltam R$ ${(MIN_SUBTOTAL - totalPrice).toFixed(2).replace(".", ",")}.`,
      );
      return;
    }
    if (total < MIN_AMOUNT) {
      toast.error(`Valor mínimo do pedido é R$ ${MIN_AMOUNT.toFixed(2).replace(".", ",")}.`);
      return;
    }

    // Validação extra para cartão (campos do próprio cartão)
    if (paymentMethod === "credit") {
      const installmentValue = total / installments;
      if (installmentValue < MIN_AMOUNT) {
        toast.error(`Cada parcela deve ser de pelo menos R$ ${MIN_AMOUNT.toFixed(2).replace(".", ",")}. Diminua o número de parcelas.`);
        return;
      }
      const cleanNum = card.number.replace(/\D/g, "");
      if (cleanNum.length < 13) {
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
    }

    try {
      // Tokeniza cartão antes de criar o pedido
      let cardPayload: import("@/services/mercadoPago").CardTokenResult | undefined;
      if (paymentMethod === "credit") {
        const [mm, yy] = card.expiry.split("/");
        try {
          const { tokenizeCard } = await import("@/services/mercadoPago");
          cardPayload = await tokenizeCard(
            {
              cardNumber: card.number,
              cardholderName: card.name,
              cardExpirationMonth: mm,
              cardExpirationYear: `20${yy}`,
              securityCode: card.cvv,
              identificationType: form.cpf.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF",
              identificationNumber: form.cpf,
            },
            installments,
            total,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Falha ao validar cartão.";
          toast.error(msg);
          return;
        }
      }

      const fbCookies = getMetaCookies();
      const purchaseSnapshot = {
        contents: items.map(({ product, quantity }) => ({
          id: product.id,
          quantity,
          item_price: product.price,
        })),
        value: total,
      };

      // Garante AddPaymentInfo para o método atual (caso o usuário não tenha
      // clicado em outro método antes — PIX é o padrão e fica pré-selecionado).
      fireAddPaymentInfo(paymentMethod);

      const order = await createOrder.mutateAsync({
        billing: {
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          phone: form.phone,
          // Campos separados — o backend grava no formato BR esperado por
          // plugins de NF-e, Correios e Mandabem (_billing_number,
          // _billing_neighborhood). address_1 = só a rua/logradouro.
          address_1: form.address,
          address_2: form.complement || undefined,
          number: form.number,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state,
          postcode: form.postcode,
        },
        items: items.map(({ product, quantity, variationId }) => ({
          product_id: Number(product.id),
          quantity,
          ...(variationId ? { variation_id: variationId } : {}),
        })),
        payment_method: paymentMap[paymentMethod],
        shipping_method_id: selectedShipping.id,
        shipping_method_title: selectedShipping.title,
        shipping_total: selectedShipping.cost,
        coupon_code: coupon?.code,
        // Quando há cupom WC, o desconto do cupom é aplicado via apply_coupon
        // no backend. O PIX (10%) continua sendo um fee virtual em paralelo.
        discount_total: coupon ? pixDiscount : discount,
        discount_title: (coupon ? pixDiscount : discount) > 0 ? "Desconto PIX (10%)" : undefined,
        cpf: form.cpf || undefined,
        fbp: fbCookies.fbp,
        fbc: fbCookies.fbc,
        checkout_url: typeof window !== "undefined" ? window.location.href : undefined,
        card: cardPayload,
      });

      if (order.payment?.error) {
        const reason = (order.payment.message ?? order.payment.error ?? "").toString();
        const friendly = mapPaymentRejectionMessage(reason);
        toast.error(friendly, { duration: 10000 });
        return;
      }

      // Purchase no browser: SÓ dispara para cartão aprovado (confirmação síncrona).
      // Para PIX/boleto, o pagamento ainda não foi feito; quem dispara Purchase é
      // o CAPI via webhook quando o pedido vira processing/completed (idempotente
      // por _biju_meta_purchase_sent + event_id "order_<id>" garante dedup).
      if (paymentMethod === "credit") {
        trackPurchase({
          orderId: order.id,
          contents: purchaseSnapshot.contents,
          value: order.total ?? purchaseSnapshot.value,
          userData: {
            email: form.email,
            phone: form.phone,
            first_name: form.firstName,
            last_name: form.lastName,
            city: form.city || undefined,
            state: form.state || undefined,
            zp: form.postcode || undefined,
            country: "br",
            external_id: form.cpf || undefined,
          },
        });
      }

      setOrderId(order.id);
      setPaymentDetails(order.payment ?? null);
      setStep("success");
      // Esvazia o carrinho local, mas mantém o registro de carrinho abandonado
      // no servidor: ele só deve sumir quando o pagamento for confirmado
      // (hook woocommerce_order_status_changed no backend).
      clearCart({ keepAbandoned: true });
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    } catch (err) {
      console.error("Falha ao finalizar pedido:", err);
      // Só exibe a mensagem do servidor (ApiError já vem traduzida/amigável).
      // Outros erros de JS mostram mensagem genérica para não vazar detalhes técnicos.
      const msg =
        err instanceof ApiError && err.message
          ? err.message
          : "Erro ao finalizar pedido. Tente novamente.";
      toast.error(msg);
    }
  };

  const paymentMethods: {
    id: PaymentMethod;
    label: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    {
      id: "pix",
      label: "PIX",
      icon: QrCode,
      desc: "10% de desconto • Aprovação instantânea",
    },
    {
      id: "credit",
      label: "Cartão de Crédito",
      icon: CreditCard,
      desc: "Até 3x sem juros",
    },
  ];

  const processingMessage =
    paymentMethod === "credit"
      ? {
          title: "Processando seu pagamento",
          subtitle: "Estamos validando seu cartão com o banco emissor.",
          hint: "Pode levar alguns segundos. Não feche nem atualize a página.",
        }
      : paymentMethod === "pix"
      ? {
          title: "Gerando seu QR Code PIX",
          subtitle: "Estamos criando o pagamento no Mercado Pago.",
          hint: "Em instantes você verá o código para pagar.",
        }
      : {
          title: "Gerando seu boleto",
          subtitle: "Estamos criando o boleto no Mercado Pago.",
          hint: "Aguarde, vai aparecer o link de pagamento.",
        };

  return (
    <Layout>
      <AnimatePresence>
        {createOrder.isPending && (
          <motion.div
            key="processing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center px-6"
            aria-live="polite"
            role="status"
          >
            <div className="max-w-md w-full text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <Loader2 className="w-20 h-20 text-primary animate-spin absolute inset-0" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
                  {processingMessage.title}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  {processingMessage.subtitle}
                </p>
              </div>
              <div className="bg-secondary/60 border border-border rounded-lg px-4 py-3 flex items-start gap-2.5 text-left">
                <Lock className="h-4 w-4 text-foreground/60 shrink-0 mt-0.5" />
                <p className="text-xs md:text-sm text-muted-foreground">
                  {processingMessage.hint}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <Link
                  to="/carrinho"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold">
                    Checkout
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Preencha seus dados para finalizar a compra
                  </p>
                </div>
              </div>

              {/* Progress steps */}
              <div className="flex items-center justify-center gap-2 mb-8">
                {["Dados", "Endereço", "Entrega", "Pagamento"].map((label, i, arr) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground hidden sm:inline">
                      {label}
                    </span>
                    {i < arr.length - 1 && (
                      <div className="w-6 md:w-12 h-px bg-border" />
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid md:grid-cols-5 gap-8"
              >
                <div className="md:col-span-3 space-y-8">
                  {/* Contact */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        1
                      </span>
                      Dados de Contato
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input aria-label="Nome" placeholder="Nome" value={form.firstName} onChange={set("firstName")} required />
                      <Input aria-label="Sobrenome" placeholder="Sobrenome" value={form.lastName} onChange={set("lastName")} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Input
                          type="tel"
                          aria-label="WhatsApp"
                          placeholder="WhatsApp"
                          value={form.phone}
                          onChange={handlePhoneChange}
                          maxLength={15}
                          required
                          aria-invalid={!!form.phone && !isValidPhone(form.phone)}
                          aria-describedby={form.phone && !isValidPhone(form.phone) ? "err-phone" : undefined}
                          className={form.phone && !isValidPhone(form.phone) ? "border-destructive focus-visible:ring-destructive/30" : ""}
                        />
                        {form.phone && !isValidPhone(form.phone) && (
                          <p id="err-phone" role="alert" className="text-xs text-destructive pl-1">WhatsApp incompleto.</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Input
                          type="email"
                          aria-label="E-mail"
                          placeholder="E-mail"
                          value={form.email}
                          onChange={set("email")}
                          required
                          aria-invalid={!!form.email && !isValidEmail(form.email)}
                          aria-describedby={form.email && !isValidEmail(form.email) ? "err-email" : undefined}
                          className={form.email && !isValidEmail(form.email) ? "border-destructive focus-visible:ring-destructive/30" : ""}
                        />
                        {form.email && !isValidEmail(form.email) && (
                          <p id="err-email" role="alert" className="text-xs text-destructive pl-1">E-mail inválido.</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Input
                        aria-label="CPF ou CNPJ"
                        placeholder="CPF ou CNPJ"
                        value={form.cpf}
                        onChange={handleCpfChange}
                        maxLength={18}
                        inputMode="numeric"
                        required
                        aria-invalid={!!form.cpf && !isValidCpfOrCnpj(form.cpf)}
                        aria-describedby={form.cpf && !isValidCpfOrCnpj(form.cpf) ? "err-cpf" : undefined}
                        className={form.cpf && !isValidCpfOrCnpj(form.cpf) ? "border-destructive focus-visible:ring-destructive/30" : ""}
                      />
                      {form.cpf && !isValidCpfOrCnpj(form.cpf) && (
                        <p id="err-cpf" role="alert" className="text-xs text-destructive pl-1">CPF ou CNPJ inválido.</p>
                      )}
                    </div>

                    {!isAuthenticated && (
                      <div className="pt-2 space-y-3">
                        {/* Entrar com Google: agiliza o checkout pra quem já
                            tem conta — puxa nome, e-mail, telefone, CPF, último
                            endereço de entrega após autenticar. */}
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2.5">
                          <p className="text-xs text-muted-foreground text-center">
                            Já é cliente? Entre para agilizar o checkout:
                          </p>
                          <GoogleLoginButton
                            text="continue_with"
                            onSuccess={async () => {
                              setIsAuthenticated(true);
                              try {
                                const acc = await fetchAccount();
                                const billing = (acc.billing ?? {}) as Record<string, string>;
                                const shipping = (acc.shipping ?? {}) as Record<string, string>;
                                setForm((prev) => ({
                                  ...prev,
                                  firstName: acc.user.firstName || billing.first_name || prev.firstName,
                                  lastName: acc.user.lastName || billing.last_name || prev.lastName,
                                  email: acc.user.email || billing.email || prev.email,
                                  phone: billing.phone || prev.phone,
                                  cpf: billing.cpf || prev.cpf,
                                  postcode: shipping.postcode || billing.postcode || prev.postcode,
                                  address: shipping.address_1 || billing.address_1 || prev.address,
                                  number: shipping.number || billing.number || prev.number,
                                  neighborhood: shipping.neighborhood || billing.neighborhood || shipping.address_2 || billing.address_2 || prev.neighborhood,
                                  city: shipping.city || billing.city || prev.city,
                                  state: shipping.state || billing.state || prev.state,
                                }));
                                toast.success("Dados preenchidos automaticamente!");
                              } catch {
                                // perfil sem dados ou erro de rede — segue normal
                              }
                            }}
                          />
                        </div>

                      </div>
                    )}
                  </section>

                  {/* Address */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        2
                      </span>
                      Endereço de Entrega
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        aria-label="CEP"
                        placeholder="CEP"
                        value={form.postcode}
                        onChange={handleCepChange}
                        maxLength={9}
                        inputMode="numeric"
                        disabled={loadingCep}
                        required
                      />
                      <div className="col-span-2 flex items-center">
                        {loadingCep && (
                          <span className="text-xs text-muted-foreground">
                            Buscando endereço...
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <Input
                        aria-label="Rua"
                        placeholder="Rua"
                        className="col-span-3"
                        value={form.address}
                        onChange={set("address")}
                        required
                      />
                      <div className="space-y-1">
                        <Input
                          aria-label="Número"
                          placeholder="Nº"
                          value={form.number}
                          onChange={set("number")}
                          required
                          aria-invalid={!!form.number && !isValidAddressNumber(form.number)}
                          aria-describedby={form.number && !isValidAddressNumber(form.number) ? "err-number" : undefined}
                          className={form.number && !isValidAddressNumber(form.number) ? "border-destructive focus-visible:ring-destructive/30" : ""}
                        />
                        {form.number && !isValidAddressNumber(form.number) && (
                          <p id="err-number" role="alert" className="text-xs text-destructive pl-1">Use número ou S/N.</p>
                        )}
                      </div>
                    </div>
                    <Input aria-label="Complemento (opcional)" placeholder="Complemento (opcional)" value={form.complement} onChange={set("complement")} />
                    <div className="grid grid-cols-3 gap-3">
                      <Input aria-label="Bairro" placeholder="Bairro" value={form.neighborhood} onChange={set("neighborhood")} required />
                      <Input aria-label="Cidade" placeholder="Cidade" value={form.city} onChange={set("city")} required />
                      <select
                        value={form.state}
                        onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                        required
                        aria-label="Estado (UF)"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="" disabled>UF</option>
                        {BR_STATES.map((s) => (
                          <option key={s.uf} value={s.uf}>{s.uf}</option>
                        ))}
                      </select>
                    </div>
                  </section>

                  {/* Shipping */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        3
                      </span>
                      Forma de Entrega
                    </h2>

                    {shippingMethods.length === 0 ? (
                      <div className="text-sm text-muted-foreground bg-secondary/40 rounded-lg p-4 flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Informe um CEP válido para calcular as opções de envio.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {shippingMethods.map((sm) => {
                          const Icon =
                            sm.id === "pickup" ? Store : sm.id === "sedex" ? Zap : Package;
                          const isSelected = selectedShippingId === sm.id;
                          return (
                            <button
                              key={sm.id}
                              type="button"
                              onClick={() => setSelectedShippingId(sm.id)}
                              className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-muted-foreground/30"
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-foreground block">
                                  {sm.title}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {sm.etaDays} · {sm.description}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-foreground shrink-0">
                                {sm.cost === 0
                                  ? "Grátis"
                                  : `R$ ${sm.cost.toFixed(2).replace(".", ",")}`}
                              </span>
                              {isSelected && (
                                <Check className="h-5 w-5 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Payment */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        4
                      </span>
                      Forma de Pagamento
                    </h2>

                    <div className="grid gap-3">
                      {paymentMethods.map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => handleSelectPaymentMethod(pm.id)}
                          className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                            paymentMethod === pm.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              paymentMethod === pm.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <pm.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-foreground block">
                              {pm.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {pm.desc}
                            </span>
                          </div>
                          {paymentMethod === pm.id && (
                            <Check className="h-5 w-5 text-primary ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Credit card fields */}
                    <AnimatePresence>
                      {paymentMethod === "credit" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="py-4">
                            <CreditCardPreview
                              number={card.number}
                              name={card.name}
                              expiry={card.expiry}
                              cvv={card.cvv}
                              focus={cardFocus}
                            />
                          </div>
                          <div className="space-y-3">
                            <Input
                              placeholder="Número do cartão"
                              inputMode="numeric"
                              maxLength={23}
                              value={card.number}
                              onChange={(e) =>
                                setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))
                              }
                              onFocus={() => setCardFocus("number")}
                              onBlur={() => setCardFocus(null)}
                              required
                            />
                            <Input
                              placeholder="Nome impresso no cartão"
                              value={card.name}
                              onChange={(e) =>
                                setCard((c) => ({ ...c, name: e.target.value.toUpperCase() }))
                              }
                              onFocus={() => setCardFocus("name")}
                              onBlur={() => setCardFocus(null)}
                              required
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                placeholder="MM/AA"
                                inputMode="numeric"
                                maxLength={5}
                                value={card.expiry}
                                onChange={(e) =>
                                  setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))
                                }
                                onFocus={() => setCardFocus("expiry")}
                                onBlur={() => setCardFocus(null)}
                                required
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
                                required
                              />
                            </div>
                            <select
                              value={installments}
                              onChange={(e) => setInstallments(Number(e.target.value))}
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                              {[1, 2, 3]
                                .filter((n) => total / n >= MIN_AMOUNT)
                                .map((n) => (
                                  <option key={n} value={n}>
                                    {n}x de R$ {(total / n).toFixed(2).replace(".", ",")}
                                    {n === 1 ? " à vista" : " sem juros"}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {paymentMethod === "pix" && (
                      <div className="bg-pix/5 border border-pix/20 rounded-lg p-4 text-center">
                        <QrCode className="h-8 w-8 text-pix mx-auto mb-2" />
                        <p className="text-sm text-pix font-semibold">
                          10% de desconto no PIX!
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O QR Code será gerado após confirmar o pedido
                        </p>
                      </div>
                    )}
                  </section>
                </div>

                {/* Order summary */}
                <div className="md:col-span-2">
                  <div className="border rounded-xl p-6 bg-card sticky top-24 space-y-4">
                    <h2 className="font-display text-lg font-bold">
                      Seu Pedido
                    </h2>

                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {items.map(({ product, quantity, variationId, unitPrice }) => {
                        const max =
                          typeof product.stockQuantity === "number" && product.stockQuantity >= 0
                            ? product.stockQuantity
                            : Infinity;
                        const lineUnit = unitPrice ?? product.price;
                        return (
                          <div key={`${product.id}-${variationId ?? 0}`} className="flex gap-3">
                            <img
                              src={product.images_thumb?.[0] ?? product.images[0]}
                              alt={product.name}
                              className="w-14 h-14 rounded-lg object-cover shrink-0"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                                {product.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex items-center border rounded-md overflow-hidden h-7">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(product.id, quantity - 1, variationId)}
                                    className="px-1.5 h-full text-sm hover:bg-muted transition-colors"
                                    aria-label="Diminuir quantidade"
                                  >
                                    −
                                  </button>
                                  <span className="px-2 text-xs font-bold min-w-[1.5rem] text-center">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(product.id, quantity + 1, variationId)}
                                    disabled={quantity >= max}
                                    className="px-1.5 h-full text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Aumentar quantidade"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItem(product.id, variationId)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  aria-label="Remover item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-foreground whitespace-nowrap self-start">
                              R${" "}
                              {(lineUnit * quantity).toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t pt-3 space-y-3 text-sm">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" /> Cupom de desconto
                        </label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Código"
                            value={coupon ? coupon.code.toUpperCase() : couponInput}
                            onChange={(e) => setCouponInput(e.target.value)}
                            className="h-9 text-sm"
                            disabled={!!coupon || validatingCoupon}
                          />
                          {coupon ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0"
                              onClick={() => setCoupon(null)}
                            >
                              Remover
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0"
                              onClick={applyCouponHere}
                              disabled={validatingCoupon || !couponInput.trim()}
                            >
                              {validatingCoupon ? "..." : "Aplicar"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>
                          R$ {totalPrice.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      {coupon && couponDiscount > 0 && (
                        <div className="flex justify-between text-pix">
                          <span>
                            Cupom {coupon.code.toUpperCase()}
                            {coupon.discount_type === "percent" && ` (${coupon.amount}%)`}
                          </span>
                          <span>
                            -R$ {couponDiscount.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      )}
                      {pixDiscount > 0 && (
                        <div className="flex justify-between text-pix">
                          <span>Desconto PIX (10%)</span>
                          <span>
                            -R$ {pixDiscount.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Frete{selectedShipping ? ` (${selectedShipping.title.split(" ")[0]})` : ""}
                        </span>
                        <span>
                          {!selectedShipping
                            ? "—"
                            : shipping === 0
                            ? "Grátis ✓"
                            : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
                        </span>
                      </div>
                      <div className="border-t pt-3 flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>

                    {totalPrice < MIN_SUBTOTAL && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        Pedido mínimo de <strong>R$ {MIN_SUBTOTAL.toFixed(2).replace(".", ",")}</strong> em produtos.
                        Faltam <strong>R$ {(MIN_SUBTOTAL - totalPrice).toFixed(2).replace(".", ",")}</strong> para finalizar.
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 text-base gap-2"
                      size="lg"
                      disabled={createOrder.isPending || totalPrice < MIN_SUBTOTAL}
                    >
                      <Lock className="h-4 w-4" />
                      {createOrder.isPending ? "Processando..." : "Confirmar Pedido"}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Pagamento 100% seguro</span>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24 max-w-lg mx-auto"
            >
              {paymentMethod === "pix" && !pixConfirmed ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-amber-500/20">
                    <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
                  </div>
                  <h1 className="font-display text-3xl font-bold mb-3 text-amber-700">
                    Aguardando pagamento
                  </h1>
                  <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                    Pague o PIX abaixo para confirmar seu pedido. Estamos verificando o pagamento em tempo real.
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-4">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Verificando pagamento...
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-pix/10 flex items-center justify-center mx-auto mb-6">
                    <Check className="h-10 w-10 text-pix" />
                  </div>
                  <h1 className="font-display text-3xl font-bold mb-3">
                    {pixConfirmed ? "Pagamento Confirmado! 🎉" : "Pedido Confirmado! 🎉"}
                  </h1>
                  <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                    {pixConfirmed
                      ? "Recebemos seu pagamento. Em breve seu pedido será preparado."
                      : "Obrigado pela sua compra! Enviamos os detalhes para seu e-mail."}
                  </p>
                </>
              )}
              {accountCreated && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 mb-6 max-w-md mx-auto flex items-center gap-2 text-sm">
                  <UserPlus className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Sua conta foi criada! Você já está logado e pode acompanhar seus pedidos.
                  </span>
                </div>
              )}
              <div className="bg-secondary/50 rounded-xl p-4 mb-6 inline-block">
                <p className="text-xs text-muted-foreground">
                  Número do pedido
                </p>
                <p className="text-lg font-bold font-mono text-foreground">
                  #{orderId ?? "---"}
                </p>
              </div>

              {paymentMethod === "pix" && paymentDetails?.qr_code_base64 && !pixConfirmed && (
                <div className="sticky top-24 z-30 max-w-sm mx-auto border-2 border-pix/30 bg-background/95 backdrop-blur shadow-lg rounded-xl p-5 mb-8 space-y-4">
                  <div className="flex items-center gap-2 justify-center text-pix font-semibold">
                    <QrCode className="h-5 w-5" />
                    <span>Pague com PIX</span>
                  </div>
                  <img
                    src={paymentDetails.qr_code_base64.startsWith("data:")
                      ? paymentDetails.qr_code_base64
                      : `data:image/png;base64,${paymentDetails.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-56 h-56 mx-auto rounded-lg bg-white p-2"
                  />
                  {paymentDetails.qr_code && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground text-left">
                        Ou copie o código PIX:
                      </p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={paymentDetails.qr_code}
                          className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono truncate"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(paymentDetails.qr_code!);
                            toast.success("Código PIX copiado!");
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                  {paymentDetails.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Válido até:{" "}
                      {new Date(paymentDetails.expires_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === "boleto" && paymentDetails?.boleto_url && (
                <div className="max-w-sm mx-auto border rounded-xl p-5 mb-8 space-y-3">
                  <p className="text-sm font-semibold">Boleto gerado</p>
                  {paymentDetails.boleto_barcode && (
                    <p className="text-xs font-mono break-all bg-secondary p-2 rounded">
                      {paymentDetails.boleto_barcode}
                    </p>
                  )}
                  <a
                    href={paymentDetails.boleto_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full"
                  >
                    <Button className="w-full" size="lg">
                      <Barcode className="h-4 w-4 mr-2" />
                      Abrir boleto
                    </Button>
                  </a>
                </div>
              )}
              {!accountCreated && !isAuthenticated && (
                <div className="bg-secondary/60 border border-border rounded-lg px-4 py-3 mb-6 max-w-md mx-auto text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Quer acompanhar seu pedido?</p>
                  <p>
                    Crie uma senha com o e-mail{" "}
                    <span className="font-medium text-foreground">{form.email}</span>{" "}
                    e acesse seus pedidos a qualquer hora.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Link to="/">
                  <Button size="lg">Voltar à Loja</Button>
                </Link>
                <Link
                  to="/conta"
                  state={!accountCreated && !isAuthenticated ? { email: form.email, signUp: true } : undefined}
                >
                  <Button size="lg" variant="outline">
                    {accountCreated || isAuthenticated ? "Meus Pedidos" : "Criar senha / Ver pedidos"}
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default Checkout;
