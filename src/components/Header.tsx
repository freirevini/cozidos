import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/novo-logo.png";
import { SlideTabs } from "@/components/ui/slide-tabs";

interface HeaderProps {
  isAdmin?: boolean;
  isPlayer?: boolean;
}

export default function Header({ isAdmin = false, isPlayer = true }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
      toast({
        title: "Logout realizado",
        description: "Você saiu da sua conta com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const navLinks = [
    { href: "/", label: "Classificação" },
    { href: "/statistics", label: "Estatísticas" },
    { href: "/matches", label: "Rodadas" },
  ];

  const adminLinks = [
    { href: "/admin/teams", label: "Times" },
    { href: "/admin/round", label: "Gerenciar Rodada" },
    { href: "/admin/players", label: "Gerenciar Jogadores" },
    { href: "/admin/ranking", label: "Gerenciar Classificação Geral" },
  ];

  const userLinks = isPlayer 
    ? [
        { href: "/times", label: "Times" },
        { href: "/profile", label: "Meu Perfil" },
      ]
    : [
        { href: "/profile", label: "Meu Perfil" },
      ];

  const allLinks = isAdmin 
    ? [...navLinks, ...adminLinks] 
    : [...navLinks, ...userLinks];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img src={logo} alt="Cozidos FC" className="h-10 w-10" />
            <span className="text-2xl font-bold text-primary glow-text">
              Cozidos FC
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-4">
            <SlideTabs 
              tabs={allLinks.map(link => ({ title: link.label, url: link.href }))} 
              currentPath={location.pathname}
            />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
            >
              <LogOut size={16} />
              Sair
            </button>
          </nav>

          {/* Tablet Navigation - Compact version */}
          <nav className="hidden md:flex lg:hidden items-center space-x-2">
            <div className="max-w-[500px] overflow-x-auto scrollbar-hide">
              <SlideTabs 
                tabs={allLinks.map(link => ({ title: link.label, url: link.href }))} 
                currentPath={location.pathname}
              />
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
            >
              <LogOut size={16} />
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <motion.button
            className="md:hidden p-2 text-foreground hover:bg-muted rounded-md transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              initial={false}
              animate={{ rotate: mobileMenuOpen ? 90 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.div>
          </motion.button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 space-y-2 animate-fade-in">
            {allLinks.map((link, index) => (
              <Link
                key={link.href}
                to={link.href}
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 menu-glow ${
                  isActive(link.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  animation: `fade-in 0.3s ease-out ${index * 0.05}s both`
                }}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              style={{
                animation: `fade-in 0.3s ease-out ${allLinks.length * 0.05}s both`
              }}
            >
              <LogOut size={16} />
              Sair
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
