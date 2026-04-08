import { Link } from "react-router-dom";
import { ShoppingBag, Heart, Eye } from "lucide-react";
import { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  product: Product;
  /** Para animação staggered no grid */
  index?: number;
  /** Modo destaque: card maior no bento grid */
  featured?: boolean;
}

const ProductCard = ({ product, index = 0, featured = false }: Props) => {
  const { addItem } = useCart();
  const [liked, setLiked] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;
  const pixPrice = product.price * 0.9;
  const installment = (product.price / 3).toFixed(2).replace(".", ",");

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} adicionado!`, { duration: 2000 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col"
    >
      {/* Image container */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-secondary/40 mb-3 ${
          featured ? "aspect-[3/4] md:aspect-square" : "aspect-[3/4]"
        }`}
      >
        <Link to={`/produto/${product.id}`} className="block w-full h-full">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-secondary animate-pulse" />
          )}
          <img
            src={product.images[0]}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
          />
          {/* Gradient overlay — legibilidade bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </Link>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.badge && (
            <span className="gradient-brand text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md">
              {product.badge}
            </span>
          )}
          {discount && (
            <span className="bg-foreground/90 text-background text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm">
              -{discount}%
            </span>
          )}
        </div>

        {/* Esgotado */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-background/55 backdrop-blur-[3px] flex items-center justify-center">
            <span className="text-sm font-semibold text-foreground bg-background/85 px-4 py-1.5 rounded-full border border-border/40">
              Esgotado
            </span>
          </div>
        )}

        {/* Quick actions — direita */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLiked(!liked); }}
            aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            className="w-9 h-9 rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center shadow-soft hover:scale-110 transition-all duration-200"
          >
            <Heart className={`h-4 w-4 transition-colors ${liked ? "fill-accent text-accent" : "text-foreground"}`} />
          </button>
          <Link
            to={`/produto/${product.id}`}
            aria-label="Ver produto"
            className="w-9 h-9 rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center shadow-soft hover:scale-110 transition-all duration-200"
          >
            <Eye className="h-4 w-4 text-foreground" />
          </Link>
        </div>

        {/* CTA deslizante no bottom */}
        {product.inStock && (
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <Button
              onClick={handleAdd}
              className="w-full gap-2 text-xs h-9 rounded-xl gradient-brand border-0 shadow-card text-white hover:opacity-90"
              size="sm"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Adicionar ao Carrinho
            </Button>
          </div>
        )}
      </div>

      {/* Info */}
      <Link to={`/produto/${product.id}`} className="block flex-1 space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">
          {product.category}
        </p>
        <h3 className={`font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200 ${
          featured ? "text-base" : "text-sm"
        }`}>
          {product.name}
        </h3>

        <div className="space-y-0.5 pt-1">
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through block">
              R$ {product.originalPrice.toFixed(2).replace(".", ",")}
            </span>
          )}
          <span className={`font-bold text-foreground block leading-tight ${featured ? "text-xl" : "text-lg"}`}>
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          <span className="text-[11px] font-semibold text-pix">
            R$ {pixPrice.toFixed(2).replace(".", ",")} no PIX
          </span>
          <span className="text-[11px] text-muted-foreground block">
            ou 3x de R$ {installment}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
          <span className="text-gold">★</span>
          <span className="font-semibold text-foreground/80">{product.rating}</span>
          <span>({product.reviews})</span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
