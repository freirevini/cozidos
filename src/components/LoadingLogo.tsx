import { motion } from "framer-motion";
import logo from "@/assets/novo-logo.png";

export default function LoadingLogo() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative"
        >
          <img src={logo} alt="Cozidos FC" className="h-20 w-20" />
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              boxShadow: [
                "0 0 20px hsl(330 100% 60% / 0.5)",
                "0 0 40px hsl(330 100% 60% / 0.8)",
                "0 0 20px hsl(330 100% 60% / 0.5)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
        <motion.p
          className="text-primary font-medium"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Carregando...
        </motion.p>
      </div>
    </div>
  );
}
