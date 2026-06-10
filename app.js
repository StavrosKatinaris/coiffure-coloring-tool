// ==========================
// CONFIG
// ==========================
// Keep YOUR current values here (already in your file).
const SUPABASE_URL = "https://kbccjpoqzacnkafwlecn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJrYmNjanBvcXphY25rYWZ3bGVjbiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY5NDIxNzA2LCJleHAiOjIwODQ5OTc3MDZ9.m_rgwS10E_Mfsc22A1QZWU83H1B_mt-73R49b4XE4qI";

const TABLE_NAME = "customers";
const DAILY_TABLE = "daily_list";

const COL_ID = "id";
const COL_NAME = "name";
const COL_SURNAME = "surname";
const COL_PRICE = "price";
const COL_NOTES = "notes";

const PIN_RPC_NAME = "check_pin";
const PIN_STORAGE_KEY = "pin_unlocked_v1";

// ==========================
// CLIENT
// ==========================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================
// STATE
// ==========================
let current = null;
let currentOriginal = null;
let editMode = false;

// ==========================
// DOM
// ==========================
const $ = (id) => document.getElementById(id);

let currentPin = null;
let currentInDaily = false;

const dailyBtn = $("dailyBtn");

const gate = $("gate");
const appRoot = $("appRoot");
const pinInput = $("pinInput");
const pinBtn = $("pinBtn");
const pinStatus = $("pinStatus");
const logoutBtn = $("logoutBtn");

const statusEl = $("status");
const hintEl = $("hint");

const listView = $("listView");
const detailView = $("detailView");
const listEl = $("list");

const searchRow = $("searchRow");
const searchInput = $("searchInput");

const listActions = $("listActions");
const detailActions = $("detailActions");

const pageTitle = $("pageTitle");
const pageSub = $("pageSub");

const todayWrap = $("todayWrap");
const todayToggle = $("todayToggle");

const detailName = $("detailName");
const detailMeta = $("detailMeta");

const nameInput = $("nameInput");
const surnameInput = $("surnameInput");
const priceInput = $("priceInput");
const notesInput = $("notesInput");

const addDialog = $("addDialog");
const addBtn = $("addBtn");
const closeAddBtn = $("closeAddBtn");
const createBtn = $("createBtn");
const addStatus = $("addStatus");
const addName = $("addName");
const addSurname = $("addSurname");
const addPrice = $("addPrice");
const addNotes = $("addNotes");

const backBtn = $("backBtn");
const editBtn = $("editBtn");
const saveBtn = $("saveBtn");
const cancelBtn = $("cancelBtn");

const PIN_VALUE_STORAGE_KEY = "pin_value_v1";

// ==========================
// UTIL
// ==========================
function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.className = "status " + (kind || "");
}

function setAddStatus(msg, kind = "") {
  addStatus.textContent = msg || "";
  addStatus.className = "status " + (kind || "");
}

function setPinStatus(msg, kind = "") {
  pinStatus.textContent = msg || "";
  pinStatus.className = "status " + (kind || "");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ==========================
// TOGGLE UI
// ==========================
function syncTodayToggleUI() {
  if (!todayToggle || !todayWrap) return;
  todayWrap.classList.toggle("on", !!todayToggle.checked);
}

// ==========================
// DAILY LIST HELPERS
// ==========================
async function fetchDailyListMap() {
  const { data, error } = await sb
    .from(DAILY_TABLE)
    .select("customer_id, date_added");

  if (error) throw error;

  const m = new Map();
  for (const r of data || []) {
    m.set(String(r.customer_id), r.date_added ? Date.parse(r.date_added) : 0);
  }
  return m;
}

async function loadTodayOnly() {
  setStatus("Φόρτωση σημερινών πελατών...");

  const { data: daily, error: e1 } = await sb
    .from(DAILY_TABLE)
    .select("customer_id, date_added")
    .order("date_added", { ascending: false });

  if (e1) {
    setStatus("Σφάλμα φόρτωσης ημερήσιου προγράμματος:\n" + e1.message, "bad");
    renderList([]);
    return;
  }

  const ids = (daily || []).map(r => r.customer_id);
  if (!ids.length) {
    setStatus("Το σημερινό πρόγραμμα είναι άδειο.", "ok");
    renderList([]);
    return;
  }

  const { data: customers, error: e2 } = await sb
    .from(TABLE_NAME)
    .select(`${COL_ID}, ${COL_NAME}, ${COL_SURNAME}`)
    .in(COL_ID, ids);

  if (e2) {
    setStatus("Σφάλμα φόρτωσης σημερινών πελατών:\n" + e2.message, "bad");
    renderList([]);
    return;
  }

  const rank = new Map(ids.map((id, i) => [String(id), i]));
  const rows = (customers || []).slice().sort((a, b) =>
    (rank.get(String(a[COL_ID])) ?? 999999) - (rank.get(String(b[COL_ID])) ?? 999999)
  );

  setStatus(`Φορτώθηκαν ${rows.length} πελάτες. (Μόνο σήμερα)`, "ok");
  renderList(rows);
}

// ==========================
// VIEW
// ==========================
function setView(mode) {
  if (mode === "list") {
    listView.style.display = "";
    detailView.style.display = "none";
    searchRow.style.display = "";
    listActions.style.display = "";
    detailActions.style.display = "none";
    hintEl.style.display = "";

    if (todayWrap) todayWrap.style.display = "";
    syncTodayToggleUI();

    pageTitle.textContent = "Πελάτες";
    pageSub.textContent = "Εργαλείο Βαφών";
    setStatus("");

    current = null;
    currentOriginal = null;
    setEditMode(false);
  } else {
    listView.style.display = "none";
    detailView.style.display = "";
    searchRow.style.display = "none";
    listActions.style.display = "none";
    detailActions.style.display = "";
    hintEl.style.display = "none";

    if (todayWrap) todayWrap.style.display = "none";

    pageTitle.textContent = "Πελάτης";
    pageSub.textContent = "Οι σημειώσεις επεξεργάζονται άμεσα";
  }
}

function setEditMode(on) {
  editMode = !!on;
  nameInput.disabled = !editMode;
  surnameInput.disabled = !editMode;
  priceInput.disabled = !editMode;

  editBtn.style.display = editMode ? "none" : "";
  saveBtn.style.display = editMode ? "" : "none";
  cancelBtn.style.display = editMode ? "" : "none";
}

// ==========================
// PIN GATE
// ==========================
function showGate() {
  gate.style.display = "";
  appRoot.style.display = "none";
  setPinStatus("");
  pinInput.value = "";
  setTimeout(() => pinInput.focus(), 50);
}

function showApp() {
  gate.style.display = "none";
  appRoot.style.display = "";
}

async function checkPin(pin) {
  const { data, error } = await sb.rpc(PIN_RPC_NAME, { p_pin: pin });
  if (error) throw error;
  return !!data;
}

async function tryUnlock() {
  const pin = (pinInput.value || "").trim();

  if (!/^\d{4}$/.test(pin)) {
    setPinStatus("Το PIN πρέπει να αποτελείται από ακριβώς 4 ψηφία.", "bad");
    return;
  }

  setPinStatus("Έλεγχος...");
  pinBtn.disabled = true;

  try {
    const ok = await checkPin(pin);
    if (!ok) {
      setPinStatus("Λάθος PIN.", "bad");
      pinBtn.disabled = false;
      return;
    }

    localStorage.setItem(PIN_STORAGE_KEY, "1");
    setPinStatus("Επιτυχής είσοδος.", "ok");

    showApp();
    setView("list");
    await loadList("");
  } catch (e) {
    setPinStatus("Αποτυχία ελέγχου PIN:\n" + (e?.message || String(e)), "bad");
  } finally {
    pinBtn.disabled = false;
  }

  currentPin = pin;
  localStorage.setItem(PIN_VALUE_STORAGE_KEY, pin);
}

function logout() {
  localStorage.removeItem(PIN_STORAGE_KEY);
  showGate();
  currentPin = null;
  localStorage.removeItem(PIN_VALUE_STORAGE_KEY);
}

// ==========================
// DATA: LIST
// ==========================
async function loadList(query = "") {
  setStatus("Φόρτωση...");

  if (todayToggle?.checked) {
    await loadTodayOnly();
    return;
  }

  let q = sb
    .from(TABLE_NAME)
    .select(`${COL_ID}, ${COL_NAME}, ${COL_SURNAME}`)
    .order(COL_ID, { ascending: true })
    .order(COL_NAME, { ascending: true })
    .limit(2000);

  const term = query.trim();
  if (term) {
    const safe = term.replaceAll(",", " ");
    q = q.or(`${COL_NAME}.ilike.%${safe}%,${COL_SURNAME}.ilike.%${safe}%`);
  }

  const { data, error } = await q;

  if (error) {
    setStatus("Σφάλμα φόρτωσης λίστας:\n" + error.message, "bad");
    listEl.innerHTML = "";
    return;
  }

  let rows = data || [];

  if (todayToggle && todayToggle.checked) {
    try {
      const dailyMap = await fetchDailyListMap();
      rows = rows.filter(r => dailyMap.has(String(r[COL_ID])));
      rows.sort((a, b) =>
        (dailyMap.get(String(b[COL_ID])) || 0) -
        (dailyMap.get(String(a[COL_ID])) || 0)
      );
      setStatus(`Φορτώθηκαν ${rows.length} πελάτες. (Μόνο σήμερα)`, "ok");
    } catch (e) {
      setStatus(
        `Φορτώθηκαν ${rows.length} πελάτες. (Αποτυχία φίλτρου σημερινών πελατών: ${e?.message || String(e)})`,
        "bad"
      );
    }
  } else {
    setStatus(`Φορτώθηκαν ${rows.length} πελάτες.`, "ok");
  }

  renderList(rows);
}

function renderList(rows) {
  if (!rows.length) {
    listEl.innerHTML = `
      <div class="rowItem" style="cursor: default;">
        <div class="nameLine">
          <div class="big">Δεν βρέθηκαν πελάτες</div>
          <div class="small">Δοκιμάστε διαφορετική αναζήτηση ή προσθέστε νέο πελάτη.</div>
        </div>
        <div class="chev"></div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = rows.map(r => {
    const full = `${r[COL_NAME] ?? ""} ${r[COL_SURNAME] ?? ""}`.trim();
    return `
      <div class="rowItem" data-id="${escapeHtml(r[COL_ID])}">
        <div class="nameLine">
          <div class="big">${escapeHtml(full || "(χωρίς όνομα)")}</div>
          <div class="small">Πατήστε για άνοιγμα</div>
        </div>
        <div class="chev">›</div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".rowItem[data-id]").forEach(el => {
    el.addEventListener("click", () => openCustomer(el.dataset.id));
  });
}

// ==========================
// DATA: DETAIL
// ==========================
async function openCustomer(id) {
  setStatus("Φόρτωση πελάτη...");

  const { data, error } = await sb
    .from(TABLE_NAME)
    .select(`${COL_ID}, ${COL_NAME}, ${COL_SURNAME}, ${COL_PRICE}, ${COL_NOTES}`)
    .eq(COL_ID, id)
    .single();

  if (error) {
    setStatus("Σφάλμα φόρτωσης πελάτη:\n" + error.message, "bad");
    return;
  }

  current = data;
  currentOriginal = clone(data);

  fillDetail(current);
  setView("detail");

  try {
    await refreshDailyStateForCurrentCustomer();
  } catch (e) {
    setStatus("Αδυναμία ανάγνωσης κατάστασης ημερήσιου προγράμματος:\n" + (e?.message || String(e)), "bad");
    setDailyBtnState(false);
  }

  setEditMode(false);
  setStatus("Η φόρτωση ολοκληρώθηκε.", "ok");
}

function fillDetail(c) {
  const full = `${c[COL_NAME] ?? ""} ${c[COL_SURNAME] ?? ""}`.trim() || "(χωρίς όνομα)";
  detailName.textContent = full;
  detailMeta.textContent = `ID: ${c[COL_ID]}`;

  nameInput.value = c[COL_NAME] ?? "";
  surnameInput.value = c[COL_SURNAME] ?? "";
  priceInput.value = c[COL_PRICE] ?? "";
  notesInput.value = c[COL_NOTES] ?? "";
}

async function updateNotesNow() {
  if (!current) return;

  const newNotes = notesInput.value ?? "";
  if ((current[COL_NOTES] ?? "") === newNotes) return;

  current[COL_NOTES] = newNotes;
  setStatus("Αποθήκευση σημειώσεων...");

  const { error } = await sb
    .from(TABLE_NAME)
    .update({ [COL_NOTES]: newNotes })
    .eq(COL_ID, current[COL_ID]);

  if (error) {
    setStatus("Αποτυχία αποθήκευσης σημειώσεων:\n" + error.message, "bad");
    return;
  }

  setStatus("Οι σημειώσεις αποθηκεύτηκαν.", "ok");
}

const updateNotesDebounced = debounce(updateNotesNow, 450);

async function saveEdits() {
  if (!current) return;

  const payload = {
    [COL_NAME]: nameInput.value ?? "",
    [COL_SURNAME]: surnameInput.value ?? "",
    [COL_PRICE]: priceInput.value ?? "",
    [COL_NOTES]: notesInput.value ?? "",
  };

  setStatus("Αποθήκευση...");

  const { data, error } = await sb
    .from(TABLE_NAME)
    .update(payload)
    .eq(COL_ID, current[COL_ID])
    .select(`${COL_ID}, ${COL_NAME}, ${COL_SURNAME}, ${COL_PRICE}, ${COL_NOTES}`)
    .single();

  if (error) {
    setStatus("Αποτυχία αποθήκευσης:\n" + error.message, "bad");
    return;
  }

  current = data;
  currentOriginal = clone(data);
  fillDetail(current);
  setEditMode(false);
  setStatus("Η αποθήκευση ολοκληρώθηκε.", "ok");

  loadList(searchInput.value || "");
}

function cancelEdits() {
  if (!currentOriginal) return;

  current = clone(currentOriginal);
  fillDetail(current);
  setEditMode(false);
  setStatus("Οι αλλαγές ακυρώθηκαν.", "ok");
}

function setDailyBtnState(inDaily) {
  currentInDaily = !!inDaily;
  if (!dailyBtn) return;

  if (currentInDaily) {
    dailyBtn.textContent = "Αφαίρεση από το σημερινό πρόγραμμα";
    dailyBtn.classList.remove("primary");
    dailyBtn.classList.add("ghost");
  } else {
    dailyBtn.textContent = "Προσθήκη στο σημερινό πρόγραμμα";
    dailyBtn.classList.add("primary");
    dailyBtn.classList.remove("ghost");
  }
}

async function refreshDailyStateForCurrentCustomer() {
  if (!current) return;

  const { data, error } = await sb
    .from(DAILY_TABLE)
    .select("customer_id")
    .eq("customer_id", current[COL_ID])
    .maybeSingle();

  if (error) throw error;

  setDailyBtnState(!!data);
}

function syncAddButtonVisibility() {
  if (!addBtn) return;

  addBtn.style.display = todayToggle?.checked ? "none" : "";
}

// ==========================
// DATA: ADD
// ==========================
async function addCustomer() {
  const nm = (addName.value || "").trim();
  const sn = (addSurname.value || "").trim();
  const pr = (addPrice.value || "").trim();
  const nt = (addNotes.value || "").trim();

  if (!nm && !sn) {
    setAddStatus("Παρακαλώ συμπληρώστε τουλάχιστον όνομα ή επώνυμο.", "bad");
    return;
  }

  setAddStatus("Δημιουργία...");

  const payload = {
    [COL_NAME]: nm || null,
    [COL_SURNAME]: sn || null,
    [COL_PRICE]: pr || null,
    [COL_NOTES]: nt || null,
  };

  const { data, error } = await sb
    .from(TABLE_NAME)
    .insert(payload)
    .select(`${COL_ID}, ${COL_NAME}, ${COL_SURNAME}, ${COL_PRICE}, ${COL_NOTES}`)
    .single();

  if (error) {
    setAddStatus("Αποτυχία δημιουργίας:\n" + error.message, "bad");
    return;
  }

  setAddStatus("Ο πελάτης δημιουργήθηκε.", "ok");
  addDialog.close();

  addName.value = "";
  addSurname.value = "";
  addPrice.value = "";
  addNotes.value = "";
  setAddStatus("");

  await loadList(searchInput.value || "");
  await openCustomer(data[COL_ID]);
}

// ==========================
// EVENTS
// ==========================
pinBtn.addEventListener("click", tryUnlock);

pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});

logoutBtn.addEventListener("click", logout);

searchInput.addEventListener(
  "input",
  debounce(() => {
    loadList(searchInput.value || "");
  }, 250)
);

addBtn.addEventListener("click", () => {
  setAddStatus("");
  addDialog.showModal();
  addName.focus();
});

closeAddBtn.addEventListener("click", () => addDialog.close());
createBtn.addEventListener("click", addCustomer);

backBtn.addEventListener("click", () => {
  setView("list");
  loadList(searchInput.value || "");
});

editBtn.addEventListener("click", () => setEditMode(true));
saveBtn.addEventListener("click", saveEdits);
cancelBtn.addEventListener("click", cancelEdits);

notesInput.addEventListener("input", () => updateNotesDebounced());
notesInput.addEventListener("blur", () => updateNotesNow());

if (todayToggle) {
  todayToggle.addEventListener("change", () => {
    syncTodayToggleUI();
    syncAddButtonVisibility();

    if (todayToggle.checked) searchInput.value = "";

    loadList(searchInput.value || "");
  });
}

if (dailyBtn) {
  dailyBtn.addEventListener("click", async () => {
    if (!current) return;

    if (!currentPin) {
      setStatus("Δεν υπάρχει PIN στην τρέχουσα συνεδρία. Παρακαλώ συνδεθείτε ξανά.", "bad");
      return;
    }

    dailyBtn.disabled = true;

    try {
      if (!currentInDaily) {
        const { error } = await sb
          .from(DAILY_TABLE)
          .upsert(
            {
              customer_id: current[COL_ID],
              added_by: currentPin,
              date_added: new Date().toISOString(),
            },
            { onConflict: "customer_id" }
          );

        if (error) throw error;

        setDailyBtnState(true);
        setStatus("Προστέθηκε στο σημερινό πρόγραμμα.", "ok");
      } else {
        const { error } = await sb
          .from(DAILY_TABLE)
          .delete()
          .eq("customer_id", current[COL_ID]);

        if (error) throw error;

        setDailyBtnState(false);
        setStatus("Αφαιρέθηκε από το σημερινό πρόγραμμα.", "ok");
      }

      if (todayToggle?.checked) {
        await loadList(searchInput.value || "");
      }
    } catch (e) {
      setStatus("Αποτυχία ενημέρωσης ημερήσιου προγράμματος:\n" + (e?.message || String(e)), "bad");
    } finally {
      dailyBtn.disabled = false;
    }
  });
}

// ==========================
// BOOT
// ==========================
(async function boot() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith("PASTE_")) {
    showGate();
    setPinStatus("Ρυθμίστε τα SUPABASE_URL και SUPABASE_ANON_KEY στο app.js.", "bad");
    return;
  }

  const unlocked = localStorage.getItem(PIN_STORAGE_KEY) === "1";

  if (!unlocked) {
    showGate();
    return;
  }

  currentPin = localStorage.getItem(PIN_VALUE_STORAGE_KEY) || null;

  showApp();
  setView("list");
  await loadList("");
})();
