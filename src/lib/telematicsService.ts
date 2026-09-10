import { supabase } from "./supabaseClient";
import { LiveBusLocation } from "./types";

export type TelematicsListener = (location: LiveBusLocation) => void;

class TelematicsService {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<TelematicsListener> = new Set();
  private initialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initChannels();
    }
  }

  private initChannels() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Supabase Realtime Broadcast Channel (Network / Multi-device WebSockets, 0 DB writes)
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
      console.warn("Realtime telematics channel init error:", e);
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
   * Sends directly via Supabase Realtime WebSockets and in-memory BroadcastChannel.
   * Does NOT write to PostgreSQL tables on every ping (0 database I/O cost).
   * Does NOT write to localStorage (0 disk footprint).
   */
  public async broadcastLiveLocation(location: LiveBusLocation): Promise<void> {
    // Notify local in-tab listeners immediately
    this.notifyListeners(location);

    // 1. Send via local BroadcastChannel (cross-tab in-memory)
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage(location);
      } catch (e) {
        console.warn("Failed to post to local BroadcastChannel:", e);
      }
    }

    // 2. Send via Supabase Realtime WebSockets (network / multi-device)
    if (this.channel) {
      try {
        await this.channel.send({
          type: "broadcast",
          event: "bus-telematics-ping",
          payload: location,
        });
      } catch (e) {
        console.warn("Failed to broadcast telematics via Supabase Realtime:", e);
      }
    }
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
