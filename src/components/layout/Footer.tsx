import { Link } from "react-router-dom";
import { Instagram, Facebook, Mail } from "lucide-react";

const Footer = () => (
  <footer className="bg-secondary/50 border-t mt-16">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-display text-xl font-bold mb-3">Luminária</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bijuterias artesanais que iluminam seu estilo. Cada peça é feita com carinho e atenção aos detalhes.
          </p>
        </div>
        <div>
          <h4 className="font-sans font-semibold text-sm mb-3 uppercase tracking-wider">Navegação</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground transition-colors">Início</Link></li>
            <li><Link to="/?cat=Colares" className="hover:text-foreground transition-colors">Colares</Link></li>
            <li><Link to="/?cat=Brincos" className="hover:text-foreground transition-colors">Brincos</Link></li>
            <li><Link to="/?cat=Pulseiras" className="hover:text-foreground transition-colors">Pulseiras</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-sans font-semibold text-sm mb-3 uppercase tracking-wider">Ajuda</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Trocas e Devoluções</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Rastreamento</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">FAQ</span></li>
            <li><span className="hover:text-foreground transition-colors cursor-pointer">Contato</span></li>
          </ul>
        </div>
        <div>
          <h4 className="font-sans font-semibold text-sm mb-3 uppercase tracking-wider">Redes Sociais</h4>
          <div className="flex gap-3">
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">
              <Instagram className="h-4 w-4 text-primary" />
            </span>
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">
              <Facebook className="h-4 w-4 text-primary" />
            </span>
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">
              <Mail className="h-4 w-4 text-primary" />
            </span>
          </div>
        </div>
      </div>
      <div className="border-t mt-8 pt-6 text-center text-xs text-muted-foreground">
        © 2026 Luminária. Todos os direitos reservados.
      </div>
    </div>
  </footer>
);

export default Footer;
