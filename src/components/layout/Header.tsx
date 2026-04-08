import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { User, Search, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CartDrawer from "@/components/CartDrawer";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchValue(q);
  }, [searchParams]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const navLinks = [
    { label: "Início", to: "/" },
    { label: "Colares", to: "/?cat=Colares" },
    { label: "Brincos", to: "/?cat=Brincos" },
    { label: "Pulseiras", to: "/?cat=Pulseiras" },
    { label: "Anéis", to: "/?cat=Anéis" },
    { label: "Conjuntos", to: "/?cat=Conjuntos" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchOpen(false);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex flex-col w-full sticky top-0 z-50">
      {/* Announcement Bar */}
      <div className="bg-foreground text-background py-2 px-4 text-center">
        <p className="text-[10px] md:text-xs font-medium tracking-[0.15em] uppercase font-sans">
          Frete Grátis acima de R$ 99 &nbsp;•&nbsp; Parcele em até 6x sem juros &nbsp;•&nbsp; 10% OFF no PIX
        </p>
      </div>

      <header
        className={`bg-background/95 backdrop-blur-xl transition-all duration-500 ${
          scrolled ? "shadow-sm border-b border-border/30" : ""
        }`}
      >
        <div className="container mx-auto px-4 lg:px-8">
          {/* Top bar: Logo centered, actions on sides */}
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            {/* Left: hamburger (mobile) */}
            <div className="flex items-center flex-1 md:hidden">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 -ml-2 text-foreground/80 hover:text-foreground transition-colors"
                aria-label="Menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            {/* Left: Search (desktop) */}
            <div className="hidden md:flex items-center flex-1">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                <Search className="h-[18px] w-[18px]" />
                <span className="font-sans text-[13px]">Buscar</span>
              </button>
            </div>

            {/* Center: Logo */}
            <div className="flex justify-center flex-shrink-0">
              <Link
                to="/"
                onClick={() => { setSearchValue(""); setSearchOpen(false); }}
                className="transition-opacity duration-300 hover:opacity-80"
              >
                <h1 className="font-display text-2xl md:text-3xl font-light tracking-[0.15em] uppercase text-foreground">
                  Luminária
                </h1>
              </Link>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-1 md:gap-4 flex-1">
              {/* Mobile search */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="md:hidden p-2 text-foreground/80 hover:text-foreground transition-colors"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </button>

              <Link to="/conta" className="hidden sm:block">
                <button className="p-2 text-foreground/80 hover:text-foreground transition-colors" aria-label="Conta">
                  <User className="h-5 w-5" />
                </button>
              </Link>

              <CartDrawer />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center justify-center gap-10 pb-3 -mt-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="text-[12px] font-sans font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-all duration-300 relative group py-1"
              >
                {link.label}
                <span className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-foreground transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>
        </div>

        {/* Full-width Search Overlay */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden border-t border-border/30 bg-background"
            >
              <div className="container mx-auto px-4 lg:px-8 py-6">
                <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="O que você está procurando?"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-12 pl-8 pr-20 bg-transparent border-b-2 border-border focus:border-foreground transition-colors text-base font-sans placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchValue && (
                      <button type="submit" className="text-xs font-sans uppercase tracking-wider text-foreground hover:text-primary transition-colors">
                        Buscar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSearchOpen(false)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </form>
                <div className="max-w-2xl mx-auto mt-4">
                  <p className="text-xs text-muted-foreground font-sans tracking-wide">
                    Populares: <span className="text-foreground cursor-pointer hover:underline" onClick={() => { setSearchValue("Colares"); }}>Colares</span>, <span className="text-foreground cursor-pointer hover:underline" onClick={() => { setSearchValue("Brincos"); }}>Brincos</span>, <span className="text-foreground cursor-pointer hover:underline" onClick={() => { setSearchValue("Conjuntos"); }}>Conjuntos</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden bg-background border-t border-border/30 overflow-hidden"
            >
              <div className="container px-4 py-8 flex flex-col gap-1">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className="block text-base font-sans font-medium uppercase tracking-[0.12em] text-foreground/80 hover:text-foreground transition-colors py-3 border-b border-border/10 last:border-0"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.05 }}
                >
                  <Link
                    to="/conta"
                    onClick={() => setMobileOpen(false)}
                    className="block text-base font-sans font-medium uppercase tracking-[0.12em] text-foreground/80 hover:text-foreground transition-colors py-3 sm:hidden"
                  >
                    Minha Conta
                  </Link>
                </motion.div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </div>
  );
};

export default Header;
