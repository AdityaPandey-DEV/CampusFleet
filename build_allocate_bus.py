import os

with open("/tmp/modal2.tsx", "r") as f:
    modal_jsx = f.read()

component_code = """
import React from 'react';
import { BusFront, X, Check, Search, ShieldAlert, GitBranch } from 'lucide-react';
import { Route, Bus, Trip } from '@/lib/types';

export function AllocateBusModal({
  isAllocateBusModalOpen,
  setIsAllocateBusModalOpen,
  activeRoute,
  assignedBuses,
  buses,
  selectedBusToAllocate,
  setSelectedBusToAllocate,
  handleAllocateBus,
  handleDeallocateBus
}: any) {
  return (
    <>
""" + modal_jsx + """
    </>
  );
}
"""

with open("src/components/staff/routes/corridors/AllocateBusModal.tsx", "w") as f:
    f.write(component_code)

print("Created AllocateBusModal.tsx")
