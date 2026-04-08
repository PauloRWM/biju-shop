import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useProducts, useCategories } from "@/hooks/useProducts";
import { products as fallbackProducts, categories as fallbackCategories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Shield, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const banners = [
  {
    image: "/banner-1.png",
    title: "Coleção de Luxo",
    subtitle: "A elegância que você merece",
    description: "Peças exclusivas banhadas a ouro com acabamento premium e garantia de qualidade.",
    cta: "Explorar Coleção",
  },
  {
    image: "/banner-2.png",
    title: "Design Atemporal",
    subtitle: "Brilhe em cada detalhe",
    description: "Nossos brincos e acessórios são desenhados para realçar sua beleza natural em qualquer ocasião.",
    cta: "Ver Detalhes",
  },
  {
    image: "/banner-3.png",
    title: "Presentes Inesquecíveis",
    subtitle: "Momentos que marcam",
    description: "Encontre o presente perfeito em nossos conjuntos exclusivos de anéis e pulseiras.",
    cta: "Comprar Agora",
  },
];

const Index = () => {
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get("cat");
  const queryParam = searchParams.get("q")?.toLowerCase() || "";
  const [activeCategory, setActiveCategory] = useState(catParam || "Todos");
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, skipSnaps: false },
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const { data: productsPage, isLoading: loadingProducts, isError } = useProducts({
    category: activeCategory !== "Todos" ? activeCategory : undefined,
    search: queryParam || undefined,
    per_page: 40,
  });

  const { data: apiCategories } = useCategories();

  // Fallback para dados locais quando a API não está disponível
  const apiOk = !isError && (loadingProducts || !!productsPage);
  const allCategories = apiOk && apiCategories?.length
    ? ["Todos", ...apiCategories.map((c) => c.name)]
    : fallbackCategories;

  const filtered = apiOk
    ? (productsPage?.products ?? [])
    : fallbackProducts.filter((p) => {
        const matchesCat = activeCategory === "Todos" || p.category === activeCategory;
        const matchesQ = !queryParam ||
          p.name.toLowerCase().includes(queryParam) ||
          p.description.toLowerCase().includes(queryParam);
        return matchesCat && matchesQ;
      });

  const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
  const scrollNext = () => emblaApi && emblaApi.scrollNext();
  const scrollTo = (index: number) => emblaApi && emblaApi.scrollTo(index);

  return (
    <Layout>
      {/* Banner Carousel */}
      <section className="relative bg-muted/30">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {banners.map((banner, index) => (
              <div key={index} className="flex-[0_0_100%] min-w-0">
                <div className="relative h-[65vh] md:h-[550px] min-h-[400px]">
                  <img
                    src={banner.image}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
                  {/* Vinheta bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />

                  <div className="container absolute inset-0 left-1/2 -translate-x-1/2 flex items-center px-4 md:px-8">
                    <AnimatePresence mode="wait">
                      {selectedIndex === index && (
                        <div className="max-w-2xl">
                          <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <motion.span
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1, duration: 0.4 }}
                              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white/70 mb-4"
                            >
                              <span className="w-8 h-px bg-white/50" />
                              {banner.title}
                            </motion.span>
                            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[1.0] mb-5 drop-shadow-sm text-balance">
                              {banner.subtitle}
                            </h2>
                            <p className="text-white/80 text-sm md:text-base mb-8 max-w-sm leading-relaxed">
                              {banner.description}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                size="lg"
                                className="h-12 px-8 rounded-full gradient-brand border-0 text-white shadow-soft hover:opacity-90 transition-all duration-300"
                              >
                                {banner.cta} <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="lg"
                                className="h-12 px-8 rounded-full border-white/25 text-white bg-white/8 backdrop-blur-sm hover:bg-white/15 transition-all duration-300"
                              >
                                Ver Coleção
                              </Button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation arrows */}
        <div className="hidden md:block">
          <button
            onClick={scrollPrev}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-all duration-300 z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 flex items-center justify-center transition-all duration-300 z-10"
            aria-label="Próximo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
        
        {/* Dots */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`h-1.5 transition-all duration-500 rounded-full ${
                selectedIndex === index ? "w-10 bg-primary" : "w-3 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-border/50 bg-card/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-3 gap-2 md:gap-6">
            {[
              { icon: Truck, title: "Frete Grátis", sub: "Acima de R$ 99" },
              { icon: Shield, title: "6 Meses de Garantia", sub: "Contra defeitos" },
              { icon: RotateCcw, title: "Troca Grátis", sub: "Em até 30 dias" },
            ].map((item) => (
              <div key={item.title} className="flex flex-col md:flex-row items-center gap-3 justify-center text-center md:text-left">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground hidden md:block">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground hidden md:block">{item.sub}</p>
                  <p className="text-[10px] md:hidden text-muted-foreground font-medium leading-tight">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 py-16 min-h-[400px]">
        {/* Header da seção */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2">
              {activeCategory === "Todos" ? "Coleção Completa" : activeCategory}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-black text-foreground text-balance leading-none">
              {queryParam ? `"${queryParam}"` : "Nossas Peças"}
            </h2>
          </div>
          <span className="text-sm text-muted-foreground bg-secondary px-4 py-1.5 rounded-full w-fit shrink-0">
            {productsPage?.total ?? filtered.length}{" "}
            {(productsPage?.total ?? filtered.length) === 1 ? "produto" : "produtos"}
          </span>
        </div>

        {/* Category filter — pill style */}
        <div className="flex gap-2 mb-10 overflow-x-auto pb-1 scrollbar-none">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 shrink-0 ${
                activeCategory === cat
                  ? "gradient-brand text-white shadow-card"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Bento Grid */}
        {loadingProducts ? (
          <LoadingSpinner />
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 auto-rows-auto">
            {filtered.map((product, i) => {
              // Primeiro produto ganha slot 2x2 (bento destaque)
              const isFeatured = i === 0 && !queryParam;
              return (
                <div
                  key={product.id}
                  className={isFeatured ? "col-span-2 row-span-2" : ""}
                >
                  <ProductCard product={product} index={i} featured={isFeatured} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Nenhum produto encontrado.</p>
          </div>
        )}
      </section>

      {/* CTA Newsletter — fundo gradiente */}
      <section className="relative overflow-hidden">
        <div className="gradient-brand">
          <div className="container mx-auto px-4 py-16 text-center relative z-10">
            <p className="text-white/70 text-xs font-bold uppercase tracking-[0.2em] mb-3">
              Exclusividade
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-black text-white mb-3 text-balance">
              Receba novidades em primeira mão
            </h2>
            <p className="text-white/80 mb-8 max-w-md mx-auto leading-relaxed">
              Cadastre-se e ganhe <strong className="text-white">10% de desconto</strong> na primeira compra.
            </p>
            <form className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                placeholder="Seu e-mail"
                className="flex-1 h-12 rounded-xl border-0 bg-white/15 backdrop-blur-sm px-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <button
                type="submit"
                className="h-12 px-6 rounded-xl bg-white text-primary font-bold text-sm shrink-0 hover:bg-white/90 transition-colors"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
