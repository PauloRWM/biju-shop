import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import CategorySidebar from "@/components/CategorySidebar";
import { useInfiniteProducts, useCategories } from "@/hooks/useProducts";
import type { ProductsParams } from "@/services/products";
import { Button } from "@/components/ui/button";
import { products as fallbackProducts, categories as fallbackCategories } from "@/data/products";
import { ChevronDown, SlidersHorizontal, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";

const PRICE_RANGES = [
  { label: "Todos os precos", min: 0, max: Infinity },
  { label: "Ate R$ 20", min: 0, max: 20 },
  { label: "R$ 20 - R$ 50", min: 20, max: 50 },
  { label: "R$ 50 - R$ 100", min: 50, max: 100 },
  { label: "R$ 100 - R$ 200", min: 100, max: 200 },
  { label: "Acima de R$ 200", min: 200, max: Infinity },
];

const SORT_OPTIONS = [
  { label: "Mais recentes", value: "date-DESC" },
  { label: "Menor preco", value: "price-ASC" },
  { label: "Maior preco", value: "price-DESC" },
  { label: "Mais populares", value: "popularity-DESC" },
  { label: "Nome A-Z", value: "title-ASC" },
];

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const catParam = searchParams.get("cat") || "";
  const queryParam = searchParams.get("q")?.toLowerCase() || "";

  const [activeCategory, setActiveCategory] = useState(catParam || "Todos");
  const [priceRange, setPriceRange] = useState(PRICE_RANGES[0]);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [searchInput, setSearchInput] = useState(queryParam);

  // Sincroniza o input com o ?q da URL (back/forward, links externos).
  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  // Debounce: 350ms após parar de digitar, atualiza a URL → useInfiniteProducts
  // reage automaticamente porque o queryKey muda.
  useEffect(() => {
    const trimmed = searchInput.trim().toLowerCase();
    if (trimmed === queryParam) return;
    const timer = setTimeout(() => {
      const params: Record<string, string> = {};
      if (activeCategory !== "Todos") params.cat = activeCategory;
      if (trimmed) params.q = trimmed;
      setSearchParams(params, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, queryParam, activeCategory, setSearchParams]);

  useEffect(() => {
    setActiveCategory(catParam || "Todos");
    window.scrollTo({ top: 0 });
  }, [catParam]);

  useEffect(() => {
    if (queryParam) window.scrollTo({ top: 0 });
  }, [queryParam]);

  // sortBy.value sempre vem de SORT_OPTIONS (valores controlados), então o cast
  // para os tipos da API é seguro.
  const [orderby, order] = sortBy.value.split("-") as [
    NonNullable<ProductsParams["orderby"]>,
    NonNullable<ProductsParams["order"]>,
  ];

  const {
    data: productsPages,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts({
    category: activeCategory !== "Todos" ? activeCategory : undefined,
    search: queryParam || undefined,
    per_page: 60,
    orderby,
    order,
  });
  const { data: apiCategories } = useCategories();

  const apiOk = !isError && (isLoading || !!productsPages);
  const catArray = Array.isArray(apiCategories) ? apiCategories : [];
  const allCategories = apiOk && catArray.length
    ? [{ name: "Todos", slug: "todos", count: 0 }, ...catArray]
    : fallbackCategories.map(c => ({ name: c, slug: c.toLowerCase(), count: 0 }));

  // Total real da lista. Em proxies que stripam o header X-WP-Total, ele
  // chega como o tamanho da página (ex: 60), o que daria "120 de 60".
  // Por isso usamos o MAIOR entre header e count da categoria.
  const totalFromHeader = productsPages?.pages[0]?.total ?? 0;
  const totalFromCategory =
    activeCategory !== "Todos" && !queryParam
      ? catArray.find((c) => c.name === activeCategory)?.count ?? 0
      : queryParam
        ? 0
        : catArray.reduce((s, c) => s + (c.count ?? 0), 0);
  const totalFromApi = Math.max(totalFromHeader, totalFromCategory);
  const products = apiOk
    ? (productsPages?.pages.flatMap((p) => p.products) ?? [])
    : fallbackProducts.filter((p) => {
        const matchesCat = activeCategory === "Todos" || p.category === activeCategory;
        const matchesQ = !queryParam ||
          p.name.toLowerCase().includes(queryParam) ||
          p.category.toLowerCase().includes(queryParam);
        return matchesCat && matchesQ;
      });

  // Filtro de preco no client
  const filtered = useMemo(() => {
    if (priceRange.min === 0 && priceRange.max === Infinity) return products;
    return products.filter(p => p.price >= priceRange.min && p.price <= priceRange.max);
  }, [products, priceRange]);

  const handleCategory = (cat: string) => {
    setActiveCategory(cat);
    const params: Record<string, string> = {};
    if (cat !== "Todos") params.cat = cat;
    if (queryParam) params.q = queryParam;
    setSearchParams(params);
  };

  const title = queryParam
    ? `Resultados para "${queryParam}"`
    : activeCategory !== "Todos"
      ? activeCategory
      : "Todos os Produtos";

  const activeFilters = (priceRange.min !== 0 || priceRange.max !== Infinity) ? 1 : 0;

  // ── Sidebar: apenas categorias ──
  const SidebarCategories = () => (
    <CategorySidebar
      categories={allCategories}
      activeCategory={activeCategory}
      onSelect={(name) => { handleCategory(name); setMobileSidebar(false); }}
    />
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 min-h-[70vh]">
        {/* Header da pagina */}
        <div className="mb-6">
          <p className="text-[11px] font-sans uppercase tracking-[0.2em] text-muted-foreground mb-1">Shop</p>
          <h1 className="font-display text-2xl md:text-3xl font-light tracking-wide text-foreground">
            {title}
          </h1>
        </div>

        {/* Campo de busca */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            inputMode="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, categoria, material..."
            className="h-12 pl-10 pr-10 text-base bg-card border-border/60 rounded-full focus-visible:ring-1 focus-visible:ring-foreground/30"
            aria-label="Buscar produtos"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* ── Sidebar Desktop: categorias ── */}
          <aside className="hidden lg:block w-[220px] shrink-0">
            <div className="sticky top-[120px]">
              <SidebarCategories />
            </div>
          </aside>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0">
            {/* Barra de preco — sempre visivel */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
              <span className="text-[11px] font-sans font-bold uppercase tracking-[0.1em] text-muted-foreground shrink-0 mr-1">
                Preco:
              </span>
              {PRICE_RANGES.map((range) => {
                const isActive = priceRange === range;
                return (
                  <button
                    key={range.label}
                    onClick={() => setPriceRange(range)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-150 shrink-0 border ${
                      isActive
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground/70 border-border hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>

            {/* Toolbar: count + sort + mobile filter btn */}
            <div className="flex items-center justify-between mb-5 gap-3">
              <p className="text-sm text-muted-foreground font-sans">
                {(() => {
                  const count = apiOk && totalFromApi > 0 && activeFilters === 0
                    ? totalFromApi
                    : filtered.length;
                  return `${count} ${count === 1 ? "produto" : "produtos"}`;
                })()}
                {activeFilters > 0 && (
                  <button
                    onClick={() => setPriceRange(PRICE_RANGES[0])}
                    className="ml-2 inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    Limpar filtro <X className="h-3 w-3" />
                  </button>
                )}
              </p>

              <div className="flex items-center gap-2">
                {/* Mobile filter button (categorias) */}
                <button
                  onClick={() => setMobileSidebar(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-sans text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Categorias
                </button>

                {/* Sort dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-sans text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors">
                    {sortBy.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-background border border-border/40 shadow-xl rounded-xl py-1.5 z-50 min-w-[170px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSortBy(opt)}
                        className={`block w-full text-left px-4 py-2 text-sm font-sans transition-colors ${
                          sortBy.value === opt.value
                            ? "text-foreground font-semibold bg-muted/50"
                            : "text-foreground/70 hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Products grid */}
            {isLoading ? (
              <LoadingSpinner />
            ) : filtered.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {filtered.map((product, i) => (
                    <div key={product.id}>
                      <ProductCard product={product} index={i} />
                    </div>
                  ))}
                </div>

                {apiOk && (hasNextPage || filtered.length < totalFromApi) && (
                  <div className="flex justify-center mt-10">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="min-w-[200px]"
                    >
                      {isFetchingNextPage ? "Carregando..." : "Carregar mais produtos"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <p className="text-muted-foreground font-sans text-sm">Nenhum produto encontrado.</p>
                {activeFilters > 0 && (
                  <button
                    onClick={() => setPriceRange(PRICE_RANGES[0])}
                    className="mt-3 text-sm font-sans text-foreground underline underline-offset-4 hover:no-underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setMobileSidebar(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-background z-50 lg:hidden overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <h2 className="text-sm font-sans font-bold uppercase tracking-[0.1em]">Filtros</h2>
                <button
                  onClick={() => setMobileSidebar(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <SidebarCategories />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Shop;
