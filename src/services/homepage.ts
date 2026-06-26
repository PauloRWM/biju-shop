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

export interface HomepageConfig {
  menu: MenuItem[];
  sections: HomeSection[];
}

export async function fetchHomepageConfig(): Promise<HomepageConfig> {
  // Rota pública e cacheável — sem Authorization para liberar cache de CDN.
  return api.getPublic<HomepageConfig>('/homepage');
}
