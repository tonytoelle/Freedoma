import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

// Local storage keys
const FIREBASE_CONFIG_KEY = "freedoma_firebase_config";
const LOCAL_PROJECTS_KEY = "freedoma_local_projects";

// Mock initial data if empty
const INITIAL_PROJECTS = [
  {
    id: "mock-1",
    title: "Bumi",
    director: "Dimas Djay",
    pm: "Icha",
    agency: "Mastermind",
    date: "2026-07-27", // future date relative to current time 2026-06-28
    status: "on", // 'on', 'tbc' (past is auto 'done')
    paymentStatus: "paid", // 'paid', 'unpaid'
    value: 10000000,
    notes: "ada mastergrade yang akan menyusul",
    contactName: "Niken Nurul Indah Pratiwi",
    contactPhone: "087842252505",
    clientCompany: "PT Sayap Kreatif Indonesia",
    clientAddress: "Rukan Permata Senayan Blok A No. 30, Grogol Utara, Keb. Lama, Jakarta, 12210",
    projectType: "Editing Video ( Color Grading ) TVC"
  },
  {
    id: "mock-2",
    title: "Decolgen",
    director: "Bendolt",
    pm: "Vya",
    agency: "Poka",
    date: "2026-06-27", // yesterday relative to 2026-06-28
    status: "on",
    paymentStatus: "unpaid",
    value: 15000000,
    notes: "Sudah serah terima offline",
    contactName: "Vya Poka",
    contactPhone: "081234567890",
    clientCompany: "PT Poka Kreatif",
    clientAddress: "Sudirman Central Business District, Jakarta",
    projectType: "TVC Ad Editing"
  },
  {
    id: "mock-3",
    title: "Shoppee",
    director: "Nicky Bhisma",
    pm: "Icha",
    agency: "Mastermind",
    date: "2026-06-28", // today
    status: "on",
    paymentStatus: "unpaid",
    value: 20000000,
    notes: "Urgent delivery",
    contactName: "Nicky",
    contactPhone: "087842252505",
    clientCompany: "PT Shoppee Indonesia",
    clientAddress: "Kuningan, Jakarta",
    projectType: "Digital Video Ad"
  },
  {
    id: "mock-4",
    title: "South Quarter",
    director: "Avi",
    pm: "Icha",
    agency: "Mastermind",
    date: "2026-06-29", // tomorrow
    status: "tbc",
    paymentStatus: "unpaid",
    value: 10000000,
    notes: "Menunggu brief final",
    contactName: "Avi",
    contactPhone: "081999888777",
    clientCompany: "SQ Office Space",
    clientAddress: "Cilandak, Jakarta Selatan",
    projectType: "Corporate Video Profile"
  },
  {
    id: "mock-5",
    title: "Shoppee 3",
    director: "Dimas Djay",
    pm: "Icha",
    agency: "Mastermind",
    date: "2026-07-05", // next week
    status: "on",
    paymentStatus: "unpaid",
    value: 10000000,
    notes: "TBC Schedule",
    contactName: "Icha Mastermind",
    contactPhone: "08122334455",
    clientCompany: "PT Sayap Kreatif Indonesia",
    clientAddress: "Jakarta",
    projectType: "Editing Video ( Color Grading ) TVC"
  }
];

// Default Firebase config for freedoma-app-2026 project
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCLaDg4TYl743jLq8b_nI9q1RHkwTUJThw",
  authDomain: "freedoma-app-2026.firebaseapp.com",
  projectId: "freedoma-app-2026",
  storageBucket: "freedoma-app-2026.firebasestorage.app",
  messagingSenderId: "573941550384",
  appId: "1:573941550384:web:e22977c36a6fb02ab60cf5"
};

// Load Firebase Config if saved
export function getSavedFirebaseConfig() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (!saved) return DEFAULT_FIREBASE_CONFIG;
    const parsed = JSON.parse(saved);
    if (parsed && parsed.apiKey && parsed.projectId) {
      return parsed;
    }
    return DEFAULT_FIREBASE_CONFIG;
  } catch (e) {
    console.error("Error parsing firebase config from localStorage", e);
    return DEFAULT_FIREBASE_CONFIG;
  }
}



export function saveFirebaseConfig(config) {
  if (typeof window === "undefined") return;
  if (!config) {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
  } else {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  }
}

// Check if Firebase is active
let db = null;
function getDb() {
  if (db) return db;
  const config = getSavedFirebaseConfig();
  if (config && config.apiKey && config.projectId) {
    try {
      const app = getApps().length === 0 ? initializeApp(config) : getApp();
      db = getFirestore(app);
      return db;
    } catch (e) {
      console.error("Failed to initialize Firebase with configured credentials:", e);
      return null;
    }
  }
  return null;
}

// Local Storage helpers for projects
function getLocalProjects() {
  if (typeof window === "undefined") return [];
  try {
    const local = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!local) {
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    // Safeguard: make sure we get a valid array
    const parsed = JSON.parse(local);
    if (Array.isArray(parsed)) {
      return parsed;
    } else {
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
  } catch (e) {
    console.error("Error parsing projects from localStorage", e);
    return INITIAL_PROJECTS;
  }
}

function saveLocalProjects(projects) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
}

// Main API Export
export async function fetchProjects() {
  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      const querySnapshot = await getDocs(collection(firestoreDb, "projects"));
      const projects = [];
      querySnapshot.forEach((doc) => {
        projects.push({ id: doc.id, ...doc.data() });
      });
      return projects;
    } catch (e) {
      console.error("Firestore fetch error, falling back to LocalStorage:", e);
      return getLocalProjects();
    }
  }
  return getLocalProjects();
}

export async function addProject(project) {
  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      const docRef = await addDoc(collection(firestoreDb, "projects"), project);
      return { id: docRef.id, ...project };
    } catch (e) {
      console.error("Firestore add error, falling back to LocalStorage:", e);
    }
  }
  const local = getLocalProjects();
  const newProj = { ...project, id: "local-" + Date.now() };
  local.push(newProj);
  saveLocalProjects(local);
  return newProj;
}

export async function updateProject(id, updates) {
  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, "projects", id);
      await updateDoc(docRef, updates);
      return { id, ...updates };
    } catch (e) {
      console.error("Firestore update error, falling back to LocalStorage:", e);
    }
  }
  const local = getLocalProjects();
  const updated = local.map((p) => (p.id === id ? { ...p, ...updates } : p));
  saveLocalProjects(updated);
  return { id, ...updates };
}

export async function deleteProject(id) {
  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, "projects", id));
      return id;
    } catch (e) {
      console.error("Firestore delete error, falling back to LocalStorage:", e);
    }
  }
  const local = getLocalProjects();
  const filtered = local.filter((p) => p.id !== id);
  saveLocalProjects(filtered);
  return id;
}
