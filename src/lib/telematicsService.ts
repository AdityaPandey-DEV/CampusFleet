import { supabase } from "./supabaseClient";
import { LiveBusLocation } from "./types";

export type TelematicsListener = (location: LiveBusLocation) => void;

class TelematicsService {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<TelematicsListener> = new Set();
  private initialized = false;

  // Throttling timers to protect cloud quotas
  private lastSupabaseBroadcastTime = 0;
  private lastApiPostTime = 0;
  private readonly SUPABASE_THROTTLE_MS = 4000; // Max 1 WebSocket broadcast per 4 seconds
  private readonly API_POST_THROTTLE_MS = 3000;  // Max 1 Mongo/Redis sync per 3 seconds

  // Polling fallback mechanism
  private pollingTimer: NodeJS.Timeout | null = null;
  private activePollingBusId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initChannels();
    }
  }

  private initChannels() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Supabase Realtime Broadcast Channel (Network / Multi-device WebSockets)
    try {
      this.channel = supabase.channel("fleet-telematics", {
        config: {
          broadcast: { self: false },
        },
      });

      this.channel
        .on("broadcast", { event: "bus-telematics-ping" }, ({ payload }) => {
          if (payload && typeof payload.latitude === "number" && typeof payload.longitude === "number") {
            this.notifyListeners(payload as LiveBusLocation);
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Connected to WebSocket cluster
          }
        });
    } catch (e) {
      console.warn("Realtime telematics channel init notice:", e);
    }

    // 2. Native HTML5 BroadcastChannel (Zero-disk in-memory cross-tab communication)
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        this.localBroadcastChannel = new BroadcastChannel("campusfleet_telematics");
        this.localBroadcastChannel.onmessage = (event) => {
          if (event?.data && typeof event.data.latitude === "number") {
            this.notifyListeners(event.data as LiveBusLocation);
          }
        };
      }
    } catch (e) {
      console.warn("Local BroadcastChannel not supported/available:", e);
    }
  }

  /**
   * Broadcast high-frequency live coordinates.
   * Architecture:
   * 1. In-tab & Local HTML5 BroadcastChannel: 0 latency, in-memory, 0 cloud cost.
   * 2. MongoDB & Redis Telematics API: Throttled, offloads high-velocity data from PostgreSQL.
   * 3. Supabase Realtime: Throttled to 4 seconds to prevent quota overages.
   */
  public async broadcastLiveLocation(location: LiveBusLocation): Promise<void> {
    // A. Notify local in-tab listeners immediately (<1ms)
    this.notifyListeners(location);

    // B. Send via local HTML5 BroadcastChannel (cross-tab in-memory, 0 quota cost)
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage(location);
      } catch (e) {
        console.warn("Failed to post to local BroadcastChannel:", e);
      }
    }

    const now = Date.now();

    // C. Persist to MongoDB & Redis Telematics API (throttled to 3s)
    if (now - this.lastApiPostTime >= this.API_POST_THROTTLE_MS && location.busId) {
      this.lastApiPostTime = now;
      try {
        fetch("/api/telematics/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            busId: location.busId,
            tripId: location.tripId,
            latitude: location.latitude,
            longitude: location.longitude,
            speedKmh: location.speedKmh,
            headingDeg: location.headingDeg,
            currentStopId: location.currentStopId,
            delayMinutes: location.delayMinutes,
          }),
        }).catch(() => {});
      } catch {
        // Silent fail for offline scenarios
      }
    }

    // D. Send via Supabase Realtime WebSockets (Throttled to 4s to protect 2M message quota)
    if (this.channel && now - this.lastSupabaseBroadcastTime >= this.SUPABASE_THROTTLE_MS) {
      this.lastSupabaseBroadcastTime = now;
      try {
        await this.channel.send({
          type: "broadcast",
          event: "bus-telematics-ping",
          payload: location,
        });
      } catch (e) {
        console.warn("Supabase Realtime broadcast notice (falling back to Mongo/Redis):", e);
      }
    }
  }

  /**
   * Start polling MongoDB / Redis fallback for a specific bus.
   * Useful when Supabase Realtime reaches free plan limits or is restricted.
   */
  public startPolling(busId: string, intervalMs = 4000): void {
    if (this.pollingTimer && this.activePollingBusId === busId) return;
    this.stopPolling();
    this.activePollingBusId = busId;

    const poll = async () => {
      try {
        const res = await fetch(`/api/telematics/live?busId=${encodeURIComponent(busId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.liveLocation) {
            this.notifyListeners(data.liveLocation);
          }
        }
      } catch {
        // Network offline
      }
    };

    poll();
    this.pollingTimer = setInterval(poll, intervalMs);
  }

  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.activePollingBusId = null;
  }

  /**
   * Subscribe to live location updates from any device or tab.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: TelematicsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(location: LiveBusLocation) {
    this.listeners.forEach((listener) => {
      try {
        listener(location);
      } catch (err) {
        console.error("Error in telematics listener callback:", err);
      }
    });
  }

  public cleanup() {
    this.stopPolling();
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.localBroadcastChannel) {
      this.localBroadcastChannel.close();
      this.localBroadcastChannel = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const telematicsService = new TelematicsService();
