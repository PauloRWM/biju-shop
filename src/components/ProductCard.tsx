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

  const pixPrice = product.price * 0.9;
  const installment = (product.price / 3).toFixed(2).replace(".", ",");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group"
    >
      <div className="relative overflow-hidden rounded-xl bg-secondary/30 aspect-square mb-3">
        <Link to={`/produto/${product.id}`}>
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {product.badge && (
            <span className="bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
              {product.badge}
            </span>
          )}
          {discount && (
            <span className="bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded-md">
              -{discount}%
            </span>
          )}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-sm font-semibold text-foreground bg-background/80 px-4 py-1.5 rounded-full">Esgotado</span>
          </div>
        )}

        <div className="absolute top-2.5 right-2.5 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setLiked(!liked)}
            className="w-8 h-8 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors shadow-sm"
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-accent text-accent" : "text-foreground"}`} />
          </button>
        </div>

        {product.inStock && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
            <Button
              onClick={() => addItem(product)}
              className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90 text-xs h-8 rounded-lg"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      <Link to={`/produto/${product.id}`} className="block space-y-1.5">
        <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Pricing */}
        <div className="space-y-0.5">
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through block">
              R$ {product.originalPrice.toFixed(2).replace(".", ",")}
            </span>
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-foreground">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-green-600 block">
            R$ {pixPrice.toFixed(2).replace(".", ",")} no PIX
          </span>
          <span className="text-[11px] text-muted-foreground block">
            ou 3x de R$ {installment} sem juros
          </span>
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
