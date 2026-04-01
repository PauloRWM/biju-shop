import { useParams, Link } from "react-router-dom";
import { products } from "@/data/products";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Heart, ChevronLeft, Star, Truck, Shield } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";

const ProductDetail = () => {
  const { id } = useParams();
  const product = products.find((p) => p.id === id);
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold mb-4">Produto não encontrado</h1>
          <Link to="/">
            <Button>Voltar à loja</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Início
          </Link>
          <span>/</span>
          <span>{product.category}</span>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <div className="aspect-square rounded-xl overflow-hidden bg-secondary/30 mb-3">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col"
          >
            {product.badge && (
              <span className="inline-block bg-accent text-accent-foreground text-xs font-semibold px-2.5 py-1 rounded-full w-fit mb-3">
                {product.badge}
              </span>
            )}

            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              {product.name}
            </h1>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < Math.floor(product.rating) ? "fill-gold text-gold" : "text-muted"}`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {product.rating} ({product.reviews} avaliações)
              </span>
            </div>

            <div className="mb-6 space-y-1">
              <div className="flex items-baseline gap-3">
                {product.originalPrice && (
                  <span className="text-base text-muted-foreground line-through">
                    R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                  </span>
                )}
                {discount && (
                  <span className="text-xs font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-md">
                    -{discount}% OFF
                  </span>
                )}
              </div>
              <span className="text-3xl font-bold text-foreground block">
                R$ {product.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-base font-semibold text-green-600 block">
                R$ {(product.price * 0.9).toFixed(2).replace(".", ",")} no PIX (10% off)
              </span>
              <span className="text-sm text-muted-foreground block">
                ou 3x de R$ {(product.price / 3).toFixed(2).replace(".", ",")} sem juros no cartão
              </span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {product.description}
            </p>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Material:</span>
                <span className="font-medium text-foreground">{product.material}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Cores:</span>
                <span className="font-medium text-foreground">{product.colors.join(", ")}</span>
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-muted-foreground">Quantidade:</span>
              <div className="flex items-center border rounded-md">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  −
                </button>
                <span className="px-4 py-1.5 text-sm font-medium border-x">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <Button
                size="lg"
                className="flex-1 gap-2"
                disabled={!product.inStock}
                onClick={() => {
                  for (let i = 0; i < qty; i++) addItem(product);
                }}
              >
                <ShoppingBag className="h-5 w-5" />
                {product.inStock ? "Adicionar ao Carrinho" : "Esgotado"}
              </Button>
              <Button size="lg" variant="outline" className="px-4">
                <Heart className="h-5 w-5" />
              </Button>
            </div>

            {/* Trust */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">Frete grátis acima de R$ 99</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">Garantia de 6 meses</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6">
              Você também pode gostar
            </h2>
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
