import { api } from './api';
import type { Product } from '@/data/products';

export interface AbandonedCartItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
  name?: string;
  line_total?: number;
}

/** Item do carrinho salvo no servidor, já hidratado com o Product completo. */
export interface SavedCartItem {
  product: Product;
  quantity: number;
  variationId?: number | null;
  unitPrice?: number;
}

/**
 * Busca o carrinho salvo do usuário logado (tabela wc_abandoned_carts por user_id).
 * Usado ao logar para recuperar o carrinho em qualquer navegador. Requer token.
 * Retorna [] silenciosamente em qualquer erro (não bloqueia o login).
 */
export async function fetchSavedCart(): Promise<SavedCartItem[]> {
  try {
    const res = await api.get<{ items: SavedCartItem[] }>('/cart');
    return Array.isArray(res?.items) ? res.items : [];
  } catch {
    return [];
  }
}

/**
 * Recupera um carrinho a partir de um token de recuperação (link gerado no
 * admin pelo botão "Enviar pro carrinho"). Endpoint público — não requer login.
 * Retorna [] silenciosamente em qualquer erro (link expirado/inválido).
 */
export async function recoverCart(token: string): Promise<SavedCartItem[]> {
  try {
    const res = await api.get<{ items: SavedCartItem[]; found?: boolean }>(
      `/cart/recover?token=${encodeURIComponent(token)}`,
    );
    return Array.isArray(res?.items) ? res.items : [];
  } catch {
    return [];
  }
}

export interface AbandonedCartGuestInfo {
  email?: string;
  phone?: string;
  name?: string;
}

export async function saveAbandonedCart(
  items: AbandonedCartItem[],
  guest?: AbandonedCartGuestInfo,
): Promise<void> {
  try {
    await api.post('/cart/save', {
      items,
      email: guest?.email,
      phone: guest?.phone,
      name: guest?.name,
    });
  } catch {
    // silencioso — não bloqueia o usuário se a sincronização falhar
  }
}

export async function clearAbandonedCart(guest?: AbandonedCartGuestInfo): Promise<void> {
  try {
    // DELETE não envia body (incompatível com vários proxies). Guest manda email/phone
    // na query string para o backend identificar o registro.
    const params = new URLSearchParams();
    if (guest?.email) params.set('email', guest.email);
    if (guest?.phone) params.set('phone', guest.phone);
    const qs = params.toString();
    await api.delete(`/cart/save${qs ? `?${qs}` : ''}`);
  } catch {
    // silencioso
  }
}
