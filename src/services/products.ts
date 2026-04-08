import { api } from './api';
import type { Product } from '@/data/products';

export interface ProductsParams {
  page?: number;
  per_page?: number;
  category?: string;
  search?: string;
  orderby?: 'date' | 'price' | 'popularity' | 'rating' | 'title';
  order?: 'ASC' | 'DESC';
  featured?: boolean;
}

export interface ProductsPage {
  products: Product[];
  total: number;
  totalPages: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  count: number;
  image: string | null;
}

export async function fetchProducts(params: ProductsParams = {}): Promise<ProductsPage> {
  const res = await fetch(buildProductsUrl(params));
  if (!res.ok) throw new Error('Erro ao buscar produtos');

  const total = Number(res.headers.get('X-WP-Total') ?? 0);
  const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? 1);
  const products: Product[] = await res.json();

  return { products, total, totalPages };
}

function buildProductsUrl(params: ProductsParams): string {
  const base = (import.meta.env.VITE_API_URL as string) || '/wp-json/biju/v1';
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  );
  return `${base}/products${qs.toString() ? '?' + qs : ''}`;
}

export async function fetchProduct(id: string): Promise<Product> {
  return api.get<Product>(`/products/${id}`);
}

export async function fetchCategories(): Promise<Category[]> {
  return api.get<Category[]>('/categories');
}
