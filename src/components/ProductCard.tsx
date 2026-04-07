import { Link } from "react-router-dom";
import { ShoppingBag, Heart, Eye } from "lucide-react";
import { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
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
    toast.success(`${product.name} adicionado ao carrinho!`, {
      duration: 2000,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group"
    >
      <div className="relative overflow-hidden rounded-xl bg-secondary/30 aspect-[3/4] mb-3">
        <Link to={`/produto/${product.id}`}>
          {!imgLoaded && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
          <img
            src={product.images[0]}
            alt={product.name}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {product.badge && (
            <span className="bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
              {product.badge}
            </span>
          )}
          {discount && (
            <span className="bg-foreground text-background text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm">
              -{discount}%
            </span>
          )}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-sm font-semibold text-foreground bg-background/80 px-4 py-1.5 rounded-full">
              Esgotado
            </span>
          </div>
        )}

        {/* Quick actions */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLiked(!liked);
            }}
            className="w-9 h-9 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow-md"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                liked ? "fill-accent text-accent" : "text-foreground"
              }`}
            />
          </button>
          <Link
            to={`/produto/${product.id}`}
            className="w-9 h-9 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow-md"
          >
            <Eye className="h-4 w-4 text-foreground" />
          </Link>
        </div>

        {/* Add to cart */}
        {product.inStock && (
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <Button
              onClick={handleAdd}
              className="w-full gap-2 text-xs h-9 rounded-lg shadow-lg"
              size="sm"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Adicionar ao Carrinho
            </Button>
          </div>
        )}
      </div>

      <Link to={`/produto/${product.id}`} className="block space-y-1.5">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
          {product.category}
        </p>
        <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Pricing */}
        <div className="space-y-0.5 pt-1">
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through block">
              R$ {product.originalPrice.toFixed(2).replace(".", ",")}
            </span>
          )}
          <span className="text-lg font-bold text-foreground block leading-tight">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          <span className="text-[11px] font-semibold text-pix block">
            R$ {pixPrice.toFixed(2).replace(".", ",")} no PIX
          </span>
          <span className="text-[11px] text-muted-foreground block">
            ou 3x de R$ {installment}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
          <span className="text-gold">★</span>
          <span className="font-medium">{product.rating}</span>
          <span>({product.reviews})</span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
