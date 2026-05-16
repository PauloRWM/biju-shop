import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Clock, MessageCircle, Globe } from "lucide-react";

const Footer = () => (
  <footer className="bg-[hsl(38,60%,95%)] border-t border-border/50">
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left">
        {/* Sobre */}
        <div className="flex flex-col items-center md:items-start">
          <img
            src="/logo.png"
            alt="Wesley Bijoux"
            className="h-40 w-auto object-contain mb-4"
          />
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Bijuterias artesanais que iluminam seu estilo. Cada peça é feita com carinho e atenção aos detalhes.
          </p>
          <div className="flex gap-3 justify-center md:justify-start">
            <a 
              href="https://www.instagram.com/wesleybijoux.com.br/"
              target="_blank" 
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors group"
              aria-label="Instagram"
            >
              <Globe className="h-4 w-4 text-foreground/60 group-hover:text-foreground transition-colors" />
            </a>
            <a
              href="https://wa.me/5511945189988"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors group"
              aria-label="WhatsApp"
            >
              <MessageCircle className="h-4 w-4 text-foreground/60 group-hover:text-foreground transition-colors" />
            </a>
            <a 
              href="mailto:wesleybijoux@gmail.com" 
              className="w-9 h-9 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors group"
              aria-label="Email"
            >
              <Mail className="h-4 w-4 text-foreground/60 group-hover:text-foreground transition-colors" />
            </a>
          </div>
        </div>

        {/* Navegação */}
        <div>
          <h4 className="font-sans font-bold text-xs mb-4 uppercase tracking-[0.12em] text-foreground">Navegação</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground transition-colors inline-block">Início</Link></li>
            <li><Link to="/shop" className="hover:text-foreground transition-colors inline-block">Todos os Produtos</Link></li>
            <li><Link to="/shop?cat=Colares" className="hover:text-foreground transition-colors inline-block">Colares</Link></li>
            <li><Link to="/shop?cat=Brincos" className="hover:text-foreground transition-colors inline-block">Brincos</Link></li>
            <li><Link to="/shop?cat=Pulseiras" className="hover:text-foreground transition-colors inline-block">Pulseiras</Link></li>
            <li><Link to="/shop?cat=Anéis" className="hover:text-foreground transition-colors inline-block">Anéis</Link></li>
            <li><Link to="/shop?cat=Conjuntos" className="hover:text-foreground transition-colors inline-block">Conjuntos</Link></li>
          </ul>
        </div>

        {/* Atendimento */}
        <div>
          <h4 className="font-sans font-bold text-xs mb-4 uppercase tracking-[0.12em] text-foreground">Atendimento</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/trocas-e-devolucoes" className="hover:text-foreground transition-colors inline-block">Trocas e Devoluções</Link></li>
            <li><Link to="/duvidas-frequentes" className="hover:text-foreground transition-colors inline-block">Perguntas Frequentes</Link></li>
            <li><Link to="/privacidade" className="hover:text-foreground transition-colors inline-block">Política de Privacidade</Link></li>
            <li><Link to="/conta" className="hover:text-foreground transition-colors inline-block">Minha Conta</Link></li>
          </ul>
        </div>

        {/* Contato */}
        <div>
          <h4 className="font-sans font-bold text-xs mb-4 uppercase tracking-[0.12em] text-foreground">Contato</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2 justify-center md:justify-start text-left">
              <Phone className="h-4 w-4 mt-0.5 shrink-0 text-foreground/40" />
              <div>
                <a href="https://wa.me/5511945189988" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors block">
                  (11) 94518-9988
                </a>
                <span className="text-xs text-muted-foreground/60">WhatsApp e Ligações</span>
              </div>
            </li>
            <li className="flex items-start gap-2 justify-center md:justify-start text-left">
              <Mail className="h-4 w-4 mt-0.5 shrink-0 text-foreground/40" />
              <div>
                <a href="mailto:wesleybijoux@gmail.com" className="hover:text-foreground transition-colors block">
                  wesleybijoux@gmail.com
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2 justify-center md:justify-start text-left">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-foreground/40" />
              <div>
                <span className="block">São Paulo, SP</span>
                <span className="text-xs text-muted-foreground/60">Atendimento em todo Brasil</span>
              </div>
            </li>
            <li className="flex items-start gap-2 justify-center md:justify-start text-left">
              <Clock className="h-4 w-4 mt-0.5 shrink-0 text-foreground/40" />
              <div>
                <span className="block">Seg - Sex: 7:00 às 16:00</span>
                <span className="text-xs text-muted-foreground/60">Sábado: 7:00 às 13:00</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Formas de Pagamento */}
      <div className="border-t border-border/50 mt-12 pt-8">
        <div className="text-center mb-6">
          <p className="text-xs font-sans uppercase tracking-[0.12em] text-muted-foreground mb-4">Formas de Pagamento</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* Cartões de Crédito */}
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <img src="/visa-logo.svg" alt="Visa" className="h-5" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <img src="/mastercard-logo.svg" alt="Mastercard" className="h-5" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <img src="/amex-logo.svg" alt="American Express" className="h-5" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <img src="/elo-logo.svg" alt="Elo" className="h-5" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <img src="/diners-logo.svg" alt="Diners" className="h-5" />
            </div>
            
            {/* PIX */}
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <img src="/icons8-pix.svg" alt="PIX" className="h-5" />
            </div>
            
            {/* Boleto */}
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <span className="text-xs font-bold text-foreground/70">BOLETO</span>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-xs font-sans uppercase tracking-[0.12em] text-muted-foreground mb-3">Segurança</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <span className="text-lg">🔒</span>
              <span className="text-xs font-medium text-foreground/70">SSL Seguro</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <span className="text-lg">✓</span>
              <span className="text-xs font-medium text-foreground/70">Compra Protegida</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border border-border/30">
              <span className="text-lg">📦</span>
              <span className="text-xs font-medium text-foreground/70">Entrega Garantida</span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-border/50 mt-8 pt-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <strong className="text-foreground/80">Wesley Bijoux</strong>. Todos os direitos reservados.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          CNPJ: 24.741.532/0001-48 • Desenvolvido com ❤️
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
