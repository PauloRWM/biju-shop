import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const Cart = () => {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();
  const shipping = totalPrice >= 99 ? 0 : 14.90;
  const total = totalPrice + shipping;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
          <p className="text-muted-foreground mb-6">Que tal explorar nossos produtos?</p>
          <Link to="/">
            <Button size="lg">Ver Produtos</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold mb-8">Carrinho</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map(({ product, quantity }) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-4 p-4 border rounded-lg bg-card"
              >
                <Link to={`/produto/${product.id}`} className="shrink-0">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-md object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/produto/${product.id}`}>
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{product.material}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border rounded-md">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="p-1.5 hover:bg-muted transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-3 text-sm font-medium border-x">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="p-1.5 hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">
                        R$ {(product.price * quantity).toFixed(2).replace(".", ",")}
                      </span>
                      <button
                        onClick={() => removeItem(product.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg p-6 bg-card sticky top-24">
              <h2 className="font-display text-lg font-bold mb-4">Resumo</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span className={shipping === 0 ? "text-primary font-medium" : "text-foreground"}>
                    {shipping === 0 ? "Grátis" : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-primary">
                    Faltam R$ {(99 - totalPrice).toFixed(2).replace(".", ",")} para frete grátis!
                  </p>
                )}
                <div className="border-t pt-3 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
              <Link to="/checkout">
                <Button className="w-full mt-6 gap-2" size="lg">
                  Finalizar Compra <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" className="w-full mt-2" size="sm">
                  Continuar Comprando
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Cart;
