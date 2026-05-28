import { Link } from "react-router-dom";
import { ShoppingBag, Heart, Minus, Plus } from "lucide-react";
import { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";
import { toast } from "sonner";
import { trackAddToCart } from "@/services/metaPixel";
import { useQueryClient } from "@tanstack/react-query";
import { fetchProduct } from "@/services/products";

interface Props {
  product: Product;
  index?: number;
  featured?: boolean;
}

const ProductCard = ({ product, index = 0 }: Props) => {
  const { addItem, openCart, items, updateQuantity } = useCart();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [qty, setQty] = useState(0);
  const [prefetched, setPrefetched] = useState(false);

  // Produtos variáveis não podem ser controlados direto no card —
  // precisam ir pra página de detalhe pra escolher a variação.
  const isVariable =
    product.type === "variable" ||
    (product.variations && product.variations.length > 0);

  // Quantidade atual deste produto no carrinho (só p/ produtos simples).
  const cartQty = isVariable
    ? 0
    : items
        .filter((i) => i.product.id === product.id && !i.variationId)
        .reduce((s, i) => s + i.quantity, 0);

  // Para produtos simples sincroniza o display com o carrinho;
  // para variáveis usa o estado local (que serve só pro botão "Adicionar"
  // que leva à página de detalhe).
  const displayQty = isVariable ? qty : cartQty;

  const prefetchProduct = () => {
    if (prefetched) return;
    setPrefetched(true);
    queryClient.prefetchQuery({
      queryKey: ["product", product.id],
      queryFn: () => fetchProduct(product.id),
      staleTime: 60_000,
    });
  };

  const pixPrice = product.price * 0.9;
  const installment = (product.price / 3).toFixed(2).replace(".", ",");
  const hasSecondImage = product.images && product.images.length > 1;

  const stopLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const decQty = (e: React.MouseEvent) => {
    stopLink(e);
    if (isVariable) {
      setQty((q) => Math.max(0, q - 1));
      return;
    }
    // Decrementa direto no carrinho — toda mudança aqui já reflete no checkout.
    updateQuantity(product.id, Math.max(0, cartQty - 1));
  };

  const incQty = (e: React.MouseEvent) => {
    stopLink(e);
    if (isVariable) {
      setQty((q) => Math.min(99, q + 1));
      return;
    }
    const newQty = Math.min(99, cartQty + 1);
    if (cartQty === 0) {
      addItem(product, 1);
      trackAddToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      });
    } else {
      updateQuantity(product.id, newQty);
    }
  };

  const handleAdd = (e: React.MouseEvent) => {
    stopLink(e);
    // Produto com variações: redireciona para a página de detalhe
    if (isVariable) {
      if (qty <= 0) {
        window.location.href = `/produto/${product.id}`;
        return;
      }
      window.location.href = `/produto/${product.id}`;
      return;
    }
    // Para produto simples, abre o carrinho. O +/- já adicionou.
    if (cartQty <= 0) {
      addItem(product, 1);
      trackAddToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      });
    }
    openCart();
    toast.success(`${product.name} no carrinho!`, { duration: 2000 });
  };

  return (
    <div
      className="group flex flex-col h-full"
      onMouseEnter={() => { setHovered(true); prefetchProduct(); }}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={prefetchProduct}
    >
      {/* Imagem — 4:5, troca de imagem no hover */}
      <div className="relative overflow-hidden rounded-xl bg-muted/30 mb-2.5 aspect-[4/5]">
        <Link to={`/produto/${product.id}`} className="block w-full h-full">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-secondary animate-pulse" />
          )}
          {/* Imagem principal — exibida imediatamente assim que o navegador
              renderiza o pixel. Sem fade nem espera de imgLoaded. */}
          <img
            src={product.images_thumb?.[0] ?? product.images[0]}
            alt={product.name}
            className={`absolute inset-0 w-full h-full object-cover ${
              hovered && hasSecondImage ? "opacity-0" : "opacity-100"
            } transition-opacity duration-200`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
          />
          {/* Segunda imagem no hover */}
          {hasSecondImage && (
            <img
              src={product.images_thumb?.[1] ?? product.images[1]}
              alt={product.name}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                hovered ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              decoding="async"
            />
          )}
        </Link>

        {/* Esgotado */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-30">
            <span className="text-xs font-semibold text-foreground bg-background/85 px-3 py-1 rounded-full border border-border/40">
              Esgotado
            </span>
          </div>
        )}

        {/* Favorito */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLiked(!liked); }}
          aria-label="Favoritar"
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 hover:scale-110"
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-500 text-red-500" : "text-foreground/70"}`} />
        </button>

        {/* Seletor de quantidade + adicionar ao carrinho.
            Sempre visível em todos os tamanhos de tela. */}
        {product.inStock && (
          <div className="absolute bottom-0 left-0 right-0 p-1.5 md:p-2.5 z-20 flex gap-1 md:gap-1.5">
            <div className="flex items-center h-9 md:h-10 rounded-lg bg-background/95 backdrop-blur-sm border border-border/60 shadow-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={decQty}
                aria-label="Diminuir quantidade"
                className="h-full w-7 md:w-8 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={displayQty <= 0}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 md:w-7 text-center text-sm font-bold tabular-nums select-none">
                {displayQty}
              </span>
              <button
                type="button"
                onClick={incQty}
                aria-label="Aumentar quantidade"
                disabled={
                  !isVariable &&
                  typeof product.stockQuantity === "number" &&
                  product.stockQuantity >= 0 &&
                  cartQty >= product.stockQuantity
                }
                className="h-full w-7 md:w-8 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={handleAdd}
              aria-label={isVariable ? "Ver produto" : cartQty > 0 ? "Ver carrinho" : "Adicionar ao carrinho"}
              className="flex-1 min-w-0 h-9 md:h-10 px-1 md:px-3 rounded-lg gradient-brand text-white flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline truncate">
                {isVariable ? "Ver" : cartQty > 0 ? "Ver carrinho" : "Adicionar"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Info — limpo: nome + preco */}
      <Link to={`/produto/${product.id}`} className="block flex-1 flex flex-col gap-1">
        <h3 className="font-sans text-sm text-foreground leading-snug line-clamp-2 group-hover:text-foreground/70 transition-colors">
          {product.name}
        </h3>

        <div className="mt-auto pt-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <img src="/icons8-pix.svg" alt="PIX" className="w-4 h-4 shrink-0" />
            <span className="font-bold text-pix text-base leading-tight">
              R$ {pixPrice.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <p className="text-xs text-foreground/80 pl-[22px]">
            ou <strong>R$ {product.price.toFixed(2).replace(".", ",")}</strong>
          </p>
          <p className="text-[11px] text-muted-foreground pl-[22px]">
            3x de R$ {installment} sem juros
          </p>
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;
