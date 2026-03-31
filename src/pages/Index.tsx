import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/ProductCard";
import { products, categories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Shield, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get("cat");
  const [activeCategory, setActiveCategory] = useState(catParam || "Todos");

  const filtered =
    activeCategory === "Todos"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">
                Nova Coleção 2026
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-4">
                Brilhe com{" "}
                <span className="text-primary">elegância</span>{" "}
                e estilo
              </h1>
              <p className="text-muted-foreground text-lg mb-6 max-w-md">
                Descubra bijuterias artesanais que transformam qualquer look. 
                Peças únicas feitas com amor e atenção aos detalhes.
              </p>
              <div className="flex gap-3">
                <Button size="lg" className="gap-2">
                  Ver Coleção <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline">
                  Promoções
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1515562141589-67f0d569b6fc?w=800&h=1000&fit=crop"
                  alt="Coleção de bijuterias Luminária"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-card rounded-xl shadow-lg p-4 border">
                <p className="text-xs text-muted-foreground">Frete grátis</p>
                <p className="font-display font-bold text-foreground">Acima de R$ 99</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Truck, text: "Frete grátis acima de R$ 99" },
              { icon: Shield, text: "Garantia de 6 meses" },
              { icon: RotateCcw, text: "Troca em até 30 dias" },
            ].map((item) => (
              <div key={item.text} className="flex flex-col md:flex-row items-center gap-2 justify-center">
                <item.icon className="h-5 w-5 text-primary" />
                <span className="text-xs md:text-sm text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Nossos Produtos
          </h2>
          <span className="text-sm text-muted-foreground">{filtered.length} produtos</span>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="whitespace-nowrap"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum produto encontrado nesta categoria.</p>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
            Receba novidades em primeira mão
          </h2>
          <p className="text-primary-foreground/80 mb-6 max-w-md mx-auto">
            Cadastre-se e ganhe 10% de desconto na primeira compra.
          </p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email"
              placeholder="Seu e-mail"
              className="flex-1 h-10 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
            />
            <Button variant="secondary" size="default">
              Cadastrar
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
