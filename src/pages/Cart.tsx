import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Truck,
  Shield,
  Tag,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";

const Cart = () => {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const shipping = totalPrice >= 99 ? 0 : 14.9;
  const couponDiscount = couponApplied ? totalPrice * 0.05 : 0;
  const total = totalPrice - couponDiscount + shipping;
  const pixTotal = total * 0.9;

  // Suggested products (not in cart)
  const cartIds = items.map((i) => i.product.id);
  const suggestions = products
    .filter((p) => !cartIds.includes(p.id) && p.inStock)
    .slice(0, 4);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">
            Seu carrinho está vazio
          </h1>
          <p className="text-muted-foreground mb-6">
            Que tal explorar nossos produtos?
          </p>
          <Link to="/">
            <Button size="lg" className="gap-2">
              Ver Produtos <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          {suggestions.length > 0 && (
            <section className="mt-16 text-left">
              <h2 className="font-display text-xl font-bold text-foreground mb-6">
                Produtos em Destaque
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {suggestions.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            Carrinho ({items.reduce((s, i) => s + i.quantity, 0)})
          </h1>
          <Link
            to="/"
            className="text-sm text-primary hover:underline font-medium"
          >
            Continuar comprando
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {/* Header row - desktop */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="col-span-6">Produto</span>
              <span className="col-span-2 text-center">Qtd</span>
              <span className="col-span-3 text-right">Subtotal</span>
              <span className="col-span-1" />
            </div>

            {items.map(({ product, quantity }) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="md:grid md:grid-cols-12 md:gap-4 md:items-center flex gap-4 p-4 border rounded-xl bg-card"
              >
                {/* Product info */}
                <div className="md:col-span-6 flex gap-4 items-center min-w-0">
                  <Link to={`/produto/${product.id}`} className="shrink-0">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link to={`/produto/${product.id}`}>
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      {product.material}
                    </p>
                    <p className="text-sm font-bold text-foreground mt-1 md:hidden">
                      R$ {product.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>

                {/* Quantity */}
                <div className="md:col-span-2 flex md:justify-center">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        updateQuantity(product.id, quantity - 1)
                      }
                      className="p-2 hover:bg-muted transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-4 text-sm font-bold border-x min-w-[2.5rem] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(product.id, quantity + 1)
                      }
                      className="p-2 hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Subtotal */}
                <div className="md:col-span-3 hidden md:block text-right">
                  <span className="text-sm font-bold text-foreground">
                    R${" "}
                    {(product.price * quantity)
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                  <span className="text-xs text-pix block">
                    R${" "}
                    {(product.price * quantity * 0.9)
                      .toFixed(2)
                      .replace(".", ",")}{" "}
                    no PIX
                  </span>
                </div>

                {/* Remove */}
                <div className="md:col-span-1 flex md:justify-end">
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="border rounded-xl p-6 bg-card sticky top-24 space-y-5">
              <h2 className="font-display text-lg font-bold">
                Resumo do Pedido
              </h2>

              {/* Coupon */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Cupom de desconto
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Código"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className="h-9 text-sm"
                    disabled={couponApplied}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => {
                      if (coupon.trim()) setCouponApplied(true);
                    }}
                    disabled={couponApplied || !coupon.trim()}
                  >
                    {couponApplied ? "Aplicado ✓" : "Aplicar"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">
                    R$ {totalPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                {couponApplied && (
                  <div className="flex justify-between text-pix">
                    <span>Cupom (5%)</span>
                    <span>
                      -R$ {couponDiscount.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span
                    className={
                      shipping === 0
                        ? "text-pix font-medium"
                        : "text-foreground"
                    }
                  >
                    {shipping === 0
                      ? "Grátis ✓"
                      : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
                {shipping > 0 && (
                  <div className="bg-primary/5 rounded-lg p-2.5 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-primary">
                      Faltam R${" "}
                      {(99 - totalPrice).toFixed(2).replace(".", ",")} para
                      frete grátis!
                    </p>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex justify-between text-pix font-semibold text-sm mt-1">
                    <span>No PIX</span>
                    <span>R$ {pixTotal.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </div>

              <Link to="/checkout">
                <Button className="w-full gap-2 h-12 text-base" size="lg">
                  Finalizar Compra <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* Trust */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>Compra 100% segura</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  <span>Entrega para todo o Brasil</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-xl font-bold text-foreground mb-6">
              Aproveite e leve também
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {suggestions.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default Cart;
