import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, CreditCard, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "success">("form");
  const shipping = totalPrice >= 99 ? 0 : 14.90;
  const total = totalPrice + shipping;

  if (items.length === 0 && step !== "success") {
    navigate("/carrinho");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("success");
    clearCart();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-8">
                <Link to="/carrinho" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <h1 className="font-display text-2xl md:text-3xl font-bold">Checkout</h1>
              </div>

              <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-8">
                <div className="md:col-span-3 space-y-6">
                  {/* Contact */}
                  <section className="space-y-4">
                    <h2 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Dados de Contato
                    </h2>
                    <Input placeholder="Nome completo" required />
                    <Input type="email" placeholder="E-mail" required />
                    <Input type="tel" placeholder="Telefone" required />
                  </section>

                  {/* Address */}
                  <section className="space-y-4">
                    <h2 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Endereço de Entrega
                    </h2>
                    <Input placeholder="CEP" required />
                    <div className="grid grid-cols-3 gap-3">
                      <Input placeholder="Rua" className="col-span-2" required />
                      <Input placeholder="Nº" required />
                    </div>
                    <Input placeholder="Complemento" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Cidade" required />
                      <Input placeholder="Estado" required />
                    </div>
                  </section>

                  {/* Payment */}
                  <section className="space-y-4">
                    <h2 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Pagamento
                    </h2>
                    <div className="border rounded-lg p-4 bg-card">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">Cartão de Crédito</span>
                      </div>
                      <div className="space-y-3">
                        <Input placeholder="Número do cartão" required />
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="MM/AA" required />
                          <Input placeholder="CVV" required />
                        </div>
                        <Input placeholder="Nome no cartão" required />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Order summary */}
                <div className="md:col-span-2">
                  <div className="border rounded-lg p-6 bg-card sticky top-24">
                    <h2 className="font-display text-lg font-bold mb-4">Seu Pedido</h2>
                    <div className="space-y-3 mb-4">
                      {items.map(({ product, quantity }) => (
                        <div key={product.id} className="flex gap-3">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground line-clamp-1">{product.name}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {quantity}</p>
                          </div>
                          <span className="text-xs font-medium text-foreground whitespace-nowrap">
                            R$ {(product.price * quantity).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frete</span>
                        <span>{shipping === 0 ? "Grátis" : `R$ ${shipping.toFixed(2).replace(".", ",")}`}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold text-base">
                        <span>Total</span>
                        <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>
                    <Button type="submit" className="w-full mt-6" size="lg">
                      Confirmar Pedido
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h1 className="font-display text-3xl font-bold mb-3">Pedido Confirmado!</h1>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                Obrigado pela sua compra! Enviamos os detalhes para seu e-mail.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                Pedido #LUM-{Math.floor(Math.random() * 90000 + 10000)}
              </p>
              <div className="flex gap-3 justify-center">
                <Link to="/">
                  <Button size="lg">Voltar à Loja</Button>
                </Link>
                <Link to="/conta">
                  <Button size="lg" variant="outline">Meus Pedidos</Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default Checkout;
