import { useParams, Link, useNavigate } from "react-router-dom";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { products as fallbackProducts } from "@/data/products";
import Layout from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { calculateShippingViaWoo, type ShippingMethod } from "@/services/shipping";
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  Star,
  Truck,
  Share2,
  Check,
  CreditCard,
  Zap,
  Truck as TruckIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "sonner";
import { trackAddToCart, trackViewContent } from "@/services/metaPixel";

// Converte nome de atributo para chave usada nas variations (formato Woo)
// ex: "pa_letra" -> "attribute_pa_letra", "Cor" -> "attribute_cor"
const attrKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const ProductDetail = () => {
  const { id } = useParams();
  const { data: apiProduct, isLoading, isError, error } = useProduct(id);
  // Se o servidor respondeu 404, o produto foi removido/despublicado.
  // Não tentamos o fallback local nesse caso, pra evitar mostrar um
  // produto fantasma com ID coincidente.
  const isNotFound =
    isError && (error as { status?: number } | null)?.status === 404;
  const product = apiProduct ?? (isError && !isNotFound ? fallbackProducts.find((p) => p.id === id) : undefined);
  const { data: relatedPage } = useProducts({
    category: product?.category,
    per_page: 5,
  });
  const { addItem, items, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(0);
  const [liked, setLiked] = useState(false);
  const [cep, setCep] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingMethod[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedImage(0);
    setQty(0);
    setSelectedAttrs({});
  }, [id]);

  useEffect(() => {
    if (!product) return;
    trackViewContent({
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
    });
  }, [product?.id]);

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
        <div className="container mx-auto max-w-7xl px-4 lg:px-8 py-16 text-center">
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

  const variationAttrs = (product.attributes ?? []).filter((a) => a.variation);
  const hasVariations = (product.variations?.length ?? 0) > 0;

  const matchedVariation = (() => {
    if (!hasVariations) return null;
    return (
      product.variations!.find((v) =>
        Object.entries(v.attributes).every(([k, val]) => {
          const sel = selectedAttrs[k];
          // val pode ser slug ou string vazia (qualquer valor)
          if (!val) return true;
          return sel && sel.toLowerCase() === String(val).toLowerCase();
        }),
      ) ?? null
    );
  })();

  const effectivePrice = matchedVariation?.price ?? product.price;
  const effectiveInStock = matchedVariation
    ? matchedVariation.inStock
    : product.inStock;

  const variationLabel = matchedVariation
    ? variationAttrs
        .map((a) => {
          const slug = selectedAttrs[`attribute_${attrKey(a.name)}`];
          const label = a.slug_to_label?.[slug ?? ""] ?? slug ?? "";
          return `${a.label}: ${label}`;
        })
        .filter(Boolean)
        .join(" / ")
    : undefined;

  // Quantidade já existente no carrinho para esta combinação produto+variação.
  // Quando o usuário toca +/− atualiza direto o carrinho (sem clicar "Adicionar").
  const cartQty = items
    .filter(
      (i) =>
        i.product.id === product.id &&
        (i.variationId ?? 0) === (matchedVariation?.id ?? 0),
    )
    .reduce((s, i) => s + i.quantity, 0);

  // Display da quantidade: para produto sem variação, sempre o carrinho.
  // Para variável, usa o estado local até o usuário escolher a variação;
  // depois também espelha o carrinho.
  const showCartQty = !hasVariations || !!matchedVariation;
  const displayQty = showCartQty ? cartQty : qty;

  const decQty = () => {
    if (!showCartQty) {
      setQty((q) => Math.max(0, q - 1));
      return;
    }
    updateQuantity(product.id, Math.max(0, cartQty - 1), matchedVariation?.id);
  };

  const incQty = () => {
    if (hasVariations && !matchedVariation) {
      toast.error("Selecione todas as opções antes.");
      return;
    }
    if (cartQty === 0) {
      addItem(product, 1, {
        variationId: matchedVariation?.id,
        variationLabel,
        unitPrice: effectivePrice,
      });
      trackAddToCart({
        productId: product.id,
        name: product.name,
        price: effectivePrice,
        quantity: 1,
      });
    } else {
      updateQuantity(product.id, cartQty + 1, matchedVariation?.id);
    }
  };

  const handleBuyNow = () => {
    if (hasVariations && !matchedVariation) {
      toast.error("Selecione todas as opções antes de comprar.");
      return;
    }
    // Se ainda não há nada no carrinho deste produto, adiciona 1 antes de ir.
    if (cartQty <= 0) {
      addItem(product, 1, {
        variationId: matchedVariation?.id,
        variationLabel,
        unitPrice: effectivePrice,
      });
      trackAddToCart({
        productId: product.id,
        name: product.name,
        price: effectivePrice,
        quantity: 1,
      });
    }
    navigate("/checkout");
  };

  const handleWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const q = Math.max(1, displayQty);
    const msg =
      `Olá! Tenho interesse neste produto:\n\n` +
      `*${product.name}*\n` +
      `Quantidade: ${q}\n` +
      `Valor: R$ ${product.price.toFixed(2).replace(".", ",")}\n` +
      (url ? `\n${url}` : "");
    const wa = `https://wa.me/5511945189988?text=${encodeURIComponent(msg)}`;
    window.open(wa, "_blank");
  };

  const formatCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const handleCalcShipping = async () => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) {
      setShippingError("Digite um CEP válido");
      setShippingOptions([]);
      return;
    }
    setShippingError(null);
    setShippingLoading(true);
    try {
      const opts = await calculateShippingViaWoo(
        clean,
        [{ product_id: Number(product.id), quantity: Math.max(1, qty) }],
        product.price * Math.max(1, qty),
      );
      setShippingOptions(opts);
    } catch {
      setShippingError("Não foi possível calcular o frete agora.");
      setShippingOptions([]);
    } finally {
      setShippingLoading(false);
    }
  };

  const nextImage = () =>
    setSelectedImage((prev) => (prev + 1) % product.images.length);
  const prevImage = () =>
    setSelectedImage(
      (prev) => (prev - 1 + product.images.length) % product.images.length
    );

  return (
    <Layout>
      <div className="container mx-auto max-w-7xl px-4 lg:px-8 py-6 overflow-x-hidden">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground mb-6 min-w-0 overflow-hidden">
          <Link
            to="/"
            className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" /> Início
          </Link>
          <span className="shrink-0">/</span>
          <Link
            to={`/shop?cat=${encodeURIComponent(product.category)}`}
            className="hover:text-foreground transition-colors shrink-0 truncate max-w-[80px] md:max-w-none"
          >
            {product.category}
          </Link>
          <span className="shrink-0">/</span>
          <span className="text-foreground font-medium truncate min-w-0 flex-1">
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
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
              {product.category}
            </p>

            <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-2 leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-gold text-gold"
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                5,0 ({product.reviews || 0} avaliações)
              </span>
            </div>

            {/* Pricing Block */}
            <div className="bg-secondary/40 rounded-lg p-3 mb-3 space-y-1">
              {(product.originalPrice || discount) && (
                <div className="flex items-baseline gap-2">
                  {product.originalPrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  {discount && (
                    <span className="text-[10px] font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                      -{discount}% OFF
                    </span>
                  )}
                </div>
              )}
              <span className="text-2xl md:text-3xl font-bold text-foreground block leading-none">
                R$ {product.price.toFixed(2).replace(".", ",")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-pix">
                  R$ {pixPrice.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-[11px] text-pix font-medium bg-pix/10 px-1.5 py-0.5 rounded">
                  PIX −10%
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" />
                <span>
                  ou 3x de R${" "}
                  {(product.price / 3).toFixed(2).replace(".", ",")} sem juros
                </span>
              </div>
            </div>

            {/* Specs */}
            {(product.material || (product.colors && product.colors.length > 0)) && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {product.material && (
                  <div className="bg-secondary/30 rounded-md px-2.5 py-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                      Material
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {product.material}
                    </span>
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="bg-secondary/30 rounded-md px-2.5 py-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                      Cores
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {product.colors.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Variações */}
            {variationAttrs.length > 0 && (
              <div className="mb-3 space-y-2.5">
                {variationAttrs.map((attr) => {
                  const key = `attribute_${attrKey(attr.name)}`;
                  const selected = selectedAttrs[key];
                  return (
                    <div key={attr.name}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        {attr.label}
                        {selected && (
                          <span className="ml-1 text-foreground font-medium normal-case tracking-normal">
                            : {attr.slug_to_label?.[selected] ?? selected}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(attr.slug_to_label ?? {}).map(([slug, label]) => {
                          const isActive = selected === slug;
                          // Verifica se há variação em estoque pra essa opção
                          const variationForOption = product.variations?.find(
                            (v) => String(v.attributes[key] ?? "").toLowerCase() === slug.toLowerCase(),
                          );
                          const optionInStock = variationForOption
                            ? variationForOption.inStock
                            : true;
                          return (
                            <button
                              key={slug}
                              type="button"
                              onClick={() =>
                                setSelectedAttrs((prev) => ({ ...prev, [key]: slug }))
                              }
                              disabled={!optionInStock}
                              className={`min-w-[2.5rem] h-9 px-3 rounded-md border text-xs font-medium transition-all ${
                                isActive
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-border bg-background hover:border-primary/50"
                              } ${!optionInStock ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Qty + Comprar Agora + Carrinho + WhatsApp — tudo na mesma linha.
                +/− já mexem direto no carrinho (sem botão "adicionar" separado). */}
            <div className="flex items-stretch gap-1.5 mb-3">
              <div className="flex items-center border rounded-md overflow-hidden h-11 shrink-0">
                <button
                  onClick={decQty}
                  disabled={displayQty <= 0}
                  className="px-2 h-full text-sm hover:bg-muted disabled:opacity-40 transition-colors"
                  aria-label="Diminuir"
                >
                  −
                </button>
                <span className="px-1.5 h-full flex items-center text-sm font-bold border-x min-w-[1.75rem] justify-center">
                  {displayQty}
                </span>
                <button
                  onClick={incQty}
                  disabled={!effectiveInStock}
                  className="px-2 h-full text-sm hover:bg-muted disabled:opacity-40 transition-colors"
                  aria-label="Aumentar"
                >
                  +
                </button>
              </div>
              <Button
                className="flex-1 min-w-0 gap-1 h-11 px-1.5 text-[11px] sm:text-xs font-bold shadow-md"
                disabled={!effectiveInStock || (hasVariations && !matchedVariation)}
                onClick={handleBuyNow}
                title="Comprar Agora"
              >
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Comprar</span>
              </Button>
              <button
                type="button"
                onClick={handleWhatsApp}
                disabled={!product.inStock}
                title="Comprar no WhatsApp"
                className="flex-1 min-w-0 h-11 px-1.5 rounded-md bg-[#25D366] hover:bg-[#1ebe5a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current shrink-0" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>
                </svg>
                <span className="truncate">WhatsApp</span>
              </button>
              <Button
                variant="outline"
                className="px-2.5 h-11 shrink-0"
                onClick={() => setLiked(!liked)}
                aria-label="Favoritar"
              >
                <Heart
                  className={`h-4 w-4 ${liked ? "fill-accent text-accent" : ""}`}
                />
              </Button>
            </div>

            {/* Calcular frete */}
            <div className="border rounded-lg p-3 mb-3 bg-card">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                <TruckIcon className="h-3.5 w-3.5 text-primary" />
                Calcular frete e prazo
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(formatCep(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && handleCalcShipping()}
                  className="flex-1 h-9 px-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={9}
                />
                <Button
                  type="button"
                  onClick={handleCalcShipping}
                  disabled={shippingLoading}
                  className="h-9 px-3 text-xs"
                >
                  {shippingLoading ? "..." : "Calcular"}
                </Button>
              </div>
              <a
                href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1.5 text-[11px] text-primary hover:underline"
              >
                Não sei meu CEP
              </a>
              {shippingError && (
                <p className="text-xs text-destructive mt-2">{shippingError}</p>
              )}
              {shippingOptions.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {shippingOptions.map((opt) => (
                    <li
                      key={opt.id}
                      className="flex items-center justify-between text-sm border-t pt-2"
                    >
                      <div>
                        <span className="font-medium text-foreground block">
                          {opt.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {opt.etaDays}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          opt.cost === 0 ? "text-pix" : "text-foreground"
                        }`}
                      >
                        {opt.cost === 0
                          ? "Grátis"
                          : `R$ ${opt.cost.toFixed(2).replace(".", ",")}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Trust badges */}
            <div className="border rounded-lg p-2.5 space-y-1.5 bg-card">
              {[
                {
                  icon: Truck,
                  label: "Frete grátis",
                  desc: "Acima de R$ 1.000 (PAC)",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      · {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Description */}
        {product.description && (
          <section className="mt-14 mb-4 border-t border-border/50 pt-10">
            <h2 className="font-display text-xl md:text-2xl font-light tracking-wide text-foreground mb-5">
              Descrição
            </h2>
            <div
              className="prose prose-sm max-w-3xl text-muted-foreground leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-foreground [&_strong]:font-medium"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-20 mb-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
                Você também pode gostar
              </h2>
              <Link
                to="/shop"
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
