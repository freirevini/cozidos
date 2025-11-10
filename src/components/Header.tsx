import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setShowLeftArrow(container.scrollLeft > 10);
      setShowRightArrow(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScrollPosition();
      container.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
      return () => {
        container.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkScrollPosition);
      };
    }
  }, [allLinks]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Cozidos FC" className="h-10 w-10" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-1">
            <SlideTabs 
              tabs={allLinks.map(link => ({ title: link.label, url: link.href }))} 
              currentPath={location.pathname}
            />
          </nav>
          
          <button
            onClick={handleLogout}
            className="hidden lg:flex px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors items-center gap-2"
          >
            <LogOut size={16} />
            Sair
          </button>

          {/* Tablet Navigation - Compact version with scroll indicators */}
          <nav className="hidden md:flex lg:hidden items-center gap-2 flex-1 max-w-[calc(100%-120px)]">
            <div className="relative flex items-center flex-1">
              {showLeftArrow && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 z-10 p-1 bg-background/80 backdrop-blur-sm rounded-full text-primary hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto scrollbar-hide"
              >
                <div className="inline-block min-w-max">
                  <SlideTabs 
                    tabs={allLinks.map(link => ({ title: link.label, url: link.href }))} 
                    currentPath={location.pathname}
                  />
                </div>
              </div>
              {showRightArrow && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 z-10 p-1 bg-background/80 backdrop-blur-sm rounded-full text-primary hover:bg-muted transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2 flex-shrink-0"
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
