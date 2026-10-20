"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  ArrowLeft,
  ArrowRight,
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
  const [academicData, setAcademicData] = useState<{
    courses: any[];
    branches: any[];
    specializations: any[];
    sections: any[];
    classes: any[];
  }>({ courses: [], branches: [], specializations: [], sections: [], classes: [] });

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedSpecializationId, setSelectedSpecializationId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(""); 
  const [selectedYear, setSelectedYear] = useState("");   
  const [selectedSection, setSelectedSection] = useState(""); 
  const [selectedClassId, setSelectedClassId] = useState("");

  // Cascaded lists derived from pure relational academic hierarchy
  const filteredBranches = useMemo(() => {
    if (!selectedCourseId) return [];
    return academicData.branches.filter(b => b.course_id === selectedCourseId);
  }, [academicData.branches, selectedCourseId]);

  const filteredSpecializations = useMemo(() => {
    if (!selectedBranchId) return [];
    return academicData.specializations.filter(s => s.branch_id === selectedBranchId);
  }, [academicData.specializations, selectedBranchId]);

  const availableSemesters = useMemo(() => {
    if (!selectedCourseId) return [];
    const crs = academicData.courses.find(c => c.id === selectedCourseId);
    const total = crs?.total_semesters || 8;
    const list: string[] = [];
    for (let i = 1; i <= total; i++) {
      const suffix = i === 1 ? "st" : i === 2 ? "nd" : i === 3 ? "rd" : "th";
      list.push(`${i}${suffix} Sem`);
    }
    return list;
  }, [academicData.courses, selectedCourseId]);

  const availableSections = useMemo(() => {
    if (!selectedSpecializationId || !selectedYear) return [];
    const matched = academicData.classes.filter(
      c => c.specialization_id === selectedSpecializationId && c.semester === selectedYear
    );
    if (matched.length === 0) {
      return (academicData.sections || []).map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
      }));
    }
    return matched.map(m => ({
      id: m.section_id || m.id,
      code: m.section,
      name: m.section_name || `Section ${m.section}`,
      classId: m.id,
    }));
  }, [academicData.classes, academicData.sections, selectedSpecializationId, selectedYear]);

  const currentMatchedClass = useMemo(() => {
    if (selectedClassId) {
      return academicData.classes.find(c => c.id === selectedClassId) || null;
    }
    if (selectedSpecializationId && selectedYear && selectedSection) {
      return academicData.classes.find(
        c => c.specialization_id === selectedSpecializationId &&
             c.semester === selectedYear &&
             c.section === selectedSection
      ) || null;
    }
    return null;
  }, [academicData.classes, selectedClassId, selectedSpecializationId, selectedYear, selectedSection]);

  const [selectedZoneCode, setSelectedZoneCode] = useState("ZONE_B");
  const [phone, setPhone] = useState("");
  const [primaryStopId, setPrimaryStopId] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRel, setEmergencyRel] = useState("Parent / Guardian");
  const [photoUrl, setPhotoUrl] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const isPassApproved = isStudentSubscriptionActive(activeStudent);
  const isPhotoLocked = isPassApproved;
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

      // 1.5. Set local preview immediately so the user never experiences broken preview while waiting for upload
      try {
        const objectUrl = URL.createObjectURL(compressedFile);
        setLocalPreviewUrl(objectUrl);
        setImageLoadFailed(false);
      } catch (err) {
        console.warn("Local object URL creation failed", err);
      }

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
    fetch("/api/academic/cascade")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAcademicData(data);
          setClassesList(data.classes || []);
        }
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
    
    if (activeStudent?.classId && academicData.classes.length > 0) {
      const ec2 = academicData.classes.find(c => c.id === activeStudent.classId);
      if (ec2) { 
        setSelectedCourseId(prev => prev || ec2.course_id || "");
        setSelectedBranchId(prev => prev || ec2.branch_id || "");
        setSelectedSpecializationId(prev => prev || ec2.specialization_id || "");
        setSelectedCourse(prev => prev || ec2.course_name || ec2.course || ""); 
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

  }, [dataLoaded, activeStudent, currentUser, academicData.classes, stops]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert("Please fill in your Contact Phone Number.");
      return;
    }

    if (!photoUrl) {
      setToast("Error: You must upload an official ID photo before activating your pass.");
      setTimeout(() => setToast(null), 5000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        if (!isPassApproved) {
          router.push("/portal/payments");
        } else {
          router.push("/portal");
        }
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
            <button
              onClick={() => router.back()}
              className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2 bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {activeStudent?.phone ? "Profile & Transit Details" : "Profile Setup"}
            </h1>
          </div>
          <div className="flex items-center gap-2">

            <div className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 flex items-center gap-1.5 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
              <Lock className="w-3 h-3" /> Secure
            </div>
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
                  {(localPreviewUrl || photoUrl) && !imageLoadFailed ? (
                    <img
                      src={
                        localPreviewUrl ||
                        (photoUrl.startsWith("http")
                          ? `/api/photo-proxy?url=${encodeURIComponent(photoUrl)}`
                          : photoUrl)
                      }
                      alt="Passport Photo Preview"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setImageLoadFailed(true);
                      }}
                      className="w-24 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-950"
                    />
                  ) : photoUrl && imageLoadFailed ? (
                    <img
                      src={photoUrl}
                      alt="Passport Photo Preview"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
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
                        {(photoUrl || localPreviewUrl) && !isUploadingPhoto && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoUrl("");
                              setLocalPreviewUrl("");
                              setImageLoadFailed(false);
                            }}
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

            {/* ── 5-TIER CASCADED ACADEMIC PICKER: Course → Branch → Specialization → Semester → Section ── */}
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" /> Academic Cohort & Section Selection
                </span>
                {currentMatchedClass && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                    ✓ Verified Cohort
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1: Degree / Course */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    1. Degree / Course *
                  </label>
                  <select
                    required
                    value={selectedCourseId}
                    onChange={e => {
                      const cId = e.target.value;
                      setSelectedCourseId(cId);
                      setSelectedBranchId("");
                      setSelectedSpecializationId("");
                      setSelectedYear("");
                      setSelectedSection("");
                      setSelectedClassId("");
                      const crs = academicData.courses.find(c => c.id === cId);
                      if (crs) setSelectedCourse(crs.short_name);
                    }}
                    className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors"
                  >
                    <option value="">-- Select Degree / Course --</option>
                    {academicData.courses.map(crs => (
                      <option key={crs.id} value={crs.id}>
                        {crs.short_name} — {crs.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Branch / Department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    2. Discipline / Branch *
                  </label>
                  <select
                    required
                    disabled={!selectedCourseId || filteredBranches.length === 0}
                    value={selectedBranchId}
                    onChange={e => {
                      const bId = e.target.value;
                      setSelectedBranchId(bId);
                      setSelectedSpecializationId("");
                      setSelectedSection("");
                      setSelectedClassId("");
                      const br = academicData.branches.find(b => b.id === bId);
                      if (br) setDepartment(br.name);
                    }}
                    className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors disabled:opacity-60"
                  >
                    <option value="">-- Select Branch --</option>
                    {filteredBranches.map(br => (
                      <option key={br.id} value={br.id}>
                        {br.code} — {br.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Specialization / Track */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    3. Specialization / Track *
                  </label>
                  <select
                    required
                    disabled={!selectedBranchId || filteredSpecializations.length === 0}
                    value={selectedSpecializationId}
                    onChange={e => {
                      const sId = e.target.value;
                      setSelectedSpecializationId(sId);
                      setSelectedSection("");
                      setSelectedClassId("");
                    }}
                    className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors disabled:opacity-60"
                  >
                    <option value="">-- Select Specialization --</option>
                    {filteredSpecializations.map(sp => (
                      <option key={sp.id} value={sp.id}>
                        {sp.short_label} ({sp.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 4: Semester */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    4. Current Semester *
                  </label>
                  <select
                    required
                    disabled={!selectedCourseId}
                    value={selectedYear}
                    onChange={e => {
                      const sem = e.target.value;
                      setSelectedYear(sem);
                      setSemester(sem);
                      setSelectedSection("");
                      setSelectedClassId("");
                    }}
                    className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors disabled:opacity-60"
                  >
                    <option value="">-- Select Semester --</option>
                    {availableSemesters.map(sem => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 5: Section & Class Mapping */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    5. Class Section *
                  </label>
                  <select
                    required
                    disabled={!selectedSpecializationId || !selectedYear}
                    value={selectedSection}
                    onChange={e => {
                      const secCode = e.target.value;
                      setSelectedSection(secCode);
                      // Auto-resolve class
                      const matched = academicData.classes.find(
                        c => c.specialization_id === selectedSpecializationId &&
                             c.semester === selectedYear &&
                             c.section === secCode
                      );
                      if (matched) {
                        setSelectedClassId(matched.id);
                      } else {
                        setSelectedClassId("");
                      }
                    }}
                    className="w-full text-sm p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-bold transition-colors disabled:opacity-60"
                  >
                    <option value="">-- Select Section --</option>
                    {availableSections.map(sec => (
                      <option key={sec.code} value={sec.code}>
                        {sec.name} ({sec.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Verified Matched Class Banner */}
              {currentMatchedClass && (
                <div className="p-3 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Assigned Timetable Cohort:
                  </span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">
                    {currentMatchedClass.name}
                  </span>
                </div>
              )}
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
              disabled={isSubmitting || !photoUrl}
              className={`w-full py-4 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                !photoUrl
                  ? "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
              } ${isSubmitting ? "opacity-50" : ""}`}
            >
              {!photoUrl ? (
                <Lock className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isSubmitting
                ? "Saving to Database..."
                : !photoUrl
                ? "Upload Official ID Photo to Proceed"
                : isPassApproved
                ? "Save Profile & Verify Transit Account"
                : "Save Details & Proceed to Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}
