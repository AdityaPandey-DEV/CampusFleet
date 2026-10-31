"use client";

import React, { Suspense } from "react";
import { ChatPortalView } from "@/components/chat/ChatPortalView";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-400">
          Loading CampusFleet Chat...
        </div>
      }
    >
      <ChatPortalView />
    </Suspense>
  );
}
