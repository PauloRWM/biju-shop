import { api } from './api';

export interface OrderBilling {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
}

export interface CreateOrderPayload {
  billing: OrderBilling;
  items: OrderItem[];
  payment_method: 'pix' | 'billet' | 'credit_card';
  customer_note?: string;
}

export interface Order {
  id: number;
  status: string;
  statusLabel: string;
  total: number;
  subtotal: number;
  paymentMethod: string;
  paymentTitle: string;
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
