import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Package,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

const TrocasDevolucoes = () => (
  <Layout>
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
          <RefreshCw className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
          Trocas e Devoluções
        </h1>
        <p className="text-muted-foreground">
          Trabalhamos com curadoria criteriosa e controle de qualidade para que
          você receba peças lindas e em perfeito estado.
        </p>
      </div>

      <div className="space-y-6 text-foreground/80 leading-relaxed">
        <section className="bg-background border border-border/50 rounded-2xl p-6 md:p-8">
          <p>
            Antes de finalizar sua compra, recomendamos atenção à descrição,
            materiais e fotos dos produtos, para garantir que sua escolha
            esteja alinhada com suas expectativas.
          </p>
          <p className="mt-3">
            Nosso objetivo é evitar trocas desnecessárias e proporcionar uma
            experiência segura e satisfatória.
          </p>
        </section>

        <section className="bg-background border border-border/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">
              Como solicitar troca ou devolução?
            </h2>
          </div>
          <p>
            Caso realmente seja necessário, a solicitação deve ser feita em até{" "}
            <strong>7 dias corridos</strong> após o recebimento, conforme o
            Código de Defesa do Consumidor.
          </p>
          <p className="mt-3">
            Entre em contato exclusivamente pelo WhatsApp:
          </p>
          <Button asChild size="lg" className="gap-2 mt-4">
            <a
              href="https://wa.me/5511945189988"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              (11) 94518-9988
            </a>
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Solicitações fora do prazo não poderão ser atendidas.
          </p>
        </section>

        <section className="bg-background border border-border/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">
              Condições obrigatórias para análise
            </h2>
          </div>
          <p className="mb-3">
            Para que a troca ou devolução seja aprovada, o produto deve:
          </p>
          <ul className="space-y-2">
            {[
              "Estar sem sinais de uso",
              "Estar com etiqueta intacta",
              "Estar na embalagem original",
              "Não apresentar danos, alterações ou manuseio inadequado",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-1 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Após o recebimento, o produto passará por análise interna. Caso não
            esteja dentro das condições exigidas, será devolvido ao remetente.
          </p>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <h2 className="font-display text-xl font-bold text-amber-900">
              Informações importantes
            </h2>
          </div>
          <ul className="space-y-2.5">
            {[
              "Não realizamos trocas por mau uso.",
              "Não realizamos trocas de produtos em promoção.",
              "Não realizamos trocas por preferência pessoal (modelo, tamanho ou cor), pois todas as informações estão disponíveis na descrição do produto.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-amber-900">
                <XCircle className="h-4 w-4 mt-1 shrink-0 text-amber-700" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-amber-800">
            <strong>O envio deve ser feito na mesma embalagem recebida</strong>,
            para evitar danos no transporte.
          </p>
        </section>

        <section className="bg-background border border-border/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">
              Nosso compromisso
            </h2>
          </div>
          <p>
            Prezamos pela transparência e qualidade. Caso o produto apresente
            defeito de fabricação comprovado, daremos todo suporte necessário
            para resolução rápida.
          </p>
          <p className="mt-3 font-medium">
            A Wesley Bijoux trabalha para que você compre com segurança e
            revenda com confiança.
          </p>
        </section>
      </div>
    </div>
  </Layout>
);

export default TrocasDevolucoes;
