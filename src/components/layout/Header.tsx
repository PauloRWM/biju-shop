import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { User, Search, Menu, X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CartDrawer from "@/components/CartDrawer";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchValue(q);
  }, [searchParams]);

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
      <div className="bg-primary text-primary-foreground py-1.5 px-4 text-center">
        <p className="text-[10px] md:text-xs font-bold tracking-widest uppercase">
          ✨ Frete Grátis nas compras acima de R$ 99 • Parcelamento em até 6x ✨
        </p>
      </div>

      <header className="bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Left: Mobile Menu & Desktop Nav */}
            <div className="flex items-center gap-8 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden hover:bg-transparent"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>

              <nav className="hidden md:flex items-center gap-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all duration-300 relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
                  </Link>
                ))}
              </nav>
            </div>

            {/* Center: Logo */}
            <div className="flex justify-center flex-1">
              <Link to="/" onClick={() => { setSearchValue(""); setSearchOpen(false); }} className="flex items-center transition-transform duration-300 hover:scale-105">
                <img 
                  src="https://wesleybijoux.com.br/wp-content/uploads/2024/08/WhatsApp-Image-2026-01-18-at-17.07.54-e1774703118212.jpeg" 
                  alt="Wesley Bijoux" 
                  className="h-10 md:h-14 w-auto object-contain"
                />
              </Link>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-1 md:gap-3 flex-1">
              <div className="relative flex items-center">
                <AnimatePresence>
                  {searchOpen && (
                    <motion.form
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      onSubmit={handleSearch}
                      className="absolute right-0 flex items-center w-[180px] md:w-[280px]"
                    >
                      <input
                        autoFocus
                        type="text"
                        placeholder="Buscar peças..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="w-full h-10 pl-4 pr-10 rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      />
                      <button type="submit" className="absolute right-3 text-muted-foreground hover:text-primary">
                        <Search className="h-4 w-4" />
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
                
                {!searchOpen && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSearchOpen(true)}
                    className="hover:text-primary hover:bg-transparent"
                  >
                    <Search className="h-5 w-5 md:h-6 md:w-6" />
                  </Button>
                )}
                
                {searchOpen && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSearchOpen(false)}
                    className="z-10 hover:text-primary hover:bg-transparent"
                  >
                    <X className="h-5 w-5 md:h-6 md:w-6" />
                  </Button>
                )}
              </div>

              <Link to="/conta" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-transparent">
                  <User className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </Link>
              
              <CartDrawer />
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-background border-t border-border/40 overflow-hidden"
            >
              <div className="container px-4 py-8 flex flex-col gap-6">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    placeholder="O que você procura?"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-12 pl-4 pr-12 rounded-xl border border-border bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-primary">
                    <Search className="h-5 w-5" />
                  </button>
                </form>

                <div className="flex flex-col gap-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-bold uppercase tracking-widest hover:text-primary transition-colors py-2 border-b border-border/20 last:border-0"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Link
                    to="/conta"
                    onClick={() => setMobileOpen(false)}
                    className="text-lg font-bold uppercase tracking-widest hover:text-primary transition-colors py-2 sm:hidden"
                  >
                    Minha Conta
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
