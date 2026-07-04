import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/lib/api-extra";

const loginSchema = z.object({
  email: z.string().trim().min(2, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const loginMutation = useLogin();
  const { data: branding } = useBranding();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token);
          setLocation("/dashboard");
        },
        onError: (err) => {
          toast({
            title: "Login failed",
            description:
              err.data?.error || "Invalid credentials. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const companyName = branding?.companyName ?? "Fratelanza Chat Management System";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      {/* Animated background elements */}
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute top-1/2 left-1/4 h-60 w-60 rounded-full bg-primary/5 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: "2s" }} />

      <div className="relative w-full max-w-md">
        {/* Header section with premium styling */}
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <div className="mb-6 relative">
            {branding?.logoUrl ? (
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-primary rounded-2xl blur-lg opacity-50 animate-pulse" />
                <img
                  src={branding.logoUrl}
                  alt={companyName}
                  className="relative h-32 w-32 rounded-2xl object-cover border-2 border-primary/30 shadow-2xl"
                  data-testid="login-logo"
                />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-2xl blur-lg" />
                <div className="relative bg-gradient-to-br from-primary to-accent text-primary-foreground p-6 rounded-2xl shadow-2xl border border-primary/20">
                  <Zap className="h-16 w-16 drop-shadow-lg" />
                </div>
              </div>
            )}
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent mb-2">
            {companyName}
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Modern Communication Platform
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-1 w-8 bg-gradient-to-r from-primary to-accent rounded-full" />
            <div className="h-1 w-1 bg-primary rounded-full" />
            <div className="h-1 w-8 bg-gradient-to-r from-accent to-primary rounded-full" />
          </div>
        </div>

        {/* Login card with premium styling */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl blur-xl" />
          <Card className="relative border-border/50 backdrop-blur-xl bg-background/80 shadow-2xl">
            <CardHeader className="space-y-1 pb-6 border-b border-border/30">
              <CardTitle className="text-2xl bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Welcome Back</CardTitle>
              <CardDescription className="text-sm">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-medium text-foreground">Username</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="admin"
                    autoComplete="username"
                    {...form.register("email")}
                    className={`h-11 bg-background/50 border-border/30 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                      form.formState.errors.email ? "border-destructive" : ""
                    }`}
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive font-medium">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-medium text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...form.register("password")}
                    className={`h-11 bg-background/50 border-border/30 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                      form.formState.errors.password ? "border-destructive" : ""
                    }`}
                    data-testid="input-password"
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive font-medium">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>
                
                <Button
                  type="submit"
                  className="w-full h-11 mt-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all transform active:scale-95 font-medium text-base group"
                  disabled={loginMutation.isPending}
                  data-testid="button-submit-login"
                >
                  <span>{loginMutation.isPending ? "Signing in..." : "Sign In"}</span>
                  {!loginMutation.isPending && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="border-t border-border/30 pt-4 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground text-center">
                Authorized personnel only.<br />For access issues, contact your administrator.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
