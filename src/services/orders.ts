import { api } from './api';

export interface OrderBilling {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_1: string;       // rua / logradouro (sem número/bairro)
  address_2?: string;      // complemento opcional
  number?: string;         // número do endereço (BR)
  neighborhood?: string;   // bairro (BR — _billing_neighborhood)
  city: string;
  state: string;
  postcode: string;
  country?: string;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
  variation_id?: number;
}

export interface CreateOrderPayload {
  billing: OrderBilling;
  items: OrderItem[];
  payment_method: 'pix' | 'billet' | 'credit_card';
  customer_note?: string;
  shipping_method_id?: string;
  shipping_method_title?: string;
  shipping_total?: number;
  discount_total?: number;
  discount_title?: string;
  coupon_code?: string;
  cpf?: string;
  fbp?: string;
  fbc?: string;
  checkout_url?: string;
  card?: {
    token: string;
    payment_method_id: string;
    installments: number;
    issuer_id?: string;
    holder_name?: string;
    bin?: string;
    last_four_digits?: string;
    expiration_month?: string;
    expiration_year?: string;
    installments_amount?: number;
    total_paid_amount?: number;
    device_id?: string;
  };
}

export interface PaymentDetails {
  qr_code_base64?: string;
  qr_code?: string;
  ticket_url?: string;
  expires_at?: string;
  boleto_url?: string;
  boleto_barcode?: string;
  payment_id?: string;
  status?: string;
  status_detail?: string;
  error?: string;
  message?: string;
}

export interface Order {
  id: number;
  status: string;
  statusLabel: string;
  total: number;
  subtotal: number;
  paymentMethod: string;
  paymentTitle: string;
  cpf?: string;
  items: {
    product_id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
    image: string | null;
  }[];
  billing: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
  };
  createdAt: string;
  customerNote: string;
  payment?: PaymentDetails;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  return api.post<Order>('/orders', payload);
}

export async function fetchOrder(id: number): Promise<Order> {
  return api.get<Order>(`/orders/${id}`);
}

export async function fetchMyOrders(): Promise<Order[]> {
  return api.get<Order[]>('/account/orders');
}

export interface PayOrderPayload {
  payment_method: 'pix' | 'credit_card' | 'billet';
  card?: CreateOrderPayload['card'];
}

/**
 * Paga um pedido já criado que ficou aguardando pagamento (botão "Pagar agora"
 * na conta). Regera o pagamento via Mercado Pago e devolve o pedido atualizado
 * com `payment` (QR PIX / status do cartão).
 */
export async function payOrder(id: number, payload: PayOrderPayload): Promise<Order> {
  return api.post<Order>(`/orders/${id}/pay`, payload);
}
