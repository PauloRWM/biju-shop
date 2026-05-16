import { useMutation, useQuery } from '@tanstack/react-query';
import { createOrder, fetchOrder, fetchMyOrders, type CreateOrderPayload } from '@/services/orders';

export function useCreateOrder() {
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
  });
}

export function useOrder(id: number | undefined) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['my-orders'],
    queryFn: fetchMyOrders,
  });
}
