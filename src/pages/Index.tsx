import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useProducts, useCategories } from "@/hooks/useProducts";
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

  const { data: productsPage, isLoading: loadingProducts } = useProducts({
    category: activeCategory !== "Todos" ? activeCategory : undefined,
    search: queryParam || undefined,
    per_page: 40,
  });

  const { data: apiCategories } = useCategories();

  const allCategories = ["Todos", ...(apiCategories?.map((c) => c.name) ?? [])];
  const filtered = productsPage?.products ?? [];

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
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
                  
                  <div className="container absolute inset-0 left-1/2 -translate-x-1/2 flex items-center px-4 md:px-8">
                    <AnimatePresence mode="wait">
                      {selectedIndex === index && (
                        <div className="max-w-xl">
                          <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="bg-background/10 backdrop-blur-md p-6 md:p-10 rounded-2xl border border-white/10 shadow-2xl"
                          >
                            <span className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-primary mb-3 block">
                              {banner.title}
                            </span>
                            <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-4 drop-shadow-sm">
                              {banner.subtitle}
                            </h2>
                            <p className="text-white/90 text-sm md:text-lg mb-8 max-w-md leading-relaxed">
                              {banner.description}
                            </p>
                            <div className="flex flex-wrap gap-4">
                              <Button size="lg" className="h-12 px-8 rounded-full shadow-lg hover:shadow-primary/30 transition-all duration-300">
                                {banner.cta} <ArrowRight className="ml-2 h-5 w-5" />
                              </Button>
                              <Button variant="outline" size="lg" className="h-12 px-8 rounded-full border-white/20 text-white bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
                                Saiba Mais
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
      <section className="container mx-auto px-4 py-12 min-h-[400px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {queryParam ? `Resultados para: "${queryParam}"` : "Nossos Produtos"}
            </h2>
            {queryParam && (
              <p className="text-sm text-muted-foreground mt-1">
                Mostrando resultados em {activeCategory}
              </p>
            )}
          </div>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit">
            {productsPage?.total ?? filtered.length} {(productsPage?.total ?? filtered.length) === 1 ? "produto" : "produtos"}
          </span>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {allCategories.map((cat) => (
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
        {loadingProducts ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {!loadingProducts && filtered.length === 0 && (
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
