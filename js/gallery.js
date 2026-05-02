// Tiny IndexedDB wrapper for the gallery. Stores parameters plus a
// thumbnail dataURL. Caps at 200 entries with FIFO eviction.

const DB_NAME = "pequod-wallpapers";
const STORE = "gallery";
const VERSION = 1;
const MAX_ENTRIES = 200;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        os.createIndex("ts", "timestamp");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveEntry(entry) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const os = tx.objectStore(STORE);
  os.add({ ...entry, timestamp: Date.now() });
  await txDone(tx);
  await evictIfNeeded();
  db.close();
}

export async function listEntries() {
  const db = await open();
  const tx = db.transaction(STORE, "readonly");
  const os = tx.objectStore(STORE);
  const req = os.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      db.close();
      const out = req.result || [];
      out.sort((a, b) => b.timestamp - a.timestamp);
      resolve(out);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteEntry(id) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function exportGalleryJSON() {
  const entries = await listEntries();
  // Strip thumbnails to keep the file small.
  const lite = entries.map(({ thumbnail, id, ...rest }) => rest);
  return JSON.stringify(lite, null, 2);
}

async function evictIfNeeded() {
  const entries = await listEntries();
  if (entries.length <= MAX_ENTRIES) return;
  const drop = entries.slice(MAX_ENTRIES);
  for (const e of drop) {
    await deleteEntry(e.id);
  }
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
