
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
  handleAllocateBus
}: any) {
  return (
    <>
      {isAllocateBusModalOpen && activeRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleAllocateBus}
            className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 text-gray-900 dark:text-white shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                <BusFront className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Allocate Vehicle to {activeRoute.name}</h3>
                <p className="text-xs text-gray-400">Assign a physical fleet bus to service this transit corridor</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold uppercase tracking-wider text-gray-400">Choose Fleet Bus</label>
              <select
                required
                value={selectedBusToAllocate}
                onChange={e => setSelectedBusToAllocate(e.target.value)}
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold"
              >
                <option value="">-- Select Available Vehicle --</option>
                {buses.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.busNumber} ({b.registrationNo}) • {b.capacity} Seats ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAllocateBusModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedBusToAllocate}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                Confirm Bus Assignment
              </button>
            </div>
          </form>
        </div>
      )}

    </>
  );
}
