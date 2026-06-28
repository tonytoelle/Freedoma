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
  Trash2
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
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
  
  return "";
}

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

export default function Home() {
  const [activeTab, setActiveTab] = useState("calendar"); // 'calendar' | 'keuangan'
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Timeline windows for pagination
  const [visiblePastCount, setVisiblePastCount] = useState(2);
  const [visibleFutureCount, setVisibleFutureCount] = useState(3);
  
  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
    if (firebaseInput.apiKey && firebaseInput.projectId) {
      saveFirebaseConfig(firebaseInput);
    } else {
      saveFirebaseConfig(null);
    }
    setIsSettingsOpen(false);
    // Reload database source
    loadAllData();
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
      value: "",
      notes: "",
      contactName: "",
      contactPhone: "",
      clientCompany: "",
      clientAddress: "",
      projectType: "Editing Video ( Color Grading ) TVC"
    });
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
      value: project.value || "",
      notes: project.notes || "",
      contactName: project.contactName || "",
      contactPhone: project.contactPhone || "",
      clientCompany: project.clientCompany || "",
      clientAddress: project.clientAddress || "",
      projectType: project.projectType || "Editing Video ( Color Grading ) TVC"
    });
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
    <div className="w-full h-full flex flex-col bg-black text-white px-6 pt-8 pb-32 overflow-y-auto no-scrollbar relative min-h-screen">
      
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-6">
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
            <span className="text-white font-bold">{activeCount}</span> <span className="text-brand-green">Projects On</span>
          </h2>
        ) : (
          <h2 className="text-2xl font-semibold text-right">
            <span className="text-white font-bold">{formattedUnpaidSum.replace("Rp", "Rp ")}</span> <span className="text-unpaid-red">Unpaid</span>
          </h2>
        )}
      </div>

      {/* Timeline Scroll Load - Older Projects */}
      {pastProjects.length > visiblePastCount && (
        <div className="w-full flex justify-center mb-4">
          <button 
            onClick={() => setVisiblePastCount(prev => prev + 2)}
            className="flex items-center gap-1 text-xs text-zinc-500 bg-card-bg px-3 py-1.5 rounded-full border border-zinc-800 hover:text-white transition"
          >
            <ChevronUp size={14} /> Tarik ke atas / Load Lalu ({pastProjects.length - visiblePastCount})
          </button>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 py-10">Memuat data...</div>
      ) : displayedProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-16 text-center">
          <p>Belum ada project ditambahkan.</p>
          <p className="text-xs text-zinc-600 mt-1">Tap tombol (+) di bawah untuk membuat project baru.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedProjects.map((project) => {
            const relativeTime = getRelativeDateString(project.date);
            const isPast = isPastJob(project.date);
            
            // Status determinations
            const displayStatus = isPast ? "done" : project.status;
            
            // Format single day digit for calendar
            const dayNum = new Date(project.date).getDate();

            return (
              <motion.div
                key={project.id}
                layoutId={`card-${project.id}`}
                onClick={() => setSelectedProject(project)}
                className="w-full bg-card-bg rounded-[24px] p-4 flex items-center justify-between gap-3 border border-zinc-900 cursor-pointer hover:border-zinc-800 transition active:scale-[0.99]"
              >
                {/* Left Side: Date Block */}
                <div className="w-[72px] h-[72px] bg-black/40 border border-zinc-800/50 rounded-[20px] flex flex-col items-center justify-center text-center p-1">
                  <span className="text-2xl font-bold text-white tracking-tight">{dayNum}</span>
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
                    <span className="leading-none">{formatIndoDate(project.date).full}</span>
                  </div>
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
            );
          })}
        </div>
      )}

      {/* Timeline Scroll Load - Future Projects */}
      {currentAndFutureProjects.length > visibleFutureCount && (
        <div className="w-full flex justify-center mt-6">
          <button 
            onClick={() => setVisibleFutureCount(prev => prev + 3)}
            className="flex items-center gap-1 text-xs text-zinc-500 bg-card-bg px-3 py-1.5 rounded-full border border-zinc-800 hover:text-white transition"
          >
            <ChevronDown size={14} /> Tarik turun / Load Akan Datang ({currentAndFutureProjects.length - visibleFutureCount})
          </button>
        </div>
      )}

      {/* Floating Add Project Button */}
      <div className="w-full flex justify-center mt-8">
        <button 
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="w-14 h-14 rounded-full bg-card-bg border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center transition active:scale-95 shadow-xl text-white"
        >
          <Plus size={28} />
        </button>
      </div>

      {/* Bottom Floating Navigation Dock */}
      <div className="fixed bottom-6 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
        <div className="w-full max-w-[280px] bg-card-bg/90 backdrop-blur-xl border border-zinc-800/80 rounded-full p-2 flex items-center justify-around shadow-2xl pointer-events-auto">
          {/* Calendar Button */}
          <button 
            onClick={() => setActiveTab("calendar")}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              activeTab === "calendar" ? "text-brand-green bg-black/40" : "text-zinc-500 hover:text-white"
            }`}
          >
            <Calendar size={24} />
          </button>

          {/* Finance Button (Money Sack) */}
          <button 
            onClick={() => setActiveTab("keuangan")}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              activeTab === "keuangan" ? "text-brand-green bg-black/40" : "text-zinc-500 hover:text-white"
            }`}
          >
            <Coins size={24} />
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
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
                  <div className="w-[72px] h-[72px] bg-black/40 border border-zinc-800/50 rounded-[20px] flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-white tracking-tight">{new Date(selectedProject.date).getDate()}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{getRelativeDateString(selectedProject.date)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white leading-tight truncate">{selectedProject.title}</h3>
                    {selectedProject.director && (
                      <p className="text-xs text-brand-green font-medium truncate mt-0.5">{selectedProject.director}</p>
                    )}
                    <p className="text-xs text-zinc-500 mt-1">{selectedProject.pm || "PM"} • {selectedProject.agency || "Agency"}</p>
                    <p className="text-xs text-zinc-600">{formatIndoDate(selectedProject.date).full}</p>
                  </div>

                  {/* Payment Status Pill */}
                  <span className={`px-4 py-2 rounded-full text-xs font-semibold uppercase ${
                    selectedProject.paymentStatus === "paid"
                      ? "bg-paid-green text-white"
                      : "bg-unpaid-red text-white"
                  }`}>
                    {selectedProject.paymentStatus}
                  </span>
                </div>

                {/* Big cash amount display */}
                <div className="w-full text-center py-4 border-t border-b border-zinc-800/50">
                  <span className="text-[28px] font-light text-zinc-300 tracking-wide">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(selectedProject.value).replace("Rp", "Rp ")}
                  </span>
                </div>

                {/* Custom notes info banner */}
                {selectedProject.notes && (
                  <div className="flex items-start gap-2.5 bg-black/30 border border-zinc-800/40 rounded-[16px] p-3 text-xs text-zinc-400 leading-normal">
                    <Info size={14} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                    <span>{selectedProject.notes}</span>
                  </div>
                )}

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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
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
                <input 
                  type="text" 
                  placeholder="Nama Project (e.g. Bumi)" 
                  required
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                />
                
                <input 
                  type="text" 
                  placeholder="Sutradara/Client (e.g. Dimas Djay)" 
                  value={formData.director} 
                  onChange={e => setFormData({...formData, director: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="PM/Producer" 
                    value={formData.pm} 
                    onChange={e => setFormData({...formData, pm: e.target.value})}
                    className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Agency/Lokasi" 
                    value={formData.agency} 
                    onChange={e => setFormData({...formData, agency: e.target.value})}
                    className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Nilai Project (IDR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 10000000" 
                      value={formData.value} 
                      onChange={e => setFormData({...formData, value: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    />
                  </div>
                </div>

                <input 
                  type="text" 
                  placeholder="Jenis Pekerjaan (e.g. Editing Video)" 
                  value={formData.projectType} 
                  onChange={e => setFormData({...formData, projectType: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Schedule</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    >
                      <option value="on">On</option>
                      <option value="tbc">TBC</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Pembayaran</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => setFormData({...formData, paymentStatus: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2">
                  <span className="text-zinc-500 text-[11px] px-1 font-semibold">Detil Client & BAST</span>
                  <input 
                    type="text" 
                    placeholder="Nama Kontak Client (e.g. Niken Nurul)" 
                    value={formData.contactName} 
                    onChange={e => setFormData({...formData, contactName: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="No WA Client (e.g. 087842252505)" 
                    value={formData.contactPhone} 
                    onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Perusahaan Client" 
                    value={formData.clientCompany} 
                    onChange={e => setFormData({...formData, clientCompany: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <textarea 
                    placeholder="Alamat Lengkap Client" 
                    value={formData.clientAddress} 
                    onChange={e => setFormData({...formData, clientAddress: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green h-16 resize-none"
                  />
                </div>

                <textarea 
                  placeholder="Keterangan / Notes (e.g. ada mastergrade menyusul)" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green h-16 resize-none"
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
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
                <input 
                  type="text" 
                  placeholder="Nama Project" 
                  required
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                />
                
                <input 
                  type="text" 
                  placeholder="Sutradara/Client" 
                  value={formData.director} 
                  onChange={e => setFormData({...formData, director: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="PM/Producer" 
                    value={formData.pm} 
                    onChange={e => setFormData({...formData, pm: e.target.value})}
                    className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Agency/Lokasi" 
                    value={formData.agency} 
                    onChange={e => setFormData({...formData, agency: e.target.value})}
                    className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Nilai Project (IDR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 10000000" 
                      value={formData.value} 
                      onChange={e => setFormData({...formData, value: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    />
                  </div>
                </div>

                <input 
                  type="text" 
                  placeholder="Jenis Pekerjaan" 
                  value={formData.projectType} 
                  onChange={e => setFormData({...formData, projectType: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Schedule</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    >
                      <option value="on">On</option>
                      <option value="tbc">TBC</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 text-[10px] px-1">Status Pembayaran</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => setFormData({...formData, paymentStatus: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2">
                  <span className="text-zinc-500 text-[11px] px-1 font-semibold">Detil Client & BAST</span>
                  <input 
                    type="text" 
                    placeholder="Nama Kontak Client" 
                    value={formData.contactName} 
                    onChange={e => setFormData({...formData, contactName: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="No WA Client" 
                    value={formData.contactPhone} 
                    onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Perusahaan Client" 
                    value={formData.clientCompany} 
                    onChange={e => setFormData({...formData, clientCompany: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <textarea 
                    placeholder="Alamat Lengkap Client" 
                    value={formData.clientAddress} 
                    onChange={e => setFormData({...formData, clientAddress: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green h-16 resize-none"
                  />
                </div>

                <textarea 
                  placeholder="Keterangan / Notes" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green h-16 resize-none"
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
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
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Nama Perusahaan (e.g. Freelancer)" 
                    value={userDetails.company}
                    onChange={e => setUserDetails({...userDetails, company: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Nomor Telepon" 
                    value={userDetails.phone}
                    onChange={e => setUserDetails({...userDetails, phone: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <textarea 
                    placeholder="Alamat Lengkap" 
                    value={userDetails.address}
                    onChange={e => setUserDetails({...userDetails, address: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green h-16 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Nama Bank" 
                      value={userDetails.bank}
                      onChange={e => setUserDetails({...userDetails, bank: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    />
                    <input 
                      type="text" 
                      placeholder="No Rekening" 
                      value={userDetails.accountNo}
                      onChange={e => setUserDetails({...userDetails, accountNo: e.target.value})}
                      className="bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                    />
                  </div>
                </div>

                {/* Firebase Connection Config */}
                <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3">
                  <span className="text-brand-green text-xs font-semibold uppercase tracking-wider">Koneksi Firebase Firestore (Opsional)</span>
                  <p className="text-[11px] text-zinc-500 mb-1 leading-normal">
                    Kosongkan untuk menyimpan data secara lokal di HP/Browser. Masukkan Firebase Web Config jika ingin sinkronisasi Cloud.
                  </p>
                  
                  <input 
                    type="text" 
                    placeholder="API Key" 
                    value={firebaseInput.apiKey}
                    onChange={e => setFirebaseInput({...firebaseInput, apiKey: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Project ID" 
                    value={firebaseInput.projectId}
                    onChange={e => setFirebaseInput({...firebaseInput, projectId: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                  <input 
                    type="text" 
                    placeholder="Auth Domain" 
                    value={firebaseInput.authDomain}
                    onChange={e => setFirebaseInput({...firebaseInput, authDomain: e.target.value})}
                    className="w-full bg-card-bg border border-zinc-850 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-brand-green"
                  />
                </div>

                <button 
                  onClick={handleSaveSettings}
                  className="w-full py-4 bg-brand-green text-black font-semibold rounded-xl hover:bg-green-500 transition mt-2 active:scale-95 text-sm"
                >
                  Simpan & Hubungkan
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
