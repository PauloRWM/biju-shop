import { Link } from "react-router-dom";
import { ShoppingBag, Heart } from "lucide-react";
import { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";

const ProductCard = ({ product }: { product: Product }) => {
  const { addItem } = useCart();
  const [liked, setLiked] = useState(false);

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group"
    >
      <div className="relative overflow-hidden rounded-lg bg-secondary/30 aspect-square mb-3">
        <Link to={`/produto/${product.id}`}>
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {product.badge && (
          <span className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs font-semibold px-2.5 py-1 rounded-full">
            {product.badge}
          </span>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-sm font-medium text-foreground">Esgotado</span>
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setLiked(!liked)}
            className="w-9 h-9 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors shadow-sm"
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-accent text-accent" : "text-foreground"}`} />
          </button>
        </div>

        {product.inStock && (
          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              onClick={() => addItem(product)}
              className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90 text-sm h-9"
            >
              <ShoppingBag className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      <Link to={`/produto/${product.id}`} className="block space-y-1">
        <h3 className="text-sm font-medium text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              R$ {product.originalPrice.toFixed(2).replace(".", ",")}
            </span>
          )}
          {discount && (
            <span className="text-xs font-semibold text-accent">-{discount}%</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="text-gold">★</span>
          <span>{product.rating}</span>
          <span>({product.reviews})</span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
