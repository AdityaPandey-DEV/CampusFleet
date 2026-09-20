with open('src/components/staff/routes/corridors/CorridorsManager.tsx', 'r') as f:
    text = f.read()

# I want to extract the state block and the handlers block.
# State block starts around line 120 (const [isRouteBuilderOpen) and ends around line 150
# Handlers block starts around line 500 (const builderOrderedStopIds) and ends around line 680 (handleSaveRoute)

