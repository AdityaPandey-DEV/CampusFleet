import re

with open('src/components/staff/routes/locations/CampusLocationsManager.tsx', 'r') as f:
    text = f.read()

# Add store import if not exists
if 'import store from' not in text:
    text = text.replace('import React', 'import store from "@/store";\nimport React')

handlers = """
  const handleOpenCreateCampusLocation = () => {
    setEditingCampus(null);
    setCampusLocationInputMode("MAP_PIN");
    const primaryCampus = campuses.find(c => c.isPrimary);
    setCampusLocationFormData({
      name: "",
      code: "",
      address: "",
      landmark: "",
      latitude: primaryCampus?.latitude || 29.375015,
      longitude: primaryCampus?.longitude || 79.529479,
      geofenceRadiusMeters: 100,
      fleetCapacity: 50,
      parkingBays: 20,
      contactPhone: "",
      contactEmail: "",
      isPrimary: campuses.length === 0,
      isActive: true,
    });
    setIsCampusModalOpen(true);
  };

  const handleOpenEditCampusLocation = (campus: Campus) => {
    setEditingCampus(campus);
    setCampusLocationInputMode("MAP_PIN");
    setCampusLocationFormData({
      name: campus.name,
      code: campus.code,
      address: campus.address || "",
      landmark: campus.landmark || "",
      latitude: campus.latitude,
      longitude: campus.longitude,
      geofenceRadiusMeters: campus.geofenceRadiusMeters || 100,
      fleetCapacity: campus.fleetCapacity || 50,
      parkingBays: campus.parkingBays || 20,
      contactPhone: campus.contactPhone || "",
      contactEmail: campus.contactEmail || "",
      isPrimary: Boolean(campus.isPrimary),
      isActive: campus.isActive !== false,
    });
    setIsCampusModalOpen(true);
  };

  const handleSaveCampusLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusLocationFormData.name.trim() || !campusLocationFormData.code.trim()) {
      alert("Please provide both Campus Name and Campus Code.");
      return;
    }
    setIsSavingCampusLocation(true);
    try {
      if (editingCampus) {
        await store.updateCampus(editingCampus.id, campusLocationFormData);
      } else {
        await store.createCampus(campusLocationFormData);
      }
      setIsCampusModalOpen(false);
      setEditingCampus(null);
    } catch (err: any) {
      alert("Error saving campus location: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingCampusLocation(false);
    }
  };

  const handleDeleteCampusLocation = async (campus: Campus) => {
    if (campuses.length <= 1) {
      alert("Cannot delete the sole campus location in the system.");
      return;
    }
    if (!confirm(`Delete campus location "${campus.name}"? This action cannot be undone.`)) return;
    try {
      await store.deleteCampus(campus.id);
    } catch (err: any) {
      alert("Error deleting campus: " + (err?.message || "Unknown error"));
    }
  };

  const handleSetPrimaryCampus = async (campus: Campus) => {
    if (campus.isPrimary) return;
    if (!confirm(`Set "${campus.name}" as the Primary Operational Hub?`)) return;
    try {
      await store.setPrimaryCampus(campus.id);
    } catch (err: any) {
      alert("Error setting primary campus: " + (err?.message || "Unknown error"));
    }
  };
"""

text = text.replace('  // Campus Location Modal States\n', handlers + '\n  // Campus Location Modal States\n')

with open('src/components/staff/routes/locations/CampusLocationsManager.tsx', 'w') as f:
    f.write(text)

