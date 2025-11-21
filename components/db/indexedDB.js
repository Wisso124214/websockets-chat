/**
 * IndexedDB helper para persistir mensajes de chat.
 * Esquema:
 *  DB: chatdb (versión 2)
 *  Store: messages
 *  Campos: { id, sessionId, chatId, direction, type, title, text, fileName, blob, createdAt }
 *
 * Índices (v1 y v2):
 *  - chatId
 *  - createdAt
 *  - chatId_createdAt (compuesto)
 *  - sessionId (v2)
 *  - sessionId_chatId (v2)
 *  - sessionId_chatId_createdAt (v2 compuesto)
 *
 * Compatibilidad legacy:
 *  - Métodos intentan usar índices compuestos modernos y caen a índices simples para datos antiguos.
 *  - cleanups evitan borrar mensajes de sesiones recientes cuando operan sobre índices legacy.
 */

const DB_NAME = 'chatdb';
const DB_VERSION = 2;
const STORE = 'messages';

let dbPromise = null;

/**
 * Abre (o inicializa) la base de datos y asegura índices requeridos.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      let store;
      if (!db.objectStoreNames.contains(STORE)) {
        store = db.createObjectStore(STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
      } else {
        store = req.transaction.objectStore(STORE);
      }
      // Asegurar índices v1 existentes
      if (!store.indexNames.contains('chatId'))
        store.createIndex('chatId', 'chatId', { unique: false });
      if (!store.indexNames.contains('createdAt'))
        store.createIndex('createdAt', 'createdAt', { unique: false });
      if (!store.indexNames.contains('chatId_createdAt')) {
        try {
          store.createIndex('chatId_createdAt', ['chatId', 'createdAt'], {
            unique: false,
          });
        } catch (_) {
          // algunos navegadores antiguos pueden no soportar índices compuestos
        }
      }
      // Índices v2 con soporte de múltiples sesiones
      if (!store.indexNames.contains('sessionId'))
        store.createIndex('sessionId', 'sessionId', { unique: false });
      if (!store.indexNames.contains('sessionId_chatId'))
        store.createIndex('sessionId_chatId', ['sessionId', 'chatId'], {
          unique: false,
        });
      if (!store.indexNames.contains('sessionId_chatId_createdAt')) {
        try {
          store.createIndex(
            'sessionId_chatId_createdAt',
            ['sessionId', 'chatId', 'createdAt'],
            { unique: false }
          );
        } catch (_) {
          // compuesto no soportado en navegadores muy antiguos
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/**
 * Persiste un mensaje (texto o archivo) asignando valores por defecto.
 * @param {Object} record Datos del mensaje a guardar.
 * @param {string} [record.sessionId]
 * @param {string|null} [record.chatId]
 * @param {'in'|'out'} [record.direction]
 * @param {'text'|'file'} [record.type]
 * @param {string} [record.title]
 * @param {string} [record.text]
 * @param {string} [record.fileName]
 * @param {Blob|null} [record.blob]
 * @param {number} [record.createdAt]
 * @returns {Promise<number>} id autoincremental asignado.
 */
export async function saveMessage(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const now = Date.now();
    const data = {
      sessionId:
        (record && record.sessionId) ||
        (typeof window !== 'undefined' &&
          (window.sessionId || window.clientId)) ||
        'default',
      chatId: null,
      direction: 'in', // 'in' | 'out'
      type: 'text', // 'text' | 'file'
      title: '',
      text: '',
      fileName: '',
      blob: null,
      createdAt: now,
      ...record,
      sessionId:
        record?.sessionId ||
        (typeof window !== 'undefined' &&
          (window.sessionId || window.clientId)) ||
        'default',
      createdAt: record?.createdAt ?? now,
    };
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Obtiene mensajes por chat (y sesión si existe índice compuesto).
 * Usa `sessionId_chatId_createdAt` si disponible; cae a índices legacy.
 * @param {string} chatId
 * @param {string} [sessionId]
 * @returns {Promise<Object[]>} Lista de mensajes ordenados por createdAt.
 */
export async function getMessagesByChat(chatId, sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const currentSessionId =
      sessionId ||
      (typeof window !== 'undefined' &&
        (window.sessionId || window.clientId)) ||
      'default';
    const hasSessionCompound = store.indexNames.contains(
      'sessionId_chatId_createdAt'
    );
    let useCompound = store.indexNames.contains('chatId_createdAt');
    let results = [];

    if (hasSessionCompound) {
      const index = store.index('sessionId_chatId_createdAt');
      const range = IDBKeyRange.bound(
        [currentSessionId, chatId, -Infinity],
        [currentSessionId, chatId, Infinity]
      );
      const req = index.openCursor(range, 'next');
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          if (results.length > 0) return resolve(results);
          // Fallback: intentar datos legacy (sin sessionId)
          if (store.indexNames.contains('chatId')) {
            const idx = store.index('chatId');
            const r = IDBKeyRange.only(chatId);
            const req2 = idx.openCursor(r, 'next');
            req2.onsuccess = (ev) => {
              const c = ev.target.result;
              if (c) {
                const v = c.value || {};
                if (!('sessionId' in v)) results.push(v);
                c.continue();
              } else {
                results.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                resolve(results);
              }
            };
            req2.onerror = () => resolve(results);
          } else {
            resolve(results);
          }
        }
      };
      req.onerror = () => reject(req.error);
    } else if (useCompound) {
      const index = store.index('chatId_createdAt');
      const range = IDBKeyRange.bound([chatId, -Infinity], [chatId, Infinity]);
      const req = index.openCursor(range, 'next');
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    } else {
      const index = store.index('chatId');
      const range = IDBKeyRange.only(chatId);
      const req = index.openCursor(range, 'next');
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          results.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    }
  });
}

/**
 * Limpia todos los mensajes del store (todas las sesiones).
 * @returns {Promise<void>}
 */
export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina todos los mensajes de un chat (scoped a sesión si índice compuesto existe).
 * @param {string} chatId
 * @param {string} [sessionId]
 * @returns {Promise<void>}
 */
export async function deleteMessagesByChat(chatId, sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const currentSessionId =
      sessionId ||
      (typeof window !== 'undefined' &&
        (window.sessionId || window.clientId)) ||
      'default';
    let index;
    let range;
    if (store.indexNames.contains('sessionId_chatId_createdAt')) {
      index = store.index('sessionId_chatId_createdAt');
      range = IDBKeyRange.bound(
        [currentSessionId, chatId, -Infinity],
        [currentSessionId, chatId, Infinity]
      );
    } else if (store.indexNames.contains('chatId_createdAt')) {
      index = store.index('chatId_createdAt');
      range = IDBKeyRange.bound([chatId, -Infinity], [chatId, Infinity]);
    } else {
      index = store.index('chatId');
      range = IDBKeyRange.only(chatId);
    }
    const toDeleteKeys = [];
    const req = index.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const v = cursor.value || {};
        // En legacy cleanup, evita borrar mensajes de nuevas sesiones
        if (
          index.name === 'chatId' &&
          'sessionId' in v &&
          v.sessionId !== undefined
        ) {
          cursor.continue();
          return;
        }
        toDeleteKeys.push(cursor.primaryKey);
        cursor.continue();
      } else {
        if (toDeleteKeys.length === 0) return resolve();
        let pending = toDeleteKeys.length;
        toDeleteKeys.forEach((key) => {
          const delReq = store.delete(key);
          delReq.onsuccess = () => {
            pending -= 1;
            if (pending === 0) resolve();
          };
          delReq.onerror = () => reject(delReq.error);
        });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina todos los mensajes pertenecientes a una sesión específica.
 * Si no hay índice `sessionId` (v1), limpia todo el store.
 * @param {string} [sessionId]
 * @returns {Promise<void>}
 */
export async function clearBySession(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const currentSessionId =
      sessionId ||
      (typeof window !== 'undefined' &&
        (window.sessionId || window.clientId)) ||
      'default';
    if (!store.indexNames.contains('sessionId')) {
      // Si no existe índice por sesión, limpiar todo (comportamiento v1)
      const reqAll = store.clear();
      reqAll.onsuccess = () => resolve();
      reqAll.onerror = () => reject(reqAll.error);
      return;
    }
    const index = store.index('sessionId');
    const range = IDBKeyRange.only(currentSessionId);
    const keys = [];
    const req = index.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        keys.push(cursor.primaryKey);
        cursor.continue();
      } else {
        if (!keys.length) return resolve();
        let pending = keys.length;
        keys.forEach((k) => {
          const delReq = store.delete(k);
          delReq.onsuccess = () => {
            pending -= 1;
            if (pending === 0) resolve();
          };
          delReq.onerror = () => reject(delReq.error);
        });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lista las sesiones distintas presentes en el store (por sessionId) con última actividad.
 * Si no existe índice `sessionId`, recorre todos los registros y agrupa por sessionId (o 'default').
 * @returns {Promise<Array<{sessionId:string,lastActivity:number}>>}
 */
export async function listSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const sessionsMap = new Map();
    const finish = () => {
      const arr = Array.from(sessionsMap.entries()).map(
        ([sessionId, lastActivity]) => ({
          sessionId,
          lastActivity: lastActivity || 0,
        })
      );
      arr.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
      resolve(arr);
    };

    if (store.indexNames.contains('sessionId')) {
      const index = store.index('sessionId');
      const req = index.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const v = cursor.value || {};
          const sid = v.sessionId || 'default';
          const ts = v.createdAt || 0;
          const prev = sessionsMap.get(sid) || 0;
          if (ts > prev) sessionsMap.set(sid, ts);
          cursor.continue();
        } else {
          finish();
        }
      };
      req.onerror = () => reject(req.error);
    } else {
      // Sin índice, recorrer todo
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const v = cursor.value || {};
          const sid = v.sessionId || 'default';
          const ts = v.createdAt || 0;
          const prev = sessionsMap.get(sid) || 0;
          if (ts > prev) sessionsMap.set(sid, ts);
          cursor.continue();
        } else {
          finish();
        }
      };
      req.onerror = () => reject(req.error);
    }
  });
}

/**
 * Elimina toda la información asociada a una sesión (wrapping de clearBySession).
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  return clearBySession(sessionId);
}

/**
 * Obtiene un resumen de chats (por chatId) para una sesión, incluyendo último mensaje y título sugerido.
 * @param {string} [sessionId]
 * @returns {Promise<Array<{chatId:string,lastMessage:string,lastType:'text'|'file',lastTitle:string,lastCreatedAt:number}>>}
 */
export async function getChatsSummaryBySession(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const currentSessionId =
      sessionId ||
      (typeof window !== 'undefined' &&
        (window.sessionId || window.clientId)) ||
      'default';
    const map = new Map();

    const finalize = () => {
      const arr = Array.from(map.values());
      arr.sort((a, b) => (b.lastCreatedAt || 0) - (a.lastCreatedAt || 0));
      resolve(arr);
    };

    const processRecord = (v) => {
      if (!v) return;
      const cid = v.chatId == null ? null : String(v.chatId);
      if (!cid) return;
      const prev = map.get(cid) || {
        chatId: cid,
        lastMessage: '',
        lastType: 'text',
        lastTitle: '',
        lastCreatedAt: 0,
      };
      // Preferir el registro más reciente
      if ((v.createdAt || 0) >= (prev.lastCreatedAt || 0)) {
        const lastMessage =
          v.type === 'text' ? v.text || '' : v.fileName || 'Archivo';
        const lastType = v.type === 'file' ? 'file' : 'text';
        // Alias sugerido: usar título de mensajes entrantes si existe; si no, dejar previo
        const titleCandidate =
          v.direction !== 'out' ? v.title || '' : prev.lastTitle;
        map.set(cid, {
          chatId: cid,
          lastMessage,
          lastType,
          lastTitle: titleCandidate || prev.lastTitle || '',
          lastCreatedAt: v.createdAt || 0,
        });
      } else if (!prev.lastTitle && v.direction !== 'out' && v.title) {
        // Completar alias si aún no existe
        prev.lastTitle = v.title;
        map.set(cid, prev);
      }
    };

    if (store.indexNames.contains('sessionId')) {
      const index = store.index('sessionId');
      const range = IDBKeyRange.only(currentSessionId);
      const req = index.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          processRecord(cursor.value);
          cursor.continue();
        } else {
          finalize();
        }
      };
      req.onerror = () => reject(req.error);
    } else {
      // Sin índice: recorrer todo y filtrar por sessionId si existe en registros
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const v = cursor.value || {};
          if (!('sessionId' in v) || v.sessionId === currentSessionId) {
            processRecord(v);
          }
          cursor.continue();
        } else {
          finalize();
        }
      };
      req.onerror = () => reject(req.error);
    }
  });
}

/**
 * Obtiene todos los mensajes de una sesión (ordenados por createdAt asc).
 * @param {string} [sessionId]
 * @returns {Promise<Array<Object>>}
 */
export async function getMessagesBySession(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const currentSessionId =
      sessionId ||
      (typeof window !== 'undefined' &&
        (window.sessionId || window.clientId)) ||
      'default';
    const results = [];
    const push = (v) => {
      if (v && v.chatId != null) results.push(v);
    };
    const finalize = () => {
      results.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(results);
    };
    if (store.indexNames.contains('sessionId')) {
      const index = store.index('sessionId');
      const range = IDBKeyRange.only(currentSessionId);
      const req = index.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          push(cursor.value);
          cursor.continue();
        } else finalize();
      };
      req.onerror = () => reject(req.error);
    } else {
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const v = cursor.value || {};
          if (!('sessionId' in v) || v.sessionId === currentSessionId) push(v);
          cursor.continue();
        } else finalize();
      };
      req.onerror = () => reject(req.error);
    }
  });
}
