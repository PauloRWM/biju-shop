import { motion } from "framer-motion";

export type CardFocus = "number" | "name" | "expiry" | "cvv" | null;

interface Props {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  focus: CardFocus;
}

const detectBrand = (n: string): { name: string; color: string; logo: string } => {
  const d = n.replace(/\D/g, "");
  if (/^4/.test(d)) return { name: "Visa", color: "from-[#1a1f71] to-[#3858a8]", logo: "VISA" };
  if (/^(5[1-5]|2[2-7])/.test(d)) return { name: "Mastercard", color: "from-[#1a1a2e] to-[#16213e]", logo: "Mastercard" };
  if (/^3[47]/.test(d)) return { name: "Amex", color: "from-[#108168] to-[#2bb673]", logo: "AMEX" };
  if (/^(636368|438935|504175|451416|509048|636297|5067|4576|4011|506699)/.test(d)) return { name: "Elo", color: "from-[#000] to-[#333]", logo: "Elo" };
  if (/^(606282|3841)/.test(d)) return { name: "Hipercard", color: "from-[#9b1e26] to-[#d4262e]", logo: "Hipercard" };
  return { name: "Cartão", color: "from-zinc-700 to-zinc-900", logo: "" };
};

const formatNumberDisplay = (n: string) => {
  const d = n.replace(/\D/g, "").padEnd(16, "•").slice(0, 16);
  return d.match(/.{1,4}/g)?.join(" ") ?? d;
};

const CreditCardPreview = ({ number, name, expiry, cvv, focus }: Props) => {
  const brand = detectBrand(number);
  const flipped = focus === "cvv";

  return (
    <div className="w-full max-w-[340px] mx-auto" style={{ perspective: 1000 }}>
      <motion.div
        className="relative w-full aspect-[1.586/1]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRENTE */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${brand.color} text-white shadow-2xl p-5 flex flex-col justify-between overflow-hidden`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-black/20 blur-2xl" />

          <div className="relative flex justify-between items-start">
            <div className="w-11 h-8 rounded bg-gradient-to-br from-yellow-200 to-yellow-500 shadow-inner" />
            <span className="font-display text-base font-bold tracking-wider opacity-90">
              {brand.logo}
            </span>
          </div>

          <motion.div
            className="relative font-mono text-lg sm:text-xl tracking-[0.18em] font-semibold"
            animate={{ scale: focus === "number" ? 1.04 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <span className={focus === "number" ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" : ""}>
              {formatNumberDisplay(number)}
            </span>
          </motion.div>

          <div className="relative flex justify-between items-end gap-3">
            <motion.div
              className="flex-1 min-w-0"
              animate={{ scale: focus === "name" ? 1.04 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-[9px] uppercase tracking-widest opacity-70 block">
                Titular
              </span>
              <span className="text-xs sm:text-sm font-semibold uppercase truncate block">
                {name || "NOME COMPLETO"}
              </span>
            </motion.div>
            <motion.div
              className="text-right shrink-0"
              animate={{ scale: focus === "expiry" ? 1.04 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-[9px] uppercase tracking-widest opacity-70 block">
                Validade
              </span>
              <span className="text-xs sm:text-sm font-semibold tabular-nums">
                {expiry || "MM/AA"}
              </span>
            </motion.div>
          </div>
        </div>

        {/* VERSO */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${brand.color} text-white shadow-2xl overflow-hidden`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-10 mt-5 bg-black/70 w-full" />
          <div className="px-5 mt-4">
            <div className="bg-white/90 text-zinc-900 rounded h-9 flex items-center justify-end pr-3 text-sm font-mono tabular-nums tracking-widest">
              {cvv || "•••"}
            </div>
            <p className="text-[10px] uppercase tracking-widest opacity-70 mt-1.5 text-right">
              CVV
            </p>
          </div>
          <div className="absolute bottom-3 right-4 font-display text-sm font-bold opacity-80">
            {brand.logo}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreditCardPreview;
