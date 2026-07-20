import { api } from "./api";

export interface StockCheckItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
}

export interface StockCheckResult {
  product_id: number;
  variation_id: number;
  /** Disponível para ESTE cliente = estoque real + o que o próprio carrinho segura. null = ilimitado. */
  available: number | null;
  requested: number;
  unlimited: boolean;
}

/**
 * Consulta o estoque REAL (sem cache) para os itens do carrinho. O backend soma
 * o que o próprio carrinho do cliente já segura (hold), então o dono nunca é
 * barrado de ter no carrinho o que ele mesmo reservou. Passamos email/phone do
 * guestContact (e o token do logado vai no header) para o servidor identificar
 * o carrinho e computar o hold próprio.
 */
export async function checkStock(
  items: StockCheckItem[],
  contact?: { email?: string; phone?: string },
): Promise<StockCheckResult[]> {
  const res = await api.post<{ items: StockCheckResult[] }>("/stock/check", {
    items,
    email: contact?.email,
    phone: contact?.phone,
  });
  return res.items ?? [];
}
