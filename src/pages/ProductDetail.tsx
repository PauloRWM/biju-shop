import { useParams, Link } from "react-router-dom";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { products as fallbackProducts } from "@/data/products";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Heart,
  ChevronLeft,
  ChevronRight,
  Star,
  Truck,
  Shield,
  RotateCcw,
  Share2,
  Check,
  CreditCard,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "sonner";

const ProductDetail = () => {
  const { id } = useParams();
  const { data: apiProduct, isLoading, isError } = useProduct(id);
  const product = apiProduct ?? (isError ? fallbackProducts.find((p) => p.id === id) : undefined);
  const { data: relatedPage } = useProducts({
    category: product?.category,
    per_page: 5,
  });
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setSelectedImage(0);
    setQty(1);
  }, [id]);

  if (isLoading && !product) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  if (isError || !product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold mb-4">
            Produto não encontrado
          </h1>
          <Link to="/">
            <Button>Voltar à loja</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const related = (
    relatedPage?.products ??
    fallbackProducts.filter((p) => p.category === product.category && p.id !== product.id)
  ).filter((p) => p.id !== product.id).slice(0, 4);
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;
  const pixPrice = product.price * 0.9;

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addItem(product);
    toast.success(
      `${qty}x ${product.name} adicionado ao carrinho!`,
      { duration: 2500 }
    );
  };

  const nextImage = () =>
    setSelectedImage((prev) => (prev + 1) % product.images.length);
  const prevImage = () =>
    setSelectedImage(
      (prev) => (prev - 1 + product.images.length) % product.images.length
    );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link
            to="/"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Início
          </Link>
          <span>/</span>
          <Link
            to={`/?cat=${product.category}`}
            className="hover:text-foreground transition-colors"
          >
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {product.name}
          </span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-14">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary/30 mb-3 group">
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedImage}
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {product.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-background"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-background"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.badge && (
                  <span className="bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                    {product.badge}
                  </span>
                )}
                {discount && (
                  <span className="bg-foreground text-background text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    -{discount}%
                  </span>
                )}
              </div>

              {/* Quick actions top right */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => setLiked(!liked)}
                  className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-background transition-colors"
                >
                  <Heart
                    className={`h-5 w-5 ${
                      liked ? "fill-accent text-accent" : "text-foreground"
                    }`}
                  />
                </button>
                <button className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-background transition-colors">
                  <Share2 className="h-5 w-5 text-foreground" />
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === i
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col"
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {product.category}
            </p>

            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3 leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.floor(product.rating)
                        ? "fill-gold text-gold"
                        : "text-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {product.rating} ({product.reviews} avaliações)
              </span>
            </div>

            {/* Pricing Block */}
            <div className="bg-secondary/40 rounded-xl p-5 mb-6 space-y-2">
              <div className="flex items-baseline gap-3">
                {product.originalPrice && (
                  <span className="text-base text-muted-foreground line-through">
                    R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                  </span>
                )}
                {discount && (
                  <span className="text-xs font-bold bg-accent text-accent-foreground px-2.5 py-0.5 rounded-full">
                    -{discount}% OFF
                  </span>
                )}
              </div>
              <span className="text-3xl md:text-4xl font-bold text-foreground block">
                R$ {product.price.toFixed(2).replace(".", ",")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-pix">
                  R$ {pixPrice.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-sm text-pix font-medium bg-pix/10 px-2 py-0.5 rounded-md">
                  PIX −10%
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>
                  ou 3x de R${" "}
                  {(product.price / 3).toFixed(2).replace(".", ",")} sem juros
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {product.description}
            </p>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-secondary/30 rounded-lg p-3">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-0.5">
                  Material
                </span>
                <span className="text-sm font-medium text-foreground">
                  {product.material}
                </span>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-0.5">
                  Cores
                </span>
                <span className="text-sm font-medium text-foreground">
                  {product.colors.join(", ")}
                </span>
              </div>
            </div>

            {/* Quantity & Actions */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-medium text-foreground">Qtd:</span>
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-4 py-2.5 text-sm hover:bg-muted transition-colors font-medium"
                >
                  −
                </button>
                <span className="px-5 py-2.5 text-sm font-bold border-x min-w-[3rem] text-center">
                  {qty}
                </span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="px-4 py-2.5 text-sm hover:bg-muted transition-colors font-medium"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <Button
                size="lg"
                className="flex-1 gap-2 h-12 text-base"
                disabled={!product.inStock}
                onClick={handleAdd}
              >
                <ShoppingBag className="h-5 w-5" />
                {product.inStock ? "Adicionar ao Carrinho" : "Esgotado"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-5 h-12"
                onClick={() => setLiked(!liked)}
              >
                <Heart
                  className={`h-5 w-5 ${
                    liked ? "fill-accent text-accent" : ""
                  }`}
                />
              </Button>
            </div>

            {/* Trust badges */}
            <div className="border rounded-xl p-4 space-y-3 bg-card">
              {[
                {
                  icon: Truck,
                  label: "Frete grátis",
                  desc: "Para compras acima de R$ 99",
                },
                {
                  icon: Shield,
                  label: "Garantia de 6 meses",
                  desc: "Contra defeitos de fabricação",
                },
                {
                  icon: RotateCcw,
                  label: "Troca grátis",
                  desc: "Até 30 dias após a compra",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground block">
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-20 mb-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
                Você também pode gostar
              </h2>
              <Link
                to="/"
                className="text-sm text-primary hover:underline font-medium"
              >
                Ver todos
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default ProductDetail;
