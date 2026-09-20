"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/components/common/ThemeProvider";
import { store } from "@/lib/store";
import { 
  Sun, Moon, Bell, Shield, Database, Download, RefreshCw, MessageSquare, Trash, 
  ChevronDown
} from "lucide-react";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [mounted, setMounted] = useState(false);

  // States for toggles
  const [allEmails, setAllEmails] = useState(true);
  const [notifDefault, setNotifDefault] = useState(true);
  const [notifTrip, setNotifTrip] = useState(true);
  const [notifBilling, setNotifBilling] = useState(true);
  const [notifGeneral, setNotifGeneral] = useState(true);

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
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Profile Details</h2>
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
            {currentUser?.role === "student" && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">Student Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                    <input 
                      type="text" 
                      value={profileForm.department} 
                      onChange={e => setProfileForm({...profileForm, department: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                    <input 
                      type="text" 
                      value={profileForm.semester} 
                      onChange={e => setProfileForm({...profileForm, semester: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Contact Name</label>
                    <input 
                      type="text" 
                      value={profileForm.emergencyContactName} 
                      onChange={e => setProfileForm({...profileForm, emergencyContactName: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Contact Phone</label>
                    <input 
                      type="text" 
                      value={profileForm.emergencyContactPhone} 
                      onChange={e => setProfileForm({...profileForm, emergencyContactPhone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                    />
                  </div>
                </div>
              </>
            )}

            {(["admin", "staff", "driver", "conductor", "teacher"].includes(currentUser?.role || "")) && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">Staff Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee Code</label>
                    <input 
                      type="text" 
                      value={profileForm.employeeCode} 
                      onChange={e => setProfileForm({...profileForm, employeeCode: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category / Rank</label>
                    <input 
                      type="text" 
                      value={profileForm.category} 
                      onChange={e => setProfileForm({...profileForm, category: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500" 
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
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
        
        {/* Appearance Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Appearance</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Sun className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Theme</h3>
                <p className="text-sm text-gray-500">Switch between light, dark, or system mode</p>
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
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark' 
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
                <button 
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    theme === 'system' 
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  System
                </button>
              </div>
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Font Family</h3>
                <p className="text-sm text-gray-500">Choose your preferred font</p>
              </div>
              <select 
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  document.documentElement.style.fontFamily = e.target.value === 'system' ? '' : e.target.value;
                }}
                className="flex items-center justify-between min-w-[180px] px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-800 rounded-none bg-white dark:bg-gray-950 focus:outline-none transition-colors"
              >
                <option value="system">System Default</option>
                <option value="Inter, sans-serif">Inter</option>
                <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas">Monospace</option>
                <option value="Georgia, serif">Serif</option>
              </select>
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
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Bell className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">All email notifications</h3>
                <p className="text-sm text-gray-500">Manage which emails you receive at {email}.</p>
              </div>
              <Toggle checked={allEmails} onChange={() => setAllEmails(!allEmails)} />
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Email categories</h3>
              <p className="text-sm text-gray-500 mb-6">Turn off individual categories to stop those emails while staying subscribed to others.</p>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Default</span>
                  <Toggle checked={notifDefault} onChange={() => setNotifDefault(!notifDefault)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Trip Updates</span>
                  <Toggle checked={notifTrip} onChange={() => setNotifTrip(!notifTrip)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing Alerts</span>
                  <Toggle checked={notifBilling} onChange={() => setNotifBilling(!notifBilling)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">General Notice</span>
                  <Toggle checked={notifGeneral} onChange={() => setNotifGeneral(!notifGeneral)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Security Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Privacy & Security</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-500">Add an extra layer of security</p>
              </div>
              <button onClick={() => handleNotImplemented('Advanced Security')} className="p-2 border border-gray-200 dark:border-gray-800 rounded-none text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"><Shield className="w-4 h-4" /></button>
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-800/60" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Data Privacy</h3>
                <p className="text-sm text-gray-500">Manage your data privacy settings</p>
              </div>
              <button onClick={() => handleNotImplemented('Advanced Security')} className="p-2 border border-gray-200 dark:border-gray-800 rounded-none text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"><Shield className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Data & Storage Card */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden mb-12">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Data & Storage</h2>
            <div className="p-2 border border-gray-100 dark:border-gray-800 rounded-none text-gray-500">
              <Database className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Install App</h3>
                <p className="text-sm text-gray-500">Add this app to your home screen or desktop for quicker access</p>
              </div>
              <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <Download className="w-4 h-4" />
                Install app
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
                Update now
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
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Clear Cache</h3>
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

      </div>
    </div>
  );
}
