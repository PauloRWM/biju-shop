import React, { createContext, useContext, useState, useCallback } from "react";
import { Product } from "@/data/products";

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

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product,
    quantity?: number,
    opts?: { variationId?: number; variationLabel?: string; unitPrice?: number },
  ) => void;
  removeItem: (productId: string, variationId?: number) => void;
  updateQuantity: (productId: string, quantity: number, variationId?: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  coupon: AppliedCoupon | null;
  setCoupon: (c: AppliedCoupon | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (
      product: Product,
      quantity: number = 1,
      opts?: { variationId?: number; variationLabel?: string; unitPrice?: number },
    ) => {
      const qty = Math.max(1, Math.floor(quantity));
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.product.id === product.id && (i.variationId ?? 0) === (opts?.variationId ?? 0),
        );
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id && (i.variationId ?? 0) === (opts?.variationId ?? 0)
              ? { ...i, quantity: i.quantity + qty }
              : i,
          );
        }
        return [
          ...prev,
          {
            product,
            quantity: qty,
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
        prev.map((i) =>
          i.product.id === productId && (i.variationId ?? 0) === (variationId ?? 0)
            ? { ...i, quantity }
            : i,
        ),
      );
    },
    [],
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + (i.unitPrice ?? i.product.price) * i.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, openCart, closeCart, coupon, setCoupon }}
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
