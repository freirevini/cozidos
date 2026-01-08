import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Trophy, User, Settings, BarChart3, Shield, Sparkles, Users, CalendarDays, UserCog } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import logo from "@/assets/novo-logo.png";
import { cn } from "@/lib/utils";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
}

interface PopupOption {
    path: string;
    label: string;
    icon: React.ReactNode;
}

export default function BottomNavbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isApproved, isAdmin, isPlayer } = useAuth();
    const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

    // Hide on scroll down, show on scroll up
    const isNavVisible = useScrollDirection({ threshold: 15 });

    // Don't show navbar if user is not logged in
    if (!user) return null;

    // Routes where navbar should be hidden (admin/management pages)
    const hideNavbarRoutes = [
        '/admin/match/',        // Gestão ao vivo da partida (/admin/match/:matchId/:roundId)
        '/admin/teams/define',  // Definição de times/sorteio
        '/admin/teams/manage',  // Gerenciamento de times
        '/admin/round/',        // Edição/visualização de rodada (/admin/round/:roundId/...)
        '/admin/players',       // Gerenciamento de jogadores
        '/auth',                // Tela de login
    ];

    // Check if current path starts with any hidden route
    const shouldHideNavbar = hideNavbarRoutes.some(route =>
        location.pathname.startsWith(route)
    );

    // Don't render navbar on excluded routes
    if (shouldHideNavbar) return null;

    // Popup options when clicking center logo (for players)
    const playerPopupOptions: PopupOption[] = [
        {
            path: "/statistics",
            label: "Estatísticas",
            icon: <BarChart3 className="w-6 h-6" />,
        },
        {
            path: "/times",
            label: "Times",
            icon: <Shield className="w-6 h-6" />,
        },
        {
            path: "/coz-ia",
            label: "CozIA",
            icon: <Sparkles className="w-6 h-6" />,
        },
    ];

    // Admin popup options when clicking "Gerenciar"
    const adminPopupOptions: PopupOption[] = [
        {
            path: "/admin/round",
            label: "Gerenciar Rodada",
            icon: <CalendarDays className="w-6 h-6" />,
        },
        {
            path: "/admin/teams",
            label: "Gerenciar Times",
            icon: <Shield className="w-6 h-6" />,
        },
        {
            path: "/admin/players",
            label: "Gerenciar Jogadores",
            icon: <UserCog className="w-6 h-6" />,
        },
        {
            path: "/statistics",
            label: "Estatísticas",
            icon: <BarChart3 className="w-6 h-6" />,
        },
    ];

    // Navigation items - Order: Home | Classificação | LOGO | Rodadas | Meu Perfil
    // Icons: Casa | Troféu | Logo | 3:2 | Perfil
    const getNavItems = (): NavItem[] => {
        // For admins - last item becomes "Gerenciar" with gear icon
        if (isAdmin) {
            return [
                {
                    path: "/",
                    label: "Home",
                    icon: <Home className="w-6 h-6" strokeWidth={1.5} />,
                    activeIcon: <Home className="w-6 h-6" strokeWidth={2} />,
                },
                {
                    path: "/classification",
                    label: "Classificação",
                    icon: <Trophy className="w-6 h-6" strokeWidth={1.5} />,
                    activeIcon: <Trophy className="w-6 h-6" strokeWidth={2} />,
                },
                { path: "center", label: "", icon: null, activeIcon: null },
                {
                    path: "/matches",
                    label: "Rodadas",
                    icon: (
                        <div className="w-6 h-6 border-[1.5px] border-current rounded flex items-center justify-center text-[10px] font-bold">
                            3:2
                        </div>
                    ),
                    activeIcon: (
                        <div className="w-6 h-6 border-2 border-current rounded flex items-center justify-center text-[10px] font-bold">
                            3:2
                        </div>
                    ),
                },
                {
                    path: "admin-menu",
                    label: "Gerenciar",
                    icon: <Settings className="w-6 h-6" strokeWidth={1.5} />,
                    activeIcon: <Settings className="w-6 h-6" strokeWidth={2} />,
                },
            ];
        }

        // For regular players and non-players
        return [
            {
                path: "/",
                label: "Home",
                icon: <Home className="w-6 h-6" strokeWidth={1.5} />,
                activeIcon: <Home className="w-6 h-6" strokeWidth={2} />,
            },
            {
                path: "/classification",
                label: "Classificação",
                icon: <Trophy className="w-6 h-6" strokeWidth={1.5} />,
                activeIcon: <Trophy className="w-6 h-6" strokeWidth={2} />,
            },
            { path: "center", label: "", icon: null, activeIcon: null },
            {
                path: "/matches",
                label: "Rodadas",
                icon: (
                    <div className="w-6 h-6 border-[1.5px] border-current rounded flex items-center justify-center text-[10px] font-bold">
                        3:2
                    </div>
                ),
                activeIcon: (
                    <div className="w-6 h-6 border-2 border-current rounded flex items-center justify-center text-[10px] font-bold">
                        3:2
                    </div>
                ),
            },
            {
                path: "/profile",
                label: "Meu Perfil",
                icon: <User className="w-6 h-6" strokeWidth={1.5} />,
                activeIcon: <User className="w-6 h-6" strokeWidth={2} />,
            },
        ];
    };

    const navItems = getNavItems();

    const isActive = (path: string) => {
        if (path === "/") return location.pathname === "/";
        if (path === "admin-menu") {
            return location.pathname.startsWith("/admin/teams") ||
                location.pathname.startsWith("/admin/players");
        }
        return location.pathname.startsWith(path);
    };

    const handleNavigation = (path: string) => {
        if (path === "admin-menu") {
            // Toggle admin popup menu
            setIsAdminMenuOpen(!isAdminMenuOpen);
            setIsLogoMenuOpen(false);
            return;
        }
        if (path === "/profile" && !isApproved) {
            return;
        }
        setIsLogoMenuOpen(false);
        setIsAdminMenuOpen(false);
        navigate(path);
    };

    const handleLogoClick = () => {
        if (isAdmin) {
            // For admins, logo navigates to players list
            navigate("/admin/players");
            return;
        }
        if (!isPlayer) {
            // For non-players, logo navigates to players list
            navigate("/players-list");
            return;
        }
        // For players, toggle the popup menu
        setIsLogoMenuOpen(!isLogoMenuOpen);
    };

    const handlePopupOptionClick = (path: string) => {
        setIsLogoMenuOpen(false);
        navigate(path);
    };

    const handleAdminPopupOptionClick = (path: string) => {
        setIsAdminMenuOpen(false);
        navigate(path);
    };

    return (
        <>
            {/* Quick Actions Drawer - Player */}
            <Drawer open={isLogoMenuOpen && isPlayer} onOpenChange={setIsLogoMenuOpen}>
                <DrawerContent className="max-h-[50vh]">
                    <DrawerHeader className="border-b border-border/50 pb-4">
                        <DrawerTitle className="text-center text-lg">Ações Rápidas</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-2">
                        {playerPopupOptions.map((option) => (
                            <button
                                key={option.path}
                                onClick={() => handlePopupOptionClick(option.path)}
                                className="w-full h-14 flex items-center gap-4 px-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/10 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-white">
                                    {option.icon}
                                </div>
                                <span className="text-base font-medium text-white">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Quick Actions Drawer - Admin */}
            <Drawer open={isAdminMenuOpen && isAdmin} onOpenChange={setIsAdminMenuOpen}>
                <DrawerContent className="max-h-[60vh]">
                    <DrawerHeader className="border-b border-pink-500/30 pb-4">
                        <DrawerTitle className="text-center text-lg text-pink-400">Gerenciamento</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-2">
                        {adminPopupOptions.map((option) => (
                            <button
                                key={option.path}
                                onClick={() => handleAdminPopupOptionClick(option.path)}
                                className="w-full h-14 flex items-center gap-4 px-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 border border-pink-500/20 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">
                                    {option.icon}
                                </div>
                                <span className="text-base font-medium text-white">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Main navigation bar - Hide on scroll down */}
            <motion.nav
                initial={{ y: 0 }}
                animate={{
                    y: isNavVisible || isLogoMenuOpen ? 0 : 100,
                    opacity: isNavVisible || isLogoMenuOpen ? 1 : 0
                }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30
                }}
                className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-safe md:hidden"
            >
                <div className="bg-black/95 rounded-2xl max-w-md mx-auto flex items-end justify-around px-1 pb-3 pt-2 relative border border-white/10">

                    {navItems.map((item) => {
                        // Center logo - larger, no circle, no rotation
                        if (item.path === "center") {
                            return (
                                <div
                                    key="center-logo"
                                    className="relative -top-6 mb-[-24px] flex flex-col items-center justify-center w-20 z-10"
                                >
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        whileHover={{ scale: 1.05 }}
                                        onClick={handleLogoClick}
                                        className={cn(
                                            "w-16 h-16 flex items-center justify-center transition-all duration-200",
                                            isLogoMenuOpen && "brightness-125"
                                        )}
                                    >
                                        <img
                                            alt="Logo Cozidos"
                                            className="w-16 h-16 object-contain drop-shadow-lg"
                                            src={logo}
                                        />
                                    </motion.button>
                                </div>
                            );
                        }

                        const active = isActive(item.path) && !isLogoMenuOpen; // Deselect when popup is open
                        const isProfileDisabled = item.path === "/profile" && !isApproved;

                        return (
                            <motion.button
                                key={item.path}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleNavigation(item.path)}
                                disabled={isProfileDisabled}
                                className={cn(
                                    "flex flex-col items-center justify-center w-14 h-14 space-y-1 transition-all duration-200",
                                    active
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground",
                                    isProfileDisabled && "opacity-40 cursor-not-allowed"
                                )}
                            >
                                <div className={cn(
                                    "transition-all duration-200",
                                    active && "drop-shadow-[0_0_6px_rgba(236,72,153,0.6)]"
                                )}>
                                    {active ? item.activeIcon : item.icon}
                                </div>
                                <span className="text-[10px] font-medium tracking-wide whitespace-nowrap">
                                    {item.label}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </motion.nav>
        </>
    );
}
