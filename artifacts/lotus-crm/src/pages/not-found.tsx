import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useT } from "@/i18n";

export default function NotFound() {
  const t = useT();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
            <h1 className="text-2xl font-bold text-foreground">{t("notFound.title")}</h1>
          </div>

          <p className="text-sm text-muted-foreground">{t("notFound.message")}</p>

          <Button asChild className="mt-6 w-full">
            <Link href="/dashboard">{t("notFound.goHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
