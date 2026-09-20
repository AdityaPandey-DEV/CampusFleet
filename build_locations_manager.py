import os

with open("src/components/staff/StaffRoutesView.tsx", "r") as f:
    lines = f.readlines()

# Extract from 0 to 171 (imports and state, up to useEffect hook end)
out = lines[0:171]

# We need to add the Location tabs. Tab 2 is from 1248 to 1428
# Let's verify the exact lines. Wait, it's safer to just extract dynamically.
tab2_start = -1
tab2_end = -1
for i, line in enumerate(lines):
    if "{/* TAB 2: CAMPUS LOCATIONS (Institutional Campus CRUD)           */}" in line:
        tab2_start = i - 1
    if "{/* TAB 3: STOPS                                                  */}" in line:
        tab2_end = i - 2
        break

if tab2_start != -1 and tab2_end != -1:
    out.extend(lines[tab2_start:tab2_end+1])

# Then we need the Modals! Wait, actually, if I just want the Campus Locations page, I just need the Campus Tab AND the Campus Modals!
# Modal 2 starts at:
modal2_start = -1
modal2_end = -1
for i, line in enumerate(lines):
    if "{/* MODAL 2: CENTRAL CAMPUS TERMINAL" in line:
        modal2_start = i - 1
    if "{/* MODAL 2: INTERACTIVE FLOWCHART ROUTE BUILDER" in line:
        modal2_end = i - 2
        break

if modal2_start != -1 and modal2_end != -1:
    out.extend(lines[modal2_start:modal2_end+1])

out.append("    </div>\n")
out.append("  );\n")
out.append("}\n")

# Replace component name
for i in range(len(out)):
    if "export default function StaffRoutesView" in out[i]:
        out[i] = "export default function CampusLocationsManager({\n"
    elif "activeTab === \"CAMPUS_LOCATIONS\" && (" in out[i]:
        out[i] = out[i].replace("activeTab === \"CAMPUS_LOCATIONS\" && (", "{true && (")

with open("src/components/staff/routes/locations/CampusLocationsManager.tsx", "w") as f:
    f.writelines(out)

print("Created CampusLocationsManager.tsx")
