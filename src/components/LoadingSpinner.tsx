import { motion } from "framer-motion";

const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <motion.img
        src="/logo.png"
        alt="Wesley Bijoux"
        className="w-20 h-20 object-contain"
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1, 0.95] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

export default LoadingSpinner;
