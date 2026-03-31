import { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Package, Heart, LogOut } from "lucide-react";

const mockOrders = [
  { id: "LUM-84521", date: "28/03/2026", status: "Entregue", total: "R$ 89,90", items: 2 },
  { id: "LUM-73102", date: "15/03/2026", status: "Em trânsito", total: "R$ 134,80", items: 3 },
  { id: "LUM-61893", date: "02/03/2026", status: "Entregue", total: "R$ 49,90", items: 1 },
];

const Account = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  if (!isLoggedIn) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md">
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
                : "Acesse sua conta para acompanhar pedidos"}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsLoggedIn(true);
            }}
            className="space-y-4"
          >
            {isSignUp && <Input placeholder="Nome completo" required />}
            <Input type="email" placeholder="E-mail" required />
            <Input type="password" placeholder="Senha" required />
            {isSignUp && <Input type="password" placeholder="Confirmar senha" required />}
            <Button className="w-full" size="lg" type="submit">
              {isSignUp ? "Criar Conta" : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Minha Conta</h1>
            <p className="text-sm text-muted-foreground">Olá, Maria! 👋</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsLoggedIn(false)} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>

        <Tabs defaultValue="pedidos">
          <TabsList className="mb-6">
            <TabsTrigger value="pedidos" className="gap-2">
              <Package className="h-4 w-4" /> Pedidos
            </TabsTrigger>
            <TabsTrigger value="dados" className="gap-2">
              <User className="h-4 w-4" /> Dados
            </TabsTrigger>
            <TabsTrigger value="favoritos" className="gap-2">
              <Heart className="h-4 w-4" /> Favoritos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos">
            <div className="space-y-3">
              {mockOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 bg-card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Pedido #{order.id}</p>
                    <p className="text-xs text-muted-foreground">{order.date} · {order.items} {order.items === 1 ? "item" : "itens"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{order.total}</p>
                    <span className={`text-xs font-medium ${order.status === "Entregue" ? "text-primary" : "text-gold"}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="dados">
            <div className="border rounded-lg p-6 bg-card max-w-lg space-y-4">
              <Input defaultValue="Maria Silva" placeholder="Nome" />
              <Input defaultValue="maria@email.com" placeholder="E-mail" />
              <Input defaultValue="(11) 99999-9999" placeholder="Telefone" />
              <Input defaultValue="01310-100" placeholder="CEP" />
              <Button>Salvar Alterações</Button>
            </div>
          </TabsContent>

          <TabsContent value="favoritos">
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Você ainda não tem favoritos.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Account;
