import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Package,
  Heart,
  LogOut,
  Eye,
  EyeOff,
  Loader2,
  ShoppingBag,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { login, register, logout, fetchAccount, type AuthUser } from "@/services/auth";
import { getAuthToken } from "@/services/api";
import { fetchMyOrders, type Order } from "@/services/orders";

// ---------------------------------------------------------------------------
// Helpers

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending:    { label: "Aguardando pagamento", icon: Clock,         className: "text-orange-500 bg-orange-50 border-orange-200" },
  processing: { label: "Em processamento",     icon: Loader2,       className: "text-blue-600 bg-blue-50 border-blue-200" },
  "on-hold":  { label: "Em espera",            icon: AlertCircle,   className: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  completed:  { label: "Entregue",             icon: CheckCircle2,  className: "text-green-700 bg-green-50 border-green-200" },
  cancelled:  { label: "Cancelado",            icon: XCircle,       className: "text-red-600 bg-red-50 border-red-200" },
  refunded:   { label: "Reembolsado",          icon: XCircle,       className: "text-gray-600 bg-gray-50 border-gray-200" },
  failed:     { label: "Falhou",               icon: XCircle,       className: "text-red-600 bg-red-50 border-red-200" },
};

function getStatus(order: Order) {
  return statusConfig[order.status] ?? {
    label: order.statusLabel || order.status,
    icon: AlertCircle,
    className: "text-muted-foreground bg-muted border-border",
  };
}

// ---------------------------------------------------------------------------
// Order card

function OrderCard({ order }: { order: Order }) {
  const status = getStatus(order);
  const StatusIcon = status.icon;

  return (
    <div className="border rounded-xl bg-card overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-3">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Pedido #{order.id}</span>
          <span className="text-xs text-muted-foreground hidden sm:block">
            · {formatDate(order.createdAt)}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${status.className}`}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {/* Items preview */}
      {order.items.length > 0 && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex -space-x-2">
            {order.items.slice(0, 3).map((item, i) =>
              item.image ? (
                <img
                  key={i}
                  src={item.image}
                  alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover border-2 border-background"
                />
              ) : (
                <div
                  key={i}
                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center border-2 border-background"
                >
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </div>
              ),
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">
              {order.items.map((i) => i.name).join(", ")}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.items.reduce((sum, i) => sum + i.quantity, 0)} {order.items.reduce((sum, i) => sum + i.quantity, 0) === 1 ? "item" : "itens"}
              · {order.paymentTitle}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
        <div>
          <span className="text-xs text-muted-foreground">Total</span>
          <p className="text-sm font-bold text-foreground">{formatCurrency(order.total)}</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-primary text-xs">
          Ver detalhes <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders list (uses TanStack Query – only rendered when logged in)

function OrdersList() {
  const { data: orders, isLoading, isError, error } = useQuery({
    queryKey: ["my-orders"],
    queryFn: fetchMyOrders,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 border rounded-xl bg-card">
        <AlertCircle className="h-10 w-10 text-destructive/60 mx-auto mb-3" />
        <p className="font-medium text-sm">Não foi possível carregar os pedidos.</p>
        <p className="text-xs text-muted-foreground mt-1">
          {(error as Error)?.message ?? "Tente novamente mais tarde."}
        </p>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-16 border rounded-xl bg-card">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="font-medium text-foreground mb-1">Nenhum pedido encontrado</p>
        <p className="text-sm text-muted-foreground">Suas compras aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password input with toggle

function PasswordInput({
  name,
  placeholder,
  required,
}: {
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        required={required}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component

const Account = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Restore session from token on mount
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      fetchAccount()
        .then(({ user: u }) => setUser(u))
        .catch(() => {})
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (data) => {
      setUser(data.user);
      toast.success(`Bem-vindo(a) de volta, ${data.user.firstName || data.user.name}!`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "E-mail ou senha incorretos.");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      register(payload.name, payload.email, payload.password),
    onSuccess: (data) => {
      setUser(data.user);
      toast.success("Conta criada com sucesso! Bem-vindo(a)!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar conta. Tente novamente.");
    },
  });

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    loginMutation.mutate({
      email: form.get("email") as string,
      password: form.get("password") as string,
    });
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirmPassword") as string;
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    registerMutation.mutate({
      name: form.get("name") as string,
      email: form.get("email") as string,
      password,
    });
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    toast.success("Você saiu com sucesso.");
  };

  // ---------------------------------------------------------------------------
  // Checking session spinner

  if (checkingSession) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // ---------------------------------------------------------------------------
  // Auth forms (login / register)

  if (!user) {
    const isPending = loginMutation.isPending || registerMutation.isPending;

    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-sm">
          {/* Icon + title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold">
              {isSignUp ? "Criar Conta" : "Entrar"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp
                ? "Crie sua conta e aproveite benefícios exclusivos"
                : "Acesse sua conta para acompanhar seus pedidos"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={isSignUp ? handleRegister : handleLogin} className="space-y-3">
            {isSignUp && (
              <Input
                name="name"
                placeholder="Nome completo"
                required
                disabled={isPending}
                autoComplete="name"
              />
            )}
            <Input
              type="email"
              name="email"
              placeholder="E-mail"
              required
              disabled={isPending}
              autoComplete="email"
            />
            <PasswordInput name="password" placeholder="Senha" required />
            {isSignUp && (
              <PasswordInput name="confirmPassword" placeholder="Confirmar senha" required />
            )}

            {!isSignUp && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isSignUp ? "Criando conta…" : "Entrando…"}
                </>
              ) : isSignUp ? (
                "Criar Conta"
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            {isSignUp ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp((s) => !s)}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Entrar" : "Criar conta grátis"}
            </button>
          </p>

          {/* Trust note */}
          <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
            Ao continuar, você concorda com nossos{" "}
            <span className="underline cursor-pointer">Termos de Uso</span> e{" "}
            <span className="underline cursor-pointer">Política de Privacidade</span>.
          </p>
        </div>
      </Layout>
    );
  }

  // ---------------------------------------------------------------------------
  // Logged-in view

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Minha Conta</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Olá, {user.firstName || user.name}! Que bom te ver por aqui.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pedidos">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="pedidos" className="gap-2 flex-1 sm:flex-none">
              <Package className="h-4 w-4" /> Pedidos
            </TabsTrigger>
            <TabsTrigger value="dados" className="gap-2 flex-1 sm:flex-none">
              <User className="h-4 w-4" /> Meus Dados
            </TabsTrigger>
            <TabsTrigger value="favoritos" className="gap-2 flex-1 sm:flex-none">
              <Heart className="h-4 w-4" /> Favoritos
            </TabsTrigger>
          </TabsList>

          {/* Pedidos */}
          <TabsContent value="pedidos">
            <OrdersList />
          </TabsContent>

          {/* Dados */}
          <TabsContent value="dados">
            <div className="border rounded-xl p-6 bg-card max-w-lg space-y-4">
              <div>
                <h2 className="font-semibold text-base mb-1">Informações pessoais</h2>
                <p className="text-xs text-muted-foreground">Seus dados cadastrais na loja.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Nome completo
                  </label>
                  <Input
                    defaultValue={user.name || `${user.firstName} ${user.lastName}`.trim()}
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    E-mail
                  </label>
                  <Input defaultValue={user.email} type="email" placeholder="E-mail" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Telefone
                  </label>
                  <Input placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    CEP
                  </label>
                  <Input placeholder="00000-000" />
                </div>
              </div>

              <Button className="w-full sm:w-auto">Salvar Alterações</Button>
            </div>
          </TabsContent>

          {/* Favoritos */}
          <TabsContent value="favoritos">
            <div className="text-center py-16 border rounded-xl bg-card">
              <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Nenhum favorito ainda</p>
              <p className="text-sm text-muted-foreground mb-4">
                Salve suas peças preferidas para encontrá-las facilmente.
              </p>
              <Button variant="outline" asChild>
                <a href="/">Explorar produtos</a>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Account;
