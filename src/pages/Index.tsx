import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/ProductCard";
import { products, categories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Shield, RotateCcw, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const banners = [
  {
    gradient: "from-[#1a1a1a] via-[#2d2520] to-[#3d2e1f]",
    accentColor: "text-[hsl(38,70%,55%)]",
    tag: "Nova Coleção",
    title: "Elegância\nAtemporal",
    description: "Peças exclusivas banhadas a ouro 18k com acabamento artesanal e garantia de qualidade.",
    cta: "Explorar Coleção",
  },
  {
    gradient: "from-[#2a1a2a] via-[#1f1525] to-[#1a1020]",
    accentColor: "text-[hsl(340,45%,65%)]",
    tag: "Destaque",
    title: "Brilhe em\nCada Detalhe",
    description: "Brincos e acessórios desenhados para realçar sua beleza natural em qualquer ocasião.",
    cta: "Ver Coleção",
  },
  {
    gradient: "from-[#1a2520] via-[#152520] to-[#0f1f1a]",
    accentColor: "text-[hsl(145,50%,55%)]",
    tag: "Presente Perfeito",
    title: "Momentos\nque Marcam",
    description: "Conjuntos exclusivos pensados para quem você ama. Embalagem especial inclusa.",
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

  useEffect(() => {
    if (catParam) setActiveCategory(catParam);
  }, [catParam]);

  const filtered = products.filter((p) => {
    const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
    const matchesQuery =
      !queryParam ||
      p.name.toLowerCase().includes(queryParam) ||
      p.description.toLowerCase().includes(queryParam) ||
      p.category.toLowerCase().includes(queryParam);
    return matchesCategory && matchesQuery;
  });

  const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
  const scrollNext = () => emblaApi && emblaApi.scrollNext();
  const scrollTo = (index: number) => emblaApi && emblaApi.scrollTo(index);

  return (
    <Layout>
      {/* Banner Carousel */}
      <section className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {banners.map((banner, index) => (
              <div key={index} className="flex-[0_0_100%] min-w-0">
                <div className={`relative h-[70vh] md:h-[600px] min-h-[480px] bg-gradient-to-br ${banner.gradient} flex items-center overflow-hidden`}>
                  {/* Decorative elements */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                  <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-3xl" />
                  <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-white/[0.02] blur-3xl" />

                  <div className="container mx-auto px-6 md:px-12 relative z-10">
                    <AnimatePresence mode="wait">
                      {selectedIndex === index && (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5 }}
                          className="max-w-2xl"
                        >
                          {/* Tag */}
                          <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="flex items-center gap-2 mb-6"
                          >
                            <Sparkles className={`h-3.5 w-3.5 ${banner.accentColor}`} />
                            <span className={`text-xs font-sans font-medium uppercase tracking-[0.25em] ${banner.accentColor}`}>
                              {banner.tag}
                            </span>
                            <div className={`h-[1px] w-12 ${banner.accentColor} opacity-40`} style={{ background: 'currentColor' }} />
                          </motion.div>

                          {/* Title */}
                          <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="font-display text-[clamp(2.5rem,6vw,5rem)] font-extralight text-white leading-[1.05] mb-6 whitespace-pre-line"
                          >
                            {banner.title}
                          </motion.h2>

                          {/* Description */}
                          <motion.p
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35, duration: 0.5 }}
                            className="text-white/50 text-sm md:text-base font-sans leading-relaxed mb-10 max-w-md"
                          >
                            {banner.description}
                          </motion.p>

                          {/* CTAs */}
                          <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="flex flex-wrap items-center gap-6"
                          >
                            <Button
                              size="lg"
                              className="h-12 px-8 rounded-none bg-white text-foreground hover:bg-white/90 font-sans text-xs uppercase tracking-[0.15em] font-medium transition-all duration-300"
                            >
                              {banner.cta}
                              <ArrowRight className="ml-3 h-4 w-4" />
                            </Button>
                            <button className="text-white/40 hover:text-white/70 font-sans text-xs uppercase tracking-[0.15em] transition-colors duration-300 underline underline-offset-4 decoration-white/20 hover:decoration-white/40">
                              Saiba Mais
                            </button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Slide counter */}
                  <div className="absolute bottom-8 right-8 md:right-12 text-white/20 font-display text-sm tracking-widest">
                    <span className="text-white/60">{String(index + 1).padStart(2, "0")}</span>
                    <span className="mx-2">/</span>
                    <span>{String(banners.length).padStart(2, "0")}</span>
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
            className="absolute left-8 top-1/2 -translate-y-1/2 w-11 h-11 border border-white/15 text-white/40 hover:text-white hover:border-white/30 flex items-center justify-center transition-all duration-300 z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-8 top-1/2 -translate-y-1/2 w-11 h-11 border border-white/15 text-white/40 hover:text-white hover:border-white/30 flex items-center justify-center transition-all duration-300 z-10"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-10">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className="group relative h-6 flex items-center"
              aria-label={`Ir para slide ${index + 1}`}
            >
              <span className={`block h-[2px] transition-all duration-700 ${
                selectedIndex === index ? "w-12 bg-white" : "w-6 bg-white/20 group-hover:bg-white/40"
              }`} />
            </button>
          ))}
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b border-border/50">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Truck, text: "Frete grátis acima de R$ 99" },
              { icon: Shield, text: "Garantia de 6 meses" },
              { icon: RotateCcw, text: "Troca em até 30 dias" },
            ].map((item) => (
              <div key={item.text} className="flex flex-col md:flex-row items-center gap-2 justify-center">
                <item.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[11px] md:text-xs text-muted-foreground font-sans tracking-wide">
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 py-14 min-h-[400px]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-light tracking-wide text-foreground">
              {queryParam ? `Resultados para "${queryParam}"` : "Curadoria"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 font-sans">
              {queryParam
                ? `${filtered.length} ${filtered.length === 1 ? "item encontrado" : "itens encontrados"}`
                : "Peças selecionadas para você"}
            </p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-5 py-2 text-xs font-sans uppercase tracking-[0.12em] transition-all duration-300 border ${
                activeCategory === cat
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-sans text-sm">
              Nenhum produto encontrado.
            </p>
          </div>
        )}
      </section>

      {/* Newsletter CTA */}
      <section className="bg-foreground text-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-background/40 mb-4">Newsletter</p>
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-wide mb-3">
            Receba novidades em primeira mão
          </h2>
          <p className="text-background/50 mb-8 max-w-md mx-auto text-sm font-sans">
            Cadastre-se e ganhe 10% de desconto na sua primeira compra.
          </p>
          <div className="flex gap-0 max-w-sm mx-auto">
            <input
              type="email"
              placeholder="Seu melhor e-mail"
              className="flex-1 h-11 px-4 bg-background/10 border border-background/15 border-r-0 text-sm text-background placeholder:text-background/30 focus:outline-none focus:bg-background/15 font-sans transition-colors"
            />
            <button className="h-11 px-6 bg-background text-foreground text-xs font-sans uppercase tracking-[0.12em] font-medium hover:bg-background/90 transition-colors">
              Cadastrar
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
