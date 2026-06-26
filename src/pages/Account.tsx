import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Package,
  LogOut,
  ShoppingBag,
  Calendar,
  CreditCard,
  MapPin,
  ChevronDown,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Copy,
  Mail,
  Phone,
  TrendingUp,
  QrCode,
  Barcode,
} from "lucide-react";
import { register, login, logout as authLogout, fetchAccount, forgotPassword } from "@/services/auth";
import { fetchMyOrders, Order } from "@/services/orders";
import { ApiError, getAuthToken } from "@/services/api";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import PayOrderDialog from "@/components/PayOrderDialog";
import { trackCompleteRegistration } from "@/services/metaPixel";

const Account = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { email?: string; signUp?: boolean } | null;

  // Assume logado se há token (evita flash do formulário de login enquanto
  // /account responde — pode levar 1-6s no servidor frio). Se o token for
  // inválido, o useEffect abaixo desloga.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!getAuthToken());
  const [isSignUp, setIsSignUp] = useState(locationState?.signUp ?? false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [payOrderTarget, setPayOrderTarget] = useState<Order | null>(null);
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phone: "",
    postcode: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    email: locationState?.email ?? "",
    password: "",
    confirmPassword: "",
  });

  // Verificar se já está logado ao carregar a página
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await fetchAccount();
        setIsLoggedIn(true);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  // Carregar dados do usuário e pedidos quando logado
  useEffect(() => {
    if (isLoggedIn) {
      loadUserData();
      loadOrders();
    }
  }, [isLoggedIn]);

  const loadUserData = async () => {
    try {
      const account = await fetchAccount();
      setUserData({
        name: account.user.name || "",
        email: account.user.email || "",
        phone: account.billing?.phone || "",
        postcode: account.billing?.postcode || "",
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await fetchMyOrders();
      setOrders(data);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogout = () => {
    authLogout();
    setIsLoggedIn(false);
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: Implementar endpoint de atualização de perfil no backend
      toast.success("Dados atualizados com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!formData.email) {
          toast.error("Informe seu e-mail");
          setLoading(false);
          return;
        }
        await forgotPassword(formData.email);
        toast.success(
          "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
        );
        setIsForgotPassword(false);
        return;
      }

      if (isSignUp) {
        // Validar senhas
        if (formData.password !== formData.confirmPassword) {
          toast.error("As senhas não coincidem");
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          toast.error("A senha deve ter no mínimo 6 caracteres");
          setLoading(false);
          return;
        }

        // Registrar novo usuário
        await register(formData.name, formData.email, formData.password);
        // CompleteRegistration (Meta Pixel + CAPI)
        void trackCompleteRegistration({
          method: "email",
          userData: { email: formData.email, country: "br" },
        });
        toast.success("Conta criada com sucesso!");
        setIsLoggedIn(true);
      } else {
        // Login
        await login(formData.email, formData.password);
        toast.success("Login realizado com sucesso!");
        setIsLoggedIn(true);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "email_exists") {
        toast.error("Este e-mail já tem conta. Faça login abaixo.", {
          action: {
            label: "Fazer login",
            onClick: () => setIsSignUp(false),
          },
        });
        setIsSignUp(false);
      } else {
        const message = error instanceof Error ? error.message : "Erro ao processar solicitação";
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleUserDataChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace(".", ",")}`;
  };

  if (!isLoggedIn) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold">
              {isForgotPassword
                ? "Recuperar senha"
                : isSignUp
                ? "Criar Conta"
                : "Entrar"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isForgotPassword
                ? "Informe seu e-mail e enviaremos um link para você redefinir a senha."
                : isSignUp && locationState?.email
                ? "Crie sua senha para acessar seus pedidos"
                : isSignUp
                ? "Crie sua conta e aproveite benefícios exclusivos"
                : "Acesse sua conta para acompanhar pedidos"}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {isSignUp && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Paulo cliente conta teste"
                  value={formData.name}
                  onChange={handleChange("name")}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange("email")}
                required
              />
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange("password")}
                  required
                />
              </div>
            )}

            {isSignUp && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  required
                />
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Processando..."
                : isForgotPassword
                ? "Enviar link de redefinição"
                : isSignUp
                ? "Criar Conta"
                : "Entrar"}
            </Button>

            {isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="block w-full text-center text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                Voltar para o login
              </button>
            )}
          </form>

          {!isForgotPassword && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">ou</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <GoogleLoginButton
                text={isSignUp ? "signup_with" : "continue_with"}
                disabled={loading}
                onSuccess={() => setIsLoggedIn(true)}
              />

              <p className="text-center text-sm text-muted-foreground mt-4">
                {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary font-medium hover:underline"
                >
                  {isSignUp ? "Entrar" : "Criar conta"}
                </button>
              </p>
            </>
          )}

          {!isSignUp && !isForgotPassword && (
            <div className="mt-6 border rounded-lg p-4 bg-secondary/40 flex gap-3 items-start text-sm text-muted-foreground">
              <ShoppingBag className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <p>
                Fez um pedido como visitante?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary font-medium hover:underline"
                >
                  Crie sua senha
                </button>{" "}
                usando o mesmo e-mail do pedido para acessar seus pedidos.
              </p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  const totalSpent = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "failed")
    .reduce((sum, o) => sum + o.total, 0);
  const deliveredOrders = orders.filter((o) => o.status === "completed").length;
  const pendingOrders = orders.filter((o) => ["pending", "on-hold"].includes(o.status)).length;

  const initials = (userData.name || "C")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const statusConfig: Record<string, { icon: typeof CheckCircle2; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
    completed: { icon: CheckCircle2, variant: "default", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
    processing: { icon: Truck, variant: "default", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
    "on-hold": { icon: Clock, variant: "secondary", color: "bg-gold/10 text-gold-foreground border-gold/30" },
    pending: { icon: Clock, variant: "secondary", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    cancelled: { icon: XCircle, variant: "destructive", color: "bg-destructive/10 text-destructive border-destructive/30" },
    failed: { icon: XCircle, variant: "destructive", color: "bg-destructive/10 text-destructive border-destructive/30" },
    refunded: { icon: XCircle, variant: "outline", color: "bg-muted text-muted-foreground border-border" },
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 md:p-8 mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_white,_transparent_60%)] opacity-10" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl md:text-3xl font-bold font-display border-2 border-white/30">
                {initials}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80">Bem-vindo(a)</p>
                <h1 className="font-display text-2xl md:text-3xl font-bold">
                  {userData.name || "Cliente"}
                </h1>
                <p className="text-sm opacity-80 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {userData.email}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              className="gap-2 self-start md:self-auto bg-white/15 backdrop-blur-sm border-white/30 text-primary-foreground hover:bg-white/25"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>

          {/* Stats */}
          <div className="relative grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/20">
            <div>
              <p className="text-xs uppercase opacity-70 mb-1 flex items-center gap-1">
                <Package className="h-3 w-3" /> Pedidos
              </p>
              <p className="text-xl md:text-2xl font-bold">{orders.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase opacity-70 mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Total gasto
              </p>
              <p className="text-xl md:text-2xl font-bold">{formatPrice(totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs uppercase opacity-70 mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pendentes
              </p>
              <p className="text-xl md:text-2xl font-bold">{pendingOrders}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="pedidos">
          <TabsList className="mb-6 bg-secondary/60 p-1 h-auto">
            <TabsTrigger value="pedidos" className="gap-2 data-[state=active]:bg-background">
              <Package className="h-4 w-4" />
              Pedidos
              {orders.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px]">
                  {orders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="dados" className="gap-2 data-[state=active]:bg-background">
              <User className="h-4 w-4" /> Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos">
            {loadingOrders ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border rounded-xl p-5 bg-card animate-pulse">
                    <div className="h-4 bg-muted rounded w-24 mb-2" />
                    <div className="h-3 bg-muted rounded w-40 mb-4" />
                    <div className="flex gap-3">
                      <div className="h-14 w-14 bg-muted rounded" />
                      <div className="flex-1">
                        <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-card">
                <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-display text-lg font-bold mb-1">Nenhum pedido ainda</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                  Que tal dar uma olhada na nossa coleção e encontrar algo especial?
                </p>
                <Button size="lg" onClick={() => navigate("/shop")} className="gap-2">
                  <ShoppingBag className="h-4 w-4" /> Ir às compras
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map((order) => {
                  const cfg = statusConfig[order.status] ?? statusConfig.pending;
                  const StatusIcon = cfg.icon;
                  const isExpanded = expandedOrderId === order.id;
                  const previewImages = order.items.filter((i) => i.image).slice(0, 3);

                  return (
                    <div
                      key={order.id}
                      className="border rounded-xl bg-card overflow-hidden transition-all hover:shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex -space-x-3">
                              {previewImages.length > 0 ? (
                                previewImages.map((item, idx) => (
                                  <img
                                    key={idx}
                                    src={item.image!}
                                    alt={item.name}
                                    className="w-12 h-12 rounded-lg object-cover border-2 border-card"
                                  />
                                ))
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center border-2 border-card">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              {order.items.length > 3 && (
                                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center border-2 border-card text-xs font-bold text-muted-foreground">
                                  +{order.items.length - 3}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-display font-bold text-foreground">
                                Pedido #{order.id}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <Calendar className="h-3 w-3" />
                                {formatDate(order.createdAt)}
                                <span>·</span>
                                <span>
                                  {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-display text-lg font-bold text-foreground leading-tight">
                                {formatPrice(order.total)}
                              </p>
                              <div
                                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mt-1 ${cfg.color}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {order.statusLabel}
                              </div>
                            </div>
                            <ChevronDown
                              className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-secondary/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          {/* PIX pendente — QR Code inline */}
                          {["pending", "on-hold"].includes(order.status) &&
                            order.paymentMethod?.includes("pix") &&
                            order.payment?.qr_code_base64 && (
                              <div className="border-2 border-pix/30 bg-pix/5 rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2 text-pix font-semibold">
                                  <QrCode className="h-5 w-5" />
                                  <span>Pague com PIX para concluir</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                                  <img
                                    src={
                                      order.payment.qr_code_base64.startsWith("data:")
                                        ? order.payment.qr_code_base64
                                        : `data:image/png;base64,${order.payment.qr_code_base64}`
                                    }
                                    alt="QR Code PIX"
                                    className="w-44 h-44 rounded-lg bg-white p-2 shrink-0"
                                  />
                                  <div className="flex-1 w-full space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                      Escaneie o QR Code no app do seu banco ou copie o código:
                                    </p>
                                    {order.payment.qr_code && (
                                      <>
                                        <input
                                          readOnly
                                          value={order.payment.qr_code}
                                          className="w-full text-xs bg-background border rounded px-2 py-1.5 font-mono truncate"
                                          onFocus={(e) => e.currentTarget.select()}
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="w-full gap-2"
                                          onClick={() => {
                                            navigator.clipboard.writeText(order.payment!.qr_code!);
                                            toast.success("Código PIX copiado!");
                                          }}
                                        >
                                          <Copy className="h-3.5 w-3.5" /> Copiar código PIX
                                        </Button>
                                      </>
                                    )}
                                    {order.payment.expires_at && (
                                      <p className="text-xs text-muted-foreground pt-1">
                                        Válido até:{" "}
                                        <span className="font-medium text-foreground">
                                          {new Date(order.payment.expires_at).toLocaleString("pt-BR")}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* Boleto pendente */}
                          {["pending", "on-hold"].includes(order.status) &&
                            order.payment?.boleto_url && (
                              <div className="border rounded-xl p-4 space-y-3 bg-card">
                                <div className="flex items-center gap-2 font-semibold">
                                  <Barcode className="h-5 w-5 text-primary" />
                                  <span>Boleto em aberto</span>
                                </div>
                                {order.payment.boleto_barcode && (
                                  <p className="text-xs font-mono break-all bg-secondary rounded p-2">
                                    {order.payment.boleto_barcode}
                                  </p>
                                )}
                                <a
                                  href={order.payment.boleto_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Button size="sm" className="w-full gap-2">
                                    <Barcode className="h-4 w-4" /> Abrir boleto
                                  </Button>
                                </a>
                              </div>
                            )}

                          {/* Items */}
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Itens do pedido
                            </h4>
                            <div className="space-y-2">
                              {order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex gap-3 items-center bg-card rounded-lg p-3 border"
                                >
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-14 h-14 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded bg-secondary flex items-center justify-center">
                                      <Package className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                                      {item.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Qtd: {item.quantity} · {formatPrice(item.price)} un
                                    </p>
                                  </div>
                                  <span className="text-sm font-bold text-foreground shrink-0">
                                    {formatPrice(item.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Info grid */}
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="bg-card rounded-lg p-3 border">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                <CreditCard className="h-3 w-3" /> Pagamento
                              </p>
                              <p className="text-sm font-medium">{order.paymentTitle || "—"}</p>
                              <p className="text-sm font-bold text-foreground mt-1">
                                {formatPrice(order.total)}
                              </p>
                            </div>
                            <div className="bg-card rounded-lg p-3 border">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" /> Entrega
                              </p>
                              <p className="text-sm text-foreground line-clamp-2">
                                {order.billing.address}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {order.billing.city} - {order.billing.state} · {order.billing.postcode}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                navigator.clipboard.writeText(String(order.id));
                                toast.success("Número do pedido copiado!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" /> Copiar nº do pedido
                            </Button>
                            {["pending", "on-hold"].includes(order.status) && (
                              <Button
                                size="sm"
                                className="gap-2"
                                onClick={() => setPayOrderTarget(order)}
                              >
                                <CreditCard className="h-3.5 w-3.5" /> Pagar agora
                              </Button>
                            )}
                            <a
                              href={`https://wa.me/?text=Olá! Gostaria de saber sobre meu pedido #${order.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button size="sm" variant="ghost" className="gap-2">
                                <Phone className="h-3.5 w-3.5" /> Suporte
                              </Button>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dados">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <div className="border rounded-xl p-5 bg-card space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">Dados pessoais</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mantenha seus dados atualizados para agilizar a entrega e a comunicação.
                    </p>
                  </div>
                  <div className="pt-2 border-t space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      {deliveredOrders} pedidos entregues
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Membro Wesley Bijoux
                    </div>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleUpdateProfile}
                className="md:col-span-2 border rounded-xl p-6 bg-card space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Nome completo</Label>
                    <Input
                      id="userName"
                      value={userData.name}
                      onChange={handleUserDataChange("name")}
                      placeholder="Nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">E-mail</Label>
                    <Input
                      id="userEmail"
                      value={userData.email}
                      onChange={handleUserDataChange("email")}
                      placeholder="E-mail"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userPhone">Telefone</Label>
                    <Input
                      id="userPhone"
                      value={userData.phone}
                      onChange={handleUserDataChange("phone")}
                      placeholder="(11) 98765-4321"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userCep">CEP</Label>
                    <Input
                      id="userCep"
                      value={userData.postcode}
                      onChange={handleUserDataChange("postcode")}
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {payOrderTarget && (
        <PayOrderDialog
          order={payOrderTarget}
          open={!!payOrderTarget}
          onOpenChange={(o) => {
            if (!o) setPayOrderTarget(null);
          }}
          onPaid={loadOrders}
        />
      )}
    </Layout>
  );
};

export default Account;
