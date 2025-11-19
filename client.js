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
import { saveMessage } from './components/db/indexedDB.js';

// === CONFIGURACIÓN BÁSICA DE CONEXIÓN ===
// Para desarrollo local con Live Server (HTTP en 127.0.0.1:5500)
// el servidor WebSocket corre por separado.
const WS_PORT = 8081;
const WS_HOST = location.hostname || '127.0.0.1';
const wsUri = `ws://${WS_HOST}:${WS_PORT}/`;
let websocket = null;

const modalInput = document.querySelector('wsc-modal-input');

window.clientId = null;
let date = null;
let fromClientAlias;

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
            } else {
              (async () => {
                try {
                  do {
                    fromClientAlias =
                      await modalInput.waitForInput('Enter your alias:');
                  } while (!fromClientAlias);
                  if (fromClientAlias) {
                    fromClientAlias = toUpperCaseFirstLetter(fromClientAlias);
                    window.clientAlias = fromClientAlias;
                    websocket.send(
                      JSON.stringify({
                        type: 'alias',
                        alias: fromClientAlias,
                        id: clientId,
                      })
                    );
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
                  sessionId: window.clientId,
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
                  sessionId: window.clientId,
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
