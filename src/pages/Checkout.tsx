import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  CreditCard,
  Check,
  Lock,
  Truck,
  Shield,
  QrCode,
  Barcode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PaymentMethod = "credit" | "pix" | "boleto";

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "success">("form");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const shipping = totalPrice >= 99 ? 0 : 14.9;

  const discount = paymentMethod === "pix" ? totalPrice * 0.1 : 0;
  const total = totalPrice - discount + shipping;

  if (items.length === 0 && step !== "success") {
    navigate("/carrinho");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("success");
    clearCart();
  };

  const paymentMethods: {
    id: PaymentMethod;
    label: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    {
      id: "pix",
      label: "PIX",
      icon: QrCode,
      desc: "10% de desconto • Aprovação instantânea",
    },
    {
      id: "credit",
      label: "Cartão de Crédito",
      icon: CreditCard,
      desc: "Até 3x sem juros",
    },
    {
      id: "boleto",
      label: "Boleto Bancário",
      icon: Barcode,
      desc: "Vencimento em 3 dias úteis",
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <Link
                  to="/carrinho"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold">
                    Checkout
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Preencha seus dados para finalizar a compra
                  </p>
                </div>
              </div>

              {/* Progress steps */}
              <div className="flex items-center gap-2 mb-8">
                {["Dados", "Endereço", "Pagamento"].map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground hidden sm:inline">
                      {label}
                    </span>
                    {i < 2 && (
                      <div className="w-8 md:w-16 h-px bg-border" />
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid md:grid-cols-5 gap-8"
              >
                <div className="md:col-span-3 space-y-8">
                  {/* Contact */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        1
                      </span>
                      Dados de Contato
                    </h2>
                    <Input placeholder="Nome completo" required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input type="email" placeholder="E-mail" required />
                      <Input type="tel" placeholder="Telefone (WhatsApp)" required />
                    </div>
                    <Input placeholder="CPF" required />
                  </section>

                  {/* Address */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        2
                      </span>
                      Endereço de Entrega
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                      <Input placeholder="CEP" required />
                      <div className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <Input
                        placeholder="Rua"
                        className="col-span-3"
                        required
                      />
                      <Input placeholder="Nº" required />
                    </div>
                    <Input placeholder="Complemento (opcional)" />
                    <div className="grid grid-cols-3 gap-3">
                      <Input placeholder="Bairro" required />
                      <Input placeholder="Cidade" required />
                      <Input placeholder="UF" required />
                    </div>
                  </section>

                  {/* Payment */}
                  <section className="border rounded-xl p-5 bg-card space-y-4">
                    <h2 className="font-display text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        3
                      </span>
                      Forma de Pagamento
                    </h2>

                    <div className="grid gap-3">
                      {paymentMethods.map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                            paymentMethod === pm.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              paymentMethod === pm.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <pm.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-foreground block">
                              {pm.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {pm.desc}
                            </span>
                          </div>
                          {paymentMethod === pm.id && (
                            <Check className="h-5 w-5 text-primary ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Credit card fields */}
                    <AnimatePresence>
                      {paymentMethod === "credit" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          <Input placeholder="Número do cartão" required />
                          <div className="grid grid-cols-2 gap-3">
                            <Input placeholder="MM/AA" required />
                            <Input placeholder="CVV" required />
                          </div>
                          <Input placeholder="Nome impresso no cartão" required />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {paymentMethod === "pix" && (
                      <div className="bg-pix/5 border border-pix/20 rounded-lg p-4 text-center">
                        <QrCode className="h-8 w-8 text-pix mx-auto mb-2" />
                        <p className="text-sm text-pix font-semibold">
                          10% de desconto no PIX!
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O QR Code será gerado após confirmar o pedido
                        </p>
                      </div>
                    )}
                  </section>
                </div>

                {/* Order summary */}
                <div className="md:col-span-2">
                  <div className="border rounded-xl p-6 bg-card sticky top-24 space-y-4">
                    <h2 className="font-display text-lg font-bold">
                      Seu Pedido
                    </h2>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {items.map(({ product, quantity }) => (
                        <div key={product.id} className="flex gap-3">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-14 h-14 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                              {product.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Qtd: {quantity}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-foreground whitespace-nowrap self-start">
                            R${" "}
                            {(product.price * quantity)
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>
                          R$ {totalPrice.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-pix">
                          <span>Desconto PIX (10%)</span>
                          <span>
                            -R$ {discount.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frete</span>
                        <span>
                          {shipping === 0
                            ? "Grátis ✓"
                            : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
                        </span>
                      </div>
                      <div className="border-t pt-3 flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-12 text-base gap-2" size="lg">
                      <Lock className="h-4 w-4" />
                      Confirmar Pedido
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Pagamento 100% seguro</span>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24 max-w-lg mx-auto"
            >
              <div className="w-20 h-20 rounded-full bg-pix/10 flex items-center justify-center mx-auto mb-6">
                <Check className="h-10 w-10 text-pix" />
              </div>
              <h1 className="font-display text-3xl font-bold mb-3">
                Pedido Confirmado! 🎉
              </h1>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                Obrigado pela sua compra! Enviamos os detalhes para seu e-mail.
              </p>
              <div className="bg-secondary/50 rounded-xl p-4 mb-8 inline-block">
                <p className="text-xs text-muted-foreground">
                  Número do pedido
                </p>
                <p className="text-lg font-bold font-mono text-foreground">
                  #LUM-{Math.floor(Math.random() * 90000 + 10000)}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Link to="/">
                  <Button size="lg">Voltar à Loja</Button>
                </Link>
                <Link to="/conta">
                  <Button size="lg" variant="outline">
                    Meus Pedidos
                  </Button>
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
