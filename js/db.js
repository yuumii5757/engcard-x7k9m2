// ─── IndexedDB Data Layer ───────────────────────────────────────
const DB_NAME = 'FlashcardsDB';
const DB_VERSION = 1;
const STORE_NAME = 'cards';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('genre', 'genre', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, callback) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const result = callback(store);
      transaction.oncomplete = () => resolve(result._value);
      transaction.onerror = () => reject(transaction.error);
      if (result instanceof IDBRequest) {
        result.onsuccess = () => {
          result._value = result.result;
        };
      }
    });
  });
}

// ─── CRUD ──────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function addCard(japanese, english, genre, memo) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite');
    const store = t.objectStore(STORE_NAME);
    const card = {
      id: generateId(),
      japanese: japanese.trim(),
      english: english.trim(),
      genre: genre.trim(),
      memo: (memo || '').trim(),
      favorite: false,
      wrongCount: 0,
      lastAnswered: null
    };
    store.add(card);
    t.oncomplete = () => resolve(card);
    t.onerror = () => reject(t.error);
  });
}

async function getCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly');
    const req = t.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function updateCard(card) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite');
    t.objectStore(STORE_NAME).put(card);
    t.oncomplete = () => resolve(card);
    t.onerror = () => reject(t.error);
  });
}

async function deleteCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite');
    t.objectStore(STORE_NAME).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function getAllCards() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly');
    const req = t.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Get cards matching a genre (supports comma-separated genre field)
async function getCardsByGenre(genre) {
  const cards = await getAllCards();
  return cards.filter(c => {
    const genres = c.genre.split(/[,、]/).map(g => g.trim());
    return genres.includes(genre);
  });
}

async function getGenres() {
  const cards = await getAllCards();
  const set = new Set();
  cards.forEach(c => {
    c.genre.split(/[,、]/).map(g => g.trim()).filter(Boolean).forEach(g => set.add(g));
  });
  return [...set].sort();
}

async function toggleFavorite(id) {
  const card = await getCard(id);
  if (!card) return null;
  card.favorite = !card.favorite;
  await updateCard(card);
  return card;
}

async function getFavoriteCards() {
  const cards = await getAllCards();
  return cards.filter(c => c.favorite);
}

async function getMissCards() {
  const cards = await getAllCards();
  return cards.filter(c => (c.wrongCount || 0) > 0)
    .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
}

async function resetAllWrongCounts() {
  const cards = await getAllCards();
  const missCards = cards.filter(c => (c.wrongCount || 0) > 0);
  for (const card of missCards) {
    card.wrongCount = 0;
    await updateCard(card);
  }
  return missCards.length;
}

// ─── Export / Import ────────────────────────────────────────────

async function exportJSON() {
  const cards = await getAllCards();
  return JSON.stringify(cards, null, 2);
}

async function importJSON(jsonString) {
  const cards = JSON.parse(jsonString);
  if (!Array.isArray(cards)) throw new Error('Invalid format');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite');
    const store = t.objectStore(STORE_NAME);
    cards.forEach(card => {
      if (!card.id) card.id = generateId();
      if (card.wrongCount === undefined) card.wrongCount = 0;
      if (card.lastAnswered === undefined) card.lastAnswered = null;
      if (card.memo === undefined) card.memo = '';
      if (card.favorite === undefined) card.favorite = false;
      store.put(card);
    });
    t.oncomplete = () => resolve(cards.length);
    t.onerror = () => reject(t.error);
  });
}
