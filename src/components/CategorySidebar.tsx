import { Link } from "react-router-dom";

export interface SidebarCategory {
  name: string;
  slug?: string;
  count: number;
}

interface CategorySidebarProps {
  categories: SidebarCategory[];
  /** Modo filtro (/shop): nome da categoria ativa, para destacar o item. */
  activeCategory?: string;
  /**
   * Modo filtro (/shop): callback ao clicar. Quando ausente, cada item vira um
   * <Link> para /shop?cat=<name> (modo navegação, usado na home).
   */
  onSelect?: (name: string) => void;
}

const itemClass = (isActive: boolean) =>
  `w-full text-left px-3 py-2 rounded-lg text-sm font-sans transition-all duration-150 flex items-center justify-between ${
    isActive
      ? "bg-foreground text-background font-semibold"
      : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
  }`;

/**
 * Lista de categorias da sidebar. Compartilhada entre /shop (modo filtro, via
 * onSelect) e a home (modo navegação, links para /shop?cat=).
 */
const CategorySidebar = ({ categories, activeCategory, onSelect }: CategorySidebarProps) => (
  <div>
    <h3 className="text-xs font-sans font-bold uppercase tracking-[0.12em] text-foreground mb-3">
      Categorias
    </h3>
    <ul className="space-y-0.5">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.name;
        const count = cat.count > 0 ? (
          <span className={`text-[10px] tabular-nums ${isActive ? "text-background/60" : "text-muted-foreground"}`}>
            {cat.count}
          </span>
        ) : null;

        return (
          <li key={cat.name}>
            {onSelect ? (
              <button onClick={() => onSelect(cat.name)} className={itemClass(isActive)}>
                <span className="truncate">{cat.name}</span>
                {count}
              </button>
            ) : (
              <Link
                to={cat.name === "Todos" ? "/shop" : `/shop?cat=${encodeURIComponent(cat.name)}`}
                className={itemClass(isActive)}
              >
                <span className="truncate">{cat.name}</span>
                {count}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

export default CategorySidebar;
