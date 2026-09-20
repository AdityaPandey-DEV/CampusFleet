with open('src/components/staff/routes/corridors/CorridorsManager.tsx', 'r') as f:
    text = f.read()

start_marker = '{mode === "create" ? ('
end_marker = '{/* Route Builder & Allocation Modals */}'

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_code = """{mode === "create" ? (
        <RouteBuilderModal
          isRouteBuilderOpen={true}
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
          handleRemoveIntermediateStop={handleRemoveIntermediate}
          handleSaveRouteFromBuilder={handleSaveRouteFromBuilder}
          builderStops={builderStops}
          builderOrderedStopIds={builderOrderedStopIds}
          builderMetrics={builderMetrics}
        />
      ) : (
        <div className="space-y-6 pt-2">
          {routes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routes.map(r => (
                <Link 
                  href={`/staff/fleet/routes/corridors/${r.id}`} 
                  key={r.id}
                  className="group"
                >
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col h-full hover:border-blue-300 dark:hover:border-blue-700/50">
                    
                    {/* Decorative Top Gradient Line based on Route Color */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-1.5 w-full opacity-80 group-hover:opacity-100 transition-opacity" 
                      style={{ backgroundColor: r.color }} 
                    />
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                       <div>
                         <span className="font-mono text-[10px] uppercase font-bold text-gray-400 block mb-1">
                           {r.code} • {r.direction === "HOME_TO_CAMPUS" ? "Inbound" : "Outbound"}
                         </span>
                         <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                           {r.name}
                         </h3>
                       </div>
                       <div 
                         className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm shrink-0"
                         style={{ color: r.color }}
                       >
                         <RouteIcon className="w-4 h-4" />
                       </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-6 mt-auto">
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-800">
                         <span className="text-[10px] text-gray-500 font-bold uppercase block mb-0.5">Distance</span>
                         <span className="font-black text-gray-900 dark:text-white text-sm">{r.distanceKm || r.totalDistanceKm} <span className="text-gray-400 font-normal">km</span></span>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-800">
                         <span className="text-[10px] text-gray-500 font-bold uppercase block mb-0.5">Duration</span>
                         <span className="font-black text-gray-900 dark:text-white text-sm">~{r.estimatedDurationMins || Math.round((r.distanceKm || r.totalDistanceKm) * 2.8)} <span className="text-gray-400 font-normal">min</span></span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                       <div className="flex items-center gap-1.5">
                          <span className="flex h-5 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono border border-blue-100 dark:border-blue-800/50">
                            {r.stops.length} Stops
                          </span>
                       </div>
                       <div className="text-[11px] font-bold text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                          View Map & Flowchart <ArrowRight className="w-3.5 h-3.5" />
                       </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 space-y-3">
               <RouteIcon className="w-10 h-10 text-gray-300 mx-auto" />
               <h3 className="font-bold text-gray-900 dark:text-white">No Transit Corridors Defined</h3>
               <p className="text-xs text-gray-500 max-w-sm mx-auto">
                 Click the "Create Route" button in the header to start building your first transit network corridor.
               </p>
            </div>
          )}
        </div>
      )}

      """
    
    text = text[:start_idx] + new_code + text[end_idx:]
    with open('src/components/staff/routes/corridors/CorridorsManager.tsx', 'w') as f:
        f.write(text)
    print("Replaced successfully!")
else:
    print("Not found!", start_idx, end_idx)

