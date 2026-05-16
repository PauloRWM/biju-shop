import { api } from "./api";

export type CouponDiscountType =
  | "percent"
  | "fixed_cart"
  | "fixed_product"
  | "free_shipping";

export interface CouponItemInput {
  product_id: number;
  qty: number;
  price: number;
}

export interface ValidateCouponInput {
  code: string;
  subtotal: number;
  items: CouponItemInput[];
  email?: string;
}

export interface CouponValidationResponse {
  code: string;
  discount_type: CouponDiscountType;
  amount: number;
  free_shipping: boolean;
  discount: number;
  description?: string;
}

/**
 * Valida o cupom contra o WooCommerce e retorna o valor de desconto
 * calculado para os itens informados. Lança Error com mensagem amigável
 * em caso de falha (cupom inválido, expirado, valor mínimo, etc).
 */
export async function validateCoupon(
  input: ValidateCouponInput,
): Promise<CouponValidationResponse> {
  try {
    return await api.post<CouponValidationResponse>(
      "/coupon/validate",
      input,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Não foi possível validar o cupom.";
    throw new Error(message);
  }
}
