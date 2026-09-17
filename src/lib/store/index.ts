/**
 * CampusFleet Store — Modular Singleton Facade
 *
 * This file orchestrates the store by importing the base class and all
 * domain modules that extend it via prototype augmentation. Consumer files
 * continue to use: import { store } from "@/lib/store"
 *
 * Module layout:
 *   _base.ts    → Class definition, state fields, reactive core (subscribe/notify)
 *   sync.ts     → Database sync (syncFromSupabase), realtime, cross-tab, telematics
 *   auth.ts     → Authentication lifecycle (login/logout/switchRole)
 *   getters.ts  → All read-only accessors and computed getters
 *   graph.ts    → Graph algorithms (Dijkstra, A*, Floyd-Warshall, Kruskal MST)
 *   crud.ts     → Create/Update/Delete for all entities
 *   booking.ts  → Booking, attendance, cancellation
 */

// 1. Import base class (state + reactive core)
import { CampusFleetStore } from "./_base";

// 2. Apply domain mixins (each augments CampusFleetStore prototype)
import "./sync";
import "./auth";
import "./getters";
import "./graph";
import "./crud";
import "./booking";

// 3. Create singleton and initialize
const _store = new CampusFleetStore();

if (typeof window !== "undefined") {
  _store.loadFromLocalStorage();
  _store.syncFromSupabase();
  _store.initAuthSync();
  _store.initTelematicsSync();
  _store.initCrossTabSync();
  _store.initSupabaseRealtime();
  _store.initStudentPaymentSync();
}

// 4. Export singleton (all 40+ consumer files import this)
export const store = _store;

// 5. Re-export constants for backward compatibility
export {
  INITIAL_STOPS,
  INITIAL_ROUTES,
  INITIAL_BUSES,
  INITIAL_SHIFTS,
  INITIAL_TRIPS,
  INITIAL_STUDENTS,
  INITIAL_GUARDIANS,
  INITIAL_STAFF,
  INITIAL_BOOKINGS,
  INITIAL_PLANS,
  INITIAL_PAYMENTS,
  INITIAL_ISSUES,
  INITIAL_MAINTENANCE,
  INITIAL_NOTIFICATIONS,
  INITIAL_LIVE_LOCATION,
} from "./_base";
