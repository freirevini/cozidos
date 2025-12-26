import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import LoadingLogo from "@/components/LoadingLogo";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GlobalPendingBanner } from "@/components/GlobalPendingBanner";
import Classification from "./pages/Classification";
import Matches from "./pages/Matches";
import MatchDetails from "./pages/MatchDetails";
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

import ProfileMonitoring from "./pages/ProfileMonitoring";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return <LoadingLogo />;
  }

  return user ? <>{children}</> : null;
}

// ApprovedOnlyRoute: Blocks access to profile pages for pending users
function ApprovedOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, profileData, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return <LoadingLogo />;
  }

  if (!user) return null;

  // Block pending users from accessing profile
  if (profileData?.status !== 'aprovado') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><PageTransition><Classification /></PageTransition></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><PageTransition><Matches /></PageTransition></ProtectedRoute>} />
        <Route path="/match/:matchId" element={<ProtectedRoute><PageTransition><MatchDetails /></PageTransition></ProtectedRoute>} />
        <Route path="/statistics" element={<ProtectedRoute><PageTransition><Statistics /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/players" element={<ProtectedRoute><PageTransition><ManagePlayers /></PageTransition></ProtectedRoute>} />

        <Route path="/admin/monitoring" element={<ProtectedRoute><PageTransition><ProfileMonitoring /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/teams" element={<ProtectedRoute><PageTransition><Teams /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/teams/define" element={<ProtectedRoute><PageTransition><DefineTeams /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/teams/manage" element={<ProtectedRoute><PageTransition><ManageTeams /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/edit" element={<ProtectedRoute><PageTransition><EditRound /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/view" element={<ProtectedRoute><PageTransition><ViewRound /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/match/:matchId/:roundId" element={<ProtectedRoute><PageTransition><ManageMatch /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/attendance" element={<ProtectedRoute><PageTransition><AttendanceRecord /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round" element={<ProtectedRoute><PageTransition><StartRound /></PageTransition></ProtectedRoute>} />
        <Route path="/admin/round/manage" element={<ProtectedRoute><PageTransition><ManageRounds /></PageTransition></ProtectedRoute>} />
        <Route path="/profile" element={<ApprovedOnlyRoute><PageTransition><Profile /></PageTransition></ApprovedOnlyRoute>} />
        <Route path="/profile/:id" element={<ApprovedOnlyRoute><PageTransition><Profile /></PageTransition></ApprovedOnlyRoute>} />
        <Route path="/times" element={<ProtectedRoute><PageTransition><ViewTeams /></PageTransition></ProtectedRoute>} />
        <Route path="/teams/view" element={<ProtectedRoute><PageTransition><ViewTeams /></PageTransition></ProtectedRoute>} />
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
        <AuthProvider>
          <GlobalPendingBanner />
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;