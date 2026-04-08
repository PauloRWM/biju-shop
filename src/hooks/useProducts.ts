import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchProducts, fetchProduct, fetchCategories, type ProductsParams } from '@/services/products';

export function useProducts(params: ProductsParams = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
    staleTime: 60_000, // 1 min
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000, // 5 min
  });
}
