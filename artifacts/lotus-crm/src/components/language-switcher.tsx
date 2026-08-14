import { useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useLocale();

  if (compact) {
    return (
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={lang === "en" ? "default" : "outline"}
          className="flex-1 text-xs"
          onClick={() => setLang("en")}
        >
          EN
        </Button>
        <Button
          type="button"
          size="sm"
          variant={lang === "ar" ? "default" : "outline"}
          className="flex-1 text-xs font-arabic"
          onClick={() => setLang("ar")}
        >
          ع
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("common.language")}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLang("en")} className={lang === "en" ? "font-semibold" : ""}>
          {t("common.english")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang("ar")} className={lang === "ar" ? "font-semibold" : ""}>
          {t("common.arabic")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
