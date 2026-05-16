import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Lock, ShieldCheck, MessageCircle, Mail, Database } from "lucide-react";

const Privacidade = () => (
  <Layout>
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
          Segurança e Privacidade
        </h1>
        <p className="text-muted-foreground">
          A Wesley Bijoux garante total sigilo e proteção dos dados fornecidos
          em nosso site.
        </p>
      </div>

      <div className="space-y-6 text-foreground/80 leading-relaxed">
        <section className="bg-background border border-border/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">
              Como utilizamos seus dados
            </h2>
          </div>
          <p>
            Todas as informações são utilizadas exclusivamente para
            processamento de pedidos, faturamento, envio e atendimento ao
            cliente, <strong>não sendo disponibilizadas, cedidas ou
            comercializadas a terceiros</strong>.
          </p>
          <p className="mt-3">
            Os dados cadastrados são armazenados com segurança e utilizados
            apenas para comunicações relacionadas às compras realizadas. Com
            autorização prévia, poderemos enviar ofertas e novidades — e você
            poderá cancelar o recebimento a qualquer momento.
          </p>
        </section>

        <section className="bg-background border border-border/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">
              Loja 100% segura
            </h2>
          </div>
          <p>
            Utilizamos criptografia SSL e protocolos seguros em todas as
            transações para proteger suas informações pessoais e de pagamento.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(38,60%,95%)] rounded-lg border border-border/30">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">SSL Seguro</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(38,60%,95%)] rounded-lg border border-border/30">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Compra Protegida</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(38,60%,95%)] rounded-lg border border-border/30">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Dados Sigilosos</span>
            </div>
          </div>
        </section>

        <section className="bg-[hsl(38,60%,95%)] border border-border/50 rounded-2xl p-6 md:p-8 text-center">
          <h2 className="font-display text-xl font-bold mb-2">
            Em caso de dúvidas
          </h2>
          <p className="text-muted-foreground mb-5">
            Nossa equipe está à disposição via WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="gap-2">
              <a
                href="https://wa.me/5511945189988"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
                (11) 94518-9988
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <a href="mailto:wesleybijoux@gmail.com">
                <Mail className="h-4 w-4" />
                E-mail
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Wesley Bijoux — Atacado de Bijuterias e Folheados
          </p>
        </section>
      </div>
    </div>
  </Layout>
);

export default Privacidade;
