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

      <SheetContent className="flex flex-col w-full sm:max-w-md !p-0 h-full overflow-hidden">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="font-display text-lg">
            Carrinho ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Seu carrinho está vazio</p>
            <SheetClose asChild>
              <Link to="/">
                <Button variant="outline" size="sm">
                  Continuar comprando
                </Button>
              </Link>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 rounded-lg border p-2.5"
                >
                  <Link to={`/produto/${item.product.id}`} className="shrink-0">
                    <SheetClose asChild>
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md"
                      />
                    </SheetClose>
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                        {item.product.name}
                      </h4>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        R$ {(item.product.price * item.quantity).toFixed(2).replace(".", ",")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center border rounded-md">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t px-4 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground">
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-pix font-semibold">No PIX</span>
                <span className="text-pix font-bold">
                  R$ {pixTotal.toFixed(2).replace(".", ",")}
                </span>
              </div>

              <SheetClose asChild>
                <Link to="/checkout" className="block">
                  <Button className="w-full gap-2" size="lg">
                    Finalizar Compra <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </SheetClose>

              <SheetClose asChild>
                <Link to="/carrinho" className="block">
                  <Button variant="outline" className="w-full" size="sm">
                    Ver carrinho completo
                  </Button>
                </Link>
              </SheetClose>

              <SheetClose asChild>
                <button className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                  Continuar comprando
                </button>
              </SheetClose>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
