import { useEffect, useState, lazy, Suspense } from "react";
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
import BottomNavbar from "@/components/BottomNavbar";

// Sync imports (critical path - needed immediately)
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages (code splitting)
const Home = lazy(() => import("./pages/Home"));
const AdminHome = lazy(() => import("./pages/AdminHome"));
const Classification = lazy(() => import("./pages/Classification"));
const Matches = lazy(() => import("./pages/Matches"));
const MatchDetails = lazy(() => import("./pages/MatchDetails"));
const Statistics = lazy(() => import("./pages/Statistics"));
const ManagePlayers = lazy(() => import("./pages/ManagePlayers"));
const Profile = lazy(() => import("./pages/Profile"));
const Teams = lazy(() => import("./pages/Teams"));
const DefineTeams = lazy(() => import("./pages/DefineTeams"));
const ManageTeams = lazy(() => import("./pages/ManageTeams"));
const StartRound = lazy(() => import("./pages/StartRound"));
const ManageRounds = lazy(() => import("./pages/ManageRounds"));
const EditRound = lazy(() => import("./pages/EditRound"));
const ViewRound = lazy(() => import("./pages/ViewRound"));
const ManageMatch = lazy(() => import("./pages/ManageMatch"));
const AttendanceRecord = lazy(() => import("./pages/AttendanceRecord"));
const ManageAttendance = lazy(() => import("./pages/ManageAttendance"));
const ViewTeams = lazy(() => import("./pages/ViewTeams"));
const ProfileMonitoring = lazy(() => import("./pages/ProfileMonitoring"));
const PlayersList = lazy(() => import("./pages/PlayersList"));
const CozIA = lazy(() => import("./pages/CozIA"));

// QueryClient with optimized caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30,   // 30 minutes - garbage collection
      refetchOnWindowFocus: false, // Don't refetch when user returns to tab
      retry: 1, // Only retry once on failure
    },
  },
});

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
  const { user, isApproved, loading } = useAuth();
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
  if (!isApproved) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// HomeRouter: Now shows the same Home for all users (including admins)
function HomeRouter() {
  return <Home />;
}

// Suspense wrapper for lazy-loaded routes
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingLogo />}>
      {children}
    </Suspense>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><LazyRoute><PageTransition><HomeRouter /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/classification" element={<ProtectedRoute><LazyRoute><PageTransition><Classification /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><LazyRoute><PageTransition><Matches /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/match/:matchId" element={<ProtectedRoute><LazyRoute><PageTransition><MatchDetails /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/statistics" element={<ProtectedRoute><LazyRoute><PageTransition><Statistics /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/players" element={<ProtectedRoute><LazyRoute><PageTransition><ManagePlayers /></PageTransition></LazyRoute></ProtectedRoute>} />

        <Route path="/admin/monitoring" element={<ProtectedRoute><LazyRoute><PageTransition><ProfileMonitoring /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/teams" element={<ProtectedRoute><LazyRoute><PageTransition><Teams /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/teams/define" element={<ProtectedRoute><LazyRoute><PageTransition><DefineTeams /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/teams/manage" element={<ProtectedRoute><LazyRoute><PageTransition><ManageTeams /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/edit" element={<ProtectedRoute><LazyRoute><PageTransition><EditRound /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/view" element={<ProtectedRoute><LazyRoute><PageTransition><ViewRound /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/match/:matchId/:roundId" element={<ProtectedRoute><LazyRoute><PageTransition><ManageMatch /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/attendance" element={<ProtectedRoute><LazyRoute><PageTransition><ManageAttendance /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/round/:roundId/attendance-old" element={<ProtectedRoute><LazyRoute><PageTransition><AttendanceRecord /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/round" element={<ProtectedRoute><LazyRoute><PageTransition><StartRound /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/round/manage" element={<ProtectedRoute><LazyRoute><PageTransition><ManageRounds /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/profile" element={<ApprovedOnlyRoute><LazyRoute><PageTransition><Profile /></PageTransition></LazyRoute></ApprovedOnlyRoute>} />
        <Route path="/profile/:id" element={<ApprovedOnlyRoute><LazyRoute><PageTransition><Profile /></PageTransition></LazyRoute></ApprovedOnlyRoute>} />
        <Route path="/times" element={<ProtectedRoute><LazyRoute><PageTransition><ViewTeams /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/teams/view" element={<ProtectedRoute><LazyRoute><PageTransition><ViewTeams /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/players-list" element={<ProtectedRoute><LazyRoute><PageTransition><PlayersList /></PageTransition></LazyRoute></ProtectedRoute>} />
        <Route path="/coz-ia" element={<ProtectedRoute><LazyRoute><PageTransition><CozIA /></PageTransition></LazyRoute></ProtectedRoute>} />
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
          <BottomNavbar />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;