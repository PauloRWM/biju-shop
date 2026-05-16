import Layout from "@/components/layout/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Wallet,
  TrendingUp,
  CreditCard,
  Truck,
  Package,
  Shield,
  Sparkles,
  GraduationCap,
  MessageCircle,
} from "lucide-react";

const faqs = [
  {
    icon: Wallet,
    question: "Qual é o pedido mínimo?",
    answer: (
      <>
        <p>
          O pedido mínimo é de <strong>R$ 47,99</strong>.
        </p>
        <p>
          Você pode escolher as peças que quiser até atingir esse valor — sem
          exigência de quantidade mínima por modelo.
        </p>
        <p className="text-muted-foreground">
          Ideal para quem está começando na revenda e quer testar os produtos.
        </p>
      </>
    ),
  },
  {
    icon: TrendingUp,
    question: "As peças têm boa margem de lucro para revenda?",
    answer: (
      <>
        <p>
          Sim! Trabalhamos com bijuterias e folheados com alta saída e excelente
          margem de lucro, ideais para revendedoras que querem gerar renda
          extra ou viver do seu próprio negócio.
        </p>
        <p>
          Nossas peças seguem tendências da moda e também oferecemos modelos
          clássicos que vendem o ano inteiro.
        </p>
      </>
    ),
  },
  {
    icon: CreditCard,
    question: "Quais são as formas de pagamento?",
    answer: (
      <>
        <p>Para facilitar sua compra, oferecemos:</p>
        <ul className="space-y-2 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span>Até 6x sem juros no cartão</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span>Até 12x com juros</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span>
              <strong>PIX com 10% de desconto</strong>, com confirmação rápida
            </span>
          </li>
        </ul>
        <p className="mt-3">
          Assim você consegue montar um pedido maior e parcelar sem pesar no
          bolso.
        </p>
      </>
    ),
  },
  {
    icon: Truck,
    question: "O frete é caro?",
    answer: (
      <>
        <p>
          O valor do frete é calculado automaticamente no checkout, de acordo
          com o CEP e o valor do pedido.
        </p>
        <p className="bg-primary/10 border border-primary/20 rounded-lg p-3 mt-3">
          <strong>Frete grátis nas compras a partir de R$ 1.000,00 (PAC)</strong>
          <br />
          <span className="text-sm text-muted-foreground">
            Muitas revendedoras aproveitam para montar pedidos maiores e
            economizar no envio.
          </span>
        </p>
      </>
    ),
  },
  {
    icon: Package,
    question: "Em quanto tempo meu pedido é enviado?",
    answer: (
      <>
        <p>
          Após a confirmação do pagamento, seu pedido é separado com agilidade
          e enviado o mais rápido possível.
        </p>
        <p>
          Você recebe o código de rastreio para acompanhar cada etapa da
          entrega.
        </p>
      </>
    ),
  },
  {
    icon: Shield,
    question: "Comprar no site é seguro?",
    answer: (
      <>
        <p>
          Sim! A Wesley Bijoux garante total segurança nas transações e
          proteção dos seus dados.
        </p>
        <p>
          Se precisar de suporte, nosso atendimento é humanizado e rápido via
          WhatsApp:{" "}
          <a
            href="https://wa.me/5511945189988"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
          >
            (11) 94518-9988
          </a>
        </p>
      </>
    ),
  },
  {
    icon: Sparkles,
    question: "As peças são de qualidade?",
    answer: (
      <>
        <p>Sim! Trabalhamos com curadoria de peças que:</p>
        <ul className="space-y-1.5 mt-3 list-disc list-inside">
          <li>Têm ótima aceitação no mercado</li>
          <li>Seguem tendências atuais</li>
          <li>Possuem excelente acabamento</li>
          <li>Vendem com facilidade</li>
        </ul>
        <p className="mt-3">
          Nosso objetivo é que você compre, revenda e volte sempre com lucro.
        </p>
      </>
    ),
  },
  {
    icon: GraduationCap,
    question: "Posso comprar mesmo sendo iniciante?",
    answer: (
      <>
        <p>Claro! Muitas das nossas clientes começaram do zero.</p>
        <p>
          Com pedido mínimo acessível, parcelamento facilitado e produtos de
          alta saída, você pode começar pequeno e crescer rapidamente.
        </p>
      </>
    ),
  },
];

const FAQ = () => (
  <Layout>
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
          <HelpCircle className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
          Dúvidas Frequentes
        </h1>
        <p className="text-muted-foreground">
          Separamos as principais perguntas para que você compre com segurança,
          confiança e aproveite ao máximo sua revenda.
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, idx) => {
          const Icon = faq.icon;
          return (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="border border-border/50 rounded-xl px-5 bg-background"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">{faq.question}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pr-2 pb-4 space-y-2 text-sm text-foreground/80 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="mt-12 bg-[hsl(38,60%,95%)] border border-border/50 rounded-2xl p-6 md:p-8 text-center">
        <h2 className="font-display text-xl md:text-2xl font-bold mb-2">
          Wesley Bijoux
        </h2>
        <p className="text-muted-foreground mb-5">
          Seu fornecedor de bijuterias e folheados para revenda. Mais do que
          vender acessórios, ajudamos mulheres a empreender e aumentar sua
          renda.
        </p>
        <Button asChild size="lg" className="gap-2">
          <a
            href="https://wa.me/5511945189988"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4" />
            Falar no WhatsApp: (11) 94518-9988
          </a>
        </Button>
      </div>
    </div>
  </Layout>
);

export default FAQ;
