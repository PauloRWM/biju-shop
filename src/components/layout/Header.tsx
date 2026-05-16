import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { User, Search, Menu, X, ChevronDown, Heart, Package, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CartDrawer from "@/components/CartDrawer";
import { useHomepageConfig } from "@/hooks/useProducts";
import { fetchProducts } from "@/services/products";
import type { Product } from "@/data/products";

const MAX_VISIBLE_NAV = 8;

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [scrolled, setScrolled] = useState(false);
  // hidden = true quando o usuário rolou pra baixo. Volta a false ao subir.
  const [hidden, setHidden] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const moreRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const { data: config } = useHomepageConfig();

  // Ajax search state
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedSearch = useDebounce(searchValue, 350);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchValue(q);
  }, [searchParams]);

  // Smart header: esconde ao rolar pra baixo, mostra ao rolar pra cima.
  // Mantém um threshold pra evitar flicker em micro-movimentos.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;

        setScrolled(y > 20);

        // Sempre visível perto do topo
        if (y < 80) {
          setHidden(false);
        } else if (delta > 6) {
          // descendo > 6px
          setHidden(true);
        } else if (delta < -6) {
          // subindo > 6px
          setHidden(false);
        }

        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchRef.current?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ajax search
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    fetchProducts({ search: debouncedSearch, per_page: 5 })
      .then((res) => {
        if (!cancelled) {
          setSuggestions(res.products);
          setShowSuggestions(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const dynamicLinks = config?.menu ?? [];
  const navLinks = [
    { label: "Inicio", to: "/" },
    { label: "Todos os Produtos", to: "/shop" },
    ...dynamicLinks.map(item => ({
      label: item.label,
      to: item.slug ? `/shop?cat=${encodeURIComponent(item.label)}` : (item.url ?? "/"),
    })),
  ];

  const visibleLinks = navLinks.slice(0, MAX_VISIBLE_NAV);
  const overflowLinks = navLinks.slice(MAX_VISIBLE_NAV);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchValue.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchValue.trim())}`);
      setMobileSearchOpen(false);
      setMobileOpen(false);
    } else {
      navigate("/shop");
    }
  };

  const handleSuggestionClick = (product: Product) => {
    setShowSuggestions(false);
    setSearchValue("");
    navigate(`/produto/${product.id}`);
  };

  const formatPrice = (price: number) =>
    price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div
      className={`flex flex-col w-full fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {/* ─── Tier 1: Utility / Announcement Bar ─── */}
      <div className="bg-foreground text-background py-1.5 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <p className="text-[10px] md:text-[11px] font-medium tracking-[0.12em] uppercase font-sans text-center flex-1">
            Frete Gratis acima de R$ 1.000 no PAC &nbsp;&bull;&nbsp; Parcele em ate 3x sem juros &nbsp;&bull;&nbsp; 10% OFF no PIX
          </p>
        </div>
      </div>

      <header
        className={`bg-background/95 backdrop-blur-xl transition-all duration-500 ${
          scrolled ? "shadow-sm border-b border-border/30" : ""
        }`}
      >
        {/* ─── Tier 2: Main Header — Logo | Search | Account + Cart ─── */}
        <div className="container mx-auto px-4 lg:px-8">
          <div className="hidden md:flex items-center gap-3 h-[52px]">
            {/* Logo */}
            <Link
              to="/"
              onClick={() => setSearchValue("")}
              className="transition-opacity duration-300 hover:opacity-80 shrink-0"
            >
              <img
                src="/logo.png"
                alt="Wesley Bijoux"
                className="h-20 w-auto object-contain"
              />
            </Link>

            {/* Search bar with AJAX suggestions */}
            <div className="flex-1 max-w-lg mx-auto relative" ref={searchRef}>
              <form onSubmit={handleSearch} className="flex items-center">
                <div className="flex w-full rounded-full border border-border/60 bg-muted/30 overflow-hidden focus-within:border-foreground/40 focus-within:bg-background focus-within:shadow-sm transition-all duration-200">
                  <input
                    type="text"
                    placeholder="Buscar produtos, categorias..."
                    value={searchValue}
                    onChange={(e) => { setSearchValue(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    className="flex-1 h-9 px-4 bg-transparent text-sm font-sans placeholder:text-muted-foreground/50 focus:outline-none text-foreground"
                  />
                  {searchLoading && (
                    <div className="flex items-center pr-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="submit"
                    className="h-9 px-4 bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors shrink-0 rounded-r-full"
                    aria-label="Buscar"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-background border border-border/40 shadow-xl rounded-xl overflow-hidden z-50"
                  >
                    {suggestions.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSuggestionClick(product)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <img
                          src={product.images?.[0] || ""}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg bg-muted shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-sans text-foreground truncate">{product.name}</p>
                          <p className="text-xs font-sans text-muted-foreground">{product.category}</p>
                        </div>
                        <span className="text-sm font-sans font-semibold text-foreground shrink-0">
                          {formatPrice(product.price)}
                        </span>
                      </button>
                    ))}
                    <Link
                      to={`/shop?q=${encodeURIComponent(searchValue)}`}
                      onClick={() => setShowSuggestions(false)}
                      className="block px-4 py-3 text-center text-xs font-sans font-medium uppercase tracking-wider text-foreground/60 hover:text-foreground hover:bg-muted/30 border-t border-border/20 transition-colors"
                    >
                      Ver todos os resultados
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Icon cluster: Account | Cart */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Account dropdown */}
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all"
                  aria-label="Minha Conta"
                >
                  <User className="h-5 w-5" />
                  <span className="text-[11px] font-sans font-medium uppercase tracking-[0.08em] hidden lg:block">
                    Entrar
                  </span>
                </button>
                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 bg-background border border-border/40 shadow-xl rounded-xl py-2 z-50 min-w-[180px]"
                    >
                      <Link
                        to="/conta"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <User className="h-4 w-4" />
                        Minha Conta
                      </Link>
                      <Link
                        to="/conta"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Package className="h-4 w-4" />
                        Meus Pedidos
                      </Link>
                      <div className="border-t border-border/30 my-1.5" />
                      <Link
                        to="/conta"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans font-medium text-foreground hover:bg-muted/50 transition-colors"
                      >
                        Entrar / Cadastrar
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cart */}
              <CartDrawer />
            </div>
          </div>

          {/* ─── Mobile: Hamburger | Logo | Search + Cart ─── */}
          <div className="flex md:hidden items-center justify-between h-14">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 -ml-2 text-foreground/80 hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link to="/" onClick={() => setSearchValue("")} className="absolute left-1/2 -translate-x-1/2 transition-opacity hover:opacity-80">
              <img
                src="/logo.png"
                alt="Wesley Bijoux"
                className="h-16 w-auto object-contain"
              />
            </Link>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className="p-2 text-foreground/80 hover:text-foreground transition-colors"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </button>
              <Link to="/conta" className="p-2 text-foreground/80 hover:text-foreground transition-colors" aria-label="Conta">
                <User className="h-5 w-5" />
              </Link>
              <CartDrawer />
            </div>
          </div>
        </div>

        {/* ─── Tier 3: Desktop Navigation Bar ─── */}
        <div className="hidden md:block border-t border-border/20">
          <div className="container mx-auto px-4 lg:px-8">
            <nav className="flex items-center justify-center gap-0.5 py-1.5">
              {visibleLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="px-3 py-1.5 text-[11.5px] font-sans font-semibold uppercase tracking-[0.14em] text-foreground/70 hover:text-foreground hover:bg-muted/40 rounded-md transition-all duration-200 whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
              {overflowLinks.length > 0 && (
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setMoreOpen((v) => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11.5px] font-sans font-semibold uppercase tracking-[0.14em] text-foreground/70 hover:text-foreground hover:bg-muted/40 rounded-md transition-all duration-200 whitespace-nowrap"
                  >
                    Mais <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {moreOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-background border border-border/40 shadow-xl rounded-xl py-2 z-50 min-w-[180px]"
                      >
                        {overflowLinks.map((link) => (
                          <Link
                            key={link.label}
                            to={link.to}
                            onClick={() => setMoreOpen(false)}
                            className="block px-5 py-2.5 text-[11px] font-sans font-medium uppercase tracking-[0.12em] text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors whitespace-nowrap"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </nav>
          </div>
        </div>

        {/* ─── Mobile search bar with suggestions ─── */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-border/20 bg-background"
            >
              <form onSubmit={handleSearch} className="flex items-center px-4 py-3 gap-2">
                <div className="flex flex-1 items-center rounded-full border border-border bg-muted/30 overflow-hidden focus-within:border-foreground/40">
                  <input
                    ref={mobileSearchRef}
                    type="text"
                    placeholder="Buscar produtos..."
                    value={searchValue}
                    onChange={(e) => { setSearchValue(e.target.value); setShowSuggestions(true); }}
                    className="flex-1 h-10 px-4 bg-transparent text-sm font-sans placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                  {searchLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  )}
                  <button type="submit" className="h-10 px-4 bg-foreground text-background rounded-r-full flex items-center" aria-label="Buscar">
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </form>
              {/* Mobile suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="bg-background border border-border/30 rounded-xl overflow-hidden shadow-lg">
                    {suggestions.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => { handleSuggestionClick(product); setMobileSearchOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border/10 last:border-0"
                      >
                        <img
                          src={product.images?.[0] || ""}
                          alt={product.name}
                          className="w-9 h-9 object-cover rounded-lg bg-muted shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-sans text-foreground truncate">{product.name}</p>
                        </div>
                        <span className="text-xs font-sans font-semibold text-foreground shrink-0">
                          {formatPrice(product.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Mobile nav ─── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden bg-background border-t border-border/30 overflow-hidden"
            >
              <div className="container px-4 py-5 flex flex-col gap-0.5">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className="block text-[13px] font-sans font-medium uppercase tracking-[0.1em] text-foreground/80 hover:text-foreground hover:bg-muted/40 transition-colors py-3 px-3 rounded-lg border-b border-border/5"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}

                {/* Mobile account section */}
                <div className="border-t border-border/20 mt-3 pt-3">
                  <Link
                    to="/conta"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 text-[13px] font-sans font-medium uppercase tracking-[0.1em] text-foreground/80 hover:text-foreground py-3 px-3 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Minha Conta
                  </Link>
                  <Link
                    to="/conta"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 text-[13px] font-sans font-medium uppercase tracking-[0.1em] text-foreground/80 hover:text-foreground py-3 px-3 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <Package className="h-4 w-4" />
                    Meus Pedidos
                  </Link>
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </div>
  );
};

export default Header;
