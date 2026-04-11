import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Facebook,
  MessageCircle,
  ShieldCheck,
  Lock,
  RefreshCw,
  PackageCheck,
} from "lucide-react";

const socialLinks = [
  { icon: Instagram, label: "Instagram", href: "https://instagram.com/wesleybijoux" },
  { icon: Facebook, label: "Facebook", href: "https://facebook.com/wesleybijoux" },
  { icon: MessageCircle, label: "WhatsApp", href: "https://wa.me/5511999999999" },
];

const paymentMethods = [
  { label: "PIX", bg: "bg-[#32bcad]/10 text-[#32bcad] border-[#32bcad]/20" },
  { label: "Boleto", bg: "bg-muted text-muted-foreground border-border" },
  { label: "Visa", bg: "bg-[#1a1f71]/10 text-[#1a1f71] border-[#1a1f71]/20" },
  { label: "Mastercard", bg: "bg-[#eb001b]/10 text-[#eb001b] border-[#eb001b]/20" },
  { label: "Elo", bg: "bg-[#FFD700]/10 text-yellow-700 border-yellow-400/20" },
  { label: "Amex", bg: "bg-[#2e77bc]/10 text-[#2e77bc] border-[#2e77bc]/20" },
];

const Footer = () => (
  <footer className="bg-secondary/50 border-t mt-16">
    {/* Main grid */}
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">

        {/* Brand — spans 2 cols on lg */}
        <div className="lg:col-span-2">
          <img
            src="https://wesleybijoux.com.br/wp-content/uploads/2024/08/WhatsApp-Image-2026-01-18-at-17.07.54-e1774703118212.jpeg"
            alt="Wesley Bijoux"
            className="h-12 w-auto object-contain mb-3"
          />
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">
            Bijuterias artesanais que iluminam seu estilo. Cada peça é criada com carinho,
            qualidade e atenção a cada detalhe.
          </p>

          {/* Contact */}
          <ul className="space-y-2 mb-5">
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <span>(11) 99999-9999</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span>contato@wesleybijoux.com.br</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>São Paulo, SP – Brasil</span>
            </li>
          </ul>

          {/* Social */}
          <div className="flex gap-2">
            {socialLinks.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Loja */}
        <div>
          <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider">Loja</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground transition-colors">Início</Link></li>
            <li><Link to="/?cat=Colares" className="hover:text-foreground transition-colors">Colares</Link></li>
            <li><Link to="/?cat=Brincos" className="hover:text-foreground transition-colors">Brincos</Link></li>
            <li><Link to="/?cat=Pulseiras" className="hover:text-foreground transition-colors">Pulseiras</Link></li>
            <li><Link to="/?cat=Tornozeleiras" className="hover:text-foreground transition-colors">Tornozeleiras</Link></li>
            <li><Link to="/?featured=true" className="hover:text-foreground transition-colors">Novidades</Link></li>
          </ul>
        </div>

        {/* Atendimento */}
        <div>
          <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider">Atendimento</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/account" className="hover:text-foreground transition-colors">Minha Conta</Link></li>
            <li><Link to="/account" className="hover:text-foreground transition-colors">Meus Pedidos</Link></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Rastreamento</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Trocas e Devoluções</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">FAQ</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Fale Conosco</span></li>
          </ul>
        </div>

        {/* Institucional */}
        <div>
          <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider">Institucional</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Sobre Nós</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Política de Privacidade</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Termos de Uso</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Política de Cookies</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Trabalhe Conosco</span></li>
          </ul>
        </div>
      </div>
    </div>

    {/* Trust badges + Payment methods */}
    <div className="border-t">
      <div className="container mx-auto px-4 py-6">
        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-6">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
            Compra 100% segura
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 text-green-600 shrink-0" />
            Dados criptografados (SSL)
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PackageCheck className="h-4 w-4 text-primary shrink-0" />
            Entrega garantida
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-4 w-4 text-primary shrink-0" />
            Troca facilitada em 30 dias
          </div>
        </div>

        {/* Payment methods */}
        <div className="flex flex-wrap justify-center items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium mr-1">Pagamentos:</span>
          {paymentMethods.map(({ label, bg }) => (
            <span
              key={label}
              className={`px-3 py-1 rounded border text-xs font-semibold tracking-wide ${bg}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="bg-secondary border-t">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© 2026 Wesley Bijoux. Todos os direitos reservados.</span>
        <span className="hidden sm:block">CNPJ: 00.000.000/0001-00</span>
        <div className="flex gap-4">
          <span className="hover:text-foreground cursor-pointer transition-colors">Privacidade</span>
          <span className="hover:text-foreground cursor-pointer transition-colors">Termos de Uso</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
