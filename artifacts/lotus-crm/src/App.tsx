import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout";

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ChatPage from "@/pages/chat";
import CustomersPage from "@/pages/customers";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

// Protected Route Component
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
};

// Admin Route Component
const AdminRoute = ({ component: Component, ...rest }: any) => {
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
      <Component {...rest} />
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
      <Route path="/dashboard">{(params) => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/chat">{(params) => <ProtectedRoute component={ChatPage} />}</Route>
      <Route path="/customers">{(params) => <ProtectedRoute component={CustomersPage} />}</Route>
      <Route path="/reports">{(params) => <ProtectedRoute component={ReportsPage} />}</Route>
      
      {/* Admin Route */}
      <Route path="/settings">{(params) => <AdminRoute component={SettingsPage} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
