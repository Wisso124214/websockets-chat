/**
 * client.js
 * ----------------------------------------------
 * Cliente principal del chat WebSocket.
 * - Establece la conexión WebSocket y gestiona eventos (open, message, close, error).
 * - Solicita al usuario un alias y lo envía al servidor.
 * - Administra la creación y actualización visual de chats (usuarios y grupos).
 * - Persiste mensajes (texto y archivos) en IndexedDB para cada sesión/Chat.
 * - Expone una pequeña API global para operaciones con grupos (crear, añadir, remover, eliminar).
 *
 * Principios de legibilidad aplicados:
 * - Nombres descriptivos y consistentes (camelCase para funciones/variables).
 * - Comentarios orientados al "por qué" y organización por secciones.
 * - Uso de constantes para valores configurables (host/puerto).
 * - Estructura simple de switch por tipo de mensaje recibido.
 */
import MainScreen from './screens/mainScreen/MainScreen.js';
import ModalInput from './components/modalInput/modalInput.js';
import ChatScreen from './screens/chatScreen/ChatScreen.js';
import {
  saveMessage,
  listSessions,
  deleteSession,
  getChatsSummaryBySession,
} from './components/db/indexedDB.js';
import { getMessagesBySession } from './components/db/indexedDB.js';

// === CONFIGURACIÓN BÁSICA DE CONEXIÓN ===
// Para desarrollo local con Live Server (HTTP en 127.0.0.1:5500)
// el servidor WebSocket corre por separado.
const WS_PORT = 8081;
const WS_HOST = location.hostname || '127.0.0.1';
const wsUri = `ws://${WS_HOST}:${WS_PORT}/`;
let websocket = null;

const modalInput = document.querySelector('wsc-modal-input');

window.clientId = null;
// Identificador lógico de la sesión (persistente entre reconexiones).
window.sessionId = null;
let date = null;
let fromClientAlias;
let selectedExistingSession = false; // Solo reconstruir chats si el usuario escogió una sesión previa

// === RECONEXIÓN AUTOMÁTICA ===
// Estrategia: backoff exponencial simple (1s, 2s, 4s, ... máx 30s).
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30s
let manualClose = false; // Para distinguir cierre intencional (navegación) de caída.
let reconnectTimeoutId = null;

function scheduleReconnect() {
  if (manualClose) return; // No reconectar si el usuario salió.
  if (reconnectTimeoutId) return; // Ya programado.
  const delay = Math.min(
    1000 * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  reconnectAttempts += 1;
  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    connectWebSocket();
  }, delay);
}

function resetReconnectState() {
  reconnectAttempts = 0;
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

// Generador de identificadores de sesión estables (independientes del id de conexión del servidor).
function generateSessionId() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

// === SESIONES GUARDADAS (alias <-> sessionId) ===
const SESS_KEY = 'wsc_sessions_meta_v1';
function getSessionsMeta() {
  try {
    const raw = localStorage.getItem(SESS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x) => x && typeof x.sessionId === 'string' && typeof x.alias === 'string'
    );
  } catch {
    return [];
  }
}
function setSessionsMeta(arr) {
  try {
    localStorage.setItem(SESS_KEY, JSON.stringify(arr || []));
  } catch {}
}
function upsertSessionMeta(sessionId, alias) {
  const arr = getSessionsMeta();
  const idx = arr.findIndex((x) => x.sessionId === sessionId);
  if (idx >= 0) arr[idx].alias = alias;
  else arr.push({ sessionId, alias });
  setSessionsMeta(arr);
}
function removeSessionMeta(sessionId) {
  const arr = getSessionsMeta().filter((x) => x.sessionId !== sessionId);
  setSessionsMeta(arr);
}

// Garantiza alias único agregando sufijo " (n)" si ya existe uno igual.
function ensureUniqueAlias(rawAlias) {
  const meta = getSessionsMeta();
  const alias = String(rawAlias || '').trim();
  if (!alias) return alias;
  // Quitar sufijo numérico si el usuario lo escribió manualmente para aplicar la lógica base
  const match = alias.match(/^(.*?)(?:\s*\((\d+)\))?$/);
  let base = match ? match[1].trim() : alias;
  if (!base) base = alias;
  // Escapar base para regex
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${esc}(?: \(\d+\))?$`);
  const duplicates = meta.filter((m) => pattern.test(m.alias));
  if (duplicates.length === 0) return base; // Primer alias, sin sufijo
  // Buscar máximo sufijo existente para evitar colisiones en caso de huecos
  let maxN = 1; // alias base cuenta como 1
  duplicates.forEach((d) => {
    const m2 = d.alias.match(/^.*? \((\d+)\)$/);
    if (m2) {
      const n = parseInt(m2[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  });
  // Nuevo alias será base + (maxN+1) si existe base limpio o cualquier sufijo
  return `${base} (${maxN + 1})`;
}

async function getSavedSessionsCombined() {
  let ids = [];
  try {
    ids = await listSessions();
  } catch {
    ids = [];
  }
  const meta = getSessionsMeta();
  const metaMap = new Map(meta.map((m) => [m.sessionId, m.alias]));
  // Merge, attach alias if known
  const merged = ids.map((it) => ({
    sessionId: it.sessionId,
    alias: metaMap.get(it.sessionId) || null,
    lastActivity: it.lastActivity || 0,
  }));
  // Include any meta sessions that might not appear in DB (edge)
  meta.forEach((m) => {
    if (!merged.find((x) => x.sessionId === m.sessionId)) {
      merged.push({ sessionId: m.sessionId, alias: m.alias, lastActivity: 0 });
    }
  });
  // Beautify alias if missing
  merged.forEach((m) => {
    if (!m.alias) {
      const short = m.sessionId?.slice?.(0, 6) || 'sesión';
      m.alias = `Usuario ${short}`;
    }
  });
  // Sort by lastActivity desc
  merged.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
  return merged;
}

async function promptSessionSelectionIfAny() {
  const items = await getSavedSessionsCombined();
  if (!items || items.length === 0) return null;
  if (!modalInput) return null;

  let current = items.slice();
  const selected = await modalInput.waitForSelection(current, {
    message: 'Selecciona una sesión guardada',
    onDelete: async (item, index) => {
      try {
        // Confirmar borrado
        const confirm = await modalInput.waitForConfirm(
          `¿Eliminar la sesión "${item.alias}" y sus mensajes?`,
          'Eliminar',
          'Cancelar'
        );
        if (!confirm) return;
        await deleteSession(item.sessionId);
        removeSessionMeta(item.sessionId);
        current.splice(index, 1);
        if (current.length === 0) {
          // No quedan sesiones: cerrar modal y forzar nuevo alias
          modalInput.changeVisibility(false);
          modalInput.cleanup?.();
          let alias;
          do {
            alias = await modalInput.waitForInput('Enter your alias:');
          } while (!alias);
          if (alias) {
            alias = toUpperCaseFirstLetter(alias);
            alias = ensureUniqueAlias(alias);
            window.clientAlias = alias;
            window.sessionId = generateSessionId();
            upsertSessionMeta(window.sessionId, alias);
          }
          return;
        }
        modalInput.mode = 'list';
        modalInput._listItems = current;
        modalInput.render();
        modalInput.changeVisibility(true);
      } catch {}
    },
  });
  return selected; // {sessionId, alias, index} | null
}

// Modal para cambiar de sesión manualmente desde el badge.
window.openSessionSwitcher = async () => {
  const modalInput = document.querySelector('wsc-modal-input');
  if (!modalInput) return;
  const items = await getSavedSessionsCombined();
  if (!items.length) {
    await modalInput.waitForConfirm(
      'No hay sesiones guardadas',
      'Ok',
      'Cerrar'
    );
    return;
  }
  let current = items.slice();
  const chosen = await modalInput.waitForSelection(current, {
    message: 'Selecciona una sesión',
    onDelete: async (item, index) => {
      try {
        const confirm = await modalInput.waitForConfirm(
          `¿Eliminar la sesión "${item.alias}" y sus mensajes?`,
          'Eliminar',
          'Cancelar'
        );
        if (!confirm) return;
        await deleteSession(item.sessionId);
        removeSessionMeta(item.sessionId);
        current.splice(index, 1);
        if (current.length === 0) {
          // Cerrar modal, limpiar UI y pedir alias nuevo
          modalInput.changeVisibility(false);
          modalInput.cleanup?.();
          try {
            const chatListEl = document.getElementById('wsc-chat-list');
            if (chatListEl && chatListEl.shadowRoot) {
              const container = chatListEl.shadowRoot.getElementById(
                'chat-list-container'
              );
              if (container)
                while (container.firstChild)
                  container.removeChild(container.firstChild);
            }
            const mainScreen = document.querySelector('wsc-main-screen');
            if (
              mainScreen &&
              typeof mainScreen.setActiveSessionLabel === 'function'
            ) {
              mainScreen.setActiveSessionLabel('');
            }
            const messageList = document.querySelector('wsc-message-list');
            if (messageList && typeof messageList.clearMessages === 'function')
              messageList.clearMessages();
            window.sessionMessages = {};
            window.clientId = null;
            window.sessionId = null;
          } catch {}
          let alias;
          do {
            alias = await modalInput.waitForInput('Enter your alias:');
          } while (!alias);
          if (alias) {
            alias = toUpperCaseFirstLetter(alias);
            alias = ensureUniqueAlias(alias);
            window.clientAlias = alias;
            window.sessionId = generateSessionId();
            upsertSessionMeta(window.sessionId, alias);
            try {
              const mainScreen = document.querySelector('wsc-main-screen');
              if (
                mainScreen &&
                typeof mainScreen.setActiveSessionLabel === 'function'
              ) {
                mainScreen.setActiveSessionLabel(window.clientAlias);
              }
            } catch {}
          }
          return;
        }
        modalInput.mode = 'list';
        modalInput._listItems = current;
        modalInput.render();
        modalInput.changeVisibility(true);
        if (window.sessionId === item.sessionId) {
          // Se eliminó la sesión activa: limpiar UI y estado
          try {
            const chatListEl = document.getElementById('wsc-chat-list');
            if (chatListEl && chatListEl.shadowRoot) {
              const container = chatListEl.shadowRoot.getElementById(
                'chat-list-container'
              );
              if (container)
                while (container.firstChild)
                  container.removeChild(container.firstChild);
            }
            const mainScreen = document.querySelector('wsc-main-screen');
            if (
              mainScreen &&
              typeof mainScreen.setActiveSessionLabel === 'function'
            ) {
              mainScreen.setActiveSessionLabel('');
            }
            const messageList = document.querySelector('wsc-message-list');
            if (messageList && typeof messageList.clearMessages === 'function')
              messageList.clearMessages();
            window.sessionMessages = {};
            window.clientId = null;
            window.sessionId = null;
          } catch {}
        }
      } catch {}
    },
  });
  if (!chosen) return;
  if (chosen.sessionId === window.sessionId) return; // Sin cambio
  // Cambiar a sesión seleccionada (no tocamos clientId del servidor)
  window.sessionId = chosen.sessionId;
  window.clientAlias = chosen.alias;
  selectedExistingSession = true;
  try {
    const mainScreen = document.querySelector('wsc-main-screen');
    if (mainScreen && typeof mainScreen.setActiveSessionLabel === 'function') {
      mainScreen.setActiveSessionLabel(window.clientAlias);
    }
  } catch {}
  // Reconstruir chats desde historial
  await rebuildChatListFromHistory(window.sessionId);
  // Avisar al servidor del nuevo alias (manteniendo id de conexión)
  try {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(
        JSON.stringify({
          type: 'alias',
          alias: window.clientAlias,
          id: clientId, // id asignado por servidor, no cambiamos
        })
      );
    }
  } catch {}
};

// Refrescar manualmente historial precargado manteniendo el chat seleccionado
window.refreshSessionHistory = async () => {
  try {
    if (!window.sessionId) return;
    const chatScreen = document.querySelector('wsc-chat-screen');
    let preferredId = null;
    if (chatScreen && typeof chatScreen.selectedClient === 'object') {
      preferredId = chatScreen.selectedClient?.id || null;
    }
    await rebuildChatListFromHistory(window.sessionId);
    if (preferredId) {
      // Intentar re-seleccionar el chat anterior
      const chatListEl = document.getElementById('wsc-chat-list');
      if (chatListEl && chatListEl.shadowRoot) {
        const container = chatListEl.shadowRoot.getElementById(
          'chat-list-container'
        );
        if (container) {
          const chats = Array.from(container.children);
          const target = chats.find((c) => c.userId === preferredId);
          if (
            target &&
            chatScreen &&
            typeof chatScreen.selectChat === 'function'
          ) {
            const userName = target.getUserName
              ? target.getUserName()
              : target.userName || 'Chat';
            chatScreen.showScreen();
            chatScreen.selectChat({ userName, userId: preferredId });
          }
        }
      }
    }
  } catch {}
};

// Reconstrucción de lista de chats desde historial de la sesión
function formatTime(ts) {
  const d = new Date(ts || Date.now());
  const h = d.getHours();
  const m = d.getMinutes();
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    (h >= 12 ? ' pm' : ' am')
  );
}

async function rebuildChatListFromHistory(sessionId) {
  try {
    const chatListEl = document.getElementById('wsc-chat-list');
    if (!chatListEl) return;
    // Limpiar lista actual
    if (chatListEl.shadowRoot) {
      const container = chatListEl.shadowRoot.getElementById(
        'chat-list-container'
      );
      if (container) {
        while (container.firstChild)
          container.removeChild(container.firstChild);
      }
    }
    // Limpiar message list y cache previa
    window.sessionMessages = {};
    const messageList = document.querySelector('wsc-message-list');
    if (messageList && typeof messageList.clearMessages === 'function') {
      messageList.clearMessages();
    }
    // Precargar todos los mensajes de la sesión y agruparlos en cache
    try {
      const all = await getMessagesBySession(sessionId);
      for (const msg of all) {
        const cid = String(msg.chatId);
        if (!window.sessionMessages[cid]) window.sessionMessages[cid] = [];
        window.sessionMessages[cid].push(msg);
      }
    } catch {}
    const summary = await getChatsSummaryBySession(sessionId);
    for (const item of summary) {
      const alias =
        item.lastTitle && item.lastTitle.trim()
          ? item.lastTitle.trim()
          : `Usuario ${String(item.chatId).slice(0, 6)}`;
      const lastMessage =
        item.lastType === 'file' ? `📎 ${item.lastMessage}` : item.lastMessage;
      const ts = formatTime(item.lastCreatedAt);
      // Agregar chat (ChatList evita duplicados por id)
      chatListEl.addChat({
        userName: alias,
        id: item.chatId,
        members: [],
        lastMessage,
        timestampLastMessage: ts,
        unreadCount: 0,
      });
    }
    // Seleccionar automáticamente el primer chat para mostrar sus mensajes
    if (chatListEl.shadowRoot) {
      const container = chatListEl.shadowRoot.getElementById(
        'chat-list-container'
      );
      if (container && container.firstChild) {
        const firstChat = container.firstChild;
        const chatScreen = document.querySelector('wsc-chat-screen');
        if (chatScreen && typeof chatScreen.selectChat === 'function') {
          chatScreen.showScreen();
          const userName = firstChat.getUserName
            ? firstChat.getUserName()
            : firstChat.userName || 'Chat';
          chatScreen.selectChat({ userName, userId: firstChat.userId });
        }
      }
    }
  } catch (e) {
    // fail silently
  }
}

// Conexión principal encapsulada para permitir reconexiones.
function connectWebSocket() {
  // Evitar múltiples conexiones simultáneas.
  if (websocket && websocket.readyState === WebSocket.OPEN) return;
  websocket = new WebSocket(wsUri);
  window.websocket = websocket;

  websocket.addEventListener('open', () => {
    resetReconnectState();
    // Si ya tenemos alias previo, reenviarlo sin molestar al usuario.
    if (window.clientAlias && window.clientId) {
      try {
        websocket.send(
          JSON.stringify({
            type: 'alias',
            alias: window.clientAlias,
            id: window.clientId,
          })
        );
      } catch (err) {}
    }
  });

  websocket.addEventListener('close', () => {
    // Intentar reconexión si no es cierre manual.
    if (!manualClose) scheduleReconnect();
  });

  websocket.addEventListener('error', () => {
    // Forzar intento de reconexión tras error (si no cierre manual).
    if (!manualClose) scheduleReconnect();
  });

  websocket.addEventListener('message', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data) {
        switch (data.type) {
          case 'id':
            clientId = data.id;
            try {
              window.clientId = clientId;
            } catch {}
            // Alias previo ya conocido => reenviar; si no existe => pedirlo.
            if (window.clientAlias) {
              fromClientAlias = window.clientAlias;
              websocket.send(
                JSON.stringify({
                  type: 'alias',
                  alias: window.clientAlias,
                  id: clientId,
                })
              );
              // Mostrar badge de sesión activa
              try {
                const mainScreen = document.querySelector('wsc-main-screen');
                if (
                  mainScreen &&
                  typeof mainScreen.setActiveSessionLabel === 'function'
                ) {
                  mainScreen.setActiveSessionLabel(window.clientAlias);
                }
              } catch {}
              // Asegurar sessionId lógico estable para esta alias
              if (!window.sessionId) {
                try {
                  const metaMatch = getSessionsMeta().find(
                    (m) => m.alias === window.clientAlias
                  );
                  if (metaMatch) {
                    window.sessionId = metaMatch.sessionId;
                  } else {
                    window.sessionId = generateSessionId();
                    upsertSessionMeta(window.sessionId, window.clientAlias);
                  }
                } catch {
                  window.sessionId = generateSessionId();
                }
              }
              // Reconstruir lista y mensajes de la sesión activa usando sessionId estable
              (async () => {
                try {
                  await rebuildChatListFromHistory(window.sessionId);
                } catch {}
              })();
            } else {
              (async () => {
                try {
                  // Primero, comprobar si hay sesiones guardadas
                  const chosen = await promptSessionSelectionIfAny();
                  if (chosen && chosen.sessionId) {
                    // Usar ese id para la sesión local (DB) y alias guardado
                    window.sessionId = chosen.sessionId;
                    window.clientAlias = chosen.alias;
                    fromClientAlias = chosen.alias;
                    selectedExistingSession = true;
                    // Aún debemos identificarnos ante el servidor con el id actual asignado
                    websocket.send(
                      JSON.stringify({
                        type: 'alias',
                        alias: fromClientAlias,
                        id: clientId,
                      })
                    );
                    // Mostrar badge de sesión activa
                    try {
                      const mainScreen =
                        document.querySelector('wsc-main-screen');
                      if (
                        mainScreen &&
                        typeof mainScreen.setActiveSessionLabel === 'function'
                      ) {
                        mainScreen.setActiveSessionLabel(window.clientAlias);
                      }
                    } catch {}
                    // Reconstruir lista de chats desde historial solo si es una sesión previa
                    await rebuildChatListFromHistory(window.sessionId);
                  } else {
                    // No hay selección; pedir alias nuevo
                    do {
                      fromClientAlias =
                        await modalInput.waitForInput('Enter your alias:');
                    } while (!fromClientAlias);
                    if (fromClientAlias) {
                      fromClientAlias = toUpperCaseFirstLetter(fromClientAlias);
                      fromClientAlias = ensureUniqueAlias(fromClientAlias);
                      window.clientAlias = fromClientAlias;
                      // Generar y guardar nuevo sessionId lógico (independiente del id de conexión)
                      window.sessionId = generateSessionId();
                      upsertSessionMeta(window.sessionId, fromClientAlias);
                      websocket.send(
                        JSON.stringify({
                          type: 'alias',
                          alias: fromClientAlias,
                          id: clientId,
                        })
                      );
                      // Mostrar badge de sesión activa (nueva sesión)
                      try {
                        const mainScreen =
                          document.querySelector('wsc-main-screen');
                        if (
                          mainScreen &&
                          typeof mainScreen.setActiveSessionLabel === 'function'
                        ) {
                          mainScreen.setActiveSessionLabel(window.clientAlias);
                        }
                      } catch {}
                      // Reconstruir (lista vacía y mensaje list limpio para sesión nueva) usando sessionId
                      await rebuildChatListFromHistory(window.sessionId);
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              })();
            }
            break;

          case 'message':
            // Mensaje de texto entrante: agregar a componente y persistir.
            const messageListRecv = document.querySelector('wsc-message-list');
            date = new Date();
            if (messageListRecv) {
              // Determinar el chat a actualizar sin mezclar tipos:
              // 1. Si es mensaje de grupo (data.groupId presente) usar el id del grupo.
              // 2. Si es mensaje directo entrante usar id_from (emisor).
              // 3. Fallbacks solo si hiciera falta (no debería darse normalmente).
              let chatId;
              if (data.groupId) {
                chatId = data.groupId;
              } else if (data.id_from) {
                chatId = data.id_from; // mensaje directo entrante
              } else if (data.id_target && data.id_target !== clientId) {
                chatId = data.id_target; // caso excepcional
              } else {
                chatId =
                  data.id_from ||
                  data.groupId ||
                  data.id_target ||
                  'desconocido';
              }
              // Persistir en IndexedDB
              try {
                saveMessage({
                  sessionId: window.sessionId || window.clientId,
                  chatId,
                  direction: 'in',
                  type: 'text',
                  title: data.from || 'Desconocido',
                  text: data.payload,
                  createdAt: Date.now(),
                });
              } catch {}
              messageListRecv.addMessage({
                chatId,
                title: data.from || 'Desconocido',
                text: data.payload,
                timestamp:
                  date.getHours().toString().padStart(2, '0') +
                  ':' +
                  date.getMinutes().toString().padStart(2, '0') +
                  (date.getHours() >= 12 ? ' pm' : ' am'),
                isIncoming: true,
                type: 'text',
              });
            }
            break;

          case 'newClient':
            // Nuevo cliente conectado: crear botón de chat (si no es uno mismo)
            const newClientAlias = `${data.alias || 'N/A'}`;
            if (data.id !== clientId)
              newChatButton({ id: data.id, alias: newClientAlias });
            break;

          case 'clientsList':
            // Lista inicial de clientes: poblar chats y solicitar grupos.
            data.clients.forEach(({ id, alias }) => {
              if (id !== clientId) newChatButton({ id, alias });
            });
            websocket.send(
              JSON.stringify({
                type: 'reqGroups',
                alias: fromClientAlias,
                id: clientId,
              })
            );
            break;

          case 'clientDisconnected':
            // Eliminación visual de un cliente que se desconecta.
            deleteClient(data.id);
            break;

          case 'groupsList':
            // Recibir listado completo de grupos para renderizar.
            data.groups.forEach(({ id, alias, members }) => {
              newChatButton({ id, alias, members });
            });
            break;

          case 'groupCreated': {
            // Grupo nuevo creado y confirmado por el servidor.
            const { group } = data;
            if (group)
              newChatButton({
                id: group.id,
                alias: group.alias,
                members: group.members,
              });
            break;
          }
          case 'groupUpdated': {
            // Actualización de miembros/nombre de grupo.
            const { group } = data;
            if (group)
              newChatButton({
                id: group.id,
                alias: group.alias,
                members: group.members,
              });
            break;
          }
          case 'groupDeleted': {
            // Eliminación de grupo: remover del listado local.
            const { groupId } = data;
            if (groupId) deleteClient(groupId);
            break;
          }

          case 'attachment':
            // Archivo entrante (binario): convertir a Blob, persistir y mostrar.
            const blob = new Blob([new Uint8Array(data.data)], {
              type: 'application/octet-stream',
            });
            const url = URL.createObjectURL(blob);
            // Mostrar el archivo como mensaje en el chat
            const messageListFile = document.querySelector('wsc-message-list');
            date = new Date();
            if (messageListFile) {
              // Misma lógica de segregación que en mensajes de texto
              let chatId;
              if (data.groupId) {
                chatId = data.groupId;
              } else if (data.id_from) {
                chatId = data.id_from;
              } else if (data.id_target && data.id_target !== clientId) {
                chatId = data.id_target;
              } else {
                chatId =
                  data.id_from ||
                  data.groupId ||
                  data.id_target ||
                  'desconocido';
              }
              // Persistir archivo en IndexedDB
              try {
                saveMessage({
                  sessionId: window.sessionId || window.clientId,
                  chatId,
                  direction: 'in',
                  type: 'file',
                  title: data.from || 'Desconocido',
                  text: '',
                  fileName: data.filename || 'Archivo',
                  blob,
                  createdAt: Date.now(),
                });
              } catch {}
              messageListFile.addMessage({
                chatId,
                title: data.from || 'Desconocido',
                timestamp:
                  date.getHours().toString().padStart(2, '0') +
                  ':' +
                  date.getMinutes().toString().padStart(2, '0') +
                  (date.getHours() >= 12 ? ' pm' : ' am'),
                isIncoming: true,
                type: 'file',
                fileName: data.filename || 'Archivo',
                blob: blob,
                url,
              });
            }
            break;

          default:
            // unknown message type; ignore
            break;
        }
        return;
      }
    } catch (err) {
      // Silenciar errores de parseo en consola pública
    }
  });
}

// === INICIALIZACIÓN ===
// Apertura cuando la página se muestra.
window.addEventListener('pageshow', () => {
  manualClose = false;
  connectWebSocket();
});

// === LIMPIEZA DE LA CONEXIÓN ===
// Cerrar el WebSocket cuando el usuario abandona la página.
window.addEventListener('pagehide', () => {
  manualClose = true;
  if (websocket) {
    try {
      websocket.close();
    } catch {}
    websocket = null;
  }
  resetReconnectState();
});

// API opcional para forzar reconexión manual desde consola.
window.forceReconnect = () => {
  manualClose = false;
  if (websocket) {
    try {
      websocket.close();
    } catch {}
    websocket = null;
  }
  connectWebSocket();
};

// === UTILIDADES ===
/**
 * Capitaliza la primera letra de una cadena.
 * @param {string} string Cadena a transformar.
 * @returns {string} Cadena con primera letra en mayúscula.
 */
const toUpperCaseFirstLetter = (string) => {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
};

// === GESTIÓN DE CHATS (CREACIÓN DINÁMICA) ===
/**
 * Crea (si no existe) un botón de chat para un usuario o grupo.
 * Maneja espera por el componente `wsc-chat-list` si aún no está en el DOM.
 * @param {{id:string, alias:string, members?:string[]}} clientSelected Datos del cliente/grupo.
 */
const newChatButton = (clientSelected) => {
  const { id, alias, members = [] } = clientSelected;
  const chat = document.querySelector('wsc-chat-list');

  const tryAdd = () => {
    if (chat && alias) {
      chat.addChat({
        userName: alias,
        id,
        members,
      });
    }
  };

  if (!chat) {
    // Esperar a que el chat esté disponible
    const observer = new MutationObserver(() => {
      const chatNow = document.querySelector('wsc-chat-list');
      if (chatNow) {
        observer.disconnect();
        tryAdd();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    tryAdd();
  }
};

// === ELIMINACIÓN DE CHAT ===
/**
 * Elimina visualmente un chat por su id.
 * @param {string} id Identificador del cliente o grupo.
 */
const deleteClient = (id) => {
  const chatList = document.querySelector('wsc-chat-list');
  if (chatList && typeof chatList.deleteChatById === 'function') {
    chatList.deleteChatById(id);
  }
};

// Antiguas utilidades de framing y carga de archivo eliminadas por no usarse

// === API GLOBAL PARA OPERACIONES DE GRUPO ===
// Se expone en window para interacción rápida desde otros componentes o consola.
window.createGroup = (alias) => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({ type: 'createGroup', groupAlias: alias }));
};
window.addClientToGroup = (groupId, targetId) => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(
    JSON.stringify({ type: 'addClientToGroup', groupId, targetId })
  );
};
window.remClientToGroup = (groupId, targetId) => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(
    JSON.stringify({ type: 'remClientToGroup', groupId, targetId })
  );
};
window.delGroup = (groupId) => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({ type: 'delGroup', groupId }));
};
