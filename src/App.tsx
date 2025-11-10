import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import LoadingLogo from "@/components/LoadingLogo";
import Classification from "./pages/Classification";
import Matches from "./pages/Matches";
import Statistics from "./pages/Statistics";
import ManagePlayers from "./pages/ManagePlayers";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Teams from "./pages/Teams";
import DefineTeams from "./pages/DefineTeams";
import ManageTeams from "./pages/ManageTeams";
import StartRound from "./pages/StartRound";
import ManageRounds from "./pages/ManageRounds";
import EditRound from "./pages/EditRound";
import ViewRound from "./pages/ViewRound";
import ManageMatch from "./pages/ManageMatch";
import AttendanceRecord from "./pages/AttendanceRecord";
import ViewTeams from "./pages/ViewTeams";
import ManageRanking from "./pages/ManageRanking";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (!session && event === 'SIGNED_OUT') {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
  };

  if (isAuthenticated === null) {
    return <LoadingLogo />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><PageTransition><Classification /></PageTransition></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><PageTransition><Matches /></PageTransition></ProtectedRoute>} />
        <Route path="/statistics" element={<ProtectedRoute><PageTransition><Statistics /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/players" element={<ProtectedRoute><PageTransition><ManagePlayers /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/ranking" element={<ProtectedRoute><PageTransition><ManageRanking /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/teams" element={<ProtectedRoute><PageTransition><Teams /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/teams/define" element={<ProtectedRoute><PageTransition><DefineTeams /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/teams/manage" element={<ProtectedRoute><PageTransition><ManageTeams /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/edit" element={<ProtectedRoute><PageTransition><EditRound /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/view" element={<ProtectedRoute><PageTransition><ViewRound /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/match/:matchId/:roundId" element={<ProtectedRoute><PageTransition><ManageMatch /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/attendance" element={<ProtectedRoute><PageTransition><AttendanceRecord /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round" element={<ProtectedRoute><PageTransition><StartRound /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/manage" element={<ProtectedRoute><PageTransition><ManageRounds /></PageTransition></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><PageTransition><Profile /></PageTransition></ProtectedRoute>} />
        <Route path="/times" element={<ProtectedRoute><PageTransition><ViewTeams /></PageTransition></ProtectedRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;