import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Leaf } from "lucide-react";
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
  email: z.string().email("Please enter a valid email address"),
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

  const companyName = branding?.companyName ?? "Lotus Pharmacies";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/40 px-4 relative overflow-hidden">
      {/* Decorative ambient blobs in brand colours */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-6 duration-700">
        <div className="mb-10 flex flex-col items-center justify-center text-center">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={companyName}
              className="h-28 w-28 mb-6 rounded-3xl object-cover ring-2 ring-primary/20 shadow-xl shadow-primary/10"
              data-testid="login-logo"
            />
          ) : (
            <div className="bg-primary text-primary-foreground p-5 rounded-3xl mb-6 shadow-xl shadow-primary/20 ring-2 ring-primary/20">
              <Leaf className="h-12 w-12" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent">
            {companyName}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            CRM &amp; Conversation Platform
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="agent@lotuspharmacies.com"
                  {...form.register("email")}
                  className={
                    form.formState.errors.email
                      ? "border-destructive transition-colors"
                      : "transition-colors"
                  }
                  data-testid="input-email"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  className={
                    form.formState.errors.password
                      ? "border-destructive transition-colors"
                      : "transition-colors"
                  }
                  data-testid="input-password"
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full mt-2 transition-transform active:scale-[0.98]"
                disabled={loginMutation.isPending}
                data-testid="button-submit-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground text-center">
              Authorized personnel only. For access issues, contact IT support.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
