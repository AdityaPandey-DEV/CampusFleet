with open('src/components/staff/routes/stops/StopsManager.tsx', 'r') as f:
    text = f.read()

import re

# Add mode prop
text = text.replace('export default function StopsManager() {', 'import { StopBuilderModal } from "./StopBuilderModal";\n\nexport default function StopsManager({ mode = "view" }: { mode?: "view" | "create" }) {')

# Find the start of the return statement
start = text.find('return (\n    <div className="space-y-6 animate-in fade-in pb-12">')
if start != -1:
    # insert conditional return for create mode
    new_return = """return (
    <div className="space-y-6 animate-in fade-in pb-12 h-full">
      {mode === "create" ? (
        <StopBuilderModal
          isAddStopModalOpen={true}
          setIsAddStopModalOpen={setIsAddStopModalOpen}
          editingStop={editingStop}
          stopFormData={stopFormData}
          setStopFormData={setStopFormData}
          stopInputMode={stopInputMode}
          setStopInputMode={setStopInputMode}
          handleSaveStop={handleSaveStop}
          isSavingStop={isSavingStop}
          designatedCampusId={designatedCampusId}
          setDesignatedCampusId={setDesignatedCampusId}
          campuses={campuses}
        />
      ) : (
"""
    # we need to close the conditional at the end
    text = text.replace('return (\n    <div className="space-y-6 animate-in fade-in pb-12">', new_return)
    text = text.replace('    </div>\n  );\n}', '      )}\n    </div>\n  );\n}')
    
    with open('src/components/staff/routes/stops/StopsManager.tsx', 'w') as f:
        f.write(text)
    print("Patched StopsManager")
else:
    print("Could not find return statement")
