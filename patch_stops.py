import re

with open('src/components/staff/routes/stops/StopsManager.tsx', 'r') as f:
    text = f.read()

# Add store import if not exists
if 'import store from' not in text:
    text = text.replace('import React', 'import store from "@/store";\nimport React')

handlers = """
  // Dynamically resolved Campus Terminal directly from campuses master table
  const currentCampusStop = React.useMemo(() => {
    const primaryCampus = campuses.find(c => c.isPrimary) || campuses[0] || store.getPrimaryCampus();
    if (primaryCampus) {
      return {
        id: primaryCampus.id,
        name: primaryCampus.name,
        code: primaryCampus.code,
        latitude: primaryCampus.latitude,
        longitude: primaryCampus.longitude,
        landmark: primaryCampus.landmark || primaryCampus.address || `${primaryCampus.name} Hub`,
        geofenceRadiusMeters: primaryCampus.geofenceRadiusMeters || 150,
        campusId: primaryCampus.id,
        zoneCode: "ZONE_CAMPUS",
      };
    }
    return stops[0] || null;
  }, [stops, campuses]);

  const handleOpenCreateStop = () => {
    setEditingStop(null);
    setStopInputMode("MAP_PIN");
    // Suggest station code based on current count
    const nextCode = `ST-0${stops.length + 1}`;
    setStopFormData({
      name: "",
      code: nextCode,
      latitude: currentCampusStop?.latitude || stops[0]?.latitude || 0,
      longitude: currentCampusStop?.longitude || stops[0]?.longitude || 0,
      landmark: "",
      geofenceRadiusMeters: 80,
      isBusMergeStop: false,
    });
    setIsAddStopModalOpen(true);
  };

  const handleOpenEditCampus = (stopToEdit?: Stop | null) => {
    const target = stopToEdit || currentCampusStop;

    if (target) {
      setCampusFormData({
        id: target.id,
        name: target.name,
        code: target.code,
        latitude: target.latitude,
        longitude: target.longitude,
        landmark: target.landmark || "",
        geofenceRadiusMeters: target.geofenceRadiusMeters || 100,
        isBusMergeStop: Boolean(target.isBusMergeStop),
        campusId: target.campusId,
        zoneCode: target.zoneCode,
      });
    } else {
      setCampusFormData(null);
    }
  };

  const handleSaveCampusTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusFormData) return;
    setIsSavingStop(true);
    try {
      if (campusFormData.id) {
        await store.updateStop(campusFormData.id, campusFormData);
        alert(`Campus terminal ${campusFormData.name} updated successfully!`);
      }
      setCampusFormData(null);
    } catch (err) {
      alert("Error saving campus terminal.");
    } finally {
      setIsSavingStop(false);
    }
  };


  const handleOpenEditStop = (stopToEdit: Stop) => {
    setEditingStop(stopToEdit);
    setStopInputMode("MAP_PIN");
    setStopFormData({
      name: stopToEdit.name,
      code: stopToEdit.code,
      latitude: stopToEdit.latitude,
      longitude: stopToEdit.longitude,
      landmark: stopToEdit.landmark || "",
      geofenceRadiusMeters: stopToEdit.geofenceRadiusMeters || 50,
      isBusMergeStop: Boolean(stopToEdit.isBusMergeStop),
    });
    setDesignatedCampusId(stopToEdit.campusId || "");
    setIsAddStopModalOpen(true);
  };

  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopFormData.name.trim() || !stopFormData.code.trim()) {
      alert("Please provide both Stop Name and Code.");
      return;
    }
    setIsSavingStop(true);

    try {
      const payload: Partial<Stop> = {
        ...stopFormData,
        campusId: designatedCampusId || undefined,
        zoneCode: designatedCampusId ? "ZONE_CAMPUS" : "ZONE_CITY",
      };

      if (editingStop) {
        await store.updateStop(editingStop.id, payload);
      } else {
        await store.createStop(payload as Omit<Stop, "id">);
      }
      setIsAddStopModalOpen(false);
      setEditingStop(null);
    } catch (err: any) {
      alert("Error saving stop: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingStop(false);
    }
  };

  const handleDeleteStop = async (stopId: string, stopName: string) => {
    if (confirm(`Delete stop "${stopName}"? This action cannot be undone.`)) {
      try {
        await store.deleteStop(stopId);
      } catch (err: any) {
        alert("Error deleting stop: " + (err?.message || "Unknown error"));
      }
    }
  };

  const handleToggleStopMerge = async (st: Stop) => {
    try {
      await store.updateStop(st.id, { isBusMergeStop: !st.isBusMergeStop });
    } catch (err: any) {
      alert("Error updating stop: " + (err?.message || "Unknown error"));
    }
  };
"""

text = text.replace('  // Campus Location Modal States\n', handlers + '\n  // Campus Location Modal States\n')

with open('src/components/staff/routes/stops/StopsManager.tsx', 'w') as f:
    f.write(text)

