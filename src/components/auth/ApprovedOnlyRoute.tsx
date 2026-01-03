import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ApprovedOnlyRouteProps {
    children: ReactNode;
}

/**
 * Route wrapper that only allows approved users.
 * Redirects unauthenticated users to /auth
 * Redirects pending users to home with a message
 */
export function ApprovedOnlyRoute({ children }: ApprovedOnlyRouteProps) {
    const { user, isApproved, loading, isPending } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Not logged in
    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    // Logged in but not approved (pending status)
    if (!isApproved) {
        // Redirect to home, the GlobalPendingBanner will handle messaging
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

export default ApprovedOnlyRoute;
