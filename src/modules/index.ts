import {
  BusFront,
  Route,
  Navigation,
  UserCheck,
  CreditCard,
  GraduationCap,
  Wrench,
  FileText,
  Users,
  ShieldCheck,
  GitFork,
  Compass,
  Building2,
  LucideIcon
} from "lucide-react";
import type { SystemCard, SystemRoleDefinition } from "@/lib/types";

/**
 * Dynamic Icon Map
 * Maps icon string names stored in the database (system_cards.icon)
 * to their corresponding UI Icon components.
 */
export const SYSTEM_ICON_MAP: Record<string, LucideIcon> = {
  BusFront,
  Route,
  Navigation,
  UserCheck,
  CreditCard,
  GraduationCap,
  Wrench,
  FileText,
  Users,
  ShieldCheck,
  GitFork,
  Compass,
  Building2,
};

export function getCardIcon(iconName: string): LucideIcon {
  return SYSTEM_ICON_MAP[iconName] || Compass;
}
