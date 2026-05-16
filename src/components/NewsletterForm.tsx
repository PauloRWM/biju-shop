import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/services/api";

const NewsletterForm = () => {
  const [whatsapp, setWhatsapp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const formatWhatsApp = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");
    
    // Formata: (99) 99999-9999
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    // Limita a 11 dígitos
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setWhatsapp(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numbers = whatsapp.replace(/\D/g, "");
    
    if (numbers.length < 10) {
      toast({
        title: "WhatsApp inválido",
        description: "Digite um número válido com DDD",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/newsletter", { whatsapp: numbers });

      toast({
        title: "✅ Cadastro realizado!",
        description: "Você receberá nossas novidades no WhatsApp",
      });

      setWhatsapp("");
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Tente novamente mais tarde";
      toast({
        title: "Erro ao cadastrar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-0 max-w-sm mx-auto">
      <input
        type="tel"
        value={whatsapp}
        onChange={handleChange}
        placeholder="(99) 99999-9999"
        maxLength={15}
        disabled={isLoading}
        className="flex-1 h-11 px-4 bg-background/10 border border-background/15 border-r-0 text-sm text-background placeholder:text-background/30 focus:outline-none focus:bg-background/15 font-sans transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="h-11 px-6 bg-background text-foreground text-xs font-sans uppercase tracking-[0.12em] font-medium hover:bg-background/90 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "..." : "Cadastrar"}
      </button>
    </form>
  );
};

export default NewsletterForm;
