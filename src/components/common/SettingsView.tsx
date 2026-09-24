"use client";

import React, { useState, useEffect, useRef } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useTheme } from "@/components/common/ThemeProvider";
import { store } from "@/lib/store";
import { 
  Sun, Moon, Bell, Shield, Database, Download, RefreshCw, MessageSquare, Trash, 
  ChevronDown, Check, Globe, Loader2, Type
} from "lucide-react";
import { usePWAInstall } from "@/lib/usePWAInstall";
import { InstallAppModal } from "@/components/common/InstallAppModal";
import { useTranslation } from "@/components/common/LanguageProvider";


const CustomDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder 
}: { 
  options: string[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500 flex justify-between items-center"
      >
        <span className={value ? "text-gray-900 dark:text-white" : "text-gray-500"}>
          {value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === opt 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { primaryLanguage, setPrimaryLanguage, languageOptions, t } = useTranslation();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [mounted, setMounted] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const fontOptions = [
    { value: "system", label: "System Default" },
    { value: "inter, sans-serif", label: "Inter" },
    { value: "roboto, sans-serif", label: "Roboto" },
    { value: "'Open Sans', sans-serif", label: "Open Sans" },
    { value: "lato, sans-serif", label: "Lato" },
    { value: "poppins, sans-serif", label: "Poppins" },
    { value: "monospace", label: "Monospace" },
    { value: "serif", label: "Serif" },
  ];

  // App Install state
  const { promptInstall } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallClick = async () => {
    const res = await promptInstall();
    if (res === "modal_needed") {
      setShowInstallModal(true);
    }
  };

  // Delete Account state
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [isDeleting, setIsDeleting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);


  const handleDeleteAccount = async () => {
    if (!termsAccepted) {
      return;
    }

    if (!executeRecaptcha) {
      alert("Security verification is loading, please wait a moment.");
      return;
    }
    
    setIsDeleting(true);
    try {
      const token = await executeRecaptcha("delete_account");
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recaptchaToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");
      
      store.wipeAllData();
      localStorage.removeItem("campusfleet_store");
      
      window.location.href = "/account-deleted";
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting your account.");
      setIsDeleting(false);
    }
  };

  // States for toggles
  const [allEmails, setAllEmails] = useState(true);
  const [notifDefault, setNotifDefault] = useState(true);
  const [notifTrip, setNotifTrip] = useState(true);
  const [notifBilling, setNotifBilling] = useState(true);
  const [notifGeneral, setNotifGeneral] = useState(true);

  // Load and save notification preferences
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("campusfleet_notif_prefs");
      if (saved) {
        const prefs = JSON.parse(saved);
        setAllEmails(prefs.allEmails ?? true);
        setNotifDefault(prefs.notifDefault ?? true);
        setNotifTrip(prefs.notifTrip ?? true);
        setNotifBilling(prefs.notifBilling ?? true);
        setNotifGeneral(prefs.notifGeneral ?? true);
      }
    } catch {}

    const fetchPrefs = async () => {
      try {
        const res = await fetch("/api/users/notifications");
        const data = await res.json();
        if (data.success && data.preferences && Object.keys(data.preferences).length > 0) {
          const p = data.preferences;
          if (p.allEmails !== undefined) setAllEmails(p.allEmails);
          if (p.notifDefault !== undefined) setNotifDefault(p.notifDefault);
          if (p.notifTrip !== undefined) setNotifTrip(p.notifTrip);
          if (p.notifBilling !== undefined) setNotifBilling(p.notifBilling);
          if (p.notifGeneral !== undefined) setNotifGeneral(p.notifGeneral);
          
          localStorage.setItem("campusfleet_notif_prefs", JSON.stringify(p));
        }
      } catch (err) {
        console.error("Failed to load notif prefs", err);
      } finally {
        setNotifLoading(false);
      }
    };
    
    if (currentUser) {
      fetchPrefs();
    } else {
      setNotifLoading(false);
    }
  }, [currentUser]);

  const saveNotifPrefs = async (prefs: any) => {
    localStorage.setItem("campusfleet_notif_prefs", JSON.stringify(prefs));
    try {
      await fetch("/api/users/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs)
      });
    } catch (err) {
      console.error("Failed to save notif prefs", err);
    }
  };

  const handleAllEmailsToggle = (checked: boolean) => {
    setAllEmails(checked);
    setNotifDefault(checked);
    setNotifTrip(checked);
    setNotifBilling(checked);
    setNotifGeneral(checked);
    saveNotifPrefs({
      allEmails: checked,
      notifDefault: checked,
      notifTrip: checked,
      notifBilling: checked,
      notifGeneral: checked
    });
  };

  const handleSingleToggle = (key: string, checked: boolean) => {
    const newPrefs = {
      allEmails, notifDefault, notifTrip, notifBilling, notifGeneral,
      [key]: checked
    };
    
    if (key === 'notifDefault') { setNotifDefault(checked); }
    if (key === 'notifTrip') { setNotifTrip(checked); }
    if (key === 'notifBilling') { setNotifBilling(checked); }
    if (key === 'notifGeneral') { setNotifGeneral(checked); }

    saveNotifPrefs(newPrefs);
  };

  // Profile form states
  const [zoomLevel, setZoomLevel] = useState(100);
  const [fontFamily, setFontFamily] = useState('system');

  // Handle zoom
  const handleZoom = (direction: string) => {
    const newZoom = direction === 'in' ? Math.min(zoomLevel + 10, 150) : Math.max(zoomLevel - 10, 80);
    setZoomLevel(newZoom);
    document.documentElement.style.zoom = newZoom + '%';
  };

  // Handle clear cache
  const handleClearCache = () => {
    if (confirm("Are you sure you want to clear all local data? You will need to log in again.")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };
  
  // Handle simple alerts
  const handleNotImplemented = (feature: string) => {
    alert(feature + " is not currently available for your account type.");
  };

  const [isSaving, setIsSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    photoUrl: "",
    department: "",
    semester: "",
    section: "",
    classId: "",
    className: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    employeeCode: "",
    category: "",
    licenseNo: ""
  });

  useEffect(() => {
    const initializeForm = () => {
      const user = store.getCurrentUser();
      if (!user) return;
      setCurrentUser(user);

      const activeStudent = store.getStudents().find(s => s.userId === user.id || s.id === user.id);
      const activeStaff = store.getStaff().find(s => s.userId === user.id || s.id === user.id);

      setProfileForm({
        fullName: activeStudent?.fullName || activeStaff?.fullName || user.fullName || "",
        phone: activeStudent?.phone || activeStaff?.phone || (user as any).phone || "",
        photoUrl: activeStudent?.photoUrl || (activeStaff as any)?.photoUrl || user.avatarUrl || "",
        department: activeStudent?.department || "",
        semester: activeStudent?.semester || "",
        section: activeStudent?.className ? activeStudent.className.split("-").pop()?.trim() || "" : "",
        classId: activeStudent?.classId || "",
        className: activeStudent?.className || "",
        emergencyContactName: activeStudent?.emergencyContact?.name || "",
        emergencyContactPhone: activeStudent?.emergencyContact?.phone || "",
        employeeCode: activeStaff?.employeeCode || "",
        category: activeStaff?.category || "",
        licenseNo: activeStaff?.licenseNo || ""
      });
    };

    setMounted(true);
    initializeForm();
    
    const unsub = store.subscribe(() => {
      initializeForm();
    });
    return unsub;
  }, []);

  useEffect(() => {
    fetch("/api/classes")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.classes) setClassesList(data.classes);
      })
      .catch(console.error);
  }, []);

  const coursesList = Array.from(new Set(classesList.map(c => c.course).filter(Boolean))) as string[];
  const yearsList = Array.from(new Set(classesList.filter(c => c.course === profileForm.department).map(c => c.semester).filter(Boolean))) as string[];
  const sectionsList = Array.from(new Set(classesList.filter(c => c.course === profileForm.department && c.semester === profileForm.semester).map(c => c.section).filter(Boolean))) as string[];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName = currentUser?.fullName || "User";
  const email = currentUser?.email || "student@example.com";

  if (!mounted) return null;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      alert("Profile updated successfully!");
      // Optionally trigger a store refresh here if you have one
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Switch Component (Flat UI)
  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button 
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      <span 
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`} 
      />
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-medium text-green-600">
          {getGreeting()}, {displayName}
        </h1>
      </div>

      <div className="space-y-8">

        {/* Profile Details Card */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-none">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('profileDetails')}</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input 
                  type="text" 
                  value={profileForm.fullName} 
                  onChange={e => setProfileForm({...profileForm, fullName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                <input 
                  type="text" 
                  value={profileForm.phone} 
                  onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                />
              </div>
            </div>

            {/* Role Specific Fields */}
            {((currentUser as any)?.role === "student" || (currentUser as any)?.role === "portal" || !currentUser?.role) && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">Student Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                    <CustomDropdown 
                      options={coursesList}
                      value={profileForm.department}
                      placeholder="Select Department"
                      onChange={(val) => {
                        setProfileForm({...profileForm, department: val, semester: "", section: "", classId: "", className: ""});
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                    <CustomDropdown 
                      options={yearsList}
                      value={profileForm.semester}
                      placeholder="Select Semester"
                      onChange={(val) => {
                        setProfileForm({...profileForm, semester: val, section: "", classId: "", className: ""});
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Section</label>
                    <CustomDropdown 
                      options={sectionsList}
                      value={profileForm.section}
                      placeholder="Select Section"
                      onChange={(val) => {
                        const matchedClass = classesList.find(c => c.course === profileForm.department && c.semester === profileForm.semester && c.section === val);
                        setProfileForm({
                          ...profileForm, 
                          section: val, 
                          classId: matchedClass?.id || "",
                          className: matchedClass?.name || ""
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Contact Name</label>
                    <input 
                      type="text" 
                      value={profileForm.emergencyContactName} 
                      onChange={e => setProfileForm({...profileForm, emergencyContactName: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                      placeholder="E.g. Parent / Guardian"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Contact Phone</label>
                    <input 
                      type="text" 
                      value={profileForm.emergencyContactPhone} 
                      onChange={e => setProfileForm({...profileForm, emergencyContactPhone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                      placeholder="+91 0000000000"
                    />
                  </div>
                </div>
              </>
            )}

            {(["admin", "staff", "driver", "conductor", "teacher"].includes(currentUser?.role || "")) && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">
                  {currentUser?.role === "conductor" ? "Conductor Details" : 
                   currentUser?.role === "driver" ? "Driver Details" : 
                   "Staff Details"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee Code</label>
                    <input 
                      type="text" 
                      value={profileForm.employeeCode} 
                      onChange={e => setProfileForm({...profileForm, employeeCode: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                      placeholder="E.g. EMP-1001"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category / Rank</label>
                    <input 
                      type="text" 
                      value={profileForm.category} 
                      onChange={e => setProfileForm({...profileForm, category: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                      placeholder="E.g. Senior"
                    />
                  </div>
                  {currentUser?.role === "driver" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">License Number</label>
                      <input 
                        type="text" 
                        value={profileForm.licenseNo} 
                        onChange={e => setProfileForm({...profileForm, licenseNo: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                        placeholder="E.g. DL-XXXXXX"
                      />
                    </div>
                  )}
                  {currentUser?.role === "conductor" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Bus / Duty</label>
                      <input 
                        type="text" 
                        value="Assigned by Dispatcher" 
                        disabled
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-500 rounded-none cursor-not-allowed" 
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-none transition-colors"
              >
                {isSaving ? t('saving') : t('saveProfile')}
              </button>
            </div>
          </div>
        </div>
        
        {/* Appearance Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none relative z-20">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('appearance')}</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Sun className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('theme')}</h3>
                <p className="text-sm text-gray-500">{t('switchThemeDesc')}</p>
              </div>
              <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                <button 
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'light' 
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Sun className="w-4 h-4" /> {t('light')}
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark' 
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Moon className="w-4 h-4" /> {t('dark')}
                </button>
                <button 
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'system' 
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t('system')}
                </button>
              </div>
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('language')}</h3>
                <p className="text-sm text-gray-500">{t('chooseLangDesc')}</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="flex items-center justify-between min-w-[200px] px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <span>
                      {languageOptions.find(l => l.code === primaryLanguage)?.nativeName || "Language"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                
                {isLangDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsLangDropdownOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-full z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="max-h-60 overflow-y-auto py-1">
                        {languageOptions.map(lang => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              setPrimaryLanguage(lang.code as any);
                              setIsLangDropdownOpen(false);
                            }}
                            className={`w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                              primaryLanguage === lang.code 
                                ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span>{lang.nativeName}</span>
                            {primaryLanguage === lang.code && <Check className="w-4 h-4 text-gray-900 dark:text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('fontFamily')}</h3>
                <p className="text-sm text-gray-500">{t('chooseFontDesc')}</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                  className="flex items-center justify-between min-w-[200px] px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-gray-500" />
                    <span>
                      {fontOptions.find(f => f.value === fontFamily)?.label || "System Default"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                
                {isFontDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsFontDropdownOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-full z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="max-h-60 overflow-y-auto py-1">
                        {fontOptions.map(font => (
                          <button
                            key={font.value}
                            onClick={() => {
                              setFontFamily(font.value);
                              document.documentElement.style.fontFamily = font.value === 'system' ? '' : font.value;
                              setIsFontDropdownOpen(false);
                            }}
                            className={`w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                              fontFamily === font.value 
                                ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span style={{ fontFamily: font.value === 'system' ? 'inherit' : font.value }}>
                              {font.label}
                            </span>
                            {fontFamily === font.value && <Check className="w-4 h-4 text-gray-900 dark:text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Zoom level</h3>
                <p className="text-sm text-gray-500">Maximize the view (more content) or increase size for readability</p>
              </div>
              <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-none bg-white dark:bg-gray-950">
                <button onClick={() => handleZoom('out')} className="px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900">-</button>
                <span className="px-4 py-2 text-sm font-medium border-x border-gray-200 dark:border-gray-800">{zoomLevel}%</span>
                <button onClick={() => handleZoom('in')} className="px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('notifications')}</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Bell className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('emailNotifications')}</h3>
                <p className="text-sm text-gray-500">Manage which emails you receive at {email}.</p>
              </div>
              <Toggle checked={allEmails} onChange={() => handleAllEmailsToggle(!allEmails)} />
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className={!allEmails ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('emailCategories')}</h3>
              <p className="text-sm text-gray-500 mb-6">Turn off individual categories to stop those emails while staying subscribed to others.</p>
              
              <div className={`space-y-6 ${notifLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('default')}</span>
                  <Toggle checked={notifDefault} onChange={() => handleSingleToggle('notifDefault', !notifDefault)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('tripUpdates')}</span>
                  <Toggle checked={notifTrip} onChange={() => handleSingleToggle('notifTrip', !notifTrip)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('billingAlerts')}</span>
                  <Toggle checked={notifBilling} onChange={() => handleSingleToggle('notifBilling', !notifBilling)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('generalNotice')}</span>
                  <Toggle checked={notifGeneral} onChange={() => handleSingleToggle('notifGeneral', !notifGeneral)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Security Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('privacySecurity')}</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('twoFactorAuth')}</h3>
                <p className="text-sm text-gray-500">Add an extra layer of security</p>
              </div>
              <button onClick={() => handleNotImplemented('Advanced Security')} className="p-2 border border-gray-200 dark:border-gray-800 rounded-none text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"><Shield className="w-4 h-4" /></button>
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('dataPrivacy')}</h3>
                <p className="text-sm text-gray-500">Manage your data privacy settings</p>
              </div>
              <button onClick={() => handleNotImplemented('Advanced Security')} className="p-2 border border-gray-200 dark:border-gray-800 rounded-none text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"><Shield className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Data & Storage Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none mb-12">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('dataStorage')}</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Database className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('installApp')}</h3>
                <p className="text-sm text-gray-500">Add this app to your home screen or desktop for quicker access</p>
              </div>
              <button onClick={handleInstallClick} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <Download className="w-4 h-4" />
                {t('installApp')}
              </button>
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Get latest update</h3>
                <p className="text-sm text-gray-500">Reload the app and fetch the newest version</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('updateNow')}
              </button>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Clear chat cache</h3>
                <p className="text-sm text-gray-500">Remove local search index, previews, and decrypted caches on this device</p>
              </div>
              <div className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('clearCache')}</h3>
                <p className="text-sm text-gray-500">Clear all cached data</p>
              </div>
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to clear the local cache? You will need to sign in again.")) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = "/";
                  }
                }}
                className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />

        {/* Danger Zone Card */}
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-none mb-12">
          <div className="flex items-center justify-between p-6 border-b border-red-200 dark:border-red-900/50">
            <h2 className="text-lg font-medium text-red-700 dark:text-red-400">{t('dangerZone')}</h2>
            <div className="p-2 border border-red-200 dark:border-red-900/50 rounded-none text-red-500">
              <Trash className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">{t('deleteAccount')}</h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
                {t('deleteAccountDesc')}
              </p>
              
              <div className="space-y-4 max-w-md">
                <div 
                  className="flex items-start space-x-3 cursor-pointer" 
                  onClick={() => setTermsAccepted(!termsAccepted)}
                >
                  <div className="mt-0.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${termsAccepted ? 'border-red-500' : 'border-gray-400'}`}>
                      {termsAccepted && <div className="w-2 h-2 rounded-full bg-red-500" />}
                    </div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('deleteAccountTerms')}
                  </span>
                </div>
                
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !termsAccepted}
                  className={`px-6 py-2 text-sm font-bold shadow-none transition-all mt-4 ${
                    isDeleting || !termsAccepted
                      ? "bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                >
                  {isDeleting ? t('deleting') : t('permanentlyDelete')}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
