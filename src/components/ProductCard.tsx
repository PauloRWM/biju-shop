import { Link } from "react-router-dom";
import { ShoppingBag, Heart } from "lucide-react";
import { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

const ProductCard = ({ product }: { product: Product }) => {
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
    toast.success(`${product.name} adicionado ao carrinho!`, { duration: 2000 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group"
    >
      <div className="relative overflow-hidden bg-muted/40 aspect-[3/4] mb-4">
        <Link to={`/produto/${product.id}`}>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
          <img
            src={product.images[0]}
            alt={product.name}
            className={`w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-[800ms] ease-out ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {discount && (
            <span className="bg-foreground text-background text-[10px] font-sans font-medium uppercase tracking-wider px-2.5 py-1">
              -{discount}%
            </span>
          )}
          {product.badge && (
            <span className="bg-accent text-accent-foreground text-[10px] font-sans font-medium uppercase tracking-wider px-2.5 py-1">
              {product.badge}
            </span>
          )}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-foreground">
              Esgotado
            </span>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLiked(!liked);
            }}
            className="w-9 h-9 bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                liked ? "fill-accent text-accent" : "text-foreground"
              }`}
            />
          </button>
        </div>

        {/* Add to cart bar */}
        {product.inStock && (
          <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-full group-hover:translate-y-0">
            <button
              onClick={handleAdd}
              className="w-full h-10 bg-foreground text-background flex items-center justify-center gap-2 text-[11px] font-sans uppercase tracking-[0.12em] font-medium hover:bg-foreground/90 transition-colors"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </div>
        )}
      </div>

      <Link to={`/produto/${product.id}`} className="block">
        <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-[0.15em] mb-1.5">
          {product.category}
        </p>
        <h3 className="text-sm font-sans font-normal text-foreground leading-snug line-clamp-1 mb-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-2">
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through font-sans">
                R$ {product.originalPrice.toFixed(2).replace(".", ",")}
              </span>
            )}
            <span className="text-base font-sans font-bold text-foreground">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <p className="text-[11px] font-sans font-semibold text-pix">
            R$ {pixPrice.toFixed(2).replace(".", ",")} no PIX
          </p>
          <p className="text-[11px] font-sans text-muted-foreground">
            3x de R$ {installment}
          </p>
        </div>

        <div className="flex items-center gap-1 mt-2">
          <span className="text-gold text-xs">★</span>
          <span className="text-[11px] font-sans text-muted-foreground">
            {product.rating} ({product.reviews})
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
