import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import NewsletterForm from "@/components/NewsletterForm";
import { useProducts, useHomepageConfig, useCategories } from "@/hooks/useProducts";
import { products as fallbackProducts, categories as fallbackCategories } from "@/data/products";
import { ArrowRight, Truck, ChevronLeft, ChevronRight, Sparkles, Star, ShoppingCart, CreditCard as CreditCard2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

type Banner = {
  image?: string;
  alt?: string;
  gradient?: string;
  accentColor?: string;
  tag?: string;
  title?: string;
  description?: string;
  cta?: string;
};

const banners: Banner[] = [
  {
    image: "/banners/IMG_9425.webp",
    alt: "Wesley Bijoux — Banner 1",
  },
  {
    image: "/banners/IMG_9427.webp",
    alt: "Wesley Bijoux — Banner 2",
  },
  {
    image: "/banners/IMG_9429.webp",
    alt: "Wesley Bijoux — Banner 3",
  },
];

const fallbackCategoryCards = [
  { name: "Colares", image: "https://picsum.photos/seed/cat-colares/400/500", count: 12 },
  { name: "Brincos", image: "https://picsum.photos/seed/cat-brincos/400/500", count: 18 },
  { name: "Pulseiras", image: "https://picsum.photos/seed/cat-pulseiras/400/500", count: 9 },
  { name: "Anéis", image: "https://picsum.photos/seed/cat-aneis/400/500", count: 14 },
  { name: "Conjuntos", image: "https://picsum.photos/seed/cat-conjuntos/400/500", count: 7 },
];

const testimonials = [
  { name: "Ana Paula", text: "Qualidade incrível! As peças parecem joias de verdade. Já comprei 3 vezes.", rating: 5 },
  { name: "Mariana S.", text: "Entrega rápida e embalagem linda. Perfeito para presente!", rating: 5 },
  { name: "Juliana C.", text: "O acabamento é impecável. Uso todos os dias e não escurece.", rating: 5 },
];

const Index = () => {
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

  const { data: homepageConfig } = useHomepageConfig();
  const { data: allCategories } = useCategories();

  // Todas as categorias com produtos ativos (exclui meta-categorias)
  const catArray = Array.isArray(allCategories) ? allCategories : [];
  const sections = catArray.length > 0
    ? catArray.filter(cat => cat.count > 0 && cat.slug !== 'todos-produtos' && cat.slug !== 'uncategorized')
    : (homepageConfig?.sections?.length ? homepageConfig.sections : fallbackCategoryCards);

  const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
  const scrollNext = () => emblaApi && emblaApi.scrollNext();
  const scrollTo = (index: number) => emblaApi && emblaApi.scrollTo(index);

  return (
    <Layout>
      {/* ─── Banner Carousel ─── */}
      <section className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {banners.map((banner, index) => (
              <div key={index} className="flex-[0_0_100%] min-w-0">
                {banner.image ? (
                  <div className="relative w-full bg-[#faf7f2] overflow-hidden aspect-[4/3] sm:aspect-[16/9] md:aspect-[1774/642]">
                    <img
                      src={banner.image}
                      alt={banner.alt ?? ""}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={index === 0 ? "high" : "low"}
                      onError={(e) => {
                        // se imagem falhar, oculta sem quebrar o layout
                        (e.currentTarget as HTMLImageElement).style.opacity = "0";
                      }}
                    />
                    <div className="absolute bottom-8 right-8 md:right-12 text-foreground/30 font-display text-sm tracking-widest">
                      <span className="text-foreground/70">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mx-2">/</span>
                      <span>{String(banners.length).padStart(2, "0")}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`relative h-[70vh] md:h-[600px] min-h-[480px] bg-gradient-to-br ${banner.gradient} flex items-center overflow-hidden`}>
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                    <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-3xl" />

                    <div className="container mx-auto px-6 md:px-12 relative z-10">
                      <AnimatePresence mode="wait">
                        {selectedIndex === index && (
                          <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl">
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="flex items-center gap-2 mb-6">
                              <Sparkles className={`h-3.5 w-3.5 ${banner.accentColor}`} />
                              <span className={`text-xs font-sans font-medium uppercase tracking-[0.25em] ${banner.accentColor}`}>{banner.tag}</span>
                              <div className={`h-[1px] w-12 opacity-40 ${banner.accentColor}`} style={{ background: 'currentColor' }} />
                            </motion.div>
                            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="font-display text-[clamp(2.5rem,6vw,5rem)] font-extralight text-white leading-[1.05] mb-6 whitespace-pre-line">
                              {banner.title}
                            </motion.h2>
                            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="text-white/50 text-sm md:text-base font-sans leading-relaxed mb-10 max-w-md">
                              {banner.description}
                            </motion.p>
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }} className="flex flex-wrap items-center gap-6">
                              <Link to="/shop">
                                <Button size="lg" className="h-12 px-8 rounded-none bg-white text-foreground hover:bg-white/90 font-sans text-xs uppercase tracking-[0.15em] font-medium">
                                  {banner.cta} <ArrowRight className="ml-3 h-4 w-4" />
                                </Button>
                              </Link>
                              <button className="text-white/40 hover:text-white/70 font-sans text-xs uppercase tracking-[0.15em] underline underline-offset-4 decoration-white/20 hover:decoration-white/40 transition-colors">
                                Saiba Mais
                              </button>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="absolute bottom-8 right-8 md:right-12 text-white/20 font-display text-sm tracking-widest">
                      <span className="text-white/60">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mx-2">/</span>
                      <span>{String(banners.length).padStart(2, "0")}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:block">
          <button onClick={scrollPrev} className="absolute left-8 top-1/2 -translate-y-1/2 w-11 h-11 border border-white/15 text-white/40 hover:text-white hover:border-white/30 flex items-center justify-center transition-all z-10" aria-label="Anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={scrollNext} className="absolute right-8 top-1/2 -translate-y-1/2 w-11 h-11 border border-white/15 text-white/40 hover:text-white hover:border-white/30 flex items-center justify-center transition-all z-10" aria-label="Próximo">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-10">
          {banners.map((_, i) => (
            <button key={i} onClick={() => scrollTo(i)} className="group relative h-6 flex items-center" aria-label={`Slide ${i + 1}`}>
              <span className={`block h-[2px] transition-all duration-700 ${selectedIndex === i ? "w-12 bg-white" : "w-6 bg-white/20 group-hover:bg-white/40"}`} />
            </button>
          ))}
        </div>
      </section>

      {/* ─── Trust badges ─── */}
      <section className="bg-[hsl(38,60%,95%)]">
        <div className="container mx-auto px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
            {[
              { icon: ShoppingCart, title: "ATACADO", sub: "Compre no atacado com o melhor preço" },
              { icon: Truck, title: "EM TODO BRASIL", sub: "Receba seu produto onde estiver ou retire em nossa loja" },
              { icon: CreditCard2, title: "PIX E CARTÃO", sub: "Pague suas compras no PIX ou no Cartão" },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-background" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground mb-0.5">{item.title}</p>
                  <p className="text-[13px] text-muted-foreground leading-snug max-w-[220px]">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Shop by Category ─── */}
      <CategoriesCarousel sections={sections} />

      {/* ─── Seções de Produtos por Categoria ─── */}
      {(homepageConfig?.sections ?? fallbackCategoryCards).map((section, idx) => (
        <CategorySection key={section.slug || section.name} section={section} index={idx} />
      ))}

      {/* ─── Testimonials ─── */}
      <section className="border-t border-border/50">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <p className="text-[11px] font-sans uppercase tracking-[0.2em] text-muted-foreground mb-2">Depoimentos</p>
            <h2 className="font-display text-2xl md:text-3xl font-light tracking-wide text-foreground">O que dizem nossas clientes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="text-center px-4"
              >
                <div className="flex items-center justify-center gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-gold text-gold" />
                  ))}
                </div>
                <p className="text-sm font-sans text-foreground/80 leading-relaxed mb-4 italic">
                  "{t.text}"
                </p>
                <p className="text-xs font-sans uppercase tracking-[0.12em] text-muted-foreground">{t.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ─── Newsletter CTA ─── */}
      <section className="bg-foreground text-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-background/40 mb-4">Newsletter</p>
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-wide mb-3">
            Receba novidades em primeira mão
          </h2>
          <p className="text-background/50 mb-8 max-w-md mx-auto text-sm font-sans">
            Cadastre seu WhatsApp e fique por dentro de lançamentos, promoções e novidades exclusivas.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </Layout>
  );
};

// Carrossel de categorias com drag
const CategoriesCarousel = ({ sections }: { sections: { name: string; slug?: string; count: number; image?: string | null }[] }) => {
  const [catRef, catApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    dragFree: true,
    slidesToScroll: 3,
  }, [Autoplay({ delay: 3000, stopOnInteraction: true })]);

  return (
    <section className="py-14">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-[11px] font-sans uppercase tracking-[0.2em] text-muted-foreground mb-2">Explore</p>
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-wide text-foreground">Compre por Categoria</h2>
        </div>

        <div className="relative">
          <div className="overflow-hidden" ref={catRef}>
            <div className="flex gap-6">
              {sections.map((cat) => (
                <CategoryCircle key={cat.slug || cat.name} cat={cat} />
              ))}
            </div>
          </div>

          {/* Setas */}
          <button
            onClick={() => catApi?.scrollPrev()}
            className="absolute -left-2 top-[50px] md:top-[60px] -translate-y-1/2 w-9 h-9 rounded-full bg-background border border-border/50 shadow-md flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/30 transition-all z-10 hidden md:flex"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => catApi?.scrollNext()}
            className="absolute -right-2 top-[50px] md:top-[60px] -translate-y-1/2 w-9 h-9 rounded-full bg-background border border-border/50 shadow-md flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/30 transition-all z-10 hidden md:flex"
            aria-label="Proximo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

// Círculo da categoria — usa a imagem do produto mais vendido que TENHA foto real.
// Pega 10 produtos por popularidade e escolhe o primeiro com has_image=true,
// pulando os que caíram no placeholder do WooCommerce.
const CategoryCircle = ({ cat }: { cat: { name: string; slug?: string; count: number; image?: string | null } }) => {
  const { data: topProductPage, isLoading } = useProducts({
    category: cat.slug || cat.name,
    per_page: 10,
    orderby: "popularity",
  });
  const firstWithImage = topProductPage?.products?.find((p) => p.has_image);
  const topImage = firstWithImage?.images_thumb?.[0] ?? firstWithImage?.images?.[0];
  // Só usa cat.image se não for um placeholder de texto.
  const imgSrc = topImage || cat.image || "";
  const [imgError, setImgError] = useState(false);
  const showImage = !!imgSrc && !imgError && !isLoading;

  return (
    <Link
      to={`/shop?cat=${encodeURIComponent(cat.name)}`}
      className="group flex flex-col items-center gap-2.5 flex-[0_0_100px] md:flex-[0_0_120px]"
    >
      <div className="relative w-[100px] h-[100px] md:w-[120px] md:h-[120px] rounded-full overflow-hidden bg-muted ring-2 ring-transparent group-hover:ring-foreground/20 transition-all duration-300 flex items-center justify-center">
        {showImage ? (
          <img
            src={imgSrc}
            alt={cat.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <Loader2 className="h-5 w-5 text-muted-foreground/40 animate-spin" />
        )}
      </div>
      <div className="text-center">
        <h3 className="font-sans text-xs md:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[110px]">
          {cat.name}
        </h3>
        <p className="text-[10px] text-muted-foreground">
          {cat.count} produtos
        </p>
      </div>
    </Link>
  );
};

// Componente para cada seção de categoria — carrossel 2 linhas com drag
const CategorySection = ({ section, index }: { section: typeof fallbackCategoryCards[0]; index: number }) => {
  const { data: productsPage, isLoading } = useProducts({
    category: section.slug || section.name,
    per_page: 12,
  });

  const [catEmblaRef, catEmblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    slidesToScroll: 2,
    dragFree: true,
  });

  const products = productsPage?.products ?? [];

  if (!isLoading && products.length === 0) return null;

  const bgClass = index % 2 === 0 ? "bg-muted/20" : "bg-background";

  return (
    <section className={bgClass}>
      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-light tracking-wide text-foreground">
              {section.name}
            </h2>
            <p className="text-xs font-sans text-muted-foreground mt-0.5">
              {section.count || products.length} produtos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5">
              <button
                onClick={() => catEmblaApi?.scrollPrev()}
                className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/40 transition-all"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => catEmblaApi?.scrollNext()}
                className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/40 transition-all"
                aria-label="Proximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Link
              to={`/shop?cat=${encodeURIComponent(section.name)}`}
              className="text-xs font-sans font-semibold uppercase tracking-[0.1em] text-foreground/70 hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Carrossel 1 linha */}
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-hidden" ref={catEmblaRef}>
            <div className="flex gap-3 md:gap-4">
              {products.map((product, i) => (
                <div
                  key={product.id}
                  className="flex-[0_0_calc(50%-6px)] md:flex-[0_0_calc(25%-9px)] min-w-0"
                >
                  <ProductCard product={product} index={i} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Index;
