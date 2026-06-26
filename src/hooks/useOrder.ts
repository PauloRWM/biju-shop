import { useMutation, useQuery, type Query } from '@tanstack/react-query';
import { createOrder, fetchOrder, fetchMyOrders, type CreateOrderPayload, type Order } from '@/services/orders';

export function useCreateOrder() {
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
  });
}

type RefetchInterval =
  | number
  | false
  | ((query: Query<Order, Error, Order, readonly unknown[]>) => number | false);

export function useOrder(id: number | undefined, opts?: { refetchInterval?: RefetchInterval }) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['my-orders'],
    queryFn: fetchMyOrders,
  });
}
