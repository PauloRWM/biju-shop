import { api } from "./api";

interface PaymentConfig {
  mp_public_key: string | null;
}

let mpInstance: any = null;
let configCache: PaymentConfig | null = null;

async function getConfig(): Promise<PaymentConfig> {
  if (configCache) return configCache;
  configCache = await api.get<PaymentConfig>("/payment-config");
  return configCache;
}

async function loadMpSdk(): Promise<void> {
  if (typeof window === "undefined") return;
  if ((window as any).MercadoPago) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar SDK Mercado Pago"));
    document.head.appendChild(s);
  });
}

async function getMp(): Promise<any> {
  if (mpInstance) return mpInstance;
  const cfg = await getConfig();
  if (!cfg.mp_public_key) {
    throw new Error("Mercado Pago não configurado (public key ausente).");
  }
  await loadMpSdk();
  mpInstance = new (window as any).MercadoPago(cfg.mp_public_key, { locale: "pt-BR" });
  return mpInstance;
}

export interface CardTokenInput {
  cardNumber: string;
  cardholderName: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

export interface CardTokenResult {
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id?: string;
  // Campos adicionais que o backend repassa ao MP plugin para melhorar a
  // aprovação (antifraude). O MP plugin v7 lê todos eles em process_payment.
  holder_name?: string;
  bin?: string;              // primeiros 6 dígitos do cartão
  last_four_digits?: string; // últimos 4 dígitos
  expiration_month?: string; // "MM"
  expiration_year?: string;  // "YYYY"
  installments_amount?: number; // valor de cada parcela (com juros, se houver)
  total_paid_amount?: number;   // total cobrado (amount + juros)
}

// Mapeamento de códigos de erro do Mercado Pago JS v2 → mensagens em PT-BR.
// Refs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/response-handling/error-handling
const MP_ERROR_MESSAGES: Record<string, string> = {
  "205": "Informe o número do cartão.",
  "208": "Informe o mês de validade.",
  "209": "Informe o ano de validade.",
  "212": "Informe o tipo de documento.",
  "213": "Informe o número do documento (CPF).",
  "214": "Número de documento (CPF) inválido.",
  "220": "Informe o tipo de documento do titular.",
  "221": "Informe o nome do titular do cartão.",
  "224": "Informe o código de segurança (CVV).",
  "316": "Nome do titular inválido.",
  "322": "Tipo de documento inválido.",
  "323": "Número de documento inválido.",
  "324": "CPF inválido.",
  "325": "Mês de validade inválido.",
  "326": "Ano de validade inválido.",
  E301: "Número do cartão inválido. Confira os dígitos.",
  E302: "Código de segurança (CVV) inválido.",
  "150": "Cartão expirado. Confira a data de validade.",
  "106": "Cartão não permitido para esta operação.",
  bin_not_found: "Não reconhecemos essa bandeira de cartão.",
  invalid_card_number: "Número do cartão inválido.",
  invalid_expiration_date: "Data de validade inválida.",
  invalid_security_code: "Código de segurança (CVV) inválido.",
  invalid_holder_name: "Nome do titular inválido.",
};

function extractMpError(err: unknown): string {
  // O SDK MP costuma retornar { cause: [{ code, description }] } ou { error, message }.
  const e = err as any;
  const causes: Array<{ code?: string | number; description?: string }> = Array.isArray(e?.cause)
    ? e.cause
    : [];
  if (causes.length > 0) {
    const code = String(causes[0].code ?? "");
    const friendly = MP_ERROR_MESSAGES[code];
    if (friendly) return friendly;
    if (causes[0].description) return causes[0].description;
  }
  if (typeof e?.message === "string" && e.message) {
    const friendly = MP_ERROR_MESSAGES[e.message];
    if (friendly) return friendly;
    return e.message;
  }
  if (typeof e?.error === "string" && MP_ERROR_MESSAGES[e.error]) {
    return MP_ERROR_MESSAGES[e.error];
  }
  return "Falha ao validar cartão. Confira os dados e tente novamente.";
}

export async function tokenizeCard(
  input: CardTokenInput,
  installments: number,
  amount?: number,
): Promise<CardTokenResult> {
  const mp = await getMp();

  const cleanNumber = input.cardNumber.replace(/\s/g, "");
  const bin = cleanNumber.slice(0, 8);
  const binShort = cleanNumber.slice(0, 6); // 6 dígitos = formato esperado pelo MP plugin

  let pmList: any;
  try {
    pmList = await mp.getPaymentMethods({ bin });
  } catch (err) {
    throw new Error(extractMpError(err));
  }
  const pm = pmList?.results?.[0];
  if (!pm) {
    throw new Error("Bandeira do cartão não reconhecida. Confira o número.");
  }
  if (pm.status && pm.status !== "active") {
    throw new Error("Esta bandeira de cartão não está disponível no momento.");
  }

  let tokenResp: any;
  try {
    tokenResp = await mp.createCardToken({
      cardNumber: cleanNumber,
      cardholderName: input.cardholderName,
      cardExpirationMonth: input.cardExpirationMonth,
      cardExpirationYear: input.cardExpirationYear,
      securityCode: input.securityCode,
      identificationType: input.identificationType,
      identificationNumber: input.identificationNumber.replace(/\D/g, ""),
    });
  } catch (err) {
    throw new Error(extractMpError(err));
  }
  if (!tokenResp?.id) {
    throw new Error("Não foi possível gerar o token do cartão.");
  }

  // Busca o plano de parcelamento exato (incluindo juros) se temos o amount.
  // Sem isso, o backend cai no cálculo simples (amount / installments), que
  // funciona para parcelas sem juros mas é incorreto para parcelas com juros.
  let installments_amount: number | undefined;
  let total_paid_amount: number | undefined;
  if (amount && amount > 0) {
    try {
      const inst = await mp.getInstallments({
        bin: binShort,
        amount: String(amount),
        paymentTypeId: "credit_card",
      });
      const planList = inst?.[0]?.payer_costs ?? [];
      const plan = planList.find((p: any) => Number(p.installments) === installments);
      if (plan) {
        installments_amount = Number(plan.installment_amount);
        total_paid_amount = Number(plan.total_amount);
      }
    } catch {
      // Se getInstallments falhar, o backend usa o fallback amount/installments.
    }
  }

  return {
    token: tokenResp.id,
    payment_method_id: pm.id,
    installments,
    issuer_id: pm.issuer?.id ?? tokenResp.issuer_id,
    holder_name: input.cardholderName,
    bin: binShort,
    last_four_digits: cleanNumber.slice(-4),
    expiration_month: input.cardExpirationMonth,
    expiration_year: input.cardExpirationYear,
    installments_amount,
    total_paid_amount,
  };
}
