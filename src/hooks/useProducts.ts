import { useQuery, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { fetchProducts, fetchProduct, fetchCategories, type ProductsParams } from '@/services/products';
import { fetchHomepageConfig } from '@/services/homepage';

export function useProducts(params: ProductsParams = {}, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    enabled: opts?.enabled ?? true,
  });
}

export function useInfiniteProducts(params: Omit<ProductsParams, 'page'> = {}) {
  const perPage = params.per_page ?? 20;
  return useInfiniteQuery({
    queryKey: ['products-infinite', params],
    queryFn: ({ pageParam = 1 }) => fetchProducts({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, allPages) => {
      const nextPage = allPages.length + 1;
      // Preferir totalPages (do header X-WP-TotalPages). Se vier 0/1 por
      // header bloqueado ou CORS, cai pra heurística: enquanto a última
      // página vier cheia, assume que existe próxima.
      if (last.totalPages && last.totalPages > 1) {
        return nextPage <= last.totalPages ? nextPage : undefined;
      }
      return last.products.length >= perPage ? nextPage : undefined;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useHomepageConfig() {
  return useQuery({
    queryKey: ['homepage-config'],
    queryFn: fetchHomepageConfig,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
