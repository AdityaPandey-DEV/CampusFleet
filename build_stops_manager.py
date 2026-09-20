import os

with open("src/components/staff/StaffRoutesView.tsx", "r") as f:
    lines = f.readlines()

out = lines[0:171]
out.append("  return (\n")
out.append("    <div className=\"space-y-6 animate-in fade-in pb-12\">\n")

# Find STOPS tab
tab3_start = -1
tab3_end = -1
for i, line in enumerate(lines):
    if "{/* TAB 3: STOPS" in line:
        tab3_start = i - 1
    if "{/* MODAL 1: CREATE / EDIT STOP" in line:
        tab3_end = i - 2
        break

if tab3_start != -1 and tab3_end != -1:
    out.extend(lines[tab3_start:tab3_end+1])

# Find MODAL 1
modal1_start = -1
modal1_end = -1
for i, line in enumerate(lines):
    if "{/* MODAL 1: CREATE / EDIT STOP" in line:
        modal1_start = i - 1
    if "{/* MODAL 2: CENTRAL CAMPUS TERMINAL" in line:
        modal1_end = i - 2
        break

if modal1_start != -1 and modal1_end != -1:
    out.extend(lines[modal1_start:modal1_end+1])

out.append("    </div>\n")
out.append("  );\n")
out.append("}\n")

# Replace component name
for i in range(len(out)):
    if "export default function StaffRoutesView" in out[i]:
        out[i] = "export default function StopsManager({\n"
    elif "activeTab === \"STOPS\" && (" in out[i]:
        out[i] = out[i].replace("activeTab === \"STOPS\" && (", "{true && (")

with open("src/components/staff/routes/stops/StopsManager.tsx", "w") as f:
    f.writelines(out)

print("Created StopsManager.tsx")
