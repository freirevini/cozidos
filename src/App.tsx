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
const ViewRoundMatches = lazy(() => import("./pages/ViewRoundMatches"));
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

// ============================================================
// ROUTE WRAPPERS - Access Control
// ============================================================

// PublicRoute: Accessible by everyone (guests and logged users)
// Currently used for ALL public pages including profiles
function PublicRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// AdminOnlyRoute: Requires user to be logged in AND be an admin
// Redirects to /auth if not logged, or to / if not admin
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/');
      }
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading) {
    return <LoadingLogo />;
  }

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}

// ============================================================
// FUTURE USE - Uncomment when needed
// ============================================================

// ProtectedRoute: Requires user to be logged in (any role)
// Redirects to /auth if not logged in
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// ApprovedOnlyRoute: Requires user to be logged in AND approved (for profile access)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        {/* ========== AUTH ========== */}
        <Route path="/auth" element={<Auth />} />

        {/* ========== PUBLIC ROUTES (visitors can access) ========== */}
        <Route path="/" element={<PublicRoute><LazyRoute><PageTransition><HomeRouter /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/classification" element={<PublicRoute><LazyRoute><PageTransition><Classification /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/matches" element={<PublicRoute><LazyRoute><PageTransition><Matches /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/match/:matchId" element={<PublicRoute><LazyRoute><PageTransition><MatchDetails /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/statistics" element={<PublicRoute><LazyRoute><PageTransition><Statistics /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/times" element={<PublicRoute><LazyRoute><PageTransition><ViewTeams /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/teams/view" element={<PublicRoute><LazyRoute><PageTransition><ViewTeams /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/players-list" element={<PublicRoute><LazyRoute><PageTransition><PlayersList /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/coz-ia" element={<PublicRoute><LazyRoute><PageTransition><CozIA /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/profile" element={<PublicRoute><LazyRoute><PageTransition><Profile /></PageTransition></LazyRoute></PublicRoute>} />
        <Route path="/profile/:id" element={<PublicRoute><LazyRoute><PageTransition><Profile /></PageTransition></LazyRoute></PublicRoute>} />

        {/* FUTURE USE: Uncomment to require login for profiles
        <Route path="/profile" element={<ApprovedOnlyRoute><LazyRoute><PageTransition><Profile /></PageTransition></LazyRoute></ApprovedOnlyRoute>} />
        <Route path="/profile/:id" element={<ApprovedOnlyRoute><LazyRoute><PageTransition><Profile /></PageTransition></LazyRoute></ApprovedOnlyRoute>} />
        */}

        {/* ========== ADMIN ROUTES (requires login + admin role) ========== */}
        <Route path="/admin/players" element={<AdminOnlyRoute><LazyRoute><PageTransition><ManagePlayers /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/monitoring" element={<AdminOnlyRoute><LazyRoute><PageTransition><ProfileMonitoring /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/teams" element={<AdminOnlyRoute><LazyRoute><PageTransition><Teams /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/teams/define" element={<AdminOnlyRoute><LazyRoute><PageTransition><DefineTeams /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/teams/manage" element={<AdminOnlyRoute><LazyRoute><PageTransition><ManageTeams /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round/:roundId/edit" element={<AdminOnlyRoute><LazyRoute><PageTransition><EditRound /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round/:roundId/view" element={<AdminOnlyRoute><LazyRoute><PageTransition><ViewRound /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round/:roundId/matches" element={<AdminOnlyRoute><LazyRoute><PageTransition><ViewRoundMatches /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/match/:matchId/:roundId" element={<AdminOnlyRoute><LazyRoute><PageTransition><ManageMatch /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round/:roundId/attendance" element={<AdminOnlyRoute><LazyRoute><PageTransition><ManageAttendance /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round/:roundId/attendance-old" element={<AdminOnlyRoute><LazyRoute><PageTransition><AttendanceRecord /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round" element={<AdminOnlyRoute><LazyRoute><PageTransition><StartRound /></PageTransition></LazyRoute></AdminOnlyRoute>} />
        <Route path="/admin/round/manage" element={<AdminOnlyRoute><LazyRoute><PageTransition><ManageRounds /></PageTransition></LazyRoute></AdminOnlyRoute>} />

        {/* ========== CATCH-ALL ========== */}
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