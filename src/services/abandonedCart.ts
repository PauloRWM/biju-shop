import { api } from './api';

export interface AbandonedCartItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
  name?: string;
  line_total?: number;
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
