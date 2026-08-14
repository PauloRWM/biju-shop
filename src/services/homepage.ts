import { api } from './api';

export interface MenuItem {
  label: string;
  slug: string | null;
  url: string | null;
}

export interface HomeSection {
  name: string;
  slug: string;
  count: number;
  image: string | null;
}

export interface HomeBanner {
  image: string;
  /** Link opcional ao clicar (path relativo /shop?... ou URL completa). */
  link?: string;
  alt?: string;
}

export interface HomepageConfig {
  menu: MenuItem[];
  sections: HomeSection[];
  /** Banners do carrossel configurados no admin. Vazio → front usa os padrão. */
  banners?: HomeBanner[];
}

export async function fetchHomepageConfig(): Promise<HomepageConfig> {
  // Rota pública e cacheável — sem Authorization para liberar cache de CDN.
  return api.getPublic<HomepageConfig>('/homepage');
}
