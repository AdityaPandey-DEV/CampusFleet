with open('src/components/staff/StaffRoutesView.tsx', 'r') as f:
    text = f.read()

start = text.find('{isAddStopModalOpen && (')
end = text.find('{isCampusModalOpen && (')

if start != -1 and end != -1:
    modal_code = text[start:end]
    
    # We will wrap it in a functional component StopBuilderModal
    component = """// @ts-nocheck
import React from 'react';
import { MapPin, Search, Plus, X, GitMerge } from 'lucide-react';
import dynamic from 'next/dynamic';

const CampusFleetMap = dynamic(() => import('@/components/maps/CampusFleetMap'), {
  ssr: false,
});

export function StopBuilderModal({
  isAddStopModalOpen,
  setIsAddStopModalOpen,
  editingStop,
  stopFormData,
  setStopFormData,
  stopInputMode,
  setStopInputMode,
  handleSaveStop,
  isSavingStop,
  designatedCampusId,
  setDesignatedCampusId,
  campuses
}: any) {
  return (
    <>
""" + modal_code + """    </>
  );
}
"""
    with open('src/components/staff/routes/stops/StopBuilderModal.tsx', 'w') as f:
        f.write(component)
    print("Extracted StopBuilderModal")
else:
    print("Could not find boundaries")
