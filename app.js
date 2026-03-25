import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { demoParts, getCategoryGradient, getVehicleOptions, inferStockState } from "./parts-data.js";
import { runEasternAISearch } from "./easternai.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP7TqLDVxV6xSQRVJyESZSrAHtirIP5wk",
  authDomain: "easternautospares-25e32.firebaseapp.com",
  projectId: "easternautospares-25e32",
  storageBucket: "easternautospares-25e32.firebasestorage.app",
  messagingSenderId: "504628520496",
  appId: "1:504628520496:web:a1b8f7645abb9c2d4caff5",
  measurementId: "G-H2G3L7LGQ2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const els = {
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  categoryFilter: document.getElementById("categoryFilter"),
  vehicleFilter: document.getElementById("vehicleFilter"),
  sortFilter: document.getElementById("sortFilter"),
  productsGrid: document.getElementById("productsGrid"),
  emptyProductsState: document.getElementById("emptyProductsState"),
  resultCount: document.getElementById("resultCount"),
  cartItems: document.getElementById("cartItems"),
  emptyCartState: document.getElementById("emptyCartState"),
  navCartCount: document.getElementById("navCartCount"),
  navCartTotal: document.getElementById("navCartTotal"),
  checkoutCartCount: document.getElementById("checkoutCartCount"),
  summaryItems: document.getElementById("summaryItems"),
  summaryTotal: document.getElementById("summaryTotal"),
  clearCartBtn: document.getElementById("clearCartBtn"),
  placeOrderBtn: document.getElementById("placeOrderBtn"),
  whatsAppBtn: document.getElementById("whatsAppBtn"),
  orderStatus: document.getElementById("orderStatus"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerLocation: document.getElementById("customerLocation"),
  customerNotes: document.getElementById("customerNotes"),
  openAuthBtn: document.getElementById("openAuthBtn"),
  appTabBtns: document.querySelectorAll("[data-app-tab]"),
  jumpTabBtns: document.querySelectorAll("[data-jump-tab]"),
  appPanels: document.querySelectorAll("[data-app-panel]"),
  closeAuthBtn: document.getElementById("closeAuthBtn"),
  authModal: document.getElementById("authModal"),
  authForm: document.getElementById("authForm"),
  authStatus: document.getElementById("authStatus"),
  authModalTitle: document.getElementById("authModalTitle"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  loginTabBtn: document.getElementById("loginTabBtn"),
  signupTabBtn: document.getElementById("signupTabBtn"),
  authAccountType: document.getElementById("authAccountType"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  staffCodeWrap: document.getElementById("staffCodeWrap"),
  staffCodeInput: document.getElementById("staffCodeInput"),
  nameFieldWrap: document.getElementById("nameFieldWrap"),
  signedInPanel: document.getElementById("signedInPanel"),
  signedInUserText: document.getElementById("signedInUserText"),
  logoutBtn: document.getElementById("logoutBtn"),
  sessionTitle: document.getElementById("sessionTitle"),
  sessionText: document.getElementById("sessionText"),
  roleBadge: document.getElementById("roleBadge"),
  authStateMini: document.getElementById("authStateMini"),
  staffPanelSection: document.getElementById("staffPanelSection"),
  addPartForm: document.getElementById("addPartForm"),
  addPartStatus: document.getElementById("addPartStatus"),
  partName: document.getElementById("partName"),
  partCategory: document.getElementById("partCategory"),
  partVehicle: document.getElementById("partVehicle"),
  partQty: document.getElementById("partQty"),
  partBarcode: document.getElementById("partBarcode"),
  partPrice: document.getElementById("partPrice"),
  partImage: document.getElementById("partImage"),
  partDescription: document.getElementById("partDescription"),
  openStockDeskBtn: document.getElementById("openStockDeskBtn"),
  closeStockDeskBtn: document.getElementById("closeStockDeskBtn"),
  stockDeskModal: document.getElementById("stockDeskModal"),
  stockTableBody: document.getElementById("stockTableBody"),
  stockTableCount: document.getElementById("stockTableCount"),
  cartNavBtn: document.getElementById("cartNavBtn"),
  heroPrice1: document.getElementById("heroPrice1"),
  heroPrice2: document.getElementById("heroPrice2"),
  heroPrice3: document.getElementById("heroPrice3"),
  aiSearchMode: document.getElementById("aiSearchMode"),
  aiMatchCount: document.getElementById("aiMatchCount"),
  aiSearchBadge: document.getElementById("aiSearchBadge"),
  aiSummary: document.getElementById("aiSummary"),
  aiTopMatches: document.getElementById("aiTopMatches"),
  aiSuggestions: document.getElementById("aiSuggestions")
};

let authMode = "login";
let currentUser = null;
let currentUserRole = "guest";
let parts = [];
let cart = JSON.parse(localStorage.getItem("eas-cart") || "[]");
let activeSearchTerm = "";
let activeAppTab = "shop";

const LOCAL_PARTS_KEY = "eas-local-parts";
const STAFF_CODE = "AES26";
const STAFF_SESSION_KEY = "eas-staff-session";

const authErrorMessages = {
  "auth/configuration-not-found": "Secure account setup is not finished yet. Please complete the sign-in configuration in the admin console.",
  "auth/email-already-in-use": "That email already has an account. Try logging in instead.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/missing-password": "Enter your password to continue.",
  "auth/too-many-requests": "Too many login attempts. Please wait a moment and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account was found for that email.",
  "auth/weak-password": "Use a stronger password with at least 6 characters.",
  "auth/network-request-failed": "Network connection failed. Check your internet connection and try again.",
  "auth/operation-not-allowed": "Secure email/password sign-in is not enabled yet.",
  "auth/unauthorized-domain": "This site domain is not authorized for sign-in yet."
};

function normalizeVehicles(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(",");
  const vehicles = [...new Set(entries
    .map((entry) => String(entry).trim())
    .filter(Boolean))];

  if (vehicles.includes("Universal")) return ["Universal"];
  return vehicles.length ? vehicles : ["Universal"];
}

function normalizePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizePart(rawPart, fallback = {}) {
  const vehicles = normalizeVehicles(rawPart.vehicles || rawPart.vehicle || fallback.vehicle);
  const stockQty = Number(rawPart.stockQty ?? fallback.stockQty ?? 0);
  const price = normalizePrice(rawPart.price ?? fallback.price);
  const barcode = String(rawPart.barcode || fallback.barcode || rawPart.partId || "").trim();

  return {
    ...rawPart,
    price,
    vehicles,
    vehicle: vehicles.includes("Universal") ? "Universal" : vehicles[0],
    stockQty,
    stock: rawPart.stock || inferStockState(stockQty),
    barcode,
    description: rawPart.description || fallback.description || "",
    imageUrl: rawPart.imageUrl || fallback.imageUrl || ""
  };
}

function getPartKey(part) {
  return part.barcode || part.partId || `${part.name}-${part.vehicle}`;
}

function mergeParts(...groups) {
  const merged = new Map();

  groups.flat().forEach((rawPart) => {
    const part = normalizePart(rawPart);
    merged.set(getPartKey(part), part);
  });

  return [...merged.values()];
}

function getLocalParts() {
  try {
    const localParts = JSON.parse(localStorage.getItem(LOCAL_PARTS_KEY) || "[]");
    return Array.isArray(localParts) ? localParts.map((part) => normalizePart(part)) : [];
  } catch (error) {
    console.warn("Local parts could not be parsed.", error);
    return [];
  }
}

function saveLocalPart(part) {
  const localParts = mergeParts(getLocalParts(), [part]);
  localStorage.setItem(LOCAL_PARTS_KEY, JSON.stringify(localParts));
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPriceLabel(value) {
  return value && Number(value) > 0 ? formatMoney(value) : "Quote";
}

function formatVehicleList(vehicles = []) {
  const visibleVehicles = vehicles.filter(Boolean);
  if (visibleVehicles.includes("Universal")) return "Universal";
  if (!visibleVehicles.length) return "Universal";
  return visibleVehicles.join(", ");
}

function getFirstName(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean)[0] || "Account";
}

function shortenEmail(email) {
  const value = String(email || "").trim();
  if (value.length <= 24) return value;
  const [local, domain] = value.split("@");
  if (!domain) return `${value.slice(0, 21)}...`;
  return `${local.slice(0, 10)}...@${domain}`;
}

function getStockSignal(stock) {
  if (stock === "In Stock") return { dot: "bg-emerald-500", label: "Available", text: "text-emerald-600" };
  if (stock === "Low Stock" || stock === "Order Ready") return { dot: "bg-amber-400", label: "Low Stock", text: "text-amber-600" };
  return { dot: "bg-rose-500", label: "Out of Stock", text: "text-rose-600" };
}

function persistCart() {
  localStorage.setItem("eas-cart", JSON.stringify(cart));
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * item.qty, 0);
}

function scrollToCheckout() {
  document.getElementById("checkout").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateAuthPanelVisibility() {
  const isSignedIn = !!currentUser;
  els.authForm.classList.toggle("hidden", isSignedIn);
  els.signedInPanel.classList.toggle("hidden", !isSignedIn);
}

function openAuthModal() {
  updateAuthPanelVisibility();
  if (!currentUser && window.location.protocol === "file:") {
    els.authStatus.textContent = "Open this page through localhost or a trusted domain for reliable secure login.";
  }
  els.authModal.classList.remove("hidden");
}

function closeAuthModal() {
  els.authModal.classList.add("hidden");
}

function openStockDeskModal() {
  els.stockDeskModal.classList.remove("hidden");
}

function closeStockDeskModal() {
  els.stockDeskModal.classList.add("hidden");
}

function setAuthMode(mode) {
  authMode = mode;
  const loginActive = mode === "login";

  els.authModalTitle.textContent = loginActive ? "Login" : "Create Account";
  els.authSubmitBtn.textContent = loginActive ? "Login" : "Join Rewards";
  els.nameFieldWrap.classList.toggle("hidden", loginActive);

  els.loginTabBtn.classList.toggle("active-tab", loginActive);
  els.signupTabBtn.classList.toggle("active-tab", !loginActive);
  els.loginTabBtn.classList.toggle("text-slate-600", !loginActive);
  els.signupTabBtn.classList.toggle("text-slate-600", loginActive);
  els.authAccountType.value = loginActive ? els.authAccountType.value : "customer";
  els.authAccountType.disabled = !loginActive;
  syncAuthFields();
}

function syncAuthFields() {
  const isStaffLogin = authMode === "login" && els.authAccountType.value === "staff";
  els.staffCodeWrap.classList.toggle("hidden", !isStaffLogin);
}

function setActiveTab(tabId) {
  if (tabId === "staff" && currentUserRole !== "staff") {
    openAuthModal();
    els.authStatus.textContent = "Staff access needs a staff login and the current staff code.";
    return;
  }

  activeAppTab = tabId;

  els.appTabBtns.forEach((button) => {
    const active = button.dataset.appTab === tabId;
    button.classList.toggle("app-tab-active", active);
    button.classList.toggle("border", !active);
    button.classList.toggle("border-white/10", !active);
    button.classList.toggle("bg-white/5", !active);
    button.classList.toggle("text-slate-300", !active);
    button.classList.toggle("text-slate-200", active);
  });

  els.appPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.appPanel !== tabId);
  });
}

function getReadableAuthError(error) {
  if (!error) return "Authentication failed. Please try again.";
  return authErrorMessages[error.code] || "Authentication failed. Please try again.";
}

async function initializeAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Auth persistence setup failed.", error);
  }
}

async function ensureUserDoc(user, name = "", role = "customer") {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const payload = {
    uid: user.uid,
    name: name || user.displayName || snap.data()?.name || "",
    firstName: getFirstName(name || user.displayName || snap.data()?.name || user.email || ""),
    email: user.email || "",
    role,
    createdAt: snap.exists() ? snap.data().createdAt || serverTimestamp() : serverTimestamp()
  };

  if (!snap.exists()) {
    await setDoc(userRef, payload);
  } else if (role === "staff" || name) {
    await setDoc(userRef, payload, { merge: true });
  }
}

async function fetchUserRole(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return "customer";
  return snap.data().role || "customer";
}

function hydrateCategoryFilter() {
  const categories = Array.from(new Set(parts.map((part) => part.category).filter(Boolean))).sort();
  els.categoryFilter.innerHTML = `<option value="all">All Categories</option>${categories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("")}`;
}

function hydrateVehicleFilter() {
  const vehicles = getVehicleOptions(parts).filter((vehicle) => vehicle !== "all");
  els.vehicleFilter.innerHTML = `<option value="all">All Vehicles</option>${vehicles
    .map((vehicle) => `<option value="${vehicle}">${vehicle}</option>`)
    .join("")}`;
}

function sortParts(list, sort) {
  const sorted = [...list];
  if (sort === "price-low") sorted.sort((left, right) => Number(left.price || Infinity) - Number(right.price || Infinity));
  if (sort === "price-high") sorted.sort((left, right) => Number(right.price || 0) - Number(left.price || 0));
  if (sort === "name") sorted.sort((left, right) => (left.name || "").localeCompare(right.name || ""));
  if (sort === "featured") sorted.sort((left, right) => (left.partId || "").localeCompare(right.partId || ""));
  return sorted;
}

function renderEasternAI(searchResult) {
  els.aiSearchMode.textContent = searchResult.mode;
  els.aiMatchCount.textContent = searchResult.matchCountLabel;
  els.aiSearchBadge.textContent = searchResult.badge;
  els.aiSummary.textContent = searchResult.summary;

  els.aiTopMatches.innerHTML = searchResult.topResults.length
    ? searchResult.topResults
        .map(
          (part) => `
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-semibold text-white">${part.name}</div>
                  <div class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">${part.partId} • ${part.category}</div>
                </div>
                <div class="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Score ${part.aiScore}
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                ${part.vehicles
                  .slice(0, 4)
                  .map(
                    (vehicle) => `
                      <span class="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">${vehicle}</span>
                    `
                  )
                  .join("")}
              </div>
              <p class="mt-3 text-sm leading-6 text-slate-300">
                ${part.aiReasons.length ? part.aiReasons.join(", ") : "Strong general match from the current catalog."}
              </p>
            </div>
          `
        )
        .join("")
    : `<div class="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No direct EasternAI match yet. Try a vehicle, category, barcode, or a simpler phrase.</div>`;

  els.aiSuggestions.innerHTML = searchResult.suggestions
    .map(
      (prompt) => `
        <button type="button" data-ai-suggestion="${prompt}" class="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-white">
          ${prompt}
        </button>
      `
    )
    .join("");

  els.aiSuggestions.querySelectorAll("[data-ai-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      els.searchInput.value = button.dataset.aiSuggestion || "";
      performSearch();
    });
  });
}

function renderProducts(searchResult) {
  const sort = els.sortFilter.value;
  const filtered = sortParts(searchResult.results, sort);

  els.resultCount.textContent = filtered.length;
  els.emptyProductsState.classList.toggle("hidden", filtered.length > 0);

  els.productsGrid.innerHTML = filtered
    .map(
      (part) => {
        const stockSignal = getStockSignal(part.stock);
        return `
        <article class="card-hover grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.35fr_0.9fr_1.2fr_110px_110px_120px] lg:items-center">
          <div class="min-w-0">
            <div class="flex items-start gap-3">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getCategoryGradient(part.category)} text-white shadow-sm">
                ${
                  part.imageUrl
                    ? `<img src="${part.imageUrl}" alt="${part.name}" class="h-12 w-12 rounded-2xl object-cover" />`
                    : `<i class="fa-solid fa-gear text-lg opacity-90"></i>`
                }
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-slate-900 sm:text-lg">${part.name || "Unnamed Part"}</h3>
                <p class="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs">${part.partId || "Auto ID"} • ${part.barcode || "No barcode"}</p>
                <p class="mt-2 text-sm leading-6 text-slate-500">${part.description || "Quality spare part available for ordering and workshop use."}</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 lg:block">
            <span class="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700 sm:text-[11px]">${part.category || "General"}</span>
          </div>

          <div class="flex flex-wrap gap-2">
            ${part.vehicles
              .slice(0, 3)
              .map(
                (vehicle) => `
                  <span class="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-600 sm:text-[11px]">${vehicle}</span>
                `
              )
              .join("")}
            ${
              part.vehicles.length > 3
                ? `<span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">+${part.vehicles.length - 3} more</span>`
                : ""
            }
          </div>

          <div>
            <div class="text-[10px] uppercase tracking-[0.16em] text-slate-400 lg:hidden">Stock</div>
            <div class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] ${stockSignal.text}">
              <span class="stock-dot ${stockSignal.dot}"></span>
              ${stockSignal.label}
            </div>
          </div>

          <div>
            <div class="text-[10px] uppercase tracking-[0.16em] text-slate-400 lg:hidden">Price</div>
            <div class="font-display text-xl font-bold text-slate-900">${formatPriceLabel(part.price)}</div>
          </div>

          <div class="flex justify-start lg:justify-end">
            <button data-add-cart="${part.partId}" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
              Add
            </button>
          </div>
        </article>
      `;
      }
    )
    .join("");

  els.productsGrid.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addCart));
  });
}

function renderStockTable() {
  const sortedParts = [...parts].sort((left, right) => (right.stockQty || 0) - (left.stockQty || 0));
  els.stockTableCount.textContent = sortedParts.length;

  els.stockTableBody.innerHTML = sortedParts
    .map(
      (part) => `
        <div class="grid gap-2 px-4 py-4 text-sm text-slate-700 lg:grid-cols-[1.1fr_0.9fr_0.9fr_90px_140px_130px] lg:items-center lg:px-5">
          <div>
            <div class="font-semibold text-slate-900">${part.name}</div>
            <div class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">${part.partId}</div>
          </div>
          <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">${part.category}</div>
          <div class="text-sm text-slate-600">${formatVehicleList(part.vehicles)}</div>
          <div class="font-semibold text-slate-900">${part.stockQty || 0}</div>
          <div class="text-xs uppercase tracking-[0.14em] text-slate-500">${part.barcode || "No barcode"}</div>
          <div>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">${part.stock}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function performSearch(options = {}) {
  if (!options.preserveExistingTerm) {
    activeSearchTerm = els.searchInput.value.trim();
  }

  const searchResult = runEasternAISearch(activeSearchTerm, parts, {
    category: els.categoryFilter.value,
    vehicle: els.vehicleFilter.value
  });

  renderProducts(searchResult);
  renderEasternAI(searchResult);
}

function refreshHeroPrices() {
  const brake = parts.find((part) => part.name?.toLowerCase().includes("brake"));
  const oil = parts.find((part) => part.name?.toLowerCase().includes("engine oil"));
  const cv = parts.find((part) => part.name?.toLowerCase().includes("cv"));

  if (brake) els.heroPrice1.textContent = formatPriceLabel(brake.price);
  if (oil) els.heroPrice2.textContent = formatPriceLabel(oil.price);
  if (cv) els.heroPrice3.textContent = formatPriceLabel(cv.price);
}

function addToCart(partId) {
  const part = parts.find((item) => item.partId === partId);
  if (!part) return;

  const existing = cart.find((item) => item.partId === partId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      partId: part.partId,
      name: part.name,
      price: Number(part.price || 0),
      qty: 1
    });
  }

  persistCart();
  renderCart();
}

function changeQty(partId, delta) {
  const item = cart.find((entry) => entry.partId === partId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((entry) => entry.partId !== partId);
  }

  persistCart();
  renderCart();
}

function clearCart() {
  cart = [];
  persistCart();
  renderCart();
}

function renderCart() {
  const count = getCartCount();
  const total = getCartTotal();

  els.navCartCount.textContent = count;
  els.navCartTotal.textContent = formatMoney(total);
  els.checkoutCartCount.textContent = count;
  els.summaryItems.textContent = count;
  els.summaryTotal.textContent = formatMoney(total);

  els.emptyCartState.classList.toggle("hidden", cart.length > 0);

  els.cartItems.innerHTML = cart
    .map(
      (item) => `
        <div class="rounded-[22px] border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h4 class="text-sm font-semibold text-slate-900 sm:text-base">${item.name}</h4>
              <p class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">${item.partId}</p>
              <p class="mt-2 text-sm text-slate-500">${item.price > 0 ? `${formatMoney(item.price)} each` : "Quoted at checkout"}</p>
            </div>

            <div class="text-right">
              <div class="font-semibold text-slate-900">${formatMoney(item.price * item.qty)}</div>
              <div class="mt-3 inline-flex items-center rounded-full border border-slate-200">
                <button data-cart-minus="${item.partId}" class="px-3 py-2 text-slate-600">-</button>
                <span class="px-3 py-2 text-sm font-semibold">${item.qty}</span>
                <button data-cart-plus="${item.partId}" class="px-3 py-2 text-slate-600">+</button>
              </div>
            </div>
          </div>
        </div>
      `
    )
    .join("");

  els.cartItems.querySelectorAll("[data-cart-minus]").forEach((button) => {
    button.addEventListener("click", () => changeQty(button.dataset.cartMinus, -1));
  });

  els.cartItems.querySelectorAll("[data-cart-plus]").forEach((button) => {
    button.addEventListener("click", () => changeQty(button.dataset.cartPlus, 1));
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value.trim();
  const name = els.authName.value.trim();
  const accountType = els.authAccountType.value;
  const isStaffLogin = authMode === "login" && accountType === "staff";
  const staffCode = els.staffCodeInput.value.trim();

  if (!email || !password) {
    els.authStatus.textContent = "Email and password are required.";
    return;
  }

  els.authSubmitBtn.disabled = true;
  els.authSubmitBtn.classList.add("opacity-60", "cursor-not-allowed");

  try {
    if (authMode === "signup") {
      if (!name) {
        els.authStatus.textContent = "Full name is required for sign up.";
        return;
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(result.user, name, "customer");
      sessionStorage.removeItem(STAFF_SESSION_KEY);
      els.authStatus.textContent = "Account created successfully. You are now signed in.";
    } else {
      if (isStaffLogin && staffCode !== STAFF_CODE) {
        els.authStatus.textContent = "Staff access requires the correct staff code.";
        return;
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(result.user, "", isStaffLogin ? "staff" : "customer");
      if (isStaffLogin) {
        sessionStorage.setItem(STAFF_SESSION_KEY, "true");
      } else {
        sessionStorage.removeItem(STAFF_SESSION_KEY);
      }
      els.authStatus.textContent = isStaffLogin ? "Staff login successful." : "Logged in successfully.";
    }

    els.authForm.reset();
    syncAuthFields();
    closeAuthModal();
  } catch (error) {
    els.authStatus.textContent = getReadableAuthError(error);
  } finally {
    els.authSubmitBtn.disabled = false;
    els.authSubmitBtn.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

async function handleOrderSubmit() {
  const name = els.customerName.value.trim();
  const phone = els.customerPhone.value.trim();
  const location = els.customerLocation.value.trim();
  const notes = els.customerNotes.value.trim();

  if (cart.length === 0) {
    els.orderStatus.textContent = "Add parts to the cart before placing an order.";
    return;
  }

  if (!name || !phone) {
    els.orderStatus.textContent = "Customer name and phone are required.";
    return;
  }

  try {
    await addDoc(collection(db, "orders"), {
      customerName: name,
      customerPhone: phone,
      customerLocation: location,
      customerNotes: notes,
      items: cart,
      total: getCartTotal(),
      itemCount: getCartCount(),
      userId: currentUser?.uid || null,
      userEmail: currentUser?.email || null,
      status: "pending",
      createdAt: serverTimestamp()
    });

    els.orderStatus.textContent = "Order submitted successfully.";
    clearCart();
    els.customerNotes.value = "";
  } catch (error) {
    els.orderStatus.textContent = `Order failed: ${error.message}`;
  }
}

function sendWhatsAppOrder() {
  const name = els.customerName.value.trim() || "Not provided";
  const phone = els.customerPhone.value.trim() || "Not provided";
  const location = els.customerLocation.value.trim() || "Not provided";
  const notes = els.customerNotes.value.trim() || "None";
  const lines = cart.length
    ? cart.map((item) => `- ${item.name} x${item.qty} = ${formatMoney(item.price * item.qty)}`).join("\n")
    : "No items selected";

  const message = `Hello Eastern Auto Spares,

I would like to place an order.

Customer: ${name}
Phone: ${phone}
Location: ${location}

Items:
${lines}

Total: ${formatMoney(getCartTotal())}

Notes:
${notes}`;

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/16038170479?text=${encoded}`, "_blank");
}

async function createPartWithAutoId(data) {
  const counterRef = doc(db, "meta", "counters");
  const partsRef = collection(db, "parts");
  let createdPart = null;

  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let current = 2000;

    if (counterSnap.exists()) {
      current = Number(counterSnap.data().partNumber || 2000);
    }

    const next = current + 1;
    const generatedPartId = `EAS-${String(next).padStart(4, "0")}`;
    const newPartRef = doc(partsRef);

    createdPart = normalizePart({
      ...data,
      partId: generatedPartId,
      createdAt: new Date()
    });

    transaction.set(counterRef, { partNumber: next }, { merge: true });
    transaction.set(newPartRef, {
      ...createdPart,
      createdAt: serverTimestamp()
    });
  });

  return createdPart;
}

function createDeskPartFromForm() {
  const vehicles = normalizeVehicles(els.partVehicle.value);
  const stockQty = Number(els.partQty.value);

  return normalizePart({
    name: els.partName.value.trim(),
    category: els.partCategory.value,
    vehicles,
    stockQty,
    barcode: els.partBarcode.value.trim() || `EAS-${Date.now()}`,
    price: normalizePrice(els.partPrice.value),
    imageUrl: els.partImage.value.trim(),
    description: els.partDescription.value.trim() || `${els.partName.value.trim()} stocked for ${formatVehicleList(vehicles)}.`,
    createdAt: new Date()
  });
}

async function handleAddPart(event) {
  event.preventDefault();

  if (currentUserRole !== "staff") {
    els.addPartStatus.textContent = "Only staff can add parts.";
    return;
  }

  const partData = createDeskPartFromForm();

  if (!partData.name || !partData.category || !partData.stockQty) {
    els.addPartStatus.textContent = "Part name, category, compatible vehicles, and stock quantity are required.";
    return;
  }

  try {
    const createdPart = await createPartWithAutoId(partData);
    parts = mergeParts(parts, [createdPart]);
    els.addPartStatus.textContent = "Stock line saved to live inventory.";
  } catch (error) {
    saveLocalPart(partData);
    parts = mergeParts(parts, [partData]);
    els.addPartStatus.textContent = "Live save failed, so the stock line was saved locally on this device.";
  }

  els.addPartForm.reset();
  hydrateCategoryFilter();
  hydrateVehicleFilter();
  renderStockTable();
  refreshHeroPrices();
  performSearch({ preserveExistingTerm: true });
  closeStockDeskModal();
}

function updateSessionUI() {
  const isSignedIn = !!currentUser;
  const isStaff = currentUserRole === "staff";
  const profileName = getFirstName(currentUser?.displayName || currentUser?.email || "Account");

  els.openAuthBtn.textContent = isSignedIn ? "Account" : "Staff / Rewards";
  els.authStateMini.classList.toggle("hidden", !isSignedIn);
  els.authStateMini.textContent = isSignedIn ? `${profileName} • ${shortenEmail(currentUser.email)}` : "";
  els.signupTabBtn.classList.toggle("hidden", isSignedIn);

  if (!isSignedIn) {
    els.sessionTitle.textContent = "Guest Browsing";
    els.sessionText.textContent = "Browse parts on your phone, search with EasternAI, and place orders fast when a car breaks down.";
    els.orderStatus.textContent = "Sign in to attach your account to orders. Guests can still prepare carts.";
  } else if (isStaff) {
    els.sessionTitle.textContent = "Staff Session";
    els.sessionText.textContent = "Desktop stock tools are unlocked. Review inventory, scan barcodes, and keep the customer storefront current.";
    els.orderStatus.textContent = "Staff account linked. Orders will include your signed-in identity.";
  } else {
    els.sessionTitle.textContent = "Customer Session";
    els.sessionText.textContent = "Your account is active. You can now place orders with your signed-in identity.";
    els.orderStatus.textContent = "Signed in successfully. Your orders will be linked to your account.";
  }

  els.roleBadge.classList.toggle("hidden", !isStaff);
  els.staffPanelSection.classList.toggle("hidden", !isStaff);
  els.signedInUserText.textContent = isSignedIn ? `${profileName} • ${shortenEmail(currentUser.email)} • ${currentUserRole}` : "";
  updateAuthPanelVisibility();
}

function wireEvents() {
  els.searchBtn.addEventListener("click", () => performSearch());
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      performSearch();
    }
  });

  els.categoryFilter.addEventListener("change", () => performSearch({ preserveExistingTerm: true }));
  els.vehicleFilter.addEventListener("change", () => performSearch({ preserveExistingTerm: true }));
  els.sortFilter.addEventListener("change", () => performSearch({ preserveExistingTerm: true }));

  els.clearCartBtn.addEventListener("click", clearCart);
  els.placeOrderBtn.addEventListener("click", handleOrderSubmit);
  els.whatsAppBtn.addEventListener("click", sendWhatsAppOrder);
  els.addPartForm.addEventListener("submit", handleAddPart);

  els.openAuthBtn.addEventListener("click", openAuthModal);
  els.closeAuthBtn.addEventListener("click", closeAuthModal);
  els.loginTabBtn.addEventListener("click", () => setAuthMode("login"));
  els.signupTabBtn.addEventListener("click", () => setAuthMode("signup"));
  els.authAccountType.addEventListener("change", syncAuthFields);
  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.logoutBtn.addEventListener("click", async () => {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    await signOut(auth);
    closeAuthModal();
  });

  els.openStockDeskBtn.addEventListener("click", openStockDeskModal);
  els.closeStockDeskBtn.addEventListener("click", closeStockDeskModal);
  els.stockDeskModal.addEventListener("click", (event) => {
    if (event.target === els.stockDeskModal) closeStockDeskModal();
  });

  els.appTabBtns.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.appTab));
  });

  els.jumpTabBtns.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.jumpTab));
  });

  els.cartNavBtn.addEventListener("click", () => {
    setActiveTab("cart");
    scrollToCheckout();
  });
  els.authModal.addEventListener("click", (event) => {
    if (event.target === els.authModal) closeAuthModal();
  });
}

async function loadParts() {
  let remoteParts = [];

  try {
    const partsQuery = query(collection(db, "parts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(partsQuery);
    remoteParts = snapshot.docs.map((entry) =>
      normalizePart({
        id: entry.id,
        ...entry.data()
      })
    );
  } catch (error) {
    console.warn("Live parts could not be loaded.", error);
  }

  parts = mergeParts(demoParts, remoteParts, getLocalParts());
  hydrateCategoryFilter();
  hydrateVehicleFilter();
  renderStockTable();
  refreshHeroPrices();
  performSearch({ preserveExistingTerm: true });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    await ensureUserDoc(user);
    currentUserRole = await fetchUserRole(user.uid);
    if (currentUserRole === "staff" && sessionStorage.getItem(STAFF_SESSION_KEY) !== "true") {
      currentUserRole = "customer";
    }
  } else {
    currentUserRole = "guest";
  }

  updateSessionUI();
});

initializeAuthPersistence();
wireEvents();
setAuthMode("login");
setActiveTab("shop");
renderCart();
loadParts();
