import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Product } from "@/data/products";
import { saveAbandonedCart, clearAbandonedCart } from "@/services/abandonedCart";
import { getAuthToken } from "@/services/api";

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
    opts?: { variationId?: number; variationLabel?: string; unitPrice?: number },
  ) => void;
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
  const isFirstRun = useRef(true);

  const addItem = useCallback(
    (
      product: Product,
      quantity: number = 1,
      opts?: { variationId?: number; variationLabel?: string; unitPrice?: number },
    ) => {
      const qty = Math.max(1, Math.floor(quantity));
      // Limite de estoque (null/undefined = não gerencia estoque = ilimitado).
      const max =
        typeof product.stockQuantity === "number" && product.stockQuantity >= 0
          ? product.stockQuantity
          : Infinity;
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.product.id === product.id && (i.variationId ?? 0) === (opts?.variationId ?? 0),
        );
        if (existing) {
          const capped = Math.min(existing.quantity + qty, max);
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
    },
    [],
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

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + (i.unitPrice ?? i.product.price) * i.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, openCart, closeCart, coupon, setCoupon, guestContact, setGuestContact }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
