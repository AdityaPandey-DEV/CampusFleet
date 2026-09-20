import os

with open("src/components/staff/StaffRoutesView.tsx", "r") as f:
    lines = f.readlines()

# Extract lines 1 to 1242 (indices 0 to 1241)
out = lines[0:1242]

# Add the imports at the top (after use client)
out.insert(2, "import { RouteBuilderModal } from './RouteBuilderModal';\n")
out.insert(3, "import { AllocateBusModal } from './AllocateBusModal';\n")

# Replace component name
for i in range(len(out)):
    if "export default function StaffRoutesView" in out[i]:
        out[i] = "export default function CorridorsManager({\n"
    elif "activeTab === \"ROUTES\" && (" in out[i]:
        out[i] = out[i].replace("activeTab === \"ROUTES\" && (", "{true && (")

# Append the Modals and closing tags
modals = """
      <RouteBuilderModal
        isRouteBuilderOpen={isRouteBuilderOpen}
        setIsRouteBuilderOpen={setIsRouteBuilderOpen}
        editingRouteId={editingRouteId}
        routeBuilderData={routeBuilderData}
        setRouteBuilderData={setRouteBuilderData}
        insertingAtGapIndex={insertingAtGapIndex}
        setInsertingAtGapIndex={setInsertingAtGapIndex}
        stopPickerSearch={stopPickerSearch}
        setStopPickerSearch={setStopPickerSearch}
        activePickerTarget={activePickerTarget}
        setActivePickerTarget={setActivePickerTarget}
        stops={stops}
        campuses={campuses}
        handleReverseRoute={handleReverseRoute}
        handleInsertIntermediateStop={handleInsertIntermediateStop}
        handleShiftIntermediateUp={handleShiftIntermediateUp}
        handleShiftIntermediateDown={handleShiftIntermediateDown}
        handleRemoveIntermediateStop={handleRemoveIntermediateStop}
        handleSaveRoute={handleSaveRoute}
        builderStops={builderStops}
        builderOrderedStopIds={builderOrderedStopIds}
        builderMetrics={builderMetrics}
      />
      <AllocateBusModal
        isAllocateBusModalOpen={isAllocateBusModalOpen}
        setIsAllocateBusModalOpen={setIsAllocateBusModalOpen}
        activeRoute={activeRoute}
        assignedBuses={assignedBuses}
        buses={buses}
        selectedBusToAllocate={selectedBusToAllocate}
        setSelectedBusToAllocate={setSelectedBusToAllocate}
        handleAllocateBus={handleAllocateBus}
        handleDeallocateBus={handleDeallocateBus}
      />
    </div>
  );
}
"""
out.append(modals)

with open("src/components/staff/routes/corridors/CorridorsManager.tsx", "w") as f:
    f.writelines(out)

print("Created CorridorsManager.tsx")
