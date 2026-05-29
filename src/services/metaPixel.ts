/**
 * Meta Pixel + Conversions API bridge.
 *
 * Carrega o pixel oficial do Meta sob demanda e expõe funções de tracking que
 * disparam o evento DUAS vezes em paralelo:
 *   1. Browser: fbq() para o pixel cliente.
 *   2. Server:  POST /meta/track para a CAPI via nosso plugin WP.
 * Ambos os disparos usam o MESMO `event_id` → o Meta deduplica automaticamente.
 *
 * Por que: adblock, ITP do Safari, iOS 14+ e bloqueio de cookies derrubam o
 * pixel do navegador, gerando vendas que não aparecem no Gerenciador. O envio
 * server-side resolve isso porque vai direto do nosso servidor para o Meta.
 */
import { api } from './api';

interface MetaConfig {
  enabled: boolean;
  pixel_id: string;
  test_event_code?: string;
}

interface FbqFn {
  (cmd: 'init', pixelId: string, advancedMatching?: Record<string, string>): void;
  (cmd: 'track', event: string, params?: Record<string, unknown>, opts?: { eventID?: string }): void;
  (cmd: 'trackCustom', event: string, params?: Record<string, unknown>, opts?: { eventID?: string }): void;
  (cmd: 'set', key: string, value: unknown): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
}

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

let configPromise: Promise<MetaConfig | null> | null = null;
let pixelLoaded = false;
let pixelInitArgs: { pixelId: string; advanced?: Record<string, string> } | null = null;

const getConfig = (): Promise<MetaConfig | null> => {
  if (configPromise) return configPromise;
  configPromise = api
    .get<MetaConfig>('/meta/config')
    .catch(() => null);
  return configPromise;
};

const loadPixel = (pixelId: string, advanced?: Record<string, string>) => {
  if (typeof window === 'undefined') return;
  if (!pixelLoaded) {
    pixelLoaded = true;
    // Snippet oficial do Meta (https://developers.facebook.com/docs/meta-pixel/get-started)
    /* eslint-disable */
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
  }

  // Re-init quando os dados de Advanced Matching mudarem (cliente preencheu mais campos
  // no checkout). O Meta aceita múltiplos inits do mesmo pixelId — o último prevalece.
  const sameAdvanced =
    pixelInitArgs &&
    pixelInitArgs.pixelId === pixelId &&
    JSON.stringify(pixelInitArgs.advanced ?? {}) === JSON.stringify(advanced ?? {});
  if (sameAdvanced) return;
  pixelInitArgs = { pixelId, advanced };
  if (advanced && Object.keys(advanced).length > 0) {
    window.fbq?.('init', pixelId, advanced);
  } else {
    window.fbq?.('init', pixelId);
  }
};

const readCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
};

const writeCookie = (name: string, value: string, days = 180) => {
  if (typeof document === 'undefined') return;
  const exp = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
};

/**
 * Lê o `_fbc` do cookie ou monta a partir do parâmetro `fbclid` da URL.
 * Formato esperado: fb.1.<timestamp>.<fbclid>
 * Quando construído a partir do fbclid, persiste como cookie (180 dias) para
 * que visitas subsequentes sem fbclid mantenham a atribuição.
 */
const resolveFbc = (): string | undefined => {
  const cookie = readCookie('_fbc');
  if (cookie) return cookie;
  if (typeof window === 'undefined') return undefined;
  const fbclid = new URLSearchParams(window.location.search).get('fbclid');
  if (!fbclid) return undefined;
  const value = `fb.1.${Date.now()}.${fbclid}`;
  writeCookie('_fbc', value, 180);
  return value;
};

export const getMetaCookies = () => ({
  fbp: readCookie('_fbp'),
  fbc: resolveFbc(),
});

export interface MetaUserData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  zp?: string;        // CEP (só dígitos)
  country?: string;   // ISO 2-letter, lowercase (ex: 'br')
  external_id?: string; // CPF, só dígitos
}

export interface MetaContent {
  id: string;
  quantity?: number;
  item_price?: number;
}

export interface MetaCustomData {
  currency?: string;
  value?: number;
  content_type?: 'product' | 'product_group';
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: MetaContent[];
  search_string?: string;
  num_items?: number;
  payment_type?: string; // AddPaymentInfo: 'pix' | 'credit_card' | 'boleto' etc
}

const newEventId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const sendCapi = async (payload: {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_data: MetaUserData & { fbp?: string; fbc?: string };
  custom_data: MetaCustomData;
}) => {
  try {
    await api.post('/meta/track', payload);
  } catch {
    // CAPI silencioso — não queremos quebrar UX se o backend falhar
  }
};

interface TrackOptions {
  /** Use um event_id estável (ex: order_<id>) para deduplicação cross-device. */
  eventId?: string;
  userData?: MetaUserData;
  customData?: MetaCustomData;
}

/**
 * Converte MetaUserData para o formato de Advanced Matching aceito pelo fbq('init').
 * O pixel do navegador hasheia internamente — passamos texto puro normalizado.
 * Telefone BR vira E.164 sem +.
 */
const toAdvancedMatching = (u?: MetaUserData): Record<string, string> => {
  if (!u) return {};
  const out: Record<string, string> = {};
  if (u.email) out.em = u.email.trim().toLowerCase();
  if (u.phone) {
    const digits = u.phone.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      out.ph = '55' + digits;
    } else if (digits) {
      out.ph = digits;
    }
  }
  // Remove acentos para bater com a normalização do servidor (PHP remove_accents).
  // U+0300..U+036F = combining diacritical marks (após NFD).
  const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (u.first_name) out.fn = stripAccents(u.first_name.trim().toLowerCase());
  if (u.last_name)  out.ln = stripAccents(u.last_name.trim().toLowerCase());
  if (u.city)       out.ct = stripAccents(u.city.toLowerCase()).replace(/[^a-z0-9]/g, '');
  if (u.state)      out.st = stripAccents(u.state.toLowerCase()).replace(/[^a-z0-9]/g, '');
  if (u.zp)         out.zp = u.zp.replace(/\D/g, '');
  if (u.country)    out.country = stripAccents(u.country.trim().toLowerCase()).replace(/[^a-z0-9]/g, '');
  if (u.external_id) out.external_id = u.external_id.replace(/\D/g, '');
  return out;
};

// Advanced Matching global — última versão conhecida (de qualquer evento).
// Acumula ao longo da sessão para que eventos posteriores se beneficiem.
const currentAdvancedMatching: Record<string, string> = {};

/**
 * Atualiza o Advanced Matching do pixel sem disparar evento. Útil para
 * passar email/telefone assim que o usuário digita no checkout.
 */
export const setUserData = async (userData: MetaUserData) => {
  const config = await getConfig();
  if (!config?.enabled || !config.pixel_id) return;
  const incoming = toAdvancedMatching(userData);
  let changed = false;
  for (const [k, v] of Object.entries(incoming)) {
    if (currentAdvancedMatching[k] !== v) {
      currentAdvancedMatching[k] = v;
      changed = true;
    }
  }
  if (!changed) return;
  loadPixel(config.pixel_id, currentAdvancedMatching);
};

const track = async (eventName: string, opts: TrackOptions = {}) => {
  const config = await getConfig();
  if (!config?.enabled || !config.pixel_id) return;

  // Acumula advanced matching desta chamada
  if (opts.userData) {
    const incoming = toAdvancedMatching(opts.userData);
    for (const [k, v] of Object.entries(incoming)) {
      currentAdvancedMatching[k] = v;
    }
  }
  loadPixel(
    config.pixel_id,
    Object.keys(currentAdvancedMatching).length > 0 ? currentAdvancedMatching : undefined,
  );

  const eventId = opts.eventId ?? newEventId();
  const customData = opts.customData ?? {};

  // 1) Pixel no navegador
  window.fbq?.('track', eventName, customData as Record<string, unknown>, { eventID: eventId });

  // 2) CAPI no servidor (mesmo event_id → deduplicado pelo Meta)
  const cookies = getMetaCookies();
  await sendCapi({
    event_name: eventName,
    event_id: eventId,
    event_source_url: typeof window !== 'undefined' ? window.location.href : '',
    user_data: { ...(opts.userData ?? {}), fbp: cookies.fbp, fbc: cookies.fbc },
    custom_data: customData,
  });
};

// -----------------------------------------------------------------------------
// API pública — eventos padronizados
// -----------------------------------------------------------------------------

export const trackPageView = () => track('PageView');

export const trackViewContent = (params: {
  productId: string;
  name: string;
  category?: string;
  price: number;
  currency?: string;
}) =>
  track('ViewContent', {
    customData: {
      content_type: 'product',
      content_ids: [params.productId],
      content_name: params.name,
      content_category: params.category,
      contents: [{ id: params.productId, quantity: 1, item_price: params.price }],
      value: params.price,
      currency: params.currency ?? 'BRL',
    },
  });

export const trackAddToCart = (params: {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency?: string;
}) =>
  track('AddToCart', {
    customData: {
      content_type: 'product',
      content_ids: [params.productId],
      content_name: params.name,
      contents: [{ id: params.productId, quantity: params.quantity, item_price: params.price }],
      value: params.price * params.quantity,
      currency: params.currency ?? 'BRL',
      num_items: params.quantity,
    },
  });

export const trackInitiateCheckout = (params: {
  contents: MetaContent[];
  value: number;
  currency?: string;
  userData?: MetaUserData;
}) =>
  track('InitiateCheckout', {
    userData: params.userData,
    customData: {
      content_type: 'product',
      content_ids: params.contents.map((c) => c.id),
      contents: params.contents,
      value: params.value,
      currency: params.currency ?? 'BRL',
      num_items: params.contents.reduce((sum, c) => sum + (c.quantity ?? 1), 0),
    },
  });

export const trackPurchase = (params: {
  orderId: string | number;
  contents: MetaContent[];
  value: number;
  currency?: string;
  userData?: MetaUserData;
}) =>
  // event_id estável = mesmo do CAPI no servidor (`order_<id>`) → deduplicação garantida
  track('Purchase', {
    eventId: `order_${params.orderId}`,
    userData: params.userData,
    customData: {
      content_type: 'product',
      content_ids: params.contents.map((c) => c.id),
      contents: params.contents,
      value: params.value,
      currency: params.currency ?? 'BRL',
      num_items: params.contents.reduce((sum, c) => sum + (c.quantity ?? 1), 0),
    },
  });

export const trackSearch = (searchString: string) =>
  track('Search', { customData: { search_string: searchString } });

export const trackAddPaymentInfo = (params: {
  contents: MetaContent[];
  value: number;
  currency?: string;
  paymentType: string; // 'pix' | 'credit_card' | 'boleto'
  userData?: MetaUserData;
}) =>
  track('AddPaymentInfo', {
    userData: params.userData,
    customData: {
      content_type: 'product',
      content_ids: params.contents.map((c) => c.id),
      contents: params.contents,
      value: params.value,
      currency: params.currency ?? 'BRL',
      num_items: params.contents.reduce((sum, c) => sum + (c.quantity ?? 1), 0),
      payment_type: params.paymentType,
    },
  });

export const trackLead = (params?: {
  value?: number;
  currency?: string;
  contentName?: string; // ex: 'Newsletter WhatsApp'
  userData?: MetaUserData;
}) =>
  track('Lead', {
    userData: params?.userData,
    customData: {
      content_name: params?.contentName,
      value: params?.value,
      currency: params?.currency ?? 'BRL',
    },
  });

export const trackCompleteRegistration = (params?: {
  method?: string; // 'google' | 'email'
  userData?: MetaUserData;
}) =>
  track('CompleteRegistration', {
    userData: params?.userData,
    customData: {
      content_name: params?.method ? `signup_${params.method}` : 'signup',
      currency: 'BRL',
    },
  });
