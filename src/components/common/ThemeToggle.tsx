"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
      <button
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
          theme === "light"
            ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title="Light Theme"
        aria-label="Light Theme"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
          theme === "dark"
            ? "bg-slate-900 text-blue-400 shadow-sm border border-slate-700"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title="Dark Theme"
        aria-label="Dark Theme"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>

      <button
        onClick={() => setTheme("system")}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
          theme === "system"
            ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title="System Match"
        aria-label="System Theme"
      >
        <Laptop className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">System</span>
      </button>
    </div>
  );
}
