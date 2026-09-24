"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { SupportedLanguage } from "@/lib/types";
import { getTranslation, LANGUAGE_OPTIONS } from "@/lib/translations";

interface LanguageContextType {
  primaryLanguage: SupportedLanguage;
  secondaryLanguage: SupportedLanguage | null;
  setPrimaryLanguage: (lang: SupportedLanguage) => void;
  setSecondaryLanguage: (lang: SupportedLanguage | null) => void;
  t: (key: string) => string;
  languageOptions: typeof LANGUAGE_OPTIONS;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "campusfleet_lang";
const STORAGE_KEY_SECONDARY = "campusfleet_lang_secondary";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [primaryLanguage, setPrimaryLangState] = useState<SupportedLanguage>("en");
  const [secondaryLanguage, setSecondaryLangState] = useState<SupportedLanguage | null>(null);

  // Load saved language preference from localStorage on mount
  useEffect(() => {
    try {
      const savedPrimary = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      const savedSecondary = localStorage.getItem(STORAGE_KEY_SECONDARY) as SupportedLanguage | null;

      if (savedPrimary && LANGUAGE_OPTIONS.some(l => l.code === savedPrimary)) {
        setPrimaryLangState(savedPrimary);
      }
      if (savedSecondary && LANGUAGE_OPTIONS.some(l => l.code === savedSecondary)) {
        setSecondaryLangState(savedSecondary);
      }
    } catch {
      // localStorage might not be available (SSR)
    }
  }, []);

  // Set primary language — updates React state instantly, no page reload
  const setPrimaryLanguage = useCallback((lang: SupportedLanguage) => {
    if (lang === primaryLanguage) return;
    setPrimaryLangState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, [primaryLanguage]);

  const setSecondaryLanguage = useCallback((lang: SupportedLanguage | null) => {
    setSecondaryLangState(lang);
    try {
      if (lang) {
        localStorage.setItem(STORAGE_KEY_SECONDARY, lang);
      } else {
        localStorage.removeItem(STORAGE_KEY_SECONDARY);
      }
    } catch {}
  }, []);

  // Translation function — looks up the key in our dictionary,
  // falls back to English if the key is missing in the target language
  const t = useCallback((key: string): string => {
    return getTranslation(primaryLanguage, key);
  }, [primaryLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        primaryLanguage,
        secondaryLanguage,
        setPrimaryLanguage,
        setSecondaryLanguage,
        t,
        languageOptions: LANGUAGE_OPTIONS,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
