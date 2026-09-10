"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const THEME_EVENT = "zettelruhe-theme";

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("zettelruhe-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(THEME_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(THEME_EVENT, handler);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    window.localStorage.setItem("zettelruhe-theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, [theme]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      aria-label={
        theme === "dark" ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
      {theme === "dark" ? "Hell" : "Dunkel"}
    </Button>
  );
}
