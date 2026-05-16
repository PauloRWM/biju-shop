import { Link, useLocation } from "react-router-dom";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { getAuthToken } from "@/services/api";

/**
 * Barra de navegação fixa para mobile.
 * Mostra os 4 destinos principais (Início, Buscar, Carrinho, Perfil) e
 * destaca o atual. O badge no carrinho mostra a quantidade total de itens.
 *
 * Aparece somente em telas <md. No desktop o Header já cobre o uso.
 */
const MobileBottomNav = () => {
  const location = useLocation();
  const { totalItems, openCart } = useCart();
  const isAuthenticated = !!getAuthToken();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/60 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação inferior"
    >
      <div className="grid grid-cols-4 h-16">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            isActive("/") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Home className="h-5 w-5" />
          <span>Início</span>
        </Link>

        <Link
          to="/shop"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            isActive("/shop") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Search className="h-5 w-5" />
          <span>Buscar</span>
        </Link>

        <button
          type="button"
          onClick={openCart}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative ${
            totalItems > 0 ? "text-primary" : "text-muted-foreground"
          }`}
          aria-label={`Carrinho com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`}
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </div>
          <span>Carrinho</span>
        </button>

        <Link
          to="/conta"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            isActive("/conta") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <User className="h-5 w-5" />
          <span>{isAuthenticated ? "Perfil" : "Entrar"}</span>
        </Link>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
