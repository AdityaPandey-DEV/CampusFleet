"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { Student, TransitZone, Campus } from "@/lib/types";
import {
  GraduationCap,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  User,
  HeartHandshake,
  Compass,
  Camera,
  Upload,
  Lock,
  Loader2,
} from "lucide-react";
import { isStudentSubscriptionActive } from "@/lib/subscription-utils";

export default function StudentOnboardingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [campuses, setCampuses] = useState<Campus[]>(() => store.getCampuses());
  const [stops, setStops] = useState(store.getStops());
  const [transitZones, setTransitZones] = useState<TransitZone[]>(() => store.getTransitZones(store.getPrimaryCampus()?.id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [serverStudent, setServerStudent] = useState<Student | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const activeStudent: Student | undefined =
    serverStudent ||
    students.find(
      s => s.email?.toLowerCase() === currentUser?.email?.toLowerCase() || (currentUser?.id && s.userId === currentUser.id)
    );

  // Form State
  const [fullName, setFullName] = useState("");
  const [campusId, setCampusId] = useState(() => store.getPrimaryCampus()?.id || "");
  const [campus, setCampus] = useState(() => store.getPrimaryCampus()?.name || "Main Campus");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [classesList, setClassesList] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState(""); // cascaded step 1
  const [selectedYear, setSelectedYear] = useState("");   // cascaded step 2
  const [selectedSection, setSelectedSection] = useState(""); // cascaded step 3
  const [selectedClassId, setSelectedClassId] = useState("");

  // Cascaded lists derived dynamically from classesList (PostgreSQL)
  const coursesList = useMemo(() => {
    const list = Array.from(new Set(classesList.map(c => c.course).filter(Boolean))) as string[];
    if (department && !list.includes(department)) list.push(department);
    return list;
  }, [classesList, department]);

  const semestersList = useMemo(() => {
    const filtered = (selectedCourse || department)
      ? classesList.filter(c => c.course === (selectedCourse || department))
      : classesList;
    const list = Array.from(new Set(filtered.map(c => c.semester).filter(Boolean))) as string[];
    list.sort((a, b) => parseInt(a) - parseInt(b));
    return list;
  }, [classesList, selectedCourse, department]);

  const sectionsList = useMemo(() => {
    return classesList.filter(c => {
      const crs = selectedCourse || department;
      if (crs && c.course !== crs) return false;
      if (selectedYear && c.semester !== selectedYear) return false;
      return true;
    });
  }, [classesList, selectedCourse, department, selectedYear]);

  const [selectedZoneCode, setSelectedZoneCode] = useState("ZONE_B");
  const [phone, setPhone] = useState("");
  const [primaryStopId, setPrimaryStopId] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRel, setEmergencyRel] = useState("Parent / Guardian");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const isPassApproved = isStudentSubscriptionActive(activeStudent);
  const isPhotoLocked = isPassApproved || Boolean(activeStudent?.photoLocked);
  const isZoneLocked = isPassApproved;
  const isCampusLocked = isPassApproved;

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPhotoLocked) {
      alert("Official photo is locked. Only Campus Staff/Admin can update your photo.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingPhoto(true);
    
    try {
      // 1. Client-side image compression (drastically speeds up upload for large phone photos)
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // Replace extension with .jpeg
                  const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpeg";
                  resolve(new File([blob], fileName, { type: "image/jpeg" }));
                } else {
                  reject(new Error("Compression failed"));
                }
              },
              "image/jpeg",
              0.8 // 80% quality
            );
          };
          img.onerror = () => reject(new Error("Failed to load image for compression"));
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
      });

      // 2. Upload compressed image
      const formData = new FormData();
      formData.append("file", compressedFile);
      
      const res = await fetch("/api/payments/upload-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setPhotoUrl(data.url);
        
        // 3. Auto-save photo URL directly to DB so it's not lost if they refresh without submitting
        const targetStudentId = activeStudent?.id || `stud-${currentUser?.id || Date.now()}`;
        if (targetStudentId && !targetStudentId.startsWith('stud-')) {
          try {
             await store.updateStudentProfile(targetStudentId, { photoUrl: data.url });
             setToast("Photo uploaded and saved! Keep completing your profile.");
             setTimeout(() => setToast(null), 4000);
          } catch(e) { /* ignore auto-save fail, they can still hit Submit */ }
        } else {
          setToast("Photo uploaded successfully! Remember to click Save Profile at the bottom.");
          setTimeout(() => setToast(null), 5000);
        }
      } else {
        alert(data.error || "Failed to upload photo. Please try again.");
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      const s = store.getStudents();
      setStudents(s);
      if (s.length > 0 || store.isReady()) setDataLoaded(true);
      setCampuses(store.getCampuses());
      setStops(store.getStops());
      setTransitZones(store.getTransitZones(campusId));
    });
    return unsub;
  }, [campusId]);

  useEffect(() => {
    if (campuses.length === 0) {
      fetch("/api/campus")
        .then(res => res.json())
        .then(data => {
          if (data.success && data.campuses && data.campuses.length > 0) {
            setCampuses(data.campuses);
            const primary = data.primaryCampus || data.campuses.find((c: any) => c.isPrimary) || data.campuses[0];
            if (primary && !campusId) {
              setCampusId(primary.id);
              setCampus(primary.name);
            }
          }
        })
        .catch(console.error);
    }
  }, [campuses.length, campusId]);

  useEffect(() => {
    setTransitZones(store.getTransitZones(campusId));
  }, [campusId]);

  useEffect(() => {
    fetch("/api/classes")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.classes) setClassesList(data.classes);
      })
      .catch(console.error);

    fetch("/api/students/me")
      .then(res => res.json())
      .then(data => {
        if (data && data.student) {
          const s = data.student;
          setServerStudent(s);
          setStudents(prev => {
            const exists = prev.find(p => p.id === s.id);
            if (exists) return prev;
            return [s, ...prev];
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        setDataLoaded(true);
      });
  }, []);

  // Initialize form state ONLY ONCE when data is loaded
  useEffect(() => {
    if (!dataLoaded) return;
    
    // Auto-populate data
    setFullName(prev => prev || activeStudent?.fullName || currentUser?.fullName || "");
    setPhone(prev => prev || activeStudent?.phone || "");
    setCampusId(prev => prev || activeStudent?.campusId || store.getPrimaryCampus()?.id || "");
    setCampus(prev => prev || activeStudent?.campus || store.getPrimaryCampus()?.name || "Main Campus");
    setDepartment(prev => prev || activeStudent?.department || "");
    setSemester(prev => prev || activeStudent?.semester || "");
    setSelectedClassId(prev => prev || activeStudent?.classId || "");
    
    if (activeStudent?.classId && classesList.length > 0) {
      const ec2 = classesList.find(c => c.id === activeStudent.classId);
      if (ec2) { 
        setSelectedCourse(prev => prev || ec2.course || ""); 
        setSelectedYear(prev => prev || ec2.semester || ""); 
        setSelectedSection(prev => prev || ec2.section || ""); 
      }
    }
    
    setSelectedZoneCode(prev => prev || activeStudent?.zoneCode || "ZONE_B");
    setPrimaryStopId(prev => prev || activeStudent?.primaryStopId || stops[0]?.id || "");
    setEmergencyName(prev => prev || (activeStudent?.emergencyContact?.name !== "Campus Desk" ? (activeStudent?.emergencyContact?.name || "") : ""));
    setEmergencyPhone(prev => prev || activeStudent?.emergencyContact?.phone || "");
    setEmergencyRel(prev => prev || activeStudent?.emergencyContact?.relationship || "Parent / Guardian");
    setPhotoUrl(prev => prev || activeStudent?.photoUrl || "");

  }, [dataLoaded, activeStudent, currentUser, classesList, stops]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert("Please fill in your Contact Phone Number.");
      return;
    }

    setIsSubmitting(true);
    const targetStudentId = activeStudent?.id || `stud-${currentUser?.id || Date.now()}`;
    const chosenClass = classesList.find(c => c.id === selectedClassId);
    const chosenCampus = campuses.find(c => c.id === campusId);

    const res = await store.updateStudentProfile(targetStudentId, {
      fullName: fullName.trim() || currentUser?.fullName || "Student",
      campusId,
      campus: chosenCampus?.name || campus,
      department,
      semester,
      classId: chosenClass?.id,
      className: chosenClass?.name,
      zoneCode: selectedZoneCode,
      phone: phone.trim(),
      primaryStopId: primaryStopId || stops[0]?.id || "",
      photoUrl: photoUrl.trim() || undefined,
      emergencyContact: {
        name: emergencyName.trim() || "Parent / Guardian",
        relationship: emergencyRel,
        phone: emergencyPhone.trim() || phone.trim(),
      },
    });

    if (chosenClass?.id) {
      try {
        await fetch(`/api/students/${targetStudentId}/class`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: chosenClass.id }),
        });
      } catch (err) {
        console.warn("Failed to sync student class with backend", err);
      }
    }

    setIsSubmitting(false);
    if (res.success) {
      setToast("✓ Student Profile Saved & Verified in Institutional Database!");
      setTimeout(() => {
        setToast(null);
        router.push("/portal");
      }, 1200);
    } else {
      alert(res.message);
    }
  };

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Flat Header */}
      <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Profile Setup</h1>
          </div>
          <div className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 flex items-center gap-1.5 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
            <Lock className="w-3 h-3" /> Secure
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:py-10">
        {toast && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> {toast}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-none">
          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
            <div className="border-b border-gray-100 dark:border-gray-800 pb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Welcome, {currentUser?.fullName || currentUser?.email}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Please complete your student profile. This information is used for ID verification, transit zone allocation, and emergency contacts.
              </p>
            </div>

            {/* Official Passport Photo Verification Upload */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Official ID Photo</h3>
                {isPhotoLocked ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md">
                    Required
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                {/* Photo Preview Thumbnail */}
                <div className="flex-shrink-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Passport Photo Preview"
                      className="w-24 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-950"
                    />
                  ) : (
                    <div className="w-24 h-32 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 flex flex-col items-center justify-center text-gray-400">
                      <User className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-[10px] font-medium">No Photo</span>
                    </div>
                  )}
                </div>

                {/* Upload Controls or Locked Notice */}
                <div className="flex-1 w-full">
                  {isPhotoLocked ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your official photo has been verified and locked. Only campus transport staff can update this photo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Upload a clear passport-sized photo. This will be shown to the conductor during boarding.
                      </p>
                      <div className="flex items-center gap-3">
                        <label className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition-colors shadow-sm ${isUploadingPhoto ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>{isUploadingPhoto ? 'Uploading...' : 'Choose File'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingPhoto}
                            onChange={handlePhotoFileChange}
                            className="hidden"
                          />
                        </label>
                        {photoUrl && !isUploadingPhoto && (
                          <button
                            type="button"
                            onClick={() => setPhotoUrl("")}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-3 py-2 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Student Name"
                  className="w-full text-sm p-3.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-600 transition-colors"
                />
              </div>

            {/* University Campus */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>University Campus</span>
                {isCampusLocked && (
                  <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </label>
              <select
                value={campusId}
                disabled={isCampusLocked}
                onChange={e => {
                  setCampusId(e.target.value);
                  const c = campuses.find(camp => camp.id === e.target.value);
                  if (c) setCampus(c.name);
                }}
                className={`w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors ${
                  isCampusLocked ? "opacity-75 cursor-not-allowed bg-gray-100 dark:bg-gray-850" : ""
                }`}
              >
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isPrimary ? "(Primary)" : ""}
                  </option>
                ))}
              </select>
            </div>

              {/* Contact Mobile Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Student Mobile Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full text-sm p-3.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-600 transition-colors"
                />
              </div>

            {/* ── CASCADED ACADEMIC PICKER: Course/Dept → Year/Sem → Section ── */}
            {/* Step 1: Department / Program */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>1. Department / Course *</span>
              </label>
              <select
                required
                value={selectedCourse || department}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedCourse(val);
                  setDepartment(val);
                  setSelectedYear("");
                  setSelectedSection("");
                  setSelectedClassId("");
                }}
                className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors"
              >
                <option value="">-- Select Course / Dept --</option>
                {coursesList.map(crs => (
                  <option key={crs} value={crs}>
                    {crs}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Semester */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>2. Academic Semester *</span>
              </label>
              <select
                required
                value={selectedYear}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedYear(val);
                  setSemester(val);
                  setSelectedSection("");
                  setSelectedClassId("");
                }}
                className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors"
                disabled={!selectedCourse && !department}
              >
                <option value="">-- Select Semester --</option>
                {semestersList.map(sem => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Section / Official Class */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>3. Assigned Section / Class *</span>
              </label>
              <select
                required
                value={selectedClassId}
                onChange={e => {
                  const classId = e.target.value;
                  setSelectedClassId(classId);
                  const chosen = classesList.find(c => c.id === classId);
                  if (chosen) {
                    if (chosen.section) setSelectedSection(chosen.section);
                    if (chosen.course) {
                      setSelectedCourse(chosen.course);
                      setDepartment(chosen.course);
                    }
                    if (chosen.semester) {
                      setSelectedYear(chosen.semester);
                      setSemester(chosen.semester);
                    }
                  }
                }}
                className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-bold transition-colors"
              >
                <option value="">-- Select Section --</option>
                {sectionsList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Residential Transit Zone */}
          <div className="space-y-1.5 mt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-green-600" />
                Residential Transit Zone *
              </span>
              {isZoneLocked ? (
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              ) : null}
            </label>
            {isZoneLocked ? (
              <div className="p-4 rounded-xl bg-green-50/80 dark:bg-green-950/40 border border-green-200 dark:border-green-800/80 text-xs text-green-900 dark:text-green-200">
                <div className="font-bold flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Zone {selectedZoneCode} — Locked after Fee Clearance
                </div>
                <p className="text-xs opacity-80 leading-relaxed">
                  Transit zone is locked once semester fee is paid. Only campus transport admin can modify zone allocation after payment.
                </p>
              </div>
            ) : (
              <select
                required
                value={selectedZoneCode}
                onChange={e => {
                  const newZone = e.target.value;
                  setSelectedZoneCode(newZone);
                  const filteredStops = stops.filter(st => (st.zoneCode || "ZONE_B") === newZone);
                  if (filteredStops.length > 0) {
                    setPrimaryStopId(filteredStops[0].id);
                  }
                }}
                className="w-full text-sm p-3.5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 text-gray-900 dark:text-white outline-none focus:border-green-500 font-bold transition-colors"
              >
                {transitZones.map(z => (
                  <option key={z.id || `${z.campusId || ""}-${z.code}`} value={z.code}>
                    {z.name} — ₹{z.semesterFee.toLocaleString()} / Semester
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">
              Covers: {transitZones.find(z => z.code === selectedZoneCode)?.corridorDescription}
            </p>
          </div>

          {/* Primary Boarding Stop (Filtered strictly to selected zone) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                Primary Boarding Stop ({selectedZoneCode}) *
              </span>
            </label>
            <select
              value={primaryStopId}
              onChange={e => setPrimaryStopId(e.target.value)}
              className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors"
            >
              {stops
                .filter(st => (st.zoneCode || "ZONE_B") === selectedZoneCode)
                .map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code}) • {st.landmark}
                  </option>
                ))}
            </select>
          </div>

          {/* Emergency Guardian Section */}
          <div className="p-5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
              <HeartHandshake className="w-5 h-5 text-red-500" />
              Emergency & Guardian Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
                placeholder="Parent / Guardian Name"
                className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 transition-colors"
              />
              <input
                type="tel"
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="Guardian Phone (+91 ...)"
                className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {isSubmitting ? "Saving to Database..." : "Save Profile & Verify Transit Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}
