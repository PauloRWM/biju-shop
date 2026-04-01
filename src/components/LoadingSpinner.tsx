import { motion } from "framer-motion";

const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <motion.div
        className="w-10 h-10 border-3 border-muted border-t-primary rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        style={{ borderWidth: 3 }}
      />
      <span className="text-sm text-muted-foreground">Carregando...</span>
    </div>
  );
};

export default LoadingSpinner;
