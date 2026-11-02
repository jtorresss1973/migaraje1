"use strict";
/* ============================================================================
   GARAJE · Gestión de vehículos
   ============================================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function esc(v){
  return String(v == null ? "" : v).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function num(v){
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[\s€]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function norm(s){
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
const sumBy  = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const fmtNum = (n, d = 2) => (Number(n) || 0).toLocaleString("es-ES",
  { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = n => (Number(n) || 0).toLocaleString("es-ES", { maximumFractionDigits: 0 });
const money  = n => fmtNum(n, 2) + " €";
const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB";
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sept","oct","nov","dic"];
const MESES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto",
                     "septiembre","octubre","noviembre","diciembre"];
function parseFecha(raw){
  const s = String(raw == null ? "" : raw).trim().replace(/^"|"$/g, "");
  if (!s) return "";
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  const parts = s.split(/[-\/\s.]+/).filter(Boolean);
  if (parts.length < 3) return "";
  const isNum = x => /^\d+$/.test(x);
  let day, mon, year;
  const mi = parts.findIndex(p => !isNum(p));
  if (mi >= 0){
    const key = norm(parts[mi]).slice(0, 4);
    const idx  = MESES.findIndex(mn => key.startsWith(mn));
    const idx2 = MESES_LARGO.findIndex(mn => mn.startsWith(key) || key.startsWith(mn));
    const month = idx >= 0 ? idx + 1 : (idx2 >= 0 ? idx2 + 1 : 0);
    if (!month) return "";
    mon = month;
    const rest = parts.filter((_, i) => i !== mi).map(Number);
    const y = rest.find(v => v > 31);
    year = y !== undefined ? y : rest[rest.length - 1];
    const d = rest.find(v => v <= 31);
    day = d !== undefined ? d : rest[0];
  } else {
    const n = parts.map(Number);
    if (n[2] > 31){ year = n[2]; mon = n[1]; day = n[0]; }
    else if (n[0] > 31){ year = n[0]; mon = n[1]; day = n[2]; }
    else { day = n[0]; mon = n[1]; year = n[2]; }
  }
  if (year < 100) year += 2000;
  if (!year || !mon || !day) return "";
  return `${year}-${String(mon).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function fmtFecha(iso){
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtFechaCorta(iso){
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [,m,d] = iso.split("-");
  return `${MESES[Number(m)-1]} ${Number(d)}`;
}
function hoyISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function diasHasta(iso){
  if (!iso) return null;
  const a = new Date(iso + "T00:00:00");
  const b = new Date(hoyISO() + "T00:00:00");
  return Math.round((a - b) / 86400000);
}
function icon(n){ return `<svg class="ic" aria-hidden="true"><use href="#i-${n}"></use></svg>`; }

/* -------------- Tipos de documento -------------- */
const DOC_TIPOS = [
  "Permiso de Conducción",
  "Permiso de Circulación",
  "Tarjeta de Inspección Técnica (ITV)",
  "Informe de la última inspección de la ITV",
  "Impuesto sobre Vehículos de Tracción Mecánica (IVTM)",
  "Facturas de reparación y mantenimiento",
  "Contrato de compraventa o factura de compra",
  "Justificante de cambio de titularidad en la DGT",
  "Póliza y recibos del seguro"
];
const DOC_ICONO = {
  "Permiso de Conducción":"car",
  "Permiso de Circulación":"car",
  "Tarjeta de Inspección Técnica (ITV)":"wrench",
  "Informe de la última inspección de la ITV":"file",
  "Impuesto sobre Vehículos de Tracción Mecánica (IVTM)":"receipt",
  "Facturas de reparación y mantenimiento":"wrench",
  "Contrato de compraventa o factura de compra":"file",
  "Justificante de cambio de titularidad en la DGT":"file",
  "Póliza y recibos del seguro":"receipt"
};
function docIcono(t){ return DOC_ICONO[t] || "file"; }

/* -------------- Estado -------------- */
const LS_KEY = "garaje.v2";
const DEFAULT_STATE = {
  vehicles: [], fuel: [], services: [], expenses: [], documents: [],
  settings: { theme: "auto", vehicle: "all" }
};
let state = loadState();
let currentView = "dashboard";
let searchTerm = { fuel:"", services:"", expenses:"", documents:"" };
const PAGE_SIZE = 20;
let pageState = { fuel:1, services:1, expenses:1, documents:1 };
let deferredInstall = null;

function loadState(){
  try {
    let raw = localStorage.getItem(LS_KEY);
    if (!raw) raw = localStorage.getItem("garaje.v1");
    if (!raw) return clone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    const out = clone(DEFAULT_STATE);
    ["vehicles","fuel","services","expenses","documents"].forEach(k => {
      out[k] = Array.isArray(s[k]) ? s[k] : [];
    });
    out.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
    return out;
  } catch (e){ return clone(DEFAULT_STATE); }
}
function saveState(){
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; }
  catch (e){
    toast("No se pudieron guardar los datos (espacio lleno). Elimina adjuntos grandes.", "err", 6000);
    return false;
  }
}
function stateSize(){
  try { return new Blob([JSON.stringify(state)]).size; } catch(e){ return 0; }
}
const inView = r => state.settings.vehicle === "all" || r.vehicleId === state.settings.vehicle;
const fuelList      = () => state.fuel.filter(inView);
const serviceList   = () => state.services.filter(inView);
const expenseList   = () => state.expenses.filter(inView);
const documentList  = () => state.documents.filter(inView);
const vehById = id => state.vehicles.find(v => v.id === id);
const vehName = id => { const v = vehById(id); return v ? v.nombre : "—"; };
function maxOdometro(){
  let m = 0;
  [...fuelList(), ...serviceList()].forEach(r => { m = Math.max(m, Number(r.odometro) || 0); });
  return m;
}
function docEstado(d){
  if (!d.vencimiento) return { txt:"Sin caducidad", cls:"" };
  const n = diasHasta(d.vencimiento);
  if (n < 0)   return { txt:"Caducado",       cls:"danger" };
  if (n <= 90) return { txt:`Caduca en ${n} d`, cls:"warn" };
  return { txt:"Vigente", cls:"ok" };
}

/* -------------- Tema -------------- */
const mqDark = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(){
  const t = state.settings.theme;
  const dark = t === "dark" || (t === "auto" && mqDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0b0f14" : "#ffffff");
  const btn = $("#themeBtn");
  if (btn) btn.innerHTML = icon(dark ? "sun" : "moon");
}
mqDark.addEventListener("change", () => { if (state.settings.theme === "auto") applyTheme(); });

/* -------------- Avisos -------------- */
function toast(msg, kind = "info", ms = 3200){
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0";
    setTimeout(() => el.remove(), 320); }, ms);
}

/* -------------- Modales -------------- */
let modalOpen = false;
function openModal(html, onMount){
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  root.classList.add("open");
  document.body.style.overflow = "hidden";
  modalOpen = true;
  const bd = $(".modal-backdrop", root);
  bd.addEventListener("mousedown", e => { if (e.target === bd) closeModal(); });
  if (onMount) onMount(root);
  const first = $(".modal input:not([type=file]):not([hidden]),.modal select,.modal textarea,.modal button", root);
  if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 40);
}
function closeModal(){
  const root = $("#modal-root");
  root.classList.remove("open");
  root.innerHTML = "";
  document.body.style.overflow = "";
  modalOpen = false;
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && modalOpen) closeModal(); });
function askConfirm(titulo, mensaje, textoOk = "Eliminar"){
  return new Promise(resolve => {
    openModal(`
      <div class="modal-head">
        <svg class="ic" style="color:var(--danger)"><use href="#i-alert"></use></svg>
        <h3>${esc(titulo)}</h3>
      </div>
      <div class="modal-body"><p>${mensaje}</p></div>
      <div class="modal-foot">
        <button class="btn" data-action="modal-close">Cancelar</button>
        <button class="btn primary" id="confirmOk" style="background:var(--danger);border-color:var(--danger)">${esc(textoOk)}</button>
      </div>`);
    $("#confirmOk").addEventListener("click", () => { closeModal(); resolve(true); });
    const bd = $(".modal-backdrop");
    bd.addEventListener("click", e => { if (e.target === bd) resolve(false); });
    document.addEventListener("keydown", function onEsc(ev){
      if (ev.key === "Escape"){ document.removeEventListener("keydown", onEsc); resolve(false); }
    });
  });
}

/* ============================================================================
   ADJUNTOS
   ============================================================================ */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const IMG_MAX_W = 1000;
const IMG_QUALITY = 0.72;
function fileToAttachment(file){
  return new Promise((resolve, reject) => {
    const isImg = (file.type || "").startsWith("image/");
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("no se pudo leer el archivo"));
    fr.onload = () => {
      if (!isImg){
        resolve({ name: file.name, type: file.type || "application/octet-stream",
                  size: file.size, data: String(fr.result) });
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error("imagen no válida"));
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > IMG_MAX_W){ h = Math.round(h * IMG_MAX_W / w); w = IMG_MAX_W; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let data;
        try { data = c.toDataURL("image/jpeg", IMG_QUALITY); }
        catch(e){ data = String(fr.result); }
        resolve({ name: file.name, type: "image/jpeg",
                  size: Math.round(data.length * 0.75), data });
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}
function fileChipHTML(key, att){
  const isImg = (att.type || "").startsWith("image/");
  const sizeTxt = att.size ? " · " + fmtBytes(att.size) : "";
  const tipo = (att.type || "").split("/")[1] || "";
  return `<div class="filechip">
    ${isImg ? `<img src="${att.data}" alt="">`
            : `<span class="fileicon">${icon("file")}</span>`}
    <div class="filemeta">
      <b title="${esc(att.name)}">${esc(att.name || "archivo")}</b>
      <span class="muted">${esc(tipo.toUpperCase())}${sizeTxt}</span>
    </div>
    <button type="button" class="mini" data-action="view-file" data-key="${key}" title="Ver">${icon("eye")}</button>
    <button type="button" class="mini del" data-action="remove-file" data-key="${key}" title="Quitar">${icon("close")}</button>
  </div>`;
}
async function handleFilePick(input){
  const form = input.form || input.closest("form");
  const key  = input.dataset.filekey;
  const file = input.files && input.files[0];
  input.value = "";
  if (!file || !form || !key) return;
  if (file.size > MAX_FILE_BYTES){ toast("El archivo es demasiado grande (máx. 8 MB)", "err"); return; }
  try {
    const att = await fileToAttachment(file);
    form._attachments = form._attachments || {};
    form._attachments[key] = att;
    refreshFileBox(form, key);
    if (stateSize() + att.data.length * 0.75 > 4.6 * 1024 * 1024)
      toast("Aviso: el almacenamiento local se está llenando", "info", 5000);
  } catch (err){ toast("No se pudo adjuntar: " + err.message, "err"); }
}
function refreshFileBox(form, key){
  const box = form.querySelector(`[data-filebox="${key}"]`);
  if (!box) return;
  const att = (form._attachments || {})[key];
  if (att && att.data){
    box.innerHTML = fileChipHTML(key, att);
  } else {
    box.innerHTML = `<button type="button" class="btn" data-action="pick-file" data-key="${key}">
      ${icon("upload")}Adjuntar archivo</button>`;
  }
}
function openAttachment(att){
  if (!att || !att.data){ toast("No hay archivo adjunto", "err"); return; }
  const isImg = (att.type || "").startsWith("image/");
  const isPdf = (att.type || "").includes("pdf");
  openModal(`
    <div class="modal-head">${icon("file")}
      <h3>${esc(att.name || "Archivo")}</h3>
      <button class="btn icon ghost" data-action="modal-close">${icon("close")}</button></div>
    <div class="modal-body" style="text-align:center">
      ${ isImg
          ? `<img src="${att.data}" alt="" style="max-width:100%;border-radius:12px;display:block;margin:auto">`
          : isPdf
            ? `<iframe src="${att.data}" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:12px;background:#fff"></iframe>`
            : `<p class="muted">Vista previa no disponible para este formato.</p>` }
      ${ att.size ? `<p class="muted" style="margin-top:10px">${fmtBytes(att.size)}</p>` : "" }
    </div>
    <div class="modal-foot">
      <button class="btn" data-action="modal-close">Cerrar</button>
      <a class="btn primary" href="${att.data}" download="${esc(att.name || "archivo")}">
        ${icon("download")}Descargar</a>
    </div>`);
}
function findAttachment(type, id, key){
  const coll = { fuel: state.fuel, services: state.services,
                 expenses: state.expenses, documents: state.documents }[type];
  const rec = coll && coll.find(r => r.id === id);
  return rec ? rec[key] : null;
}

/* ============================================================================
   FILE SYSTEM ACCESS API
   ============================================================================ */
const FS_PICKER = !!window.showSaveFilePicker;
const FS_DIR    = !!window.showDirectoryPicker;
let backupDirHandle = null;

const FS_DB = "garaje-fs", FS_STORE = "handles";
function fsDB(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(FS_DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(FS_STORE)) r.result.createObjectStore(FS_STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function fsPut(k, v){
  try {
    const db = await fsDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(FS_STORE, "readwrite");
      tx.objectStore(FS_STORE).put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch(e){ console.warn(e); }
}
async function fsGet(k){
  try {
    const db = await fsDB();
    return new Promise(res => {
      const tx = db.transaction(FS_STORE, "readonly");
      const req = tx.objectStore(FS_STORE).get(k);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch(e){ return null; }
}
async function fsDel(k){
  try {
    const db = await fsDB();
    return new Promise(res => {
      const tx = db.transaction(FS_STORE, "readwrite");
      tx.objectStore(FS_STORE).delete(k);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch(e){}
}
function download(name, content, mime){
  const blob = content instanceof Blob ? content
             : new Blob([content], { type: mime || "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
async function saveFileWithPicker(blob, filename, mime){
  if (window.showSaveFilePicker){
    try {
      const ext = "." + filename.split(".").pop();
      const isJSON = mime.includes("json");
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: isJSON ? "Archivo JSON" : "Archivo CSV",
                  accept: { [mime]: [ext] } }]
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return "picker";
    } catch(e){
      if (e.name === "AbortError") return "cancel";
      console.warn("showSaveFilePicker falló:", e);
    }
  }
  download(filename, blob, mime);
  return "download";
}
async function ensureDirPermission(handle, mode = "readwrite"){
  if (!handle) return false;
  try {
    if ((await handle.queryPermission({ mode })) === "granted") return true;
    if ((await handle.requestPermission({ mode })) === "granted") return true;
    return false;
  } catch(e){ return false; }
}
async function loadBackupDir(){
  const h = await fsGet("backupDir");
  if (h){
    backupDirHandle = h;
    if (currentView === "data") render();
  }
}
async function chooseBackupFolder(){
  if (!FS_DIR){
    toast("Tu navegador no permite elegir carpeta. Se usará la descarga normal.", "info", 5000);
    return null;
  }
  try {
    const dir = await window.showDirectoryPicker({ mode: "readwrite" });
    backupDirHandle = dir;
    await fsPut("backupDir", dir);
    toast("Carpeta de copias: " + dir.name, "ok");
    render();
    return dir;
  } catch(e){
    if (e.name !== "AbortError") toast("No se pudo abrir la carpeta: " + e.message, "err");
    return null;
  }
}
async function writeBackupToFolder(){
  if (!FS_DIR){
    toast("Este navegador no permite escribir en carpetas", "err");
    return null;
  }
  let dir = backupDirHandle;
  if (!dir){
    dir = await fsGet("backupDir");
    if (dir) backupDirHandle = dir;
  }
  if (!dir) dir = await chooseBackupFolder();
  if (!dir) return null;
  if (!await ensureDirPermission(dir, "readwrite")){
    toast("Permiso denegado para escribir en la carpeta", "err");
    return null;
  }
  const filename = "garaje-backup-" + hoyISO() + ".json";
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  try {
    const fh = await dir.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return { name: filename, folder: dir.name };
  } catch(e){
    toast("Error al escribir el archivo: " + e.message, "err");
    return null;
  }
}
async function forgetBackupFolder(){
  backupDirHandle = null;
  await fsDel("backupDir");
  toast("Carpeta de copias olvidada", "info");
  render();
}
async function restoreFromFile(file){
  try {
    const text = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(fr.error);
      fr.readAsText(file);
    });
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") throw new Error("Formato inválido");
    const ok = await askConfirm("Restaurar copia",
      `Se sustituirán los datos actuales por los de la copia
       (${(data.vehicles||[]).length} vehículos, ${(data.fuel||[]).length} recargas,
        ${(data.services||[]).length} servicios, ${(data.expenses||[]).length} gastos,
        ${(data.documents||[]).length} documentos).`,
      "Restaurar");
    if (!ok) return;
    state = Object.assign(clone(DEFAULT_STATE), data, {
      settings: Object.assign({}, DEFAULT_STATE.settings, data.settings || {})
    });
    ["vehicles","fuel","services","expenses","documents"].forEach(k => {
      if (!Array.isArray(state[k])) state[k] = [];
    });
    pageState = { fuel:1, services:1, expenses:1, documents:1 };
    saveState(); render(); toast("Copia restaurada correctamente", "ok");
  } catch(err){
    toast("No se pudo restaurar: " + err.message, "err");
  }
}
async function restoreFromFolder(){
  if (!FS_DIR){
    toast("Este navegador no permite elegir carpeta. Usa «Restaurar copia (archivo)».", "info", 5000);
    return;
  }
  try {
    const dir = await window.showDirectoryPicker({ mode: "read" });
    const files = [];
    for await (const entry of dir.values()){
      if (entry.kind === "file" && /\.json$/i.test(entry.name)){
        const f = await entry.getFile();
        files.push(f);
      }
    }
    if (!files.length){ toast("No se han encontrado archivos .json en la carpeta", "err"); return; }
    files.sort((a, b) => b.name.localeCompare(a.name));
    window._backupFiles = files;
    openModal(`
      <div class="modal-head">${icon("folder")}<h3>Restaurar copia desde carpeta</h3>
        <button class="btn icon ghost" data-action="modal-close">${icon("close")}</button></div>
      <div class="modal-body">
        <p class="muted" style="margin-bottom:10px">Carpeta <b>${esc(dir.name)}</b> · ${files.length} copia(s):</p>
        <ul class="importlist">
          ${files.map((f, i) => `<li>
            <svg class="ic"><use href="#i-file"></use></svg>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
              <div class="muted">${fmtBytes(f.size)} · ${new Date(f.lastModified).toLocaleString("es-ES")}</div>
            </div>
            <button class="btn primary sm" data-action="pick-backup" data-index="${i}">Restaurar</button>
          </li>`).join("")}
        </ul>
      </div>
      <div class="modal-foot">
        <button class="btn" data-action="modal-close">Cancelar</button>
      </div>`);
  } catch(e){
    if (e.name !== "AbortError") toast("Error al leer la carpeta: " + e.message, "err");
  }
}

/* ============================================================================
   NAVEGACIÓN
   ============================================================================ */
const VIEWS = [
  { id:"dashboard", label:"Panel",       short:"Panel",    icon:"dash"    },
  { id:"fuel",      label:"Recargas",    short:"Recarga",  icon:"fuel"    },
  { id:"services",  label:"Servicios",   short:"Servicio", icon:"wrench"  },
  { id:"expenses",  label:"Gastos",      short:"Gastos",   icon:"receipt" },
  { id:"documents", label:"Documentos",  short:"Docs",     icon:"file"    },
  { id:"vehicles",  label:"Vehículos",   short:"Vehíc.",   icon:"car"     },
  { id:"data",      label:"Datos",       short:"Datos",    icon:"db"      }
];
function renderNav(){
  $("#sidebar").innerHTML = VIEWS.map(v =>
    `<button class="navlink ${currentView===v.id?"active":""}" data-action="nav" data-view="${v.id}">
       ${icon(v.icon)}<span>${v.label}</span></button>`).join("");
  $("#bottomnav").innerHTML = VIEWS.map(v =>
    `<button class="${currentView===v.id?"active":""}" data-action="nav" data-view="${v.id}"
       title="${v.label}">${icon(v.icon)}<span>${v.short}</span></button>`).join("");
}
function renderVehicleSelect(){
  const sel = $("#vehicleSelect");
  const cur = state.settings.vehicle;
  sel.innerHTML = `<option value="all">Todos los vehículos</option>` +
    state.vehicles.map(v =>
      `<option value="${v.id}" ${v.id===cur?"selected":""}>${esc(v.nombre)}</option>`).join("");
  if (cur !== "all" && !vehById(cur)){ state.settings.vehicle = "all"; sel.value = "all"; }
}
function render(){
  document.body.dataset.view = currentView;
  renderNav();
  renderVehicleSelect();
  const fn = {
    dashboard: viewDashboard, fuel: viewFuel, services: viewServices,
    expenses: viewExpenses, documents: viewDocuments, vehicles: viewVehicles, data: viewData
  }[currentView] || viewDashboard;
  $("#view").innerHTML = fn();
  const sa = $("#view .scroll-area");
  if (sa) sa.scrollTop = 0;
}

/* ============================================================================
   PAGINACIÓN
   ============================================================================ */
function paginate(list, type){
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let page = Math.min(Math.max(1, pageState[type] || 1), pages);
  pageState[type] = page;
  const start = (page - 1) * PAGE_SIZE;
  return { items: list.slice(start, start + PAGE_SIZE), total, pages, page, start };
}
function paginationHTML(type, info){
  if (info.pages <= 1) return "";
  const { page, pages, total, start } = info;
  const btn = (p, label, dis, act) =>
    `<button class="pagebtn${act?" active":""}" ${dis?"disabled":""}
      data-action="page" data-type="${type}" data-page="${p}">${label}</button>`;
  const win = [];
  const push = p => { if (p >= 1 && p <= pages && !win.includes(p)) win.push(p); };
  push(1); push(2);
  for (let p = page - 1; p <= page + 1; p++) push(p);
  push(pages - 1); push(pages);
  const sorted = win.sort((a, b) => a - b);
  let nums = "", prev = 0;
  sorted.forEach(p => {
    if (prev && p - prev > 1) nums += `<span class="pagegap">…</span>`;
    nums += btn(p, p, false, p === page);
    prev = p;
  });
  const fin = Math.min(start + PAGE_SIZE, total);
  return `<div class="pagination">
    <span class="pageinfo">Mostrando ${start + 1}–${fin} de ${total}</span>
    <div class="pagecontrols">
      ${btn(page - 1, "‹", page <= 1)}${nums}${btn(page + 1, "›", page >= pages)}
    </div></div>`;
}

/* ============================================================================
   GRÁFICOS
   ============================================================================ */
function chartBars(items, opt = {}){
  if (!items.length) return `<div class="empty">${icon("chart")}<div>Sin datos suficientes</div></div>`;
  const color = opt.color || "var(--accent)", unit = opt.unit || "";
  const h = opt.h || 210, bw = opt.bw || 22, gap = 7;
  const padL = 46, padR = 12, padT = 14, padB = 34;
  const n = items.length;
  const w = Math.max(320, padL + padR + n * (bw + gap));
  const max = Math.max(...items.map(i => i.value), 0.0001);
  const plotH = h - padT - padB;
  const yOf = v => padT + plotH - (v / max) * plotH;
  let grid = "";
  for (let i = 0; i <= 4; i++){
    const val = max * i / 4, y = yOf(val);
    grid += `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="var(--border)"/>`;
    grid += `<text x="${padL-8}" y="${y+3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${fmtNum(val, val < 10 ? 1 : 0)}</text>`;
  }
  let bars = "";
  const step = Math.ceil(n / 14);
  items.forEach((it, i) => {
    const x = padL + i * (bw + gap);
    const y = yOf(it.value);
    const bh = Math.max(1.5, padT + plotH - y);
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${color}" opacity=".92">
      <title>${esc(it.label)} — ${fmtNum(it.value)} ${unit}</title></rect>`;
    if (i % step === 0)
      bars += `<text x="${x+bw/2}" y="${h-padB+16}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(it.short || it.label)}</text>`;
  });
  return `<div class="chartbox"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"
    style="width:100%;min-width:${Math.min(w,640)}px;height:auto;display:block">${grid}${bars}</svg></div>`;
}
function chartStacked(months){
  const h = 230, bw = 26, gap = 12, padL = 52, padR = 12, padT = 16, padB = 40;
  const n = months.length;
  const w = Math.max(340, padL + padR + n * (bw + gap));
  const max = Math.max(...months.map(m => m.fuel + m.serv + m.exp), 1);
  const plotH = h - padT - padB;
  const yOf = v => padT + plotH - (v / max) * plotH;
  const colors = { fuel:"#4c8dff", serv:"#f59e0b", exp:"#a78bfa" };
  let grid = "";
  for (let i = 0; i <= 4; i++){
    const val = max * i / 4, y = yOf(val);
    grid += `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="var(--border)"/>`;
    grid += `<text x="${padL-8}" y="${y+3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${fmtNum(val,0)}</text>`;
  }
  let bars = "";
  months.forEach((m, i) => {
    const x = padL + i * (bw + gap);
    let cursor = padT + plotH;
    [["fuel","Combustible"],["serv","Servicios"],["exp","Otros"]].forEach(([k, lbl]) => {
      const val = m[k];
      if (val <= 0) return;
      const bh = (val / max) * plotH;
      cursor -= bh;
      bars += `<rect x="${x}" y="${cursor}" width="${bw}" height="${Math.max(bh,1)}" rx="3"
        fill="${colors[k]}"><title>${esc(m.label)} · ${lbl}: ${money(val)}</title></rect>`;
    });
    bars += `<text x="${x+bw/2}" y="${h-padB+15}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(m.label)}</text>`;
  });
  return `<div class="chartbox"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"
    style="width:100%;min-width:${Math.min(w,640)}px;height:auto;display:block">${grid}${bars}</svg></div>`;
}
function chartDonut(parts){
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (total <= 0) return `<div class="empty">${icon("chart")}<div>Sin gastos registrados</div></div>`;
  const r = 58, c = 2 * Math.PI * r;
  let off = 0, segs = "";
  parts.forEach(p => {
    if (p.value <= 0) return;
    const len = c * p.value / total;
    segs += `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${p.color}" stroke-width="22"
      stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"
      transform="rotate(-90 80 80)"><title>${esc(p.label)}: ${money(p.value)}</title></circle>`;
    off += len;
  });
  const legend = parts.map(p => `
    <li><span class="dot" style="background:${p.color}"></span>
      <span>${esc(p.label)}</span>
      <span class="val">${money(p.value)} · ${fmtNum(total ? p.value/total*100 : 0, 0)}%</span></li>`).join("");
  return `<div class="donutwrap">
    <svg viewBox="0 0 160 160" style="width:158px;height:158px;flex:0 0 auto">${segs}
      <text x="80" y="76" text-anchor="middle" font-size="12" fill="var(--muted)">Total</text>
      <text x="80" y="94" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${money(total)}</text>
    </svg>
    <ul class="legend">${legend}</ul></div>`;
}

/* ============================================================================
   VISTA: PANEL
   ============================================================================ */
function viewDashboard(){
  const F = fuelList(), S = serviceList(), E = expenseList(), D = documentList();

  if (!state.vehicles.length){
    return `<div class="viewhead">
        <div><h2>Panel</h2><p class="muted">Aún no hay vehículos registrados</p></div>
      </div>
      <div class="scroll-area">
        <div class="card"><div class="empty">${icon("car")}
          <div style="margin-bottom:14px">Crea tu primer vehículo para empezar</div>
          <button class="btn primary" data-action="new-vehicle">${icon("plus")}Añadir vehículo</button>
        </div></div>
      </div>`;
  }

  const totalF = sumBy(F, "coste"), totalS = sumBy(S, "coste"), totalE = sumBy(E, "coste");
  const total  = totalF + totalS + totalE;
  const litros = sumBy(F, "cantidad");
  const kmFuel = F.reduce((a, r) => a + (Number(r.distancia) || 0), 0);
  const consumo = kmFuel > 0 ? (litros / kmFuel) * 100 : 0;
  const eurKm   = kmFuel > 0 ? totalF / kmFuel : 0;
  const ultOdo  = maxOdometro();
  const meses   = new Set([...F, ...S, ...E].map(r => (r.fecha || "").slice(0, 7)).filter(Boolean)).size;
  const mediaMes = meses > 0 ? total / meses : 0;
  const prox = D.filter(d => d.vencimiento).map(d => ({ ...d, dias: diasHasta(d.vencimiento) }))
    .filter(d => d.dias !== null && d.dias <= 90).sort((a, b) => a.dias - b.dias);
  const caducados = prox.filter(d => d.dias < 0).length;
  const serie = F.filter(r => Number(r.distancia) > 0 && Number(r.cantidad) > 0)
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")).slice(-24)
    .map(r => ({ label: fmtFecha(r.fecha), short: fmtFechaCorta(r.fecha),
                 value: (Number(r.cantidad) / Number(r.distancia)) * 100 }));
  const now = new Date();
  const mesesArr = [];
  for (let i = 11; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mesesArr.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      fuel: 0, serv: 0, exp: 0 });
  }
  const map = Object.fromEntries(mesesArr.map(m => [m.key, m]));
  const acum = (list, key) => list.forEach(r => {
    const k = (r.fecha || "").slice(0, 7);
    if (map[k]) map[k][key] += Number(r.coste) || 0;
  });
  acum(F, "fuel"); acum(S, "serv"); acum(E, "exp");
  const recientes = [
    ...F.map(r => ({ ...r, _t:"fuel",     _c: r.gasolinera, _d: `Recarga · ${fmtNum(r.cantidad,2)} L` })),
    ...S.map(r => ({ ...r, _t:"services", _c: r.proveedor, _d: r.concepto })),
    ...E.map(r => ({ ...r, _t:"expenses", _c: r.proveedor, _d: r.concepto }))
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 8);
  const iconoTipo = { fuel:"fuel", services:"wrench", expenses:"receipt" };

  return `
  <div class="viewhead">
    <div><h2>Panel</h2>
      <p class="muted">${state.settings.vehicle === "all"
        ? `${state.vehicles.length} vehículo(s) · ${F.length + S.length + E.length + D.length} registros`
        : esc(vehName(state.settings.vehicle))}</p></div>
    <div class="actions">
      <button class="btn" data-action="nav" data-view="data">${icon("db")}Datos</button>
      <button class="btn primary" data-action="quick-new">${icon("plus")}Nuevo</button>
    </div>
  </div>

  <div class="scroll-area">
    <div class="grid kpis" style="margin-bottom:14px">
      <div class="kpi accent"><div class="label">Gasto total</div><div class="value">${money(total)}</div>
        <div class="sub">Media ${money(mediaMes)}/mes</div></div>
      <div class="kpi"><div class="label">Combustible</div><div class="value">${money(totalF)}</div>
        <div class="sub">${fmtNum(litros,1)} L · ${F.length} recargas</div></div>
      <div class="kpi"><div class="label">Servicios</div><div class="value">${money(totalS)}</div>
        <div class="sub">${S.length} intervenciones</div></div>
      <div class="kpi"><div class="label">Otros gastos</div><div class="value">${money(totalE)}</div>
        <div class="sub">${E.length} registros</div></div>
      <div class="kpi ok"><div class="label">Consumo medio</div><div class="value">${fmtNum(consumo,2)}</div>
        <div class="sub">L/100 km · ${fmtNum(consumo>0?100/consumo:0,2)} km/L</div></div>
      <div class="kpi"><div class="label">Coste combustible</div><div class="value">${fmtNum(eurKm,3)}</div>
        <div class="sub">€ por km</div></div>
      <div class="kpi"><div class="label">Odómetro actual</div><div class="value">${fmtInt(ultOdo)}</div>
        <div class="sub">km</div></div>
      <div class="kpi ${caducados ? "danger" : ""}"><div class="label">Documentos</div><div class="value">${D.length}</div>
        <div class="sub">${caducados ? caducados + " caducado(s)" : prox.length ? prox.length + " por vencer" : "al día"}</div></div>
    </div>

    ${prox.length ? `
    <div class="card" style="margin-bottom:14px">
      <h3>${icon("calendar")}Vencimientos próximos</h3>
      <div class="tablewrap"><table>
        <thead><tr><th>Documento</th><th>Vehículo</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
        <tbody>${prox.slice(0, 8).map(d => {
          const est = docEstado(d);
          return `<tr>
            <td data-label="Documento">${esc(d.tipo)}${d.titulo ? `<div class="muted">${esc(d.titulo)}</div>` : ""}</td>
            <td data-label="Vehículo">${esc(vehName(d.vehicleId))}</td>
            <td data-label="Vence">${fmtFecha(d.vencimiento)}</td>
            <td data-label="Estado"><span class="tag ${est.cls}">${esc(est.txt)}</span></td>
            <td class="actions"><button class="mini" data-action="nav" data-view="documents" title="Ver">${icon("eye")}</button></td>
          </tr>`; }).join("")}</tbody>
      </table></div>
    </div>` : ""}

    <div class="grid cols-2" style="margin-bottom:14px">
      <div class="card">
        <h3>${icon("chart")}Consumo por recarga</h3>
        <p class="muted" style="margin-bottom:10px">Últimas ${serie.length} recargas con distancia · L/100 km</p>
        ${chartBars(serie, { color:"#4c8dff", unit:"L/100km", h:210 })}
      </div>
      <div class="card">
        <h3>${icon("chart")}Distribución del gasto</h3>
        ${chartDonut([
          { label:"Combustible", value: totalF, color:"#4c8dff" },
          { label:"Servicios",   value: totalS, color:"#f59e0b" },
          { label:"Otros",       value: totalE, color:"#a78bfa" }
        ])}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <h3>${icon("calendar")}Gasto mensual (últimos 12 meses)</h3>
      ${chartStacked(mesesArr)}
      <ul class="legend" style="flex-direction:row;flex-wrap:wrap;gap:18px;margin-top:8px">
        <li><span class="dot" style="background:#4c8dff"></span>Combustible</li>
        <li><span class="dot" style="background:#f59e0b"></span>Servicios</li>
        <li><span class="dot" style="background:#a78bfa"></span>Otros gastos</li>
      </ul>
    </div>

    <div class="card">
      <h3>${icon("file")}Últimos movimientos</h3>
      ${recientes.length ? `<div class="tablewrap"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Proveedor</th><th class="num">Importe</th></tr></thead>
        <tbody>${recientes.map(r => `
          <tr>
            <td data-label="Fecha">${fmtFecha(r.fecha)}</td>
            <td data-label="Tipo"><span class="tag">${icon(iconoTipo[r._t])} ${({fuel:"Recarga",services:"Servicio",expenses:"Gasto"})[r._t]}</span></td>
            <td data-label="Concepto">${esc(r._d || "—")}</td>
            <td data-label="Proveedor">${esc(r._c || "—")}</td>
            <td class="num" data-label="Importe">${money(r.coste)}</td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty">${icon("file")}<div>Sin registros todavía</div></div>`}
    </div>
  </div>`;
}

/* ============================================================================
   LISTAS
   ============================================================================ */
function searchFilter(list, q){
  if (!q) return list;
  const s = q.toLowerCase();
  return list.filter(r => Object.values(r).some(v => {
    if (v && typeof v === "object") return false;
    return String(v ?? "").toLowerCase().includes(s);
  }));
}
function attachBtn(type, id, key){
  const att = findAttachment(type, id, key);
  if (!att || !att.data) return `<span class="muted">—</span>`;
  return `<button class="mini has" data-action="view-att" data-type="${type}" data-id="${id}"
    data-key="${key}" title="${esc(att.name || "adjunto")}">${icon("clip")}</button>`;
}
function tableFuel(){
  const q = searchTerm.fuel;
  const all = searchFilter(fuelList(), q).sort((a, b) =>
    (b.fecha || "").localeCompare(a.fecha || "") || (Number(b.odometro)||0) - (Number(a.odometro)||0));
  if (!all.length) return `<div class="empty">${icon("fuel")}<div>${q ? "Sin resultados" : "Todavía no hay recargas"}</div></div>`;
  const info = paginate(all, "fuel");
  const rows = info.items.map(r => {
    const cant = Number(r.cantidad) || 0, cost = Number(r.coste) || 0, dist = Number(r.distancia) || 0;
    const eurL = cant > 0 ? cost / cant : 0;
    const cons = (dist > 0 && cant > 0) ? (cant / dist) * 100 : 0;
    return `<tr>
      <td data-label="Fecha">${fmtFecha(r.fecha)}${r.parcial ? ' <span class="tag warn">parcial</span>' : ""}</td>
      <td class="num" data-label="Odómetro">${r.odometro ? fmtInt(r.odometro) : "—"}</td>
      <td class="num" data-label="Distancia">${dist ? fmtInt(dist) : "—"}</td>
      <td class="num" data-label="Litros">${fmtNum(cant,2)}</td>
      <td class="num" data-label="Importe">${money(cost)}</td>
      <td class="num" data-label="€/L">${eurL ? fmtNum(eurL,3) : "—"}</td>
      <td class="num" data-label="L/100km">${cons ? fmtNum(cons,2) : "—"}</td>
      <td data-label="Gasolinera">${esc(r.gasolinera || "—")}</td>
      <td class="actions"><span class="rowbtns">
        <button class="mini" data-action="edit" data-type="fuel" data-id="${r.id}" title="Editar">${icon("edit")}</button>
        <button class="mini del" data-action="del" data-type="fuel" data-id="${r.id}" title="Eliminar">${icon("trash")}</button>
      </span></td></tr>`;
  }).join("");
  return `<div class="tablewrap"><table>
    <thead><tr><th>Fecha</th><th class="num">Odómetro</th><th class="num">Dist.</th><th class="num">Litros</th>
      <th class="num">Importe</th><th class="num">€/L</th><th class="num">L/100</th>
      <th>Gasolinera</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>${paginationHTML("fuel", info)}`;
}
function tableServices(){
  const q = searchTerm.services;
  const all = searchFilter(serviceList(), q).sort((a, b) =>
    (b.fecha || "").localeCompare(a.fecha || "") || (Number(b.odometro)||0) - (Number(a.odometro)||0));
  if (!all.length) return `<div class="empty">${icon("wrench")}<div>${q ? "Sin resultados" : "Todavía no hay servicios"}</div></div>`;
  const info = paginate(all, "services");
  const rows = info.items.map(r => `<tr>
      <td data-label="Fecha">${fmtFecha(r.fecha)}</td>
      <td class="num" data-label="Odómetro">${r.odometro ? fmtInt(r.odometro) : "—"}</td>
      <td data-label="Servicio">${esc(r.concepto || "—")}${r.notas ? `<div class="muted">${esc(r.notas)}</div>` : ""}</td>
      <td data-label="Proveedor">${esc(r.proveedor || "—")}</td>
      <td class="num" data-label="Importe">${money(r.coste)}</td>
      <td data-label="Documento" style="text-align:center">${attachBtn("services", r.id, "documento")}</td>
      <td class="actions"><span class="rowbtns">
        <button class="mini" data-action="edit" data-type="services" data-id="${r.id}" title="Editar">${icon("edit")}</button>
        <button class="mini del" data-action="del" data-type="services" data-id="${r.id}" title="Eliminar">${icon("trash")}</button>
      </span></td></tr>`).join("");
  return `<div class="tablewrap"><table>
    <thead><tr><th>Fecha</th><th class="num">Odómetro</th><th>Servicio</th><th>Proveedor</th>
      <th class="num">Importe</th><th style="text-align:center">Doc.</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>${paginationHTML("services", info)}`;
}
function tableExpenses(){
  const q = searchTerm.expenses;
  const all = searchFilter(expenseList(), q).sort((a, b) =>
    (b.fecha || "").localeCompare(a.fecha || ""));
  if (!all.length) return `<div class="empty">${icon("receipt")}<div>${q ? "Sin resultados" : "Todavía no hay otros gastos"}</div></div>`;
  const info = paginate(all, "expenses");
  const rows = info.items.map(r => `<tr>
      <td data-label="Fecha">${fmtFecha(r.fecha)}</td>
      <td data-label="Concepto">${esc(r.concepto || "—")}${r.notas ? `<div class="muted">${esc(r.notas)}</div>` : ""}</td>
      <td data-label="Proveedor">${esc(r.proveedor || "—")}</td>
      <td class="num" data-label="Importe">${money(r.coste)}</td>
      <td data-label="Documento" style="text-align:center">${attachBtn("expenses", r.id, "documento")}</td>
      <td class="actions"><span class="rowbtns">
        <button class="mini" data-action="edit" data-type="expenses" data-id="${r.id}" title="Editar">${icon("edit")}</button>
        <button class="mini del" data-action="del" data-type="expenses" data-id="${r.id}" title="Eliminar">${icon("trash")}</button>
      </span></td></tr>`).join("");
  return `<div class="tablewrap"><table>
    <thead><tr><th>Fecha</th><th>Concepto</th><th>Proveedor</th><th class="num">Importe</th>
      <th style="text-align:center">Doc.</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>${paginationHTML("expenses", info)}`;
}
function tableDocuments(){
  const q = searchTerm.documents;
  const all = searchFilter(documentList(), q).sort((a, b) => {
    const av = a.vencimiento || "9999", bv = b.vencimiento || "9999";
    if (av !== bv) return av.localeCompare(bv);
    return (b.fecha || "").localeCompare(a.fecha || "");
  });
  if (!all.length) return `<div class="empty">${icon("file")}<div>${q ? "Sin resultados" : "Todavía no hay documentos"}</div></div>`;
  const info = paginate(all, "documents");
  const rows = info.items.map(r => {
    const est = docEstado(r);
    return `<tr>
      <td data-label="Documento">
        <span class="tag accent">${icon(docIcono(r.tipo))} ${esc((r.tipo || "").length > 26 ? r.tipo.slice(0, 24) + "…" : (r.tipo || "—"))}</span>
        ${r.titulo ? `<div class="muted" style="margin-top:4px">${esc(r.titulo)}</div>` : ""}</td>
      <td data-label="Nº / Ref.">${esc(r.numero || "—")}</td>
      <td data-label="Emisor">${esc(r.emisor || "—")}</td>
      <td data-label="Fecha">${r.fecha ? fmtFecha(r.fecha) : "—"}</td>
      <td data-label="Vencimiento">${r.vencimiento ? fmtFecha(r.vencimiento) : "—"}
        <div><span class="tag ${est.cls}">${esc(est.txt)}</span></div></td>
      <td class="num" data-label="Importe">${Number(r.coste) ? money(r.coste) : "—"}</td>
      <td data-label="Adjunto" style="text-align:center">${attachBtn("documents", r.id, "archivo")}</td>
      <td class="actions"><span class="rowbtns">
        <button class="mini" data-action="edit" data-type="documents" data-id="${r.id}" title="Editar">${icon("edit")}</button>
        <button class="mini del" data-action="del" data-type="documents" data-id="${r.id}" title="Eliminar">${icon("trash")}</button>
      </span></td></tr>`;
  }).join("");
  return `<div class="tablewrap"><table>
    <thead><tr><th>Documento</th><th>Nº / Ref.</th><th>Emisor</th><th>Fecha</th><th>Vencimiento</th>
      <th class="num">Importe</th><th style="text-align:center">Adj.</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>${paginationHTML("documents", info)}`;
}
function renderListBody(type){
  if (type === "fuel")      return tableFuel();
  if (type === "services")  return tableServices();
  if (type === "expenses")  return tableExpenses();
  if (type === "documents") return tableDocuments();
  return "";
}
function listView(type){
  const meta = {
    fuel:      { title:"Recargas",     icon:"fuel",    btn:"Nueva recarga",  ph:"Buscar por gasolinera, fecha, notas…" },
    services:  { title:"Servicios",    icon:"wrench",  btn:"Nuevo servicio", ph:"Buscar por servicio, proveedor…" },
    expenses:  { title:"Otros gastos", icon:"receipt", btn:"Nuevo gasto",    ph:"Buscar por concepto, proveedor…" },
    documents: { title:"Documentos",   icon:"file",    btn:"Nuevo documento",ph:"Buscar por tipo, emisor, número…" }
  }[type];
  const list = { fuel: fuelList, services: serviceList,
                 expenses: expenseList, documents: documentList }[type]();
  const tot = sumBy(list, "coste");
  let extra = "";
  if (type === "fuel"){
    const l = sumBy(list, "cantidad");
    const km = list.reduce((a, r) => a + (Number(r.distancia) || 0), 0);
    extra = ` · ${fmtNum(l,1)} L · ${km > 0 ? fmtNum(l/km*100,2) + " L/100km" : "—"}`;
  } else if (type === "documents"){
    const cad = list.filter(d => d.vencimiento && diasHasta(d.vencimiento) < 0).length;
    extra = cad ? ` · <span style="color:var(--danger)">${cad} caducado(s)</span>` : "";
  }
  return `
  <div class="viewhead">
    <div><h2>${meta.title}</h2>
      <p class="muted">${list.length} registros${type === "documents" ? "" : " · " + money(tot)}${extra}</p></div>
    <div class="actions">
      <button class="btn" data-action="export-csv" data-type="${type}">${icon("download")}CSV</button>
      <button class="btn primary" data-action="new" data-type="${type}">${icon("plus")}${meta.btn}</button>
    </div>
  </div>
  <div class="toolbar">
    <div class="search">${icon("search")}
      <input type="search" placeholder="${meta.ph}" value="${esc(searchTerm[type]||"")}" data-search="${type}">
    </div>
  </div>
  <div class="scroll-area" id="tableHost">${renderListBody(type)}</div>`;
}
const viewFuel      = () => listView("fuel");
const viewServices  = () => listView("services");
const viewExpenses  = () => listView("expenses");
const viewDocuments = () => listView("documents");

/* ============================================================================
   VISTA: VEHÍCULOS
   ============================================================================ */
function viewVehicles(){
  if (!state.vehicles.length){
    return `<div class="viewhead">
        <div><h2>Vehículos</h2><p class="muted">Sin vehículos registrados</p></div>
        <div class="actions"><button class="btn primary" data-action="new-vehicle">${icon("plus")}Añadir vehículo</button></div>
      </div>
      <div class="scroll-area">
        <div class="card"><div class="empty">${icon("car")}<div>Añade tu primer vehículo para comenzar</div></div></div>
      </div>`;
  }
  const cards = state.vehicles.map(v => {
    const F = state.fuel.filter(r => r.vehicleId === v.id);
    const S = state.services.filter(r => r.vehicleId === v.id);
    const E = state.expenses.filter(r => r.vehicleId === v.id);
    const D = state.documents.filter(r => r.vehicleId === v.id);
    const tot = sumBy(F,"coste") + sumBy(S,"coste") + sumBy(E,"coste");
    const odo = [...F, ...S].reduce((m, r) => Math.max(m, Number(r.odometro) || 0), 0);
    const km = F.reduce((a, r) => a + (Number(r.distancia) || 0), 0);
    const litros = sumBy(F, "cantidad");
    const cons = km > 0 ? litros / km * 100 : 0;
    const ultima = [...F, ...S, ...E].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""))[0];
    const foto = v.imagen && v.imagen.data ? v.imagen.data : null;
    return `<article class="vcard">
      ${foto ? `<div class="vphoto"><img src="${foto}" alt="${esc(v.nombre)}"></div>` : ""}
      <div class="top">
        ${foto ? "" : `<span class="avatar">${icon("car")}</span>`}
        <div style="flex:1;min-width:0">
          <h3 style="font-size:1.02rem">${esc(v.nombre)}</h3>
          <p class="muted">${esc([v.marca, v.modelo, v.anio].filter(Boolean).join(" · ") || "Sin datos")}</p>
        </div>
        <span class="rowbtns">
          <button class="mini" data-action="edit-vehicle" data-id="${v.id}" title="Editar">${icon("edit")}</button>
          <button class="mini del" data-action="del-vehicle" data-id="${v.id}" title="Eliminar">${icon("trash")}</button>
        </span>
      </div>
      <dl class="meta">
        ${v.licencia ? `<dt>Matrícula</dt><dd>${esc(v.licencia)}</dd>` : ""}
        ${v.vin ? `<dt>Bastidor</dt><dd>${esc(v.vin)}</dd>` : ""}
        ${v.poliza ? `<dt>Póliza</dt><dd>${esc(v.poliza)}</dd>` : ""}
        <dt>Odómetro</dt><dd>${odo ? fmtInt(odo) + " km" : "—"}</dd>
        <dt>Último reg.</dt><dd>${ultima ? fmtFecha(ultima.fecha) : "—"}</dd>
      </dl>
      ${v.notas ? `<p class="muted">${esc(v.notas)}</p>` : ""}
      <div class="stats">
        <div><span class="muted">Gasto total</span><b>${money(tot)}</b></div>
        <div><span class="muted">Recargas</span><b>${F.length}</b></div>
        <div><span class="muted">Documentos</span><b>${D.length}</b></div>
        <div><span class="muted">Consumo</span><b>${cons ? fmtNum(cons,2) + " L/100" : "—"}</b></div>
      </div>
      ${v.especificaciones ? `<details><summary class="muted" style="cursor:pointer;font-size:.8rem">Especificaciones</summary>
        <p class="muted" style="margin-top:8px;font-size:.8rem;white-space:pre-wrap">${esc(String(v.especificaciones).replace(/\|\|\|/g, "\n").replace(/:::/g, ": "))}</p></details>` : ""}
    </article>`;
  }).join("");
  return `
  <div class="viewhead">
    <div><h2>Vehículos</h2><p class="muted">${state.vehicles.length} vehículo(s)</p></div>
    <div class="actions"><button class="btn primary" data-action="new-vehicle">${icon("plus")}Añadir vehículo</button></div>
  </div>
  <div class="scroll-area">
    <div class="vcards">${cards}</div>
  </div>`;
}

/* ============================================================================
   VISTA: DATOS
   ============================================================================ */
function folderInfoHTML(){
  if (!FS_DIR){
    return `<div class="folderbox">
      <svg class="ic" style="color:var(--muted)"><use href="#i-folder"></use></svg>
      <div class="finfo">
        <b>Elección de carpeta no disponible</b>
        <span>Tu navegador no soporta la File System Access API. Se usará la descarga normal de archivos.</span>
      </div>
    </div>`;
  }
  if (backupDirHandle){
    return `<div class="folderbox">
      <svg class="ic"><use href="#i-folder"></use></svg>
      <div class="finfo">
        <b>${esc(backupDirHandle.name || "Carpeta de copias")}</b>
        <span>Carpeta configurada para guardar las copias de seguridad</span>
      </div>
      <button class="btn" data-action="forget-folder">${icon("x")}Olvidar</button>
      <button class="btn" data-action="change-folder">${icon("folder")}Cambiar</button>
    </div>`;
  }
  return `<div class="folderbox">
    <svg class="ic" style="color:var(--muted)"><use href="#i-folder"></use></svg>
    <div class="finfo">
      <b>Sin carpeta configurada</b>
      <span>Elige una carpeta para guardar las copias con un solo clic</span>
    </div>
    <button class="btn primary" data-action="change-folder">${icon("folder")}Elegir carpeta</button>
  </div>`;
}
function viewData(){
  const counts = [
    ["Vehículos", state.vehicles.length],
    ["Recargas",  state.fuel.length],
    ["Servicios", state.services.length],
    ["Otros gastos", state.expenses.length],
    ["Documentos", state.documents.length]
  ];
  const bytes = stateSize();
  const pct = Math.min(100, (bytes / (5 * 1024 * 1024)) * 100);
  return `
  <div class="viewhead">
    <div><h2>Datos</h2><p class="muted">Importar, exportar y copias de seguridad</p></div>
  </div>
  <div class="scroll-area">

    <div class="grid cols-2" style="margin-bottom:14px">
      <div class="card">
        <h3>${icon("db")}Resumen</h3>
        <div class="grid" style="grid-template-columns:repeat(2,1fr);gap:10px">
          ${counts.map(([l, n]) => `<div class="kpi" style="padding:11px">
            <div class="label">${l}</div><div class="value" style="font-size:1.25rem">${n}</div></div>`).join("")}
        </div>
        <div style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted);margin-bottom:6px">
            <span>Almacenamiento usado</span><span>${fmtBytes(bytes)} de ~5 MB</span>
          </div>
          <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
          ${pct > 75 ? `<p class="muted" style="margin-top:8px;color:var(--warn)">
            Queda poco espacio. Elimina adjuntos grandes o exporta una copia.</p>` : ""}
        </div>
      </div>

      <div class="card">
        <h3>${icon("upload")}Importar CSV</h3>
        <p class="muted" style="margin-bottom:12px">
          Arrastra o selecciona los ficheros <b>Recargas.csv</b>, <b>Servicios.csv</b>,
          <b>Otros Gastos.csv</b> y <b>Vehículos.csv</b>. El tipo se detecta automáticamente
          por las cabeceras y los vehículos se crean si no existen.
        </p>
        <div class="dropzone" id="dropzone">
          ${icon("upload")}
          <div style="margin-top:8px;font-weight:600;color:var(--text)">Arrastra los CSV aquí</div>
          <div style="font-size:.8rem;margin-top:4px">o pulsa para seleccionarlos</div>
        </div>
        <input type="file" id="csvInput" accept=".csv,text/csv" multiple hidden>
        <label class="check" style="margin-top:12px">
          <input type="checkbox" id="dedupeCheck" checked>
          Omitir registros duplicados
        </label>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <h3>${icon("save")}Copia de seguridad completa (JSON)</h3>
      <p class="muted" style="margin-bottom:14px">
        La copia incluye <b>todos los datos, adjuntos e imágenes</b>. Guárdala con regularidad.
        ${FS_PICKER ? `<span class="badge-support">${icon("check")}Puedes elegir ubicación</span>` : ""}
      </p>
      <div class="toolbar" style="margin-bottom:0">
        <button class="btn primary" data-action="export-json">${icon("save")}Guardar copia…</button>
        ${FS_DIR ? `<button class="btn" data-action="save-folder">${icon("folder")}Guardar en carpeta</button>` : ""}
        <button class="btn" data-action="import-json">${icon("upload")}Restaurar desde archivo</button>
        ${FS_DIR ? `<button class="btn" data-action="import-folder">${icon("folder")}Restaurar desde carpeta</button>` : ""}
      </div>
      ${folderInfoHTML()}
    </div>

    <div class="card" style="margin-bottom:14px">
      <h3>${icon("download")}Exportar a CSV</h3>
      <div class="toolbar" style="margin-bottom:0">
        <button class="btn" data-action="export-csv" data-type="fuel">${icon("file")}Recargas.csv</button>
        <button class="btn" data-action="export-csv" data-type="services">${icon("file")}Servicios.csv</button>
        <button class="btn" data-action="export-csv" data-type="expenses">${icon("file")}Otros Gastos.csv</button>
        <button class="btn" data-action="export-csv" data-type="documents">${icon("file")}Documentos.csv</button>
        <button class="btn" data-action="export-csv" data-type="vehicles">${icon("file")}Vehículos.csv</button>
        <input type="file" id="jsonInput" accept=".json,application/json" hidden>
      </div>
    </div>

    <div class="card">
      <h3 style="color:var(--danger)">${icon("alert")}Zona peligrosa</h3>
      <p class="muted" style="margin-bottom:12px">Borra todos los datos guardados en este navegador. No se puede deshacer.</p>
      <button class="btn danger" data-action="clear-all">${icon("trash")}Borrar todos los datos</button>
    </div>
  </div>`;
}

/* ============================================================================
   FORMULARIOS
   ============================================================================ */
function formFields(type){
  const veh = { k:"vehicleId", l:"Vehículo", t:"select-vehicle", req:true, full:true };
  switch (type){
    case "fuel": return [
      veh,
      { k:"fecha",    l:"Fecha",           t:"date",   req:true },
      { k:"odometro", l:"Odómetro (km)",   t:"number", step:"1" },
      { k:"distancia",l:"Distancia (km)",  t:"number", step:"1", hint:"Se calcula con el odómetro anterior" },
      { k:"cantidad", l:"Cantidad (L)",    t:"number", step:"0.001" },
      { k:"coste",    l:"Coste total (€)", t:"number", step:"0.01", req:true },
      { k:"gasolinera", l:"Gasolinera",    t:"text", full:true },
      { k:"parcial",  l:"Recarga parcial", t:"checkbox" },
      { k:"faltaLlenado", l:"Falta llenado", t:"checkbox" },
      { k:"notas",    l:"Notas",           t:"textarea", full:true },
      { k:"recibo",   l:"Referencia del recibo", t:"text", full:true }
    ];
    case "services": return [
      veh,
      { k:"fecha",    l:"Fecha",           t:"date", req:true },
      { k:"odometro", l:"Odómetro (km)",   t:"number", step:"1" },
      { k:"concepto", l:"Servicio",        t:"text", req:true, full:true },
      { k:"coste",    l:"Coste total (€)", t:"number", step:"0.01", req:true },
      { k:"proveedor",l:"Proveedor",       t:"text" },
      { k:"recibo",   l:"Referencia del recibo", t:"text" },
      { k:"notas",    l:"Notas",           t:"textarea", full:true },
      { k:"documento",l:"Documento justificativo del coste", t:"file", full:true,
        accept:"image/*,application/pdf", hint:"Factura, recibo o parte de trabajo (imagen o PDF)" }
    ];
    case "expenses": return [
      veh,
      { k:"fecha",    l:"Fecha",           t:"date", req:true },
      { k:"concepto", l:"Concepto",        t:"text", req:true, full:true },
      { k:"coste",    l:"Coste total (€)", t:"number", step:"0.01", req:true },
      { k:"proveedor",l:"Proveedor",       t:"text" },
      { k:"recibo",   l:"Referencia del recibo", t:"text" },
      { k:"notas",    l:"Notas",           t:"textarea", full:true },
      { k:"documento",l:"Documento justificativo del gasto", t:"file", full:true,
        accept:"image/*,application/pdf", hint:"Factura, ticket o justificante (imagen o PDF)" }
    ];
    case "documents": return [
      veh,
      { k:"tipo",     l:"Tipo de documento", t:"select", req:true, full:true, options: DOC_TIPOS },
      { k:"titulo",   l:"Título / descripción", t:"text", full:true,
        hint:"Ej.: «Póliza todo riesgo 2026» o «ITV favorable 2026»" },
      { k:"numero",   l:"Nº de documento / referencia", t:"text" },
      { k:"emisor",   l:"Entidad emisora", t:"text", hint:"DGT, aseguradora, ITV, ayuntamiento…" },
      { k:"fecha",    l:"Fecha de emisión", t:"date" },
      { k:"vencimiento", l:"Fecha de vencimiento", t:"date", hint:"Déjalo vacío si no caduca" },
      { k:"coste",    l:"Importe (€)", t:"number", step:"0.01" },
      { k:"notas",    l:"Notas", t:"textarea", full:true },
      { k:"archivo",  l:"Archivo del documento", t:"file", full:true,
        accept:"image/*,application/pdf", hint:"Escaneo o foto del documento (imagen o PDF)" }
    ];
    case "vehicles": return [
      { k:"nombre",  l:"Nombre / identificación", t:"text", req:true, full:true },
      { k:"marca",   l:"Marca",  t:"text" },
      { k:"modelo",  l:"Modelo", t:"text" },
      { k:"anio",    l:"Año",    t:"number", step:"1" },
      { k:"licencia",l:"Matrícula", t:"text" },
      { k:"vin",     l:"Nº de serie / bastidor", t:"text" },
      { k:"poliza",  l:"Nº de póliza", t:"text" },
      { k:"notas",   l:"Notas", t:"textarea", full:true },
      { k:"especificaciones", l:"Especificaciones (filtros, aceite…)", t:"textarea", full:true },
      { k:"imagen",  l:"Imagen del vehículo", t:"file", full:true,
        accept:"image/*", hint:"Foto del vehículo (se guarda comprimida)" }
    ];
  }
  return [];
}
function fieldHTML(f, value){
  const id = "f_" + f.k;
  const full = f.full ? " full" : "";
  if (f.t === "checkbox"){
    return `<div class="field${full}"><label class="check">
      <input type="checkbox" id="${id}" name="${f.k}" ${value ? "checked" : ""}> ${esc(f.l)}
    </label></div>`;
  }
  if (f.t === "file"){
    const has = value && value.data;
    return `<div class="field${full}">
      <label>${esc(f.l)}</label>
      <input type="file" hidden id="${id}" name="${f.k}" data-filekey="${f.k}"
             accept="${f.accept || "image/*,application/pdf"}">
      <div class="filebox" data-filebox="${f.k}">
        ${has ? fileChipHTML(f.k, value)
              : `<button type="button" class="btn" data-action="pick-file" data-key="${f.k}">
                   ${icon("upload")}Adjuntar archivo</button>`}
      </div>
      ${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}
    </div>`;
  }
  let input;
  if (f.t === "textarea")
    input = `<textarea id="${id}" name="${f.k}" rows="3">${esc(value ?? "")}</textarea>`;
  else if (f.t === "select-vehicle")
    input = `<select id="${id}" name="${f.k}">${
      state.vehicles.map(v => `<option value="${v.id}" ${v.id === value ? "selected" : ""}>${esc(v.nombre)}</option>`).join("")
    }</select>`;
  else if (f.t === "select")
    input = `<select id="${id}" name="${f.k}">${
      (f.options || []).map(o => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")
    }</select>`;
  else
    input = `<input type="${f.t}" id="${id}" name="${f.k}" value="${esc(value ?? "")}"
      ${f.step ? `step="${f.step}"` : ""} ${f.t === "number" ? 'inputmode="decimal"' : ""}>`;
  return `<div class="field${full}">
    <label for="${id}">${esc(f.l)}${f.req ? " *" : ""}</label>
    ${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}
  </div>`;
}
function prevOdometro(vehicleId, fecha, odo, excludeId){
  const all = [
    ...state.fuel.filter(r => r.vehicleId === vehicleId),
    ...state.services.filter(r => r.vehicleId === vehicleId)
  ].filter(r => r.id !== excludeId && Number(r.odometro) > 0)
   .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  let best = 0;
  for (const r of all){
    const o = Number(r.odometro);
    if (o < odo && (r.fecha || "") <= (fecha || "9999")) best = Math.max(best, o);
  }
  return best;
}
function openRecordForm(type, id){
  if (!state.vehicles.length){
    toast("Primero crea un vehículo", "err");
    openVehicleForm();
    return;
  }
  const coll = { fuel: state.fuel, services: state.services,
                 expenses: state.expenses, documents: state.documents }[type];
  const existing = id ? coll.find(r => r.id === id) : null;
  const base = {
    vehicleId: state.settings.vehicle !== "all" ? state.settings.vehicle : state.vehicles[0].id,
    fecha: hoyISO(), coste: "", cantidad: "", odometro: "", distancia: "",
    gasolinera: "", concepto: "", proveedor: "", notas: "", recibo: "",
    parcial: false, faltaLlenado: false,
    tipo: DOC_TIPOS[0], titulo: "", numero: "", emisor: "", vencimiento: ""
  };
  const rec = Object.assign(base, existing || {});
  const titles = { fuel:"Recarga", services:"Servicio", expenses:"Otro gasto", documents:"Documento" };
  const icons  = { fuel:"fuel", services:"wrench", expenses:"receipt", documents:"file" };
  const fields = formFields(type);
  openModal(`
    <div class="modal-head">
      ${icon(icons[type])}
      <h3>${existing ? "Editar" : "Nuevo"} · ${titles[type]}</h3>
      <button class="btn icon ghost" data-action="modal-close">${icon("close")}</button>
    </div>
    <form id="recForm">
      <div class="modal-body"><div class="formgrid">
        ${fields.map(f => fieldHTML(f, rec[f.k])).join("")}
      </div></div>
      <div class="modal-foot">
        <button type="button" class="btn" data-action="modal-close">Cancelar</button>
        <button type="submit" class="btn primary">${icon("check")}Guardar</button>
      </div>
    </form>`, root => {
    const form = $("#recForm", root);
    form._attachments = {};
    fields.filter(f => f.t === "file").forEach(f => {
      if (rec[f.k] && rec[f.k].data) form._attachments[f.k] = rec[f.k];
    });
    const odoEl = form.elements["odometro"];
    const distEl = form.elements["distancia"];
    const vehEl = form.elements["vehicleId"];
    const fechaEl = form.elements["fecha"];
    function recalcular(){
      if (!odoEl || !distEl) return;
      const odo = num(odoEl.value);
      if (!odo) return;
      const prev = prevOdometro(vehEl ? vehEl.value : rec.vehicleId,
                                fechaEl ? fechaEl.value : "", odo, existing ? existing.id : null);
      if (prev && odo > prev) distEl.value = Math.round(odo - prev);
    }
    if (odoEl){ odoEl.addEventListener("change", recalcular); odoEl.addEventListener("blur", recalcular); }
    if (vehEl) vehEl.addEventListener("change", recalcular);
    form.addEventListener("submit", e => {
      e.preventDefault();
      const out = existing ? existing : { id: uid() };
      let fileError = null;
      fields.forEach(f => {
        if (f.t === "file"){ out[f.k] = (form._attachments || {})[f.k] || null; return; }
        const el = form.elements[f.k];
        if (!el) return;
        if (f.t === "checkbox") out[f.k] = el.checked;
        else if (f.t === "number") out[f.k] = el.value === "" ? "" : num(el.value);
        else out[f.k] = el.value.trim();
      });
      for (const f of fields){
        if (f.req && !String(out[f.k] ?? "").trim()){
          toast("El campo «" + f.l + "» es obligatorio", "err");
          const el = form.elements[f.k];
          if (el) el.focus();
          fileError = true; break;
        }
      }
      if (fileError) return;
      if (type !== "documents" && !out.coste && out.coste !== 0){
        toast("Introduce el coste total", "err"); return;
      }
      if (!existing) coll.push(out);
      if (!saveState()){
        if (!existing) coll.splice(coll.indexOf(out), 1);
        return;
      }
      closeModal(); render();
      toast(existing ? "Registro actualizado" : "Registro añadido", "ok");
    });
  });
}
function openVehicleForm(id){
  const existing = id ? vehById(id) : null;
  const v = existing || {
    nombre:"", marca:"", modelo:"", anio:"", licencia:"",
    vin:"", poliza:"", notas:"", especificaciones:"", imagen:null
  };
  const fields = formFields("vehicles");
  openModal(`
    <div class="modal-head">${icon("car")}
      <h3>${existing ? "Editar vehículo" : "Nuevo vehículo"}</h3>
      <button class="btn icon ghost" data-action="modal-close">${icon("close")}</button>
    </div>
    <form id="vehForm">
      <div class="modal-body"><div class="formgrid">
        ${fields.map(f => fieldHTML(f, v[f.k])).join("")}
      </div></div>
      <div class="modal-foot">
        <button type="button" class="btn" data-action="modal-close">Cancelar</button>
        <button type="submit" class="btn primary">${icon("check")}Guardar</button>
      </div>
    </form>`, root => {
    const form = $("#vehForm", root);
    form._attachments = {};
    fields.filter(f => f.t === "file").forEach(f => {
      if (v[f.k] && v[f.k].data) form._attachments[f.k] = v[f.k];
    });
    form.addEventListener("submit", e => {
      e.preventDefault();
      const out = existing ? existing : { id: uid() };
      fields.forEach(f => {
        if (f.t === "file"){ out[f.k] = (form._attachments || {})[f.k] || null; return; }
        const el = form.elements[f.k];
        if (!el) return;
        out[f.k] = f.t === "number" ? (el.value === "" ? "" : num(el.value)) : el.value.trim();
      });
      if (!out.nombre){ toast("El nombre es obligatorio", "err"); return; }
      if (!existing){
        state.vehicles.push(out);
        if (state.settings.vehicle === "all" && state.vehicles.length === 1)
          state.settings.vehicle = out.id;
      }
      if (!saveState()){
        if (!existing) state.vehicles.pop();
        return;
      }
      closeModal(); render();
      toast(existing ? "Vehículo actualizado" : "Vehículo añadido", "ok");
    });
  });
}

/* ============================================================================
   CSV: PARSER E IMPORTACIÓN
   ============================================================================ */
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQ = false, i = 0;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  while (i < text.length){
    const c = text[i];
    if (inQ){
      if (c === '"'){
        if (text[i+1] === '"'){ field += '"'; i += 2; }
        else { inQ = false; i++; }
      } else { field += c; i++; }
    } else {
      if (c === '"'){ inQ = true; i++; }
      else if (c === ","){ row.push(field); field = ""; i++; }
      else if (c === "\r"){ i++; }
      else if (c === "\n"){ row.push(field); rows.push(row); row = []; field = ""; i++; }
      else { field += c; i++; }
    }
  }
  row.push(field); rows.push(row);
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}
const ALIASES = {
  vehicles: {
    nombre:  ["vehiculo", "nombre", "identificacion"],
    marca:   ["marca"], modelo: ["modelo"], anio: ["ano", "year"],
    licencia:["no licencia", "licencia", "matricula", "numero de licencia", "placa"],
    vin:     ["numero de serie", "serie", "vin", "bastidor", "chasis"],
    poliza:  ["numero de poliza", "poliza"],
    notas:   ["notas", "observaciones"],
    especificaciones: ["especificaciones", "specs"]
  },
  fuel: {
    vehicleName: ["vehiculo", "nombre"], fecha: ["fecha"],
    odometro: ["odometro", "kilometraje", "km"],
    distancia: ["distancia", "recorrido"],
    cantidad: ["cantidad", "litros"],
    coste: ["coste total", "coste", "importe", "total"],
    eficiencia: ["eficiencia del combustible", "eficiencia", "rendimiento"],
    parcial: ["recarga parcial", "parcial"],
    faltaLlenado: ["falta llenado", "falta"],
    gasolinera: ["gasolinera", "estacion", "surtidor"],
    tipoCombustible: ["tipo de combustible", "combustible"],
    octanaje: ["octanaje"],
    notas: ["notas", "observaciones"],
    recibo: ["recibo", "comprobante"],
    tipoRegistro: ["tipo de registro"]
  },
  services: {
    vehicleName: ["vehiculo", "nombre"], fecha: ["fecha"],
    odometro: ["odometro", "kilometraje"],
    concepto: ["servicios", "servicio", "descripcion", "concepto"],
    coste: ["coste total", "coste", "importe", "total"],
    proveedor: ["proveedor", "taller"],
    notas: ["notas", "observaciones"], recibo: ["recibo", "comprobante"]
  },
  expenses: {
    vehicleName: ["vehiculo", "nombre"], fecha: ["fecha"],
    concepto: ["otros gastos", "gasto", "concepto", "descripcion"],
    coste: ["coste total", "coste", "importe", "total"],
    proveedor: ["proveedor"],
    notas: ["notas", "observaciones"], recibo: ["recibo", "comprobante"]
  }
};
function buildIndex(headers, aliasMap){
  const H = headers.map(norm);
  const idx = {};
  for (const key in aliasMap){
    const aliases = aliasMap[key];
    let found = -1;
    for (let i = 0; i < H.length && found < 0; i++){
      for (const a of aliases){
        if (H[i] === a || H[i].startsWith(a)){ found = i; break; }
      }
    }
    idx[key] = found;
  }
  return idx;
}
function detectType(headers){
  const H = headers.map(norm);
  const has = x => H.some(h => h === x);
  if (has("marca") || has("modelo") || has("numero de serie")) return "vehicles";
  if (has("gasolinera") || has("cantidad") || has("distancia") || has("octanaje")) return "fuel";
  if (has("otros gastos") || has("gasto")) return "expenses";
  if (has("servicios") || has("servicio")) return "services";
  if (has("odometro") && has("proveedor")) return "services";
  if (has("odometro")) return "fuel";
  return null;
}
function get(row, idx, key){
  const i = idx[key];
  return (i === undefined || i < 0 || i >= row.length) ? "" : String(row[i] ?? "").trim();
}
function parseFile(text){
  const rows = parseCSV(text);
  if (rows.length < 2) return { type: null, error: "El archivo está vacío", count: 0 };
  const headers = rows[0].map(h => String(h).replace(/^"|"$/g, "").trim());
  const type = detectType(headers);
  if (!type) return { type: null, error: "No se reconoce el tipo de archivo", count: 0, headers };
  const idx = buildIndex(headers, ALIASES[type]);
  const data = rows.slice(1);
  if (type === "vehicles"){
    const out = data.map(r => ({
      nombre: get(r, idx, "nombre"), marca: get(r, idx, "marca"),
      modelo: get(r, idx, "modelo"), anio: num(get(r, idx, "anio")) || "",
      licencia: get(r, idx, "licencia"), vin: get(r, idx, "vin"),
      poliza: get(r, idx, "poliza"), notas: get(r, idx, "notas"),
      especificaciones: get(r, idx, "especificaciones"), imagen: null
    })).filter(v => v.nombre);
    return { type, records: out, count: out.length };
  }
  const out = data.map(r => {
    const base = {
      vehicleName: get(r, idx, "vehicleName"),
      fecha: parseFecha(get(r, idx, "fecha")),
      coste: num(get(r, idx, "coste")),
      notas: get(r, idx, "notas"),
      recibo: get(r, idx, "recibo")
    };
    if (type === "fuel"){
      return Object.assign(base, {
        odometro: num(get(r, idx, "odometro")) || "",
        distancia: num(get(r, idx, "distancia")) || "",
        cantidad: num(get(r, idx, "cantidad")) || "",
        gasolinera: get(r, idx, "gasolinera"),
        tipoCombustible: get(r, idx, "tipoCombustible"),
        octanaje: num(get(r, idx, "octanaje")) || "",
        parcial: /^(s[ií]|si|true|1|yes)$/i.test(get(r, idx, "parcial")),
        faltaLlenado: /^(s[ií]|si|true|1|yes)$/i.test(get(r, idx, "faltaLlenado")),
        tipoRegistro: get(r, idx, "tipoRegistro") || "Fuel Record"
      });
    }
    if (type === "services"){
      return Object.assign(base, {
        odometro: num(get(r, idx, "odometro")) || "",
        concepto: get(r, idx, "concepto"),
        proveedor: get(r, idx, "proveedor"),
        documento: null
      });
    }
    return Object.assign(base, {
      concepto: get(r, idx, "concepto"),
      proveedor: get(r, idx, "proveedor"),
      documento: null
    });
  }).filter(r => r.fecha || r.coste || r.cantidad);
  return { type, records: out, count: out.length };
}
let pendingImport = null;
function readFile(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file, "UTF-8");
  });
}
async function handleCSVFiles(files){
  const parsed = [];
  for (const f of files){
    try {
      const text = await readFile(f);
      const res = parseFile(text);
      parsed.push({ file: f.name, ...res });
    } catch (e){
      parsed.push({ file: f.name, error: "No se pudo leer: " + e.message, count: 0 });
    }
  }
  pendingImport = parsed;
  showImportPreview(parsed);
}
function showImportPreview(parsed){
  const names = { vehicles:"Vehículos", fuel:"Recargas", services:"Servicios", expenses:"Otros gastos" };
  const iconNames = { vehicles:"car", fuel:"fuel", services:"wrench", expenses:"receipt" };
  const total = parsed.reduce((a, p) => a + (p.count || 0), 0);
  const items = parsed.map(p => `
    <li>
      ${p.error ? `<svg class="ic" style="color:var(--danger)"><use href="#i-alert"></use></svg>`
                : `<svg class="ic"><use href="#i-${iconNames[p.type] || "file"}"></use></svg>`}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis">${esc(p.file)}</div>
        <div class="muted">${p.error ? esc(p.error) : `${names[p.type] || "?"} · ${p.count} registros`}</div>
      </div></li>`).join("");
  openModal(`
    <div class="modal-head">${icon("upload")}<h3>Importar datos</h3>
      <button class="btn icon ghost" data-action="modal-close">${icon("close")}</button></div>
    <div class="modal-body">
      <p class="muted">Se van a importar <b>${total}</b> registros. Los vehículos que no existan se crearán automáticamente.</p>
      <ul class="importlist">${items}</ul>
      <label class="check" style="margin-top:14px">
        <input type="checkbox" id="impDedupe" checked> Omitir duplicados
      </label>
    </div>
    <div class="modal-foot">
      <button class="btn" data-action="modal-close">Cancelar</button>
      <button class="btn primary" id="impOk" ${total ? "" : "disabled"}>${icon("upload")}Importar</button>
    </div>`);
  $("#impOk").addEventListener("click", () => {
    const dedupe = $("#impDedupe").checked;
    const res = applyImport(pendingImport, dedupe);
    pendingImport = null;
    closeModal(); saveState(); render();
    toast(`Importados ${res.added} registros` + (res.skipped ? ` · ${res.skipped} duplicados omitidos` : ""), "ok", 4500);
  });
}
function applyImport(parsed, dedupe){
  let added = 0, skipped = 0;
  const findVehicle = name => {
    const n = norm(name);
    if (!n) return null;
    let v = state.vehicles.find(x => norm(x.nombre) === n);
    if (!v){
      v = { id: uid(), nombre: String(name).trim(), marca:"", modelo:"", anio:"",
            licencia:"", vin:"", poliza:"", notas:"", especificaciones:"", imagen:null };
      state.vehicles.push(v);
    }
    return v;
  };
  const keyOf = (type, r) => {
    if (type === "fuel") return `f|${r.vehicleId}|${r.fecha}|${r.coste}|${r.cantidad}|${r.odometro}`;
    if (type === "services") return `s|${r.vehicleId}|${r.fecha}|${r.coste}|${norm(r.concepto)}`;
    if (type === "expenses") return `e|${r.vehicleId}|${r.fecha}|${r.coste}|${norm(r.concepto)}`;
    return "";
  };
  const existing = new Set();
  state.fuel.forEach(r => existing.add(keyOf("fuel", r)));
  state.services.forEach(r => existing.add(keyOf("services", r)));
  state.expenses.forEach(r => existing.add(keyOf("expenses", r)));
  const existingVeh = new Set(state.vehicles.map(v => norm(v.nombre)));
  parsed.filter(p => p.type === "vehicles").forEach(p => {
    (p.records || []).forEach(r => {
      const n = norm(r.nombre);
      if (!n) return;
      if (dedupe && existingVeh.has(n)){ skipped++; return; }
      if (!existingVeh.has(n)){
        state.vehicles.push(Object.assign({ id: uid() }, r));
        existingVeh.add(n); added++;
      }
    });
  });
  ["fuel", "services", "expenses"].forEach(type => {
    const coll = state[type];
    parsed.filter(p => p.type === type).forEach(p => {
      (p.records || []).forEach(r => {
        const v = findVehicle(r.vehicleName) ||
                  state.vehicles.find(x => x.id === state.settings.vehicle) ||
                  state.vehicles[0];
        if (!v) return;
        const rec = Object.assign({}, r, { id: uid(), vehicleId: v.id });
        delete rec.vehicleName;
        const k = keyOf(type, rec);
        if (dedupe && existing.has(k)){ skipped++; return; }
        existing.add(k); coll.push(rec); added++;
      });
    });
  });
  return { added, skipped };
}

/* ============================================================================
   EXPORTACIÓN
   ============================================================================ */
function toCSV(headers, rows){
  const esc2 = v => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(esc2).join(","))].join("\r\n");
}
async function exportCSV(type){
  let name, content;
  if (type === "vehicles"){
    name = "Vehiculos.csv";
    content = toCSV(
      ["Vehículo","Marca","Modelo","Año","No. Licencia","Numero de Serie","Numero de Poliza","Notas","Especificaciones","Imagen"],
      state.vehicles.map(v => [v.nombre, v.marca, v.modelo, v.anio, v.licencia, v.vin,
        v.poliza, v.notas, v.especificaciones, v.imagen && v.imagen.data ? "sí" : ""]));
  } else if (type === "fuel"){
    name = "Recargas.csv";
    content = toCSV(
      ["Vehículo","Fecha","Odómetro","Distancia","Cantidad","Coste Total","Recarga Parcial","Falta llenado","Gasolinera","Tipo de Combustible","Octanaje","Notas","Recibo"],
      state.fuel.slice().sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).map(r => [
        vehName(r.vehicleId), r.fecha, r.odometro, r.distancia, r.cantidad, r.coste,
        r.parcial ? "Sí" : "No", r.faltaLlenado ? "Sí" : "No",
        r.gasolinera, r.tipoCombustible, r.octanaje, r.notas, r.recibo]));
  } else if (type === "services"){
    name = "Servicios.csv";
    content = toCSV(
      ["Servicios","Vehículo","Fecha","Odómetro","Coste Total","Proveedor","Notas","Recibo","Documento"],
      state.services.slice().sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).map(r => [
        r.concepto, vehName(r.vehicleId), r.fecha, r.odometro, r.coste, r.proveedor,
        r.notas, r.recibo, r.documento && r.documento.data ? r.documento.name : ""]));
  } else if (type === "expenses"){
    name = "Otros Gastos.csv";
    content = toCSV(
      ["Otros Gastos","Vehículo","Fecha","Coste Total","Proveedor","Notas","Recibo","Documento"],
      state.expenses.slice().sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).map(r => [
        r.concepto, vehName(r.vehicleId), r.fecha, r.coste, r.proveedor,
        r.notas, r.recibo, r.documento && r.documento.data ? r.documento.name : ""]));
  } else if (type === "documents"){
    name = "Documentos.csv";
    content = toCSV(
      ["Tipo","Vehículo","Título","Número","Emisor","Fecha","Vencimiento","Coste","Notas","Archivo"],
      state.documents.slice().sort((a,b)=>(a.vencimiento||"9999").localeCompare(b.vencimiento||"9999")).map(r => [
        r.tipo, vehName(r.vehicleId), r.titulo, r.numero, r.emisor, r.fecha,
        r.vencimiento, r.coste, r.notas, r.archivo && r.archivo.data ? r.archivo.name : ""]));
  }
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const res = await saveFileWithPicker(blob, name, "text/csv");
  if (res === "cancel") return;
  toast(res === "picker" ? "Archivo guardado" : "Archivo descargado", "ok");
}
async function exportJSON(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const filename = "garaje-backup-" + hoyISO() + ".json";
  const res = await saveFileWithPicker(blob, filename, "application/json");
  if (res === "cancel") return;
  toast(res === "picker" ? "Copia guardada en la ubicación elegida" : "Copia descargada", "ok");
}

/* ============================================================================
   ACCIONES
   ============================================================================ */
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  switch (a){
    case "nav": currentView = el.dataset.view; render(); break;
    case "modal-close": closeModal(); break;
    case "new": openRecordForm(el.dataset.type); break;
    case "quick-new": {
      const items = [
        ["fuel","Nueva recarga", "fuel"],
        ["services","Nuevo servicio", "wrench"],
        ["expenses","Nuevo gasto", "receipt"],
        ["documents","Nuevo documento", "file"]
      ];
      openModal(`
        <div class="modal-head">${icon("plus")}<h3>¿Qué quieres registrar?</h3></div>
        <div class="modal-body" style="display:grid;gap:10px">
          ${items.map(([t, l, ic]) => `<button class="btn" style="justify-content:flex-start;padding:14px"
            data-action="quick-pick" data-type="${t}">${icon(ic)} ${l}</button>`).join("")}
        </div>`);
      break;
    }
    case "quick-pick": closeModal(); openRecordForm(el.dataset.type); break;
    case "new-vehicle": openVehicleForm(); break;
    case "edit": openRecordForm(el.dataset.type, el.dataset.id); break;
    case "edit-vehicle": openVehicleForm(el.dataset.id); break;
    case "page": {
      const t = el.dataset.type;
      pageState[t] = parseInt(el.dataset.page, 10) || 1;
      const host = $("#tableHost");
      if (host){
        host.innerHTML = renderListBody(t);
        host.scrollTop = 0;
      }
      break;
    }
    case "pick-file": {
      const form = el.closest("form");
      if (!form) break;
      const input = form.querySelector(`input[data-filekey="${el.dataset.key}"]`);
      if (input) input.click();
      break;
    }
    case "remove-file": {
      const form = el.closest("form");
      if (!form) break;
      const key = el.dataset.key;
      if (form._attachments) delete form._attachments[key];
      refreshFileBox(form, key);
      break;
    }
    case "view-file": {
      const form = el.closest("form");
      if (!form) break;
      openAttachment((form._attachments || {})[el.dataset.key]);
      break;
    }
    case "view-att":
      openAttachment(findAttachment(el.dataset.type, el.dataset.id, el.dataset.key));
      break;
    case "del": {
      const t = el.dataset.type, id = el.dataset.id;
      const coll = { fuel: state.fuel, services: state.services,
                     expenses: state.expenses, documents: state.documents }[t];
      const rec = coll.find(r => r.id === id);
      if (!rec) return;
      const desc = t === "documents" ? (rec.tipo + (rec.titulo ? " · " + rec.titulo : ""))
                                     : `${fmtFecha(rec.fecha)} — ${money(rec.coste)}`;
      const ok = await askConfirm("Eliminar registro",
        `¿Eliminar <b>${esc(desc)}</b>?<br><span class="muted">Esta acción no se puede deshacer.</span>`);
      if (!ok) return;
      coll.splice(coll.indexOf(rec), 1);
      saveState(); render(); toast("Registro eliminado", "ok");
      break;
    }
    case "del-vehicle": {
      const id = el.dataset.id;
      const v = vehById(id);
      if (!v) return;
      const n = state.fuel.filter(r => r.vehicleId === id).length +
                state.services.filter(r => r.vehicleId === id).length +
                state.expenses.filter(r => r.vehicleId === id).length +
                state.documents.filter(r => r.vehicleId === id).length;
      const ok = await askConfirm("Eliminar vehículo",
        `¿Eliminar <b>${esc(v.nombre)}</b>?` +
        (n ? `<br><span class="muted">Se eliminarán también sus ${n} registros asociados.</span>` : ""));
      if (!ok) return;
      state.vehicles = state.vehicles.filter(x => x.id !== id);
      state.fuel      = state.fuel.filter(r => r.vehicleId !== id);
      state.services  = state.services.filter(r => r.vehicleId !== id);
      state.expenses  = state.expenses.filter(r => r.vehicleId !== id);
      state.documents = state.documents.filter(r => r.vehicleId !== id);
      if (state.settings.vehicle === id) state.settings.vehicle = "all";
      saveState(); render(); toast("Vehículo eliminado", "ok");
      break;
    }
    case "export-csv":  exportCSV(el.dataset.type); break;
    case "export-json": exportJSON(); break;
    case "import-json": $("#jsonInput").click(); break;
    case "change-folder": chooseBackupFolder(); break;
    case "forget-folder": forgetBackupFolder(); break;
    case "save-folder": {
      const res = await writeBackupToFolder();
      if (res){
        toast(`Copia guardada en «${res.folder}»: ${res.name}`, "ok", 4500);
        render();
      }
      break;
    }
    case "import-folder": restoreFromFolder(); break;
    case "pick-backup": {
      const files = window._backupFiles || [];
      const f = files[parseInt(el.dataset.index, 10)];
      if (!f) break;
      closeModal();
      restoreFromFile(f);
      break;
    }
    case "clear-all": {
      const ok = await askConfirm("Borrar todos los datos",
        "Se eliminarán <b>todos</b> los vehículos, recargas, servicios, gastos y documentos guardados en este navegador." +
        "<br><span class='muted'>Te recomendamos descargar antes una copia de seguridad.</span>",
        "Borrar todo");
      if (!ok) return;
      state = clone(DEFAULT_STATE);
      pageState = { fuel:1, services:1, expenses:1, documents:1 };
      saveState(); render(); toast("Todos los datos han sido borrados", "ok");
      break;
    }
  }
});

document.addEventListener("input", e => {
  const el = e.target.closest("[data-search]");
  if (!el) return;
  const type = el.dataset.search;
  searchTerm[type] = el.value;
  pageState[type] = 1;
  const host = document.getElementById("tableHost");
  if (host){
    host.innerHTML = renderListBody(type);
    host.scrollTop = 0;
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "vehicleSelect"){
    state.settings.vehicle = e.target.value;
    pageState = { fuel:1, services:1, expenses:1, documents:1 };
    saveState(); render();
  }
});

document.addEventListener("change", e => {
  const fi = e.target.closest("input[type=file][data-filekey]");
  if (fi) handleFilePick(fi);
});

$("#themeBtn").addEventListener("click", () => {
  const order = ["auto", "light", "dark"];
  const i = order.indexOf(state.settings.theme);
  state.settings.theme = order[(i + 1) % order.length];
  saveState(); applyTheme();
  toast("Tema: " + ({ auto:"automático", light:"claro", dark:"oscuro" })[state.settings.theme], "info", 1600);
});

$("#fab").addEventListener("click", () => {
  const map = { fuel:"fuel", services:"services", expenses:"expenses", documents:"documents" };
  openRecordForm(map[currentView] || "fuel");
});

/* ============================================================================
   IMPORTACIÓN CSV + RESTAURAR
   ============================================================================ */
document.addEventListener("click", e => {
  if (e.target.closest("#dropzone")) $("#csvInput").click();
});
document.addEventListener("change", e => {
  if (e.target.id === "csvInput" && e.target.files.length){
    handleCSVFiles(Array.from(e.target.files));
    e.target.value = "";
  }
  if (e.target.id === "jsonInput" && e.target.files.length){
    const file = e.target.files[0];
    e.target.value = "";
    restoreFromFile(file);
  }
});
document.addEventListener("dragover", e => {
  const dz = e.target.closest("#dropzone");
  if (dz){ e.preventDefault(); dz.classList.add("over"); }
});
document.addEventListener("dragleave", e => {
  const dz = e.target.closest("#dropzone");
  if (dz) dz.classList.remove("over");
});
document.addEventListener("drop", e => {
  const dz = e.target.closest("#dropzone");
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove("over");
  const files = Array.from(e.dataTransfer.files).filter(f => /\.csv$/i.test(f.name));
  if (!files.length){ toast("Suelta archivos .csv", "err"); return; }
  handleCSVFiles(files);
});

/* ============================================================================
   INSTALACIÓN PWA
   ============================================================================ */
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstall = e;
  $("#installBtn").hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  $("#installBtn").hidden = true;
  toast("¡Aplicación instalada!", "ok");
});
$("#installBtn").addEventListener("click", async () => {
  if (deferredInstall){
    deferredInstall.prompt();
    const res = await deferredInstall.userChoice;
    if (res.outcome === "accepted") toast("Instalando…", "ok");
    deferredInstall = null;
    $("#installBtn").hidden = true;
  } else {
    openModal(`
      <div class="modal-head">${icon("install")}<h3>Instalar la aplicación</h3>
        <button class="btn icon ghost" data-action="modal-close">${icon("close")}</button></div>
      <div class="modal-body">
        <p style="margin-bottom:12px">Tu navegador no ofrece el diálogo automático. Puedes instalarla manualmente:</p>
        <p style="margin-bottom:8px"><b>Chrome / Edge (escritorio):</b> menú <kbd>⋮</kbd> → «Instalar aplicación».</p>
        <p style="margin-bottom:8px"><b>Android (Chrome):</b> menú <kbd>⋮</kbd> → «Añadir a pantalla de inicio».</p>
        <p><b>iPhone / iPad (Safari):</b> botón Compartir → «Añadir a pantalla de inicio».</p>
      </div>`);
  }
});

/* ============================================================================
   SERVICE WORKER
   ============================================================================ */
if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./" })
      .catch(err => console.warn("[SW] Registro fallido:", err));
  });
}

/* ============================================================================
   INICIALIZACIÓN
   ============================================================================ */
function init(){
  applyTheme();
  render();
  loadBackupDir();
  document.addEventListener("keydown", e => {
    if (modalOpen) return;
    if (e.target.matches("input,textarea,select")) return;
    if (e.key === "n" && !e.ctrlKey && !e.metaKey){
      const map = { fuel:"fuel", services:"services", expenses:"expenses", documents:"documents" };
      if (map[currentView]){ e.preventDefault(); openRecordForm(map[currentView]); }
    }
  });
}
init();