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

  // Multi-step Form State
  const [step, setStep] = useState<1 | 2>(1);

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
  const [zoneToConfirm, setZoneToConfirm] = useState<TransitZone | null>(null);
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

    fetch(`/api/students/me?_t=${Date.now()}`, { cache: 'no-store' })
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

    if (step === 1) {
      // Validate step 1 fields if necessary
      if (!selectedClassId && !department) {
        alert("Please select your course and class details.");
        return;
      }
      setStep(2);
      return;
    }

  const confirmAndSubmitProfile = async () => {
    if (!zoneToConfirm) return;
    
    setIsSubmitting(true);
    const targetStudentId = activeStudent?.id || `stud-${currentUser?.id || Date.now()}`;
    const chosenClass = classesList.find(c => c.id === selectedClassId);
    const chosenCampus = campuses.find(c => c.id === campusId);

    // Auto-select the first stop in the confirmed zone
    const zoneStops = stops.filter(st => (st.zoneCode || "ZONE_B") === zoneToConfirm.code);
    const chosenStopId = zoneStops.length > 0 ? zoneStops[0].id : (primaryStopId || stops[0]?.id || "");

    const res = await store.updateStudentProfile(targetStudentId, {
      fullName: fullName.trim() || currentUser?.fullName || "Student",
      campusId,
      campus: chosenCampus?.name || campus,
      department,
      semester,
      classId: chosenClass?.id,
      className: chosenClass?.name,
      zoneCode: zoneToConfirm.code,
      phone: phone.trim(),
      primaryStopId: chosenStopId,
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
        setZoneToConfirm(null);
        router.push("/portal/payments");
      }, 1200);
    } else {
      alert(res.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert("Please fill in your Contact Phone Number.");
      return;
    }

    if (step === 1) {
      // Validate step 1 fields if necessary
      if (!selectedClassId && !department) {
        alert("Please select your course and class details.");
        return;
      }
      setStep(2);
      return;
    }

    // If step 2 submit button is clicked, we just prompt the user if they haven't selected a zone
    alert("Please select a transit zone from the options above.");
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

          {/* Conditional Rendering based on Step */}
          <div className={step === 1 ? "block" : "hidden"}>
            {/* ── PROFILE FIELDS (Step 1) ── */}
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
          </div>

          <div className={step === 2 ? "block" : "hidden"}>
            {/* ── ZONE SELECTION (Step 2) ── */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Residential Transit Zone</h3>
              
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {transitZones.map(z => {
                    const isSelected = selectedZoneCode === z.code;
                    const zoneStops = stops.filter(st => (st.zoneCode || "ZONE_B") === z.code);
                    
                    return (
                      <div
                        key={z.id || `${z.campusId || ""}-${z.code}`}
                        onClick={() => setZoneToConfirm(z)}
                        className={`cursor-pointer relative overflow-hidden p-5 rounded-2xl border-2 transition-all duration-200 ${
                          isSelected 
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-500/10" 
                            : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                      >
                        {/* Selected Indicator Ribbon */}
                        {isSelected && (
                          <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg">
                            Selected
                          </div>
                        )}
                        
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                              {z.code.replace("_", " ")}
                            </div>
                            <h4 className={`text-lg font-black ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                              {z.name}
                            </h4>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-green-600 dark:text-green-400">
                              ₹{z.semesterFee.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-500">Per Semester</div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-4 h-10 overflow-hidden line-clamp-2">
                          {z.corridorDescription}
                        </div>
                        
                        {/* Stops Pill Tags */}
                        {zoneStops.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-auto">
                            {zoneStops.slice(0, 4).map(st => (
                              <span key={st.id} className={`text-[10px] px-2 py-0.5 rounded-md border ${
                                isSelected 
                                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800" 
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                              }`}>
                                {st.name}
                              </span>
                            ))}
                            {zoneStops.length > 4 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md text-gray-500">
                                +{zoneStops.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-8">
            <button
              type="submit"
              disabled={isSubmitting || step === 2}
              className={`w-full py-4 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${step === 2 ? 'hidden' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              <CheckCircle2 className="w-5 h-5" />
              {isSubmitting ? "Saving..." : "Continue to Zone Selection →"}
            </button>
            
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full mt-3 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← Back to Profile
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {zoneToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && setZoneToConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center mb-2">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">Confirm Selection</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You have selected <strong className="text-gray-900 dark:text-white">{zoneToConfirm.name}</strong>. 
                Are you sure? <br/><br/>
                <span className="text-red-500 font-bold">Important:</span> You cannot change your zone after confirming. You will be redirected to the payment gateway.
              </p>
              
              <div className="w-full pt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setZoneToConfirm(null)}
                  className="py-3 text-sm font-bold rounded-xl text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={confirmAndSubmitProfile}
                  className="py-3 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Processing..." : "Confirm & Pay"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
