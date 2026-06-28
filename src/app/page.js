"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Coins, 
  Settings, 
  Plus, 
  X, 
  FileText, 
  ClipboardCheck, 
  MessageSquare, 
  Edit3, 
  Video, 
  User, 
  MapPin, 
  CalendarDays,
  Smartphone,
  Info,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Trash2,
  Search,
  Home as HomeIcon
} from "lucide-react";
import { 
  fetchProjects, 
  addProject, 
  updateProject, 
  deleteProject, 
  getSavedFirebaseConfig, 
  saveFirebaseConfig 
} from "../lib/firebase";
import { generateInvoicePDF, generateBASTPDF } from "../lib/pdfGenerator";
import { getWhatsAppReminderLink } from "../lib/whatsapp";

// Helper for relative date formatting
function getRelativeDateString(targetDateStr, baseDate = new Date("2026-06-28")) {
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return "";

  // Reset times to compare dates
  const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const d2 = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days from now`;
  if (diffDays === 7) return "next week";
  if (diffDays > 7) return "upcoming";
  if (diffDays < -1) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
    ];
    return months[target.getMonth()];
  }
  
  return "";
}

const modalTransition = { type: "tween", ease: "easeOut", duration: 0.18 };
const overlayTransition = { duration: 0.12 };

// Check if job is in the past
function isPastJob(targetDateStr, baseDateStr = "2026-06-28") {
  const target = new Date(targetDateStr);
  const base = new Date(baseDateStr);
  if (isNaN(target.getTime())) return false;
  
  // Compare without time
  const tDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const bDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return tDate.getTime() < bDate.getTime();
}

// Format raw number to dot separated string
function formatNumberWithDots(val) {
  if (val === undefined || val === null || val === "") return "";
  const numStr = String(val).replace(/[^0-9]/g, "");
  if (!numStr) return "";
  return new Intl.NumberFormat("id-ID").format(Number(numStr));
}

// Parse dot separated string back to number
function parseDotsToNumber(str) {
  if (!str) return 0;
  return Number(String(str).replace(/[^0-9]/g, "")) || 0;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("calendar"); // 'calendar' | 'keuangan'
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Timeline windows for pagination
  const [visiblePastCount, setVisiblePastCount] = useState(7);
  const [visibleFutureCount, setVisibleFutureCount] = useState(7);
  
  // Search query state
  const [searchQuery, setSearchQuery] = useState("");

  // Autofill dynamic package tracking
  const [autofilledFields, setAutofilledFields] = useState({});

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => {
      const nextForm = { ...prev, [fieldName]: value };
      
      // Clear autofill status for this field since user edited/selected it
      setAutofilledFields(prevAuto => {
        const nextAuto = { ...prevAuto };
        nextAuto[fieldName] = false;
        
        // Trigger dynamic autofill downstream
        if (value && value.trim().length > 0) {
          // Find latest project where project[fieldName] matches value
          const match = [...projects].reverse().find(p => 
            (p[fieldName] || "").toLowerCase().trim() === value.toLowerCase().trim()
          );
          if (match) {
            const fieldsToFill = ["director", "pm", "agency", "clientCompany", "projectType"];
            fieldsToFill.forEach(f => {
              if (f !== fieldName) {
                const isCurrentEmpty = !prev[f] || prev[f].trim().length === 0;
                const isCurrentAutofilled = prevAuto[f];
                if ((isCurrentEmpty || isCurrentAutofilled) && match[f]) {
                  nextForm[f] = match[f];
                  nextAuto[f] = true;
                }
              }
            });
          }
        }
        return nextAuto;
      });
      
      return nextForm;
    });
  };

  const getInputStyle = (fieldName) => {
    return `w-full bg-card-bg px-4 py-3 rounded-xl text-sm outline-none focus:bg-zinc-800 transition border ${
      autofilledFields[fieldName]
        ? "text-brand-green border-brand-green/30 bg-brand-green/5 font-semibold"
        : "text-white border-transparent"
    }`;
  };

  const getGridInputStyle = (fieldName) => {
    return `bg-card-bg px-4 py-3 rounded-xl text-sm outline-none focus:bg-zinc-800 transition w-full border ${
      autofilledFields[fieldName]
        ? "text-brand-green border-brand-green/30 bg-brand-green/5 font-semibold"
        : "text-white border-transparent"
    }`;
  };

  const handleInputFocus = (fieldName, focusId, e) => {
    setActiveSuggestionField(focusId);
    if (autofilledFields[fieldName]) {
      e.target.select();
    }
  };

  // Calendar Month states
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June
  const [selectedCalDate, setSelectedCalDate] = useState("2026-06-28");

  const INDO_MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  
  // Custom states for UI updates
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null); // "add-title", "edit-pm", etc.

  const getSuggestionsForField = (fieldName, query) => {
    if (!query || typeof query !== "string") return [];
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    
    const uniqueValues = Array.from(new Set(
      projects
        .map(p => p[fieldName])
        .filter(val => val && typeof val === "string" && val.trim().length > 0)
    ));
    
    return uniqueValues
      .filter(val => val.toLowerCase().includes(trimmed) && val.toLowerCase() !== trimmed)
      .slice(0, 3);
  };

  const renderSuggestions = (fieldName, currentVal, onSelect, fieldId) => {
    if (activeSuggestionField !== fieldId) return null;
    const matches = getSuggestionsForField(fieldName, currentVal);
    if (matches.length === 0) return null;

    return (
      <div className="relative w-full">
        <div className="absolute top-1 left-0 right-0 bg-[#1c1c1e] border border-zinc-800 rounded-xl shadow-2xl z-50 p-1 flex flex-col gap-0.5 overflow-hidden">
          {matches.map((match, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(match);
                setActiveSuggestionField(null);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition active:scale-[0.98] cursor-pointer truncate"
            >
              {match}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAddBAST, setShowAddBAST] = useState(false);
  const [showEditBAST, setShowEditBAST] = useState(false);
  
  // SSR Hydration safeguard
  const [mounted, setMounted] = useState(false);
  
  // User Profile configuration
  const [userDetails, setUserDetails] = useState({
    name: "Anthonius Ari Toelle",
    company: "Freelancer",
    address: "Apt Pakubuwono Terrace S/23/B7, Cipulir, Kebayoran Lama, Jakarta",
    phone: "087842252505",
    bank: "CIMB Niaga",
    accountNo: "703413786800"
  });

  // Firebase Config state
  const [firebaseInput, setFirebaseInput] = useState({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  });

  // Forms state
  const [formData, setFormData] = useState({
    title: "",
    director: "",
    pm: "",
    agency: "",
    date: "2026-06-28",
    status: "on",
    paymentStatus: "unpaid",
    value: "",
    notes: "",
    contactName: "",
    contactPhone: "",
    clientCompany: "",
    clientAddress: "",
    projectType: "Editing Video ( Color Grading ) TVC"
  });

  // Load Data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      // Sort projects by date
      const sorted = data.sort((a, b) => new Date(a.date) - new Date(b.date));
      setProjects(sorted);

      // Dynamically determine initial pagination counts
      setVisiblePastCount(7);
      setVisibleFutureCount(7);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    // Load config & profile from localStorage if any
    const savedConfig = getSavedFirebaseConfig();
    if (savedConfig) {
      setFirebaseInput(savedConfig);
    }
    const savedProfile = localStorage.getItem("freedoma_user_profile");
    if (savedProfile) {
      setUserDetails(JSON.parse(savedProfile));
    }
    loadAllData();

    // Register Service Worker for PWA
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("Service Worker registration failed:", err);
      });
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      setTimeout(() => {
        const marker = document.getElementById("today-marker");
        if (marker) {
          marker.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
    }
  }, [projects]);

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-screen bg-black flex items-center justify-center text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-green/30 animate-pulse">
            <img src="/icon-192.png" alt="logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-400">Memuat Freedoma...</span>
        </div>
      </div>
    );
  }


  // Save Settings
  const handleSaveSettings = () => {
    localStorage.setItem("freedoma_user_profile", JSON.stringify(userDetails));
    setIsSettingsOpen(false);
  };

  // Add Project
  const handleAddProject = async (e) => {
    e.preventDefault();
    const cleanProject = {
      ...formData,
      value: Number(formData.value) || 0
    };
    const created = await addProject(cleanProject);
    setProjects(prev => [...prev, created].sort((a, b) => new Date(a.date) - new Date(b.date)));
    setIsAddOpen(false);
    resetForm();
  };

  // Edit Project
  const handleEditProject = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    const cleanUpdates = {
      ...formData,
      value: Number(formData.value) || 0
    };
    await updateProject(selectedProject.id, cleanUpdates);
    
    // Update local state
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, ...cleanUpdates } : p).sort((a, b) => new Date(a.date) - new Date(b.date)));
    setSelectedProject({ ...selectedProject, ...cleanUpdates });
    setIsEditOpen(false);
  };

  // Inline Update
  const handleInlineUpdate = async (field, value) => {
    if (!selectedProject) return;
    let updatedProject = { ...selectedProject, [field]: value };
    let updates = { [field]: value };

    if (field === "paymentStatus") {
      if (value === "paid") {
        updatedProject.paymentDate = "2026-06-28";
        updates.paymentDate = "2026-06-28";
      } else {
        updatedProject.paymentDate = "";
        updates.paymentDate = "";
      }
    }

    setSelectedProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
    try {
      await updateProject(selectedProject.id, updates);
    } catch (err) {
      console.error("Failed to update project inline:", err);
    }
  };

  // Delete Project
  const handleDelete = async (projectId) => {
    if (confirm("Hapus project ini?")) {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setSelectedProject(null);
      setIsEditOpen(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      director: "",
      pm: "",
      agency: "",
      date: "2026-06-28",
      status: "on",
      paymentStatus: "unpaid",
      paymentDate: "",
      value: "",
      notes: "",
      contactName: "",
      contactPhone: "",
      clientCompany: "",
      clientAddress: "",
      projectType: "Editing Video ( Color Grading ) TVC"
    });
    setAutofilledFields({});
  };

  const openEdit = (project) => {
    setFormData({
      title: project.title || "",
      director: project.director || "",
      pm: project.pm || "",
      agency: project.agency || "",
      date: project.date || "2026-06-28",
      status: project.status || "on",
      paymentStatus: project.paymentStatus || "unpaid",
      paymentDate: project.paymentDate || "",
      value: project.value || "",
      notes: project.notes || "",
      contactName: project.contactName || "",
      contactPhone: project.contactPhone || "",
      clientCompany: project.clientCompany || "",
      clientAddress: project.clientAddress || "",
      projectType: project.projectType || "Editing Video ( Color Grading ) TVC"
    });
    setAutofilledFields({});
    setIsEditOpen(true);
  };

  // Split projects based on Today (2026-06-28)
  const baseDateStr = "2026-06-28";
  
  const pastProjects = projects.filter(p => isPastJob(p.date, baseDateStr));
  const currentAndFutureProjects = projects.filter(p => !isPastJob(p.date, baseDateStr));

  // Determine pagination visible slices
  const visiblePast = pastProjects.slice(-visiblePastCount); // Get closest past ones
  const visibleFuture = currentAndFutureProjects.slice(0, visibleFutureCount);
  
  const displayedProjects = [...visiblePast, ...visibleFuture];

  // Search filter logic
  const searchedProjects = searchQuery.trim().length === 0 
    ? projects
    : projects.filter(p => {
        const q = searchQuery.toLowerCase().trim();
        return (
          (p.title || "").toLowerCase().includes(q) ||
          (p.director || "").toLowerCase().includes(q) ||
          (p.pm || "").toLowerCase().includes(q) ||
          (p.agency || "").toLowerCase().includes(q) ||
          (p.clientCompany || "").toLowerCase().includes(q)
        );
      });

  // Stats
  const activeCount = projects.filter(p => !isPastJob(p.date, baseDateStr) && p.status === "on").length;
  const totalUnpaidValue = projects
    .filter(p => p.paymentStatus === "unpaid")
    .reduce((sum, p) => sum + p.value, 0);

  const formattedUnpaidSum = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(totalUnpaidValue);

  return (
    <div className="w-full h-full flex flex-col bg-black text-white px-6 pb-32 overflow-y-auto no-scrollbar relative min-h-screen">
      
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-xl z-30 pt-8 pb-4 mb-6 -mx-6 px-6 flex justify-between items-center border-b border-zinc-900/30">
        <div className="flex items-center gap-2">
          {/* Neon Green Owl Icon */}
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-brand-green/30 bg-black">
            <img src="/icon-192.png" alt="logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">freedoma</span>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-card-bg hover:bg-zinc-800 transition active:scale-95"
        >
          <Settings size={20} className="text-zinc-400" />
        </button>
      </div>

      {/* Screen Title */}
      <div className="mb-6">
        {activeTab === "calendar" ? (
          <h2 className="text-2xl font-semibold text-right">
            <span className="text-white font-bold font-number">{activeCount}</span> <span className="text-brand-green">Projects On</span>
          </h2>
        ) : activeTab === "keuangan" ? (
          <h2 className="text-2xl font-semibold text-right">
            <span className="text-white font-bold font-number">{formattedUnpaidSum.replace("Rp", "Rp ")}</span> <span className="text-unpaid-red">Unpaid</span>
          </h2>
        ) : activeTab === "search" ? (
          <h2 className="text-2xl font-semibold text-right">
            <span className="text-white font-bold font-number">{searchedProjects.length}</span> <span className="text-brand-green">Results Found</span>
          </h2>
        ) : (
          <h2 className="text-2xl font-semibold text-right">
            <span className="text-brand-green">Kalender</span> <span className="text-white font-bold font-number">Bulanan</span>
          </h2>
        )}
      </div>

      {/* Month Calendar Grid View */}
      {activeTab === "month" && (() => {
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dayCells = [];
        
        for (let i = 0; i < firstDayIndex; i++) {
          dayCells.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
          dayCells.push(i);
        }

        const handlePrevMonth = () => {
          if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
          } else {
            setCurrentMonth(prev => prev - 1);
          }
        };

        const handleNextMonth = () => {
          if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
          } else {
            setCurrentMonth(prev => prev + 1);
          }
        };

        return (
          <div className="flex flex-col gap-6 mb-6">
            {/* Month Header / Controls */}
            <div className="flex justify-between items-center bg-card-bg border border-zinc-900 rounded-2xl p-4">
              <button 
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/40 border border-zinc-800 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer text-xs"
              >
                ◀
              </button>
              <span className="font-semibold text-white text-sm">
                {INDO_MONTHS[currentMonth]} {currentYear}
              </span>
              <button 
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/40 border border-zinc-800 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer text-xs"
              >
                ▶
              </button>
            </div>

            {/* Month Grid Calendar */}
            <div className="bg-card-bg border border-zinc-900 rounded-[28px] p-4 flex flex-col gap-3">
              {/* Days of week */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <span>Min</span>
                <span>Sen</span>
                <span>Sel</span>
                <span>Rab</span>
                <span>Kam</span>
                <span>Jum</span>
                <span>Sab</span>
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-2">
                {dayCells.map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <div key={`empty-${idx}`} className="aspect-square" />;
                  }

                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dayProjects = projects.filter(p => p.date === dateStr);
                  const hasJobs = dayProjects.length > 0;
                  const isSelected = dateStr === selectedCalDate;
                  const isToday = dateStr === "2026-06-28";

                  return (
                    <button
                      key={`day-${dayNum}`}
                      type="button"
                      onClick={() => setSelectedCalDate(dateStr)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center relative active:scale-95 transition cursor-pointer border ${
                        isSelected 
                          ? "bg-brand-green/20 border-brand-green text-brand-green font-bold" 
                          : isToday 
                          ? "bg-zinc-800 border-zinc-700 text-white font-bold" 
                          : "bg-black/20 border-zinc-950 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      <span className="text-xs">{dayNum}</span>
                      {hasJobs && (
                        <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${
                          isSelected ? "bg-brand-green" : "bg-brand-green/80"
                        }`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Jobs List for Selected Day */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                Project pada {formatIndoDate(selectedCalDate).full}
              </h3>
              {projects.filter(p => p.date === selectedCalDate).length === 0 ? (
                <div className="text-center py-6 bg-card-bg/40 border border-zinc-900/50 rounded-2xl text-xs text-zinc-550">
                  Tidak ada project dijadwalkan pada hari ini.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {projects.filter(p => p.date === selectedCalDate).map((project) => {
                    const isPast = isPastJob(project.date);
                    const displayStatus = isPast ? "done" : project.status;
                    return (
                      <div
                        key={project.id}
                        onClick={() => { setSelectedProject(project); setStatusDropdownOpen(false); }}
                        className="w-full bg-card-bg rounded-2xl p-4 flex items-center justify-between gap-3 border border-zinc-900 cursor-pointer hover:border-zinc-800 transition active:scale-[0.98]"
                      >
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                          <h4 className="text-sm font-semibold text-white truncate">{project.title}</h4>
                          {project.director && (
                            <span className="text-[10px] text-brand-green truncate">{project.director}</span>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase ${
                          displayStatus === "done" 
                            ? "bg-done-green text-done-text" 
                            : displayStatus === "on" 
                            ? "bg-on-green text-on-text" 
                            : "bg-tbc-orange text-tbc-text"
                        }`}>
                          {displayStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Search Input Field */}
      {activeTab === "search" && (
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Cari project, sutradara, produser..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1c1c1e] border border-zinc-800 rounded-2xl px-4 py-3.5 pl-11 text-white text-sm outline-none focus:border-zinc-700 transition"
          />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        </div>
      )}

      {/* Timeline Scroll Load - Older Projects */}
      {activeTab !== "search" && activeTab !== "month" && pastProjects.length > visiblePastCount && (
        <div className="w-full flex justify-center mb-4">
          <button 
            onClick={() => setVisiblePastCount(prev => prev + 3)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 bg-[#1c1c1e] px-4 py-2 rounded-full border border-zinc-800 hover:text-white transition active:scale-95 cursor-pointer shadow-lg"
          >
            <ChevronUp size={14} /> Lihat Proyek Lalu ({pastProjects.length - visiblePastCount})
          </button>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 py-10">Memuat data...</div>
      ) : activeTab === "month" ? (
        null
      ) : activeTab === "search" ? (
        searchedProjects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-16 text-center">
            <p>Project tidak ditemukan.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {searchedProjects.map((project) => {
              const relativeTime = getRelativeDateString(project.date);
              const isPast = isPastJob(project.date);
              const displayStatus = isPast ? "done" : project.status;
              const dayNum = new Date(project.date).getDate();

              return (
                <motion.div
                  key={project.id}
                  layoutId={`card-${project.id}`}
                  transition={modalTransition}
                  onClick={() => { setSelectedProject(project); setStatusDropdownOpen(false); }}
                  className={`w-full bg-card-bg rounded-[24px] p-4 flex items-center justify-between gap-3 border border-zinc-900 cursor-pointer hover:border-zinc-800 transition active:scale-[0.99] ${
                    isPast ? "opacity-75" : ""
                  }`}
                >
                  {/* Left Side: Date Block */}
                  <div className="w-[72px] h-[72px] bg-black/40 border border-zinc-800/50 rounded-[20px] flex flex-col items-center justify-center text-center p-1">
                    <span className="text-2xl font-bold text-white tracking-tight font-number">{dayNum}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{relativeTime}</span>
                  </div>

                  {/* Middle Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <h3 className="text-[17px] font-semibold text-white leading-tight truncate">{project.title}</h3>
                    
                    {/* Director / Client */}
                    {project.director && (
                      <div className="flex items-center gap-1.5 text-xs text-brand-green">
                        <Video size={12} />
                        <span className="truncate leading-none">{project.director}</span>
                      </div>
                    )}
                    
                    {/* PM / Producer */}
                    {project.pm && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <User size={12} />
                        <span className="truncate leading-none">{project.pm}</span>
                      </div>
                    )}

                    {/* Agency / Location */}
                    {project.agency && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <MapPin size={12} />
                        <span className="truncate leading-none">{project.agency}</span>
                      </div>
                    )}
                    
                    {/* Real Date */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <CalendarDays size={12} />
                      <span className="leading-none font-number">{formatIndoDate(project.date).full}</span>
                    </div>
                  </div>

                  {/* Right Side Status Button */}
                  <div className="flex items-center justify-end">
                    <span className={`px-4 py-2 rounded-full text-xs font-semibold uppercase min-w-[70px] text-center ${
                      displayStatus === "done" 
                        ? "bg-done-green text-done-text" 
                        : displayStatus === "on" 
                        ? "bg-on-green text-on-text" 
                        : "bg-tbc-orange text-tbc-text"
                    }`}>
                      {displayStatus}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : displayedProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-16 text-center">
          <p>Belum ada project ditambahkan.</p>
          <p className="text-xs text-zinc-600 mt-1">Tap tombol (+) di bawah untuk membuat project baru.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedProjects.map((project, index) => {
            const relativeTime = getRelativeDateString(project.date);
            const isPast = isPastJob(project.date);
            
            // Status determinations
            const displayStatus = isPast ? "done" : project.status;
            
            // Format single day digit for calendar
            const dayNum = new Date(project.date).getDate();

            // Check if this is the first non-past project to show the "Hari Ini" marker divider
            const isFirstCurrent = !isPast && (index === 0 || isPastJob(displayedProjects[index - 1].date));

            return (
              <React.Fragment key={project.id}>
                {isFirstCurrent && (
                  <div id="today-marker" className="w-full flex items-center gap-3 my-2 scroll-mt-24">
                    <div className="h-[1px] bg-brand-green/30 flex-1" />
                    <span className="text-[10px] font-bold text-brand-green uppercase tracking-widest bg-brand-green/10 px-3 py-1.5 rounded-full border border-brand-green/20">
                      Hari Ini
                    </span>
                    <div className="h-[1px] bg-brand-green/30 flex-1" />
                  </div>
                )}

                <motion.div
                  layoutId={`card-${project.id}`}
                  transition={modalTransition}
                  onClick={() => { setSelectedProject(project); setStatusDropdownOpen(false); }}
                  className={`w-full bg-card-bg rounded-[24px] p-4 flex items-center justify-between gap-3 border border-zinc-900 cursor-pointer hover:border-zinc-800 transition active:scale-[0.99] ${
                    isPast ? "opacity-75" : ""
                  }`}
                >
                  {/* Left Side: Date Block */}
                  <div className="w-[72px] h-[72px] bg-black/40 border border-zinc-800/50 rounded-[20px] flex flex-col items-center justify-center text-center p-1">
                    <span className="text-2xl font-bold text-white tracking-tight font-number">{dayNum}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{relativeTime}</span>
                  </div>

                  {/* Middle Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <h3 className="text-[17px] font-semibold text-white leading-tight truncate">{project.title}</h3>
                    
                    {/* Director / Client */}
                    {project.director && (
                      <div className="flex items-center gap-1.5 text-xs text-brand-green">
                        <Video size={12} />
                        <span className="truncate leading-none">{project.director}</span>
                      </div>
                    )}
                    
                    {/* PM / Producer */}
                    {project.pm && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <User size={12} />
                        <span className="truncate leading-none">{project.pm}</span>
                      </div>
                    )}

                    {/* Nominal Job - Only in Keuangan tab */}
                    {activeTab === "keuangan" && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Coins size={12} className="text-zinc-550" />
                        <span className="leading-none font-number">
                          {new Intl.NumberFormat("id-ID").format(project.value || 0)}
                        </span>
                      </div>
                    )}

                    {/* Agency / Location - Only in Calendar tab */}
                    {activeTab === "calendar" && project.agency && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <MapPin size={12} />
                        <span className="truncate leading-none">{project.agency}</span>
                      </div>
                    )}
                    
                    {/* Real Date - Only in Calendar tab */}
                    {activeTab === "calendar" && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <CalendarDays size={12} />
                        <span className="leading-none font-number">{formatIndoDate(project.date).full}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Side Status Button */}
                  <div className="flex items-center justify-end">
                    {activeTab === "calendar" ? (
                      <span className={`px-4 py-2 rounded-full text-xs font-semibold uppercase min-w-[70px] text-center ${
                        displayStatus === "done" 
                          ? "bg-done-green text-done-text" 
                          : displayStatus === "on" 
                          ? "bg-on-green text-on-text" 
                          : "bg-tbc-orange text-tbc-text"
                      }`}>
                        {displayStatus}
                      </span>
                    ) : (
                      <span className={`px-4 py-2 rounded-full text-xs font-semibold uppercase min-w-[70px] text-center ${
                        project.paymentStatus === "paid"
                          ? "bg-paid-green text-white"
                          : "bg-unpaid-red text-white"
                    }`}>
                      {project.paymentStatus}
                    </span>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        </div>
      )}

      {/* Timeline Scroll Load - Future Projects */}
      {activeTab !== "search" && activeTab !== "month" && currentAndFutureProjects.length > visibleFutureCount && (
        <div className="w-full flex justify-center mt-6">
          <button 
            onClick={() => setVisibleFutureCount(prev => prev + 3)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 bg-[#1c1c1e] px-4 py-2 rounded-full border border-zinc-800 hover:text-white transition active:scale-95 cursor-pointer shadow-lg"
          >
            <ChevronDown size={14} /> Lihat Proyek Akan Datang ({currentAndFutureProjects.length - visibleFutureCount})
          </button>
        </div>
      )}

      {/* Bottom Floating Navigation Dock */}
      <div className="fixed bottom-6 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
        <div className="w-full max-w-[360px] bg-card-bg/90 backdrop-blur-xl border border-zinc-800/80 rounded-full p-2 flex items-center justify-around shadow-2xl pointer-events-auto">
          {/* Calendar Timeline Button */}
          <button 
            onClick={() => setActiveTab("calendar")}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              activeTab === "calendar" ? "text-brand-green bg-black/40" : "text-zinc-500 hover:text-white"
            }`}
            title="Timeline"
          >
            <HomeIcon size={22} />
          </button>

          {/* Month Calendar Grid Button */}
          <button 
            onClick={() => setActiveTab("month")}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              activeTab === "month" ? "text-brand-green bg-black/40" : "text-zinc-500 hover:text-white"
            }`}
            title="Kalender"
          >
            <Calendar size={22} />
          </button>

          <button 
            onClick={() => { 
              resetForm(); 
              if (activeTab === "month" && selectedCalDate) {
                setFormData(prev => ({ ...prev, date: selectedCalDate }));
              }
              setIsAddOpen(true); 
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center transition bg-[#2c2c2e]/60 border border-zinc-850/50 hover:bg-zinc-800 hover:text-white active:scale-95 cursor-pointer text-zinc-400"
            title="Tambah"
          >
            <Plus size={22} />
          </button>

          {/* Search Button */}
          <button 
            onClick={() => setActiveTab("search")}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              activeTab === "search" ? "text-brand-green bg-black/40" : "text-zinc-500 hover:text-white"
            }`}
            title="Cari"
          >
            <Search size={22} />
          </button>

          {/* Finance Button (Coins) */}
          <button 
            onClick={() => setActiveTab("keuangan")}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              activeTab === "keuangan" ? "text-brand-green bg-black/40" : "text-zinc-500 hover:text-white"
            }`}
            title="Keuangan"
          >
            <Coins size={22} />
          </button>
        </div>
      </div>

      {/* MODAL: PROJECT DETAILS */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={modalTransition}
              className="w-full max-w-md bg-black border-t sm:border border-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 flex flex-col gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Detail Header */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-brand-green/30">
                    <img src="/icon-192.png" alt="logo" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-zinc-400 font-medium">Project Details</span>
                </div>
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-card-bg hover:bg-zinc-800 text-zinc-400"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Card Frame */}
              <div className="bg-card-bg rounded-[24px] p-5 border border-zinc-900 flex flex-col gap-4">
                {/* Upper block with Info */}
                <div className="flex items-center justify-between gap-3">
                  <div className="w-[72px] h-[72px] bg-black/40 border border-zinc-800/50 rounded-[20px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <span className="text-2xl font-bold text-white tracking-tight font-number">{new Date(selectedProject.date).getDate()}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{getRelativeDateString(selectedProject.date)}</span>
                    <input 
                      type="date" 
                      value={selectedProject.date} 
                      onChange={(e) => handleInlineUpdate("date", e.target.value)} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <input 
                      type="text" 
                      value={selectedProject.title} 
                      placeholder="Judul Project"
                      onChange={(e) => handleInlineUpdate("title", e.target.value)}
                      className="bg-transparent font-bold text-lg text-white w-full outline-none border-b border-transparent focus:border-zinc-800"
                    />
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase w-10">Dir</span>
                      <input 
                        type="text" 
                        value={selectedProject.director || ""} 
                        placeholder="Sutradara"
                        onChange={(e) => handleInlineUpdate("director", e.target.value)}
                        className="bg-transparent text-xs text-brand-green font-medium w-full outline-none"
                      />
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase w-10">PM</span>
                      <input 
                        type="text" 
                        value={selectedProject.pm || ""} 
                        placeholder="PM"
                        onChange={(e) => handleInlineUpdate("pm", e.target.value)}
                        className="bg-transparent text-xs text-zinc-300 w-full outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase w-10">Loc</span>
                      <input 
                        type="text" 
                        value={selectedProject.agency || ""} 
                        placeholder="Lokasi"
                        onChange={(e) => handleInlineUpdate("agency", e.target.value)}
                        className="bg-transparent text-xs text-zinc-300 w-full outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase w-10">Pay</span>
                      <input 
                        type="text" 
                        value={selectedProject.clientCompany || ""} 
                        placeholder="Prepared For (Client Company)"
                        onChange={(e) => handleInlineUpdate("clientCompany", e.target.value)}
                        className="bg-transparent text-xs text-zinc-300 w-full outline-none"
                      />
                    </div>

                    {selectedProject.paymentStatus === "paid" && (
                      <div className="flex items-center gap-1 border-t border-zinc-900/50 pt-1.5 mt-1">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase w-10">Paid</span>
                        <input 
                          type="date" 
                          value={selectedProject.paymentDate || "2026-06-28"} 
                          onChange={(e) => handleInlineUpdate("paymentDate", e.target.value)}
                          className="bg-transparent text-xs text-brand-green font-semibold w-full outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Status Pill (Clickable Toggle) */}
                  <button 
                    onClick={() => handleInlineUpdate("paymentStatus", selectedProject.paymentStatus === "paid" ? "unpaid" : "paid")}
                    className={`px-4 py-2 rounded-full text-xs font-semibold uppercase active:scale-95 transition-all cursor-pointer ${
                      selectedProject.paymentStatus === "paid"
                        ? "bg-paid-green text-white"
                        : "bg-unpaid-red text-white"
                    }`}
                  >
                    {selectedProject.paymentStatus}
                  </button>
                </div>

                {/* Status Selector (On / TBC / Done) as a Dropdown Capsule */}
                <div className="flex justify-end items-center pt-3 border-t border-zinc-900/50 relative">
                  
                  <div className="relative">
                    {/* Main Toggle Button */}
                    <button
                      onClick={() => setStatusDropdownOpen(prev => !prev)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase flex items-center gap-1.5 active:scale-95 transition cursor-pointer ${
                        selectedProject.status === "on"
                          ? "bg-on-green text-on-text"
                          : selectedProject.status === "tbc"
                          ? "bg-tbc-orange text-tbc-text"
                          : "bg-done-green text-done-text"
                      }`}
                    >
                      {selectedProject.status}
                      <span className="text-[8px] opacity-70">▼</span>
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {statusDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 bottom-full mb-2 bg-[#1c1c1e] border border-zinc-800 rounded-2xl p-1.5 flex flex-col gap-1 shadow-2xl z-50 min-w-[90px]"
                        >
                          {["on", "tbc", "done"].map((st) => (
                            <button
                              key={st}
                              onClick={() => {
                                handleInlineUpdate("status", st);
                                setStatusDropdownOpen(false);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold uppercase text-center active:scale-95 transition cursor-pointer ${
                                selectedProject.status === st
                                  ? st === "on"
                                    ? "bg-on-green text-on-text"
                                    : st === "tbc"
                                    ? "bg-tbc-orange text-tbc-text"
                                    : "bg-done-green text-done-text"
                                  : "text-zinc-400 hover:text-white hover:bg-zinc-855"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Big cash amount display */}
                <div className="w-full flex items-center justify-center gap-1 py-3 border-t border-b border-zinc-800/50">
                  <span className="text-xl font-light text-zinc-500">Rp</span>
                  <input 
                    type="text"
                    value={formatNumberWithDots(selectedProject.value)}
                    onChange={(e) => handleInlineUpdate("value", parseDotsToNumber(e.target.value))}
                    className="bg-transparent text-[24px] font-light text-zinc-300 tracking-wide text-center outline-none w-48 font-number"
                  />
                </div>

                {/* Custom notes info banner */}
                <div className="flex items-start gap-2.5 bg-black/30 border border-zinc-800/40 rounded-[16px] p-3 text-xs text-zinc-400 leading-normal">
                  <Info size={14} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                  <textarea
                    placeholder="Tambah keterangan / notes..."
                    value={selectedProject.notes || ""}
                    onChange={(e) => handleInlineUpdate("notes", e.target.value)}
                    className="bg-transparent text-xs text-zinc-300 w-full outline-none resize-none h-12"
                  />
                </div>

                {/* Tools Section Grid (2x2) */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {/* Invoice */}
                  <button 
                    onClick={() => generateInvoicePDF(selectedProject, userDetails)}
                    className="flex items-center gap-2 justify-center py-3 bg-[#2c2c2e] hover:bg-zinc-700 transition rounded-xl text-white font-medium text-[14px]"
                  >
                    <FileText size={16} className="text-zinc-400" />
                    <span>invoice</span>
                  </button>

                  {/* BAST */}
                  <button 
                    onClick={() => generateBASTPDF(selectedProject, userDetails)}
                    className="flex items-center gap-2 justify-center py-3 bg-[#2c2c2e] hover:bg-zinc-700 transition rounded-xl text-white font-medium text-[14px]"
                  >
                    <ClipboardCheck size={16} className="text-zinc-400" />
                    <span>bast</span>
                  </button>

                  {/* Reminder */}
                  <button 
                    onClick={() => {
                      const { link, text } = getWhatsAppReminderLink(selectedProject, userDetails);
                      // Fallback copy to clipboard
                      navigator.clipboard.writeText(text);
                      alert("Reminder template disalin ke clipboard! Membuka WhatsApp...");
                      window.open(link, "_blank");
                    }}
                    className="flex items-center gap-2 justify-center py-3 bg-[#2c2c2e] hover:bg-zinc-700 transition rounded-xl text-white font-medium text-[14px]"
                  >
                    <MessageSquare size={16} className="text-zinc-400" />
                    <span>reminder</span>
                  </button>

                  {/* Edit */}
                  <button 
                    onClick={() => {
                      openEdit(selectedProject);
                    }}
                    className="flex items-center gap-2 justify-center py-3 bg-[#2c2c2e] hover:bg-zinc-700 transition rounded-xl text-white font-medium text-[14px]"
                  >
                    <Edit3 size={16} className="text-zinc-400" />
                    <span>edit</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD PROJECT */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={modalTransition}
              className="w-full max-w-md bg-black border-t sm:border border-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Project Baru</h3>
                <button 
                  onClick={() => setIsAddOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-card-bg hover:bg-zinc-800 text-zinc-400"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddProject} className="flex flex-col gap-3">
                <div>
                  <input 
                    type="text" 
                    placeholder="Nama Project (e.g. Bumi)" 
                    required
                    value={formData.title} 
                    onChange={e => handleFieldChange("title", e.target.value)}
                    onFocus={(e) => handleInputFocus("title", "add-title", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("title")}
                  />
                  {renderSuggestions("title", formData.title, (val) => handleFieldChange("title", val), "add-title")}
                </div>
                
                <div>
                  <input 
                    type="text" 
                    placeholder="Sutradara/Client (e.g. Dimas Djay)" 
                    value={formData.director} 
                    onChange={e => handleFieldChange("director", e.target.value)}
                    onFocus={(e) => handleInputFocus("director", "add-director", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("director")}
                  />
                  {renderSuggestions("director", formData.director, (val) => handleFieldChange("director", val), "add-director")}
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="Prepared For / Client Company (e.g. PT Sayap Kreatif)" 
                    value={formData.clientCompany} 
                    onChange={e => handleFieldChange("clientCompany", e.target.value)}
                    onFocus={(e) => handleInputFocus("clientCompany", "add-clientCompany", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("clientCompany")}
                  />
                  {renderSuggestions("clientCompany", formData.clientCompany, (val) => handleFieldChange("clientCompany", val), "add-clientCompany")}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input 
                      type="text" 
                      placeholder="PM/Producer" 
                      value={formData.pm} 
                      onChange={e => handleFieldChange("pm", e.target.value)}
                      onFocus={(e) => handleInputFocus("pm", "add-pm", e)}
                      onBlur={() => setActiveSuggestionField(null)}
                      className={getGridInputStyle("pm")}
                    />
                    {renderSuggestions("pm", formData.pm, (val) => handleFieldChange("pm", val), "add-pm")}
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Lokasi" 
                      value={formData.agency} 
                      onChange={e => handleFieldChange("agency", e.target.value)}
                      onFocus={(e) => handleInputFocus("agency", "add-agency", e)}
                      onBlur={() => setActiveSuggestionField(null)}
                      className={getGridInputStyle("agency")}
                    />
                    {renderSuggestions("agency", formData.agency, (val) => handleFieldChange("agency", val), "add-agency")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Nilai Project (IDR)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 10.000.000" 
                      value={formatNumberWithDots(formData.value)} 
                      onChange={e => setFormData({...formData, value: parseDotsToNumber(e.target.value)})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition font-number"
                    />
                  </div>
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="Jenis Pekerjaan (e.g. Editing Video)" 
                    value={formData.projectType} 
                    onChange={e => handleFieldChange("projectType", e.target.value)}
                    onFocus={(e) => handleInputFocus("projectType", "add-projectType", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("projectType")}
                  />
                  {renderSuggestions("projectType", formData.projectType, (val) => handleFieldChange("projectType", val), "add-projectType")}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Schedule</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    >
                      <option value="on">On</option>
                      <option value="tbc">TBC</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Pembayaran</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          paymentStatus: val,
                          paymentDate: val === "paid" ? "2026-06-28" : ""
                        }));
                      }}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                {formData.paymentStatus === "paid" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Tanggal Pembayaran</label>
                    <input 
                      type="date" 
                      value={formData.paymentDate || "2026-06-28"} 
                      onChange={e => setFormData({...formData, paymentDate: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    />
                  </div>
                )}

                <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBAST(!showAddBAST)}
                    className="flex justify-between items-center w-full text-left text-zinc-400 hover:text-white transition px-1 py-1"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Detil Client & BAST (Opsional)</span>
                    <ChevronDown size={16} className={`transition-transform duration-200 ${showAddBAST ? "rotate-180" : ""}`} />
                  </button>
                  
                  {showAddBAST && (
                    <div className="flex flex-col gap-2 mt-1">
                      <input 
                        type="text" 
                        placeholder="Nama Kontak Client (e.g. Niken Nurul)" 
                        value={formData.contactName} 
                        onChange={e => setFormData({...formData, contactName: e.target.value})}
                        className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                      />
                      <input 
                        type="text" 
                        placeholder="No WA Client (e.g. 087842252505)" 
                        value={formData.contactPhone} 
                        onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                        className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                      />

                      <textarea 
                        placeholder="Alamat Lengkap Client" 
                        value={formData.clientAddress} 
                        onChange={e => setFormData({...formData, clientAddress: e.target.value})}
                        className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition h-16 resize-none"
                      />
                    </div>
                  )}
                </div>

                <textarea 
                  placeholder="Keterangan / Notes (e.g. ada mastergrade menyusul)" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition h-16 resize-none"
                />

                <button 
                  type="submit" 
                  className="w-full py-4 bg-brand-green text-black font-semibold rounded-xl hover:bg-green-500 transition mt-2 active:scale-95 text-sm"
                >
                  Tambah Project
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT PROJECT */}
      <AnimatePresence>
        {isEditOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={modalTransition}
              className="w-full max-w-md bg-black border-t sm:border border-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Edit Project</h3>
                <button 
                  onClick={() => setIsEditOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-card-bg hover:bg-zinc-800 text-zinc-400"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleEditProject} className="flex flex-col gap-3">
                <div>
                  <input 
                    type="text" 
                    placeholder="Nama Project" 
                    required
                    value={formData.title} 
                    onChange={e => handleFieldChange("title", e.target.value)}
                    onFocus={(e) => handleInputFocus("title", "edit-title", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("title")}
                  />
                  {renderSuggestions("title", formData.title, (val) => handleFieldChange("title", val), "edit-title")}
                </div>
                
                <div>
                  <input 
                    type="text" 
                    placeholder="Sutradara/Client" 
                    value={formData.director} 
                    onChange={e => handleFieldChange("director", e.target.value)}
                    onFocus={(e) => handleInputFocus("director", "edit-director", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("director")}
                  />
                  {renderSuggestions("director", formData.director, (val) => handleFieldChange("director", val), "edit-director")}
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="Prepared For / Client Company" 
                    value={formData.clientCompany} 
                    onChange={e => handleFieldChange("clientCompany", e.target.value)}
                    onFocus={(e) => handleInputFocus("clientCompany", "edit-clientCompany", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("clientCompany")}
                  />
                  {renderSuggestions("clientCompany", formData.clientCompany, (val) => handleFieldChange("clientCompany", val), "edit-clientCompany")}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input 
                      type="text" 
                      placeholder="PM/Producer" 
                      value={formData.pm} 
                      onChange={e => handleFieldChange("pm", e.target.value)}
                      onFocus={(e) => handleInputFocus("pm", "edit-pm", e)}
                      onBlur={() => setActiveSuggestionField(null)}
                      className={getGridInputStyle("pm")}
                    />
                    {renderSuggestions("pm", formData.pm, (val) => handleFieldChange("pm", val), "edit-pm")}
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Lokasi" 
                      value={formData.agency} 
                      onChange={e => handleFieldChange("agency", e.target.value)}
                      onFocus={(e) => handleInputFocus("agency", "edit-agency", e)}
                      onBlur={() => setActiveSuggestionField(null)}
                      className={getGridInputStyle("agency")}
                    />
                    {renderSuggestions("agency", formData.agency, (val) => handleFieldChange("agency", val), "edit-agency")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Nilai Project (IDR)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 10.000.000" 
                      value={formatNumberWithDots(formData.value)} 
                      onChange={e => setFormData({...formData, value: parseDotsToNumber(e.target.value)})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition font-number"
                    />
                  </div>
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="Jenis Pekerjaan" 
                    value={formData.projectType} 
                    onChange={e => handleFieldChange("projectType", e.target.value)}
                    onFocus={(e) => handleInputFocus("projectType", "edit-projectType", e)}
                    onBlur={() => setActiveSuggestionField(null)}
                    className={getInputStyle("projectType")}
                  />
                  {renderSuggestions("projectType", formData.projectType, (val) => handleFieldChange("projectType", val), "edit-projectType")}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Schedule</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    >
                      <option value="on">On</option>
                      <option value="tbc">TBC</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Pembayaran</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          paymentStatus: val,
                          paymentDate: val === "paid" ? "2026-06-28" : ""
                        }));
                      }}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                {formData.paymentStatus === "paid" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Tanggal Pembayaran</label>
                    <input 
                      type="date" 
                      value={formData.paymentDate || "2026-06-28"} 
                      onChange={e => setFormData({...formData, paymentDate: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    />
                  </div>
                )}

                <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditBAST(!showEditBAST)}
                    className="flex justify-between items-center w-full text-left text-zinc-400 hover:text-white transition px-1 py-1"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Detil Client & BAST (Opsional)</span>
                    <ChevronDown size={16} className={`transition-transform duration-200 ${showEditBAST ? "rotate-180" : ""}`} />
                  </button>
                  
                  {showEditBAST && (
                    <div className="flex flex-col gap-2 mt-1">
                      <input 
                        type="text" 
                        placeholder="Nama Kontak Client" 
                        value={formData.contactName} 
                        onChange={e => setFormData({...formData, contactName: e.target.value})}
                        className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                      />
                      <input 
                        type="text" 
                        placeholder="No WA Client" 
                        value={formData.contactPhone} 
                        onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                        className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                      />

                      <textarea 
                        placeholder="Alamat Lengkap Client" 
                        value={formData.clientAddress} 
                        onChange={e => setFormData({...formData, clientAddress: e.target.value})}
                        className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition h-16 resize-none"
                      />
                    </div>
                  )}
                </div>

                <textarea 
                  placeholder="Keterangan / Notes" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition h-16 resize-none"
                />

                <div className="flex gap-3 mt-2">
                  <button 
                    type="button"
                    onClick={() => handleDelete(selectedProject.id)}
                    className="flex-1 py-4 bg-unpaid-red text-white font-semibold rounded-xl hover:bg-red-700 transition active:scale-95 text-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Hapus
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-4 bg-brand-green text-black font-semibold rounded-xl hover:bg-green-500 transition active:scale-95 text-sm"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: SETTINGS (PROFILE & FIREBASE CONFIG) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={modalTransition}
              className="w-full max-w-md bg-black border-t sm:border border-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Pengaturan</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-card-bg hover:bg-zinc-800 text-zinc-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Profile Settings */}
                <div className="flex flex-col gap-2">
                  <span className="text-brand-green text-xs font-semibold uppercase tracking-wider">Data Diri (Untuk Invoice/BAST)</span>
                  
                  <input 
                    type="text" 
                    placeholder="Nama Lengkap" 
                    value={userDetails.name}
                    onChange={e => setUserDetails({...userDetails, name: e.target.value})}
                    className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                  />
                  <input 
                    type="text" 
                    placeholder="Nama Perusahaan (e.g. Freelancer)" 
                    value={userDetails.company}
                    onChange={e => setUserDetails({...userDetails, company: e.target.value})}
                    className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                  />
                  <input 
                    type="text" 
                    placeholder="Nomor Telepon" 
                    value={userDetails.phone}
                    onChange={e => setUserDetails({...userDetails, phone: e.target.value})}
                    className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                  />
                  <textarea 
                    placeholder="Alamat Lengkap" 
                    value={userDetails.address}
                    onChange={e => setUserDetails({...userDetails, address: e.target.value})}
                    className="w-full bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition h-16 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Nama Bank" 
                      value={userDetails.bank}
                      onChange={e => setUserDetails({...userDetails, bank: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    />
                    <input 
                      type="text" 
                      placeholder="No Rekening" 
                      value={userDetails.accountNo}
                      onChange={e => setUserDetails({...userDetails, accountNo: e.target.value})}
                      className="bg-card-bg px-4 py-3 rounded-xl text-white text-sm outline-none focus:bg-zinc-800 transition"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveSettings}
                  className="w-full py-4 bg-brand-green text-black font-semibold rounded-xl hover:bg-green-500 transition mt-2 active:scale-95 text-sm"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Helpers
function formatIndoDate(dateStr) {
  if (!dateStr) return { full: "" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { full: dateStr };
  
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  
  return {
    full: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  };
}
