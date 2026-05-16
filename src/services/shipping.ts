import { api } from "./api";

export interface ShippingMethod {
  id: string;
  title: string;
  cost: number;
  etaDays: string;
  description: string;
}

const FREE_SHIPPING_THRESHOLD = 1000;

type Region = "SE" | "S" | "CO" | "NE" | "N";

function regionFromCep(cep: string): Region {
  const prefix = Number(cep.slice(0, 2));
  if (prefix <= 39) return "SE";
  if (prefix <= 69) return "NE";
  if (prefix <= 78) return "CO";
  if (prefix <= 79 || (prefix >= 80 && prefix <= 99)) return "S";
  return "N";
}

const TABLE: Record<Region, { pac: number; sedex: number; pacEta: string; sedexEta: string }> = {
  SE: { pac: 12.9, sedex: 22.9, pacEta: "5 a 8 dias úteis", sedexEta: "1 a 3 dias úteis" },
  S:  { pac: 14.9, sedex: 24.9, pacEta: "6 a 10 dias úteis", sedexEta: "2 a 4 dias úteis" },
  CO: { pac: 15.9, sedex: 27.9, pacEta: "7 a 11 dias úteis", sedexEta: "3 a 5 dias úteis" },
  NE: { pac: 18.9, sedex: 32.9, pacEta: "8 a 13 dias úteis", sedexEta: "3 a 6 dias úteis" },
  N:  { pac: 22.9, sedex: 38.9, pacEta: "10 a 15 dias úteis", sedexEta: "4 a 7 dias úteis" },
};

export interface ShippingItemInput {
  product_id: number;
  quantity: number;
  variation_id?: number;
}

/**
 * Calcula frete via WooCommerce (zonas + métodos configurados no admin).
 * Sempre adiciona "Retirar na loja" como primeira opção.
 * Em caso de falha, faz fallback para a tabela local.
 */
export async function calculateShippingViaWoo(
  cep: string,
  items: ShippingItemInput[],
  subtotal: number,
): Promise<ShippingMethod[]> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return [];

  const pickup: ShippingMethod = {
    id: "pickup",
    title: "Retirar na loja",
    cost: 0,
    etaDays: "Pronto em até 1 dia útil",
    description: "Sem custo · Combinar horário por WhatsApp",
  };

  try {
    const res = await api.post<{ methods: ShippingMethod[] }>(
      "/shipping/calculate",
      { postcode: clean, items, subtotal },
    );
    const methods = (res?.methods ?? []).filter((m) => m && m.title);
    if (methods.length > 0) {
      return [pickup, ...methods];
    }
  } catch {
    // fallback abaixo
  }

  // Fallback: tabela local
  const table = TABLE[regionFromCep(clean)];
  const freeEligible = subtotal >= FREE_SHIPPING_THRESHOLD;
  return [
    pickup,
    {
      id: "pac",
      title: "PAC (Correios)",
      cost: freeEligible ? 0 : table.pac,
      etaDays: table.pacEta,
      description: freeEligible ? "Frete grátis acima de R$ 1.000" : "Econômico",
    },
    {
      id: "sedex",
      title: "SEDEX (Correios)",
      cost: table.sedex,
      etaDays: table.sedexEta,
      description: "Entrega expressa",
    },
  ];
}

/**
 * Versão síncrona — usada apenas como fallback (tabela local).
 * Mantida para compatibilidade com chamadas existentes.
 */
export function calculateShipping(cep: string, subtotal: number): ShippingMethod[] {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return [];

  const table = TABLE[regionFromCep(clean)];
  const freeEligible = subtotal >= FREE_SHIPPING_THRESHOLD;

  return [
    {
      id: "pickup",
      title: "Retirar na loja",
      cost: 0,
      etaDays: "Pronto em até 1 dia útil",
      description: "Sem custo · Combinar horário por WhatsApp",
    },
    {
      id: "pac",
      title: "PAC (Correios)",
      cost: freeEligible ? 0 : table.pac,
      etaDays: table.pacEta,
      description: freeEligible ? "Frete grátis acima de R$ 1.000" : "Econômico",
    },
    {
      id: "sedex",
      title: "SEDEX (Correios)",
      cost: table.sedex,
      etaDays: table.sedexEta,
      description: "Entrega expressa",
    },
  ];
}

export const FREE_SHIPPING_MIN = FREE_SHIPPING_THRESHOLD;
