"use client";

import React from "react";
import { useConductorContext } from "@/components/conductor/ConductorContext";
import { AuditTab } from "@/components/conductor/tabs/AuditTab";

export default function AuditPage() {
  const { attendanceRecords, students } = useConductorContext();

  return (
    <AuditTab
      attendanceRecords={attendanceRecords}
      students={students}
    />
  );
}
