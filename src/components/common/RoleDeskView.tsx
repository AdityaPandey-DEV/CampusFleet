import React from "react";
import { getRolesWithHierarchy, getSystemCards } from "@/modules/rbac/rbac-service";
import { HubDashboardView, HubModule } from "@/components/common/HubDashboardView";
import { getCardIcon } from "@/modules";
import { notFound } from "next/navigation";

interface RoleDeskViewProps {
  roleKey: string;
}

export async function RoleDeskView({ roleKey }: RoleDeskViewProps) {
  // Normalize role key (handle hyphens or underscores e.g. transport-admin -> transport_admin)
  const normalizedKey = roleKey.toLowerCase().replace(/-/g, "_");

  const [roles, allCards] = await Promise.all([
    getRolesWithHierarchy(),
    getSystemCards(),
  ]);

  const roleDef = roles.find(
    (r) =>
      r.key === normalizedKey ||
      (r.portalPath && r.portalPath.replace(/^\//, "").replace(/-/g, "_") === normalizedKey)
  );

  if (!roleDef) {
    notFound();
  }

  // Cards map
  const cardMap = new Map(allCards.map((c) => [c.key, c]));

  // Display only the direct cards assigned to this specific role desk
  // This keeps the Admin desk clean with only Admin cards, and delegates other desks to their portals.
  const allowedCardKeys =
    roleDef.directCards && roleDef.directCards.length > 0
      ? roleDef.directCards
      : (roleDef.allEffectiveCards || []);

  const roleSlug = roleDef.portalPath ? roleDef.portalPath.replace(/^\//, "") : roleDef.key.replace(/_/g, "-");

  const modules: HubModule[] = [];

  for (const cardKey of allowedCardKeys) {
    const card = cardMap.get(cardKey);
    if (!card) continue;

    // Build URL following the user's pattern: /rolefromdb/cardname
    // Special exception for role_manager card: always goes to /role-manager
    const cardSlug = card.key.replace(/_/g, "-");
    const href = card.route || (card.key === "role_manager" ? "/role-manager" : `/${roleSlug}/${cardSlug}`);

    modules.push({
      title: card.title,
      description: card.description,
      icon: getCardIcon(card.icon),
      href,
    });
  }

  return (
    <HubDashboardView
      title={roleDef.name}
      subtitle={roleDef.description || `Manage ${roleDef.name} operations, capabilities, and functional desks.`}
      modules={modules}
    />
  );
}
