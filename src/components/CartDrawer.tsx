import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight } from "lucide-react";

const CartDrawer = () => {
  const { items, removeItem, updateQuantity, totalItems, totalPrice, isOpen, openCart, closeCart } = useCart();

  const pixTotal = totalPrice * 0.9;

  return (
    <Sheet open={isOpen} onOpenChange={(v) => v ? openCart() : closeCart()}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" onClick={openCart}>
          <ShoppingBag className="h-5 w-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex flex-col w-full sm:max-w-md p-0 h-full">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-display text-xl">
            Carrinho ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground text-center">Seu carrinho está vazio</p>
            <SheetClose asChild>
              <Link to="/">
                <Button variant="outline">
                  Continuar comprando
                </Button>
              </Link>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={`${item.product.id}-${item.variationId ?? 0}`}
                    className="flex gap-4 pb-4 border-b last:border-0"
                  >
                    <Link to={`/produto/${item.product.id}`} className="shrink-0" onClick={closeCart}>
                      <img
                        src={item.product.images_thumb?.[0] ?? item.product.images[0]}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div>
                        <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-tight mb-1">
                          {item.product.name}
                        </h4>
                        <p className="text-base font-bold text-foreground">
                          R$ {(item.product.price * item.quantity).toFixed(2).replace(".", ",")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center border rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variationId)}
                            className="p-2 hover:bg-muted transition-colors"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="px-4 text-sm font-medium min-w-[2.5rem] text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variationId)}
                            disabled={
                              typeof item.product.stockQuantity === "number" &&
                              item.product.stockQuantity >= 0 &&
                              item.quantity >= item.product.stockQuantity
                            }
                            className="p-2 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.product.id, item.variationId)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t px-6 py-5 space-y-4 shrink-0 bg-background">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-base font-bold text-foreground">
                    R$ {totalPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img src="/icons8-pix.svg" alt="PIX" className="w-4 h-4" />
                    <span className="text-sm font-semibold text-[#32BCAD]">No PIX (10% OFF)</span>
                  </div>
                  <span className="text-lg font-bold text-[#32BCAD]">
                    R$ {pixTotal.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>

              <SheetClose asChild>
                <Link to="/checkout" className="block">
                  <Button className="w-full gap-2 h-11" size="lg">
                    Finalizar Compra <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </SheetClose>

              <div className="flex gap-2">
                <SheetClose asChild>
                  <Link to="/carrinho" className="flex-1">
                    <Button variant="outline" className="w-full h-10">
                      Ver carrinho
                    </Button>
                  </Link>
                </SheetClose>

                <SheetClose asChild>
                  <Button variant="ghost" className="flex-1 h-10">
                    Continuar comprando
                  </Button>
                </SheetClose>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
