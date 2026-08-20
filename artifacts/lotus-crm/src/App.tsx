import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { setBaseUrl } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useMyPermissions, type EffectivePermissions } from "@/lib/api-extra";
import { AppLayout } from "@/components/layout";

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ChatPage from "@/pages/chat";
import CustomersPage from "@/pages/customers";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import InsightsPage from "@/pages/insights";
import MarketingPage from "@/pages/marketing";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

type PageComponent = React.ComponentType<Record<string, never>>;

interface RouteProps {
  component: PageComponent;
}

// Protected Route Component
const ProtectedRoute = ({ component: Component }: RouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
};

// Admin Route Component
const AdminRoute = ({ component: Component }: RouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
};

// Permission-gated route
const PermissionRoute = ({
  component: Component,
  permission,
  fallback = "/dashboard",
}: RouteProps & { permission: keyof EffectivePermissions; fallback?: string }) => {
  const { user, isLoading } = useAuth();
  const { data: perms, isLoading: permsLoading } = useMyPermissions();

  if (isLoading || permsLoading) {
    return <div className="h-screen w-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!user) return <Redirect to="/login" />;
  if (!perms?.[permission]) return <Redirect to={fallback} />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
};

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      {/* Root redirect */}
      <Route path="/">
        {() => <Redirect to={user ? "/dashboard" : "/login"} />}
      </Route>

      {/* Protected Routes */}
      <Route path="/dashboard">{() => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/chat">{() => <PermissionRoute component={ChatPage} permission="canViewChats" />}</Route>
      <Route path="/customers">{() => <PermissionRoute component={CustomersPage} permission="canManageCustomers" fallback="/dashboard" />}</Route>
      <Route path="/reports">{() => <PermissionRoute component={ReportsPage} permission="canViewReports" />}</Route>
      <Route path="/insights">{() => <PermissionRoute component={InsightsPage} permission="canViewChats" />}</Route>
      <Route path="/marketing">{() => <AdminRoute component={MarketingPage} />}</Route>

      {/* Admin Route */}
      <Route path="/settings">{() => <AdminRoute component={SettingsPage} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Set the API base URL for the generated client
    const apiUrl = import.meta.env.DEV ? "" : window.location.origin;
    setBaseUrl(apiUrl);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <LocaleProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
          </LocaleProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
