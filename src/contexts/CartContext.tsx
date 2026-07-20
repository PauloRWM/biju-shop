import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Product } from "@/data/products";
import { saveAbandonedCart, clearAbandonedCart, fetchSavedCart, recoverCart } from "@/services/abandonedCart";
import { getAuthToken } from "@/services/api";
import { checkStock } from "@/services/stock";

export interface CartItem {
  product: Product;
  quantity: number;
  variationId?: number;
  variationLabel?: string;
  unitPrice?: number;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  discount_type: "percent" | "fixed_cart" | "fixed_product" | "free_shipping";
  amount: number;
  free_shipping: boolean;
}

export interface GuestContact {
  email?: string;
  phone?: string;
  name?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product,
    quantity?: number,
    opts?: {
      variationId?: number;
      variationLabel?: string;
      unitPrice?: number;
      // Estoque da variação selecionada (sobrepõe o do produto-pai).
      inStock?: boolean;
      maxStock?: number | null;
    },
    // Retorna false quando a adição foi bloqueada por falta de estoque.
  ) => boolean;
  removeItem: (productId: string, variationId?: number) => void;
  updateQuantity: (productId: string, quantity: number, variationId?: number) => void;
  clearCart: (opts?: { keepAbandoned?: boolean }) => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  coupon: AppliedCoupon | null;
  setCoupon: (c: AppliedCoupon | null) => void;
  guestContact: GuestContact;
  setGuestContact: (c: GuestContact) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Chaves de persistência do carrinho (localStorage).
const CART_ITEMS_KEY = "biju_cart_items";
const CART_COUPON_KEY = "biju_cart_coupon";

const loadInitialItems = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validação mínima — formato pode ter mudado entre versões do site.
    return parsed.filter(
      (i): i is CartItem =>
        i && typeof i === "object" && i.product && typeof i.quantity === "number",
    );
  } catch {
    return [];
  }
};

const loadInitialCoupon = (): AppliedCoupon | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CART_COUPON_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(loadInitialItems);
  const [isOpen, setIsOpen] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(loadInitialCoupon);
  const [guestContact, setGuestContact] = useState<GuestContact>({});
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  // Quando true, a próxima sincronização de carrinho abandonado é ignorada.
  // Usado ao finalizar pedido: esvaziamos o carrinho local mas NÃO apagamos
  // o registro de abandonado no servidor (só some quando o pagamento confirma).
  const suppressSync = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stockCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  const addItem = useCallback(
    (
      product: Product,
      quantity: number = 1,
      opts?: {
        variationId?: number;
        variationLabel?: string;
        unitPrice?: number;
        inStock?: boolean;
        maxStock?: number | null;
      },
    ): boolean => {
      const qty = Math.max(1, Math.floor(quantity));

      // Estoque efetivo: usa o da variação (opts) quando informado, senão o do produto.
      const inStock = opts?.inStock ?? product.inStock;
      const maxRaw = opts?.maxStock ?? product.stockQuantity;
      // Limite de estoque (null/undefined = não gerencia estoque = ilimitado).
      const max =
        typeof maxRaw === "number" && maxRaw >= 0 ? maxRaw : Infinity;

      // Bloqueio: impede adicionar produto/variação sem estoque.
      if (inStock === false || max <= 0) {
        toast.error("Produto esgotado — não foi possível adicionar ao carrinho.");
        return false;
      }

      // Já no máximo disponível? Avisa e não adiciona (decisão síncrona com o
      // snapshot atual de items, antes do update funcional).
      const existing = items.find(
        (i) => i.product.id === product.id && (i.variationId ?? 0) === (opts?.variationId ?? 0),
      );
      if (existing && existing.quantity >= max) {
        toast.error(`Você já atingiu o máximo disponível (${max} em estoque).`);
        return false;
      }

      setItems((prev) => {
        const prevExisting = prev.find(
          (i) => i.product.id === product.id && (i.variationId ?? 0) === (opts?.variationId ?? 0),
        );
        if (prevExisting) {
          const capped = Math.min(prevExisting.quantity + qty, max);
          return prev.map((i) =>
            i.product.id === product.id && (i.variationId ?? 0) === (opts?.variationId ?? 0)
              ? { ...i, quantity: capped }
              : i,
          );
        }
        return [
          ...prev,
          {
            product,
            quantity: Math.min(qty, max),
            variationId: opts?.variationId,
            variationLabel: opts?.variationLabel,
            unitPrice: opts?.unitPrice,
          },
        ];
      });

      return true;
    },
    [items],
  );

  const removeItem = useCallback((productId: string, variationId?: number) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.product.id === productId && (i.variationId ?? 0) === (variationId ?? 0)),
      ),
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number, variationId?: number) => {
      if (quantity <= 0) {
        setItems((prev) =>
          prev.filter(
            (i) => !(i.product.id === productId && (i.variationId ?? 0) === (variationId ?? 0)),
          ),
        );
        return;
      }
      setItems((prev) =>
        prev.map((i) => {
          if (!(i.product.id === productId && (i.variationId ?? 0) === (variationId ?? 0))) {
            return i;
          }
          const max =
            typeof i.product.stockQuantity === "number" && i.product.stockQuantity >= 0
              ? i.product.stockQuantity
              : Infinity;
          return { ...i, quantity: Math.min(quantity, max) };
        }),
      );
    },
    [],
  );

  const clearCart = useCallback((opts?: { keepAbandoned?: boolean }) => {
    if (opts?.keepAbandoned) {
      // Esvazia o carrinho local sem apagar o registro de abandonado.
      // Suprime a próxima sincronização (que veria items vazio e tentaria deletar)
      // e cancela qualquer sync com debounce ainda pendente.
      suppressSync.current = true;
      if (syncTimer.current) clearTimeout(syncTimer.current);
    } else {
      void clearAbandonedCart(guestContact);
    }
    setItems([]);
    setCoupon(null);
  }, [guestContact]);

  // Persiste items no localStorage a cada mudança.
  useEffect(() => {
    try {
      if (items.length === 0) {
        localStorage.removeItem(CART_ITEMS_KEY);
      } else {
        localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
      }
    } catch {
      // Quota excedida ou modo privado — ignora.
    }
  }, [items]);

  // Persiste cupom aplicado.
  useEffect(() => {
    try {
      if (coupon) {
        localStorage.setItem(CART_COUPON_KEY, JSON.stringify(coupon));
      } else {
        localStorage.removeItem(CART_COUPON_KEY);
      }
    } catch {
      // ignore
    }
  }, [coupon]);

  // Sincroniza carrinho com o servidor (tabela wc_abandoned_carts).
  // - Usuário logado: identificado pelo JWT (sempre sincroniza).
  // - Guest: só sincroniza quando já tem email ou telefone (capturados no checkout).
  // Debounce de 3s para não bater no backend a cada clique de +/-.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    // Pedido recém-criado: pula esta sincronização (não apaga o abandonado).
    if (suppressSync.current) {
      suppressSync.current = false;
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const hasIdentifier =
        !!getAuthToken() || !!guestContact.email || !!guestContact.phone;
      if (!hasIdentifier) return; // guest anônimo: não vale a pena enviar
      if (items.length === 0) {
        void clearAbandonedCart(guestContact);
      } else {
        void saveAbandonedCart(
          items.map((i) => ({
            product_id: Number(i.product.id),
            variation_id: i.variationId,
            quantity: i.quantity,
            name: i.product.name,
            line_total: (i.unitPrice ?? i.product.price) * i.quantity,
          })),
          guestContact,
        );
      }
    }, 3000);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [items, guestContact]);

  // Validação de estoque em tempo real (fora do checkout). Sempre que o carrinho
  // muda, consulta o estoque REAL no servidor e ajusta:
  //  - pediu mais do que há disponível → limita à quantidade disponível + avisa;
  //  - estoque zero → remove o item do carrinho e informa o motivo.
  // O backend considera o que o PRÓPRIO carrinho segura (hold), então o dono não
  // perde o que ele mesmo reservou. Debounce curto (500ms) para ser quase imediato
  // sem disparar a cada clique de +/-.
  useEffect(() => {
    if (items.length === 0) return;
    if (stockCheckTimer.current) clearTimeout(stockCheckTimer.current);
    stockCheckTimer.current = setTimeout(async () => {
      try {
        const results = await checkStock(
          items.map((i) => ({
            product_id: Number(i.product.id),
            variation_id: i.variationId,
            quantity: i.quantity,
          })),
          guestContact,
        );
        const byKey = new Map(
          results.map((r) => [`${r.product_id}:${r.variation_id ?? 0}`, r]),
        );
        for (const it of items) {
          const r = byKey.get(`${Number(it.product.id)}:${it.variationId ?? 0}`);
          if (!r || r.unlimited || r.available === null) continue;
          if (r.available >= it.quantity) continue;
          if (r.available <= 0) {
            removeItem(it.product.id, it.variationId);
            toast.error(`${it.product.name} ficou sem estoque e foi removido do carrinho.`);
          } else {
            updateQuantity(it.product.id, r.available, it.variationId);
            toast.error(
              `Só temos ${r.available} de ${it.product.name} em estoque — ajustamos a quantidade.`,
            );
          }
        }
      } catch {
        // Erro de rede: não mexe no carrinho.
      }
    }, 500);
    return () => {
      if (stockCheckTimer.current) clearTimeout(stockCheckTimer.current);
    };
  }, [items, guestContact, removeItem, updateQuantity]);

  // Recupera o carrinho salvo na conta ao logar e mescla com o carrinho local
  // deste navegador. Regra de merge: mesma chave (product.id + variationId) →
  // mantém a MAIOR quantidade; itens só no servidor são adicionados. Assim o
  // cliente reencontra o carrinho em qualquer navegador sem perder o que já
  // tinha aqui. Dispara no evento de login (biju:auth-change com token) e uma
  // vez no mount se já houver sessão (login persistido entre recarregamentos).
  useEffect(() => {
    let cancelled = false;

    const mergeFromAccount = async () => {
      if (!getAuthToken()) return;
      const saved = await fetchSavedCart();
      if (cancelled || saved.length === 0) return;

      setItems((prev) => {
        const keyOf = (productId: string, variationId?: number | null) =>
          `${productId}:${variationId ?? 0}`;

        const merged = new Map<string, CartItem>();
        for (const it of prev) {
          merged.set(keyOf(it.product.id, it.variationId), it);
        }

        for (const s of saved) {
          const key = keyOf(s.product.id, s.variationId ?? undefined);
          const existing = merged.get(key);
          if (existing) {
            // Duplicata: mantém a maior quantidade (nada se perde).
            if (s.quantity > existing.quantity) {
              merged.set(key, { ...existing, quantity: s.quantity });
            }
          } else {
            merged.set(key, {
              product: s.product,
              quantity: s.quantity,
              variationId: s.variationId ?? undefined,
              unitPrice: s.unitPrice,
            });
          }
        }

        return Array.from(merged.values());
      });
    };

    // Tenta no mount (sessão já logada de um refresh).
    void mergeFromAccount();

    // E a cada login dentro da mesma aba.
    const onAuthChange = (e: Event) => {
      const detail = (e as CustomEvent<{ token: string | null }>).detail;
      if (detail?.token) void mergeFromAccount();
    };
    window.addEventListener("biju:auth-change", onAuthChange);

    return () => {
      cancelled = true;
      window.removeEventListener("biju:auth-change", onAuthChange);
    };
  }, []);

  // Recuperação de carrinho por link (admin → "Enviar pro carrinho").
  // Quando a URL traz ?recover_cart=TOKEN, troca o token pelos produtos no
  // servidor, mescla no carrinho deste navegador (mesma regra: maior qtd) e
  // abre o drawer. Depois limpa o parâmetro da URL para não reexecutar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("recover_cart");
    if (!token) return;

    let cancelled = false;

    (async () => {
      const recovered = await recoverCart(token);

      // Remove o parâmetro da URL independentemente do resultado.
      params.delete("recover_cart");
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);

      if (cancelled || recovered.length === 0) {
        if (!cancelled && recovered.length === 0) {
          toast.error("Este link de carrinho expirou ou é inválido.");
        }
        return;
      }

      setItems((prev) => {
        const keyOf = (productId: string, variationId?: number | null) =>
          `${productId}:${variationId ?? 0}`;

        const merged = new Map<string, CartItem>();
        for (const it of prev) {
          merged.set(keyOf(it.product.id, it.variationId), it);
        }
        for (const s of recovered) {
          const key = keyOf(s.product.id, s.variationId ?? undefined);
          const existing = merged.get(key);
          if (existing) {
            if (s.quantity > existing.quantity) {
              merged.set(key, { ...existing, quantity: s.quantity });
            }
          } else {
            merged.set(key, {
              product: s.product,
              quantity: s.quantity,
              variationId: s.variationId ?? undefined,
              unitPrice: s.unitPrice,
            });
          }
        }
        return Array.from(merged.values());
      });

      toast.success("Seus produtos voltaram pro carrinho!");
      setIsOpen(true);
    })();

    return () => { cancelled = true; };
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + (i.unitPrice ?? i.product.price) * i.quantity,
    0,
  );

  // Memoiza o value para não recriar o objeto a cada render do provider, o que
  // re-renderizaria todos os consumidores (Header, cards, drawer) sem necessidade.
  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, openCart, closeCart, coupon, setCoupon, guestContact, setGuestContact }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, openCart, closeCart, coupon, guestContact],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
