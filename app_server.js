/**
 * app_server.js
 * --------------------------------------------------
 * Servidor WebSocket (Deno) con soporte para:
 *  - Gestión de clientes (alta / desconexión / alias).
 *  - Mensajería directa y de grupos.
 *  - CRUD básico de grupos (crear, actualizar miembros, eliminar).
 *  - Sanitización de contenido para evitar exponer datos sensibles.
 *  - Broadcast de actualizaciones a todos los clientes conectados.
 *
 * Principios aplicados:
 *  - Nombres descriptivos y funciones pequeñas y enfocadas.
 *  - Comentarios explican propósito y decisiones (no repiten obviedades).
 *  - Eliminación de valores mágicos vía constantes.
 *  - Uso de helpers reutilizables para reducir duplicación.
 */

// === CONSTANTES DE SANITIZACIÓN ===
// Separamos regex fuera para claridad y potencial reutilización / testeo.
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g; // números largos tipo tarjeta
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-\._~\+\/=]+/gi;
const PHONE_REGEX = /\+?\d[\d\s().-]{8,}\d/g;
const PASSWORD_REGEX = /(password|pass|pwd)\s*[:=]\s*[^&\s]+/gi;

/**
 * Crea la estructura Map que contiene los grupos.
 * @returns {Map<string, {id:string, alias:string, sockets:Set<WebSocket>}>}
 */
const createGroupsStructure = () => {
  return new Map(); // groupId -> { id, alias, sockets: Set<socket> }
};

/**
 * Envía un JSON serializado a todos los sockets abiertos, excepto (opcional) uno.
 * @param {Map<WebSocket, {id:string, alias:string}>} socketsMap
 * @param {string} jsonString JSON ya serializado.
 * @param {WebSocket|null} exceptSocket Socket a excluir.
 */
const broadcastJSON = (socketsMap, jsonString, exceptSocket = null) => {
  socketsMap.forEach((_, socket) => {
    if (socket === exceptSocket) return;
    if (socket.readyState === WebSocket.OPEN) socket.send(jsonString);
  });
};

/**
 * Serializa un grupo para enviarlo al cliente.
 * @param {{id:string, alias:string, sockets:Set<WebSocket>}} group
 * @param {Map<WebSocket, {id:string, alias:string}>} allSockets
 * @returns {{id:string, alias:string, members:string[]}}
 */
const serializeGroup = (group, allSockets) => ({
  id: group.id,
  alias: group.alias,
  // Importante: miembros por ID para evitar duplicidades y dependencias de alias.
  members: Array.from(group.sockets).map((s) => allSockets.get(s)?.id),
});

// === HELPERS DE BUSQUEDA ===
/**
 * Busca un WebSocket por su id asignado.
 * @param {Map<WebSocket, {id:string, alias:string}>} allSockets
 * @param {string} targetId
 * @returns {WebSocket|undefined}
 */
const findSocketById = (allSockets, targetId) => {
  return Array.from(allSockets.keys()).find(
    (s) => allSockets.get(s).id === targetId
  );
};

/**
 * Sanitiza texto removiendo información sensible.
 * @param {string} text
 * @returns {string}
 */
const sanitizeText = (text) => {
  if (typeof text !== 'string') return text;
  let t = text;
  t = t.replace(EMAIL_REGEX, '[redacted-email]');
  t = t.replace(CREDIT_CARD_REGEX, '[redacted-number]');
  t = t.replace(BEARER_REGEX, 'Bearer [redacted]');
  t = t.replace(PHONE_REGEX, '[redacted-phone]');
  t = t.replace(PASSWORD_REGEX, '$1=[redacted]');
  return t;
};

/**
 * Sanitiza alias de usuario para uso público.
 * @param {string} alias
 * @returns {string}
 */
const sanitizeAlias = (alias) => {
  if (typeof alias !== 'string') return 'User';
  let a = alias.trim().slice(0, 30);
  a = a.replace(EMAIL_REGEX, 'user');
  return a || 'User';
};

/**
 * Inicia el servidor WebSocket usando Deno.serve.
 * También sirve archivos estáticos esenciales.
 * @param {number} [port=8080]
 * @param {string} [hostname='127.0.0.1']
 * @returns {Deno.Server} Referencia al servidor para potencial cierre/control.
 */
export function startServer(port = 8080, hostname = '127.0.0.1') {
  const allSockets = new Map(); // socket -> { id, alias }
  const groups = createGroupsStructure();

  // Create default group 'All'
  const defaultGroup = {
    id: 'groupAll',
    alias: 'Grupo Todos',
    sockets: new Set(),
  };
  groups.set(defaultGroup.id, defaultGroup);

  /**
   * Envia a todos los clientes la lista completa de grupos serializados.
   */
  const sendGroupsList = () => {
    const listPayload = JSON.stringify({
      type: 'groupsList',
      groups: Array.from(groups.values()).map((g) =>
        serializeGroup(g, allSockets)
      ),
    });
    broadcastJSON(allSockets, listPayload);
  };

  const server = Deno.serve({
    port,
    hostname,
    handler(request) {
      // === SERVING ESTÁTICO BÁSICO ===
      if (request.headers.get('upgrade') !== 'websocket') {
        const url = new URL(request.url);
        const serveFile = async (path, mime) => {
          try {
            const file = await Deno.open(path, { read: true });
            const response = new Response(file.readable);
            response.headers.set('Content-Type', mime);
            response.headers.set('Access-Control-Allow-Origin', '*');
            return response;
          } catch (_) {
            return new Response('Not found', { status: 404 });
          }
        };
        if (url.pathname === '/') return serveFile('./index.html', 'text/html');
        if (url.pathname === '/client.js')
          return serveFile('./client.js', 'text/javascript');
        if (url.pathname === '/client.css')
          return serveFile('./client.css', 'text/css');
        if (
          url.pathname.startsWith('/screens/') ||
          url.pathname.startsWith('/components/') ||
          url.pathname.startsWith('/assets/')
        ) {
          const filePath = '.' + url.pathname;
          if (filePath.endsWith('.js'))
            return serveFile(filePath, 'text/javascript');
          if (filePath.endsWith('.css')) return serveFile(filePath, 'text/css');
          if (filePath.endsWith('.html'))
            return serveFile(filePath, 'text/html');
          if (
            filePath.endsWith('.png') ||
            filePath.endsWith('.jpg') ||
            filePath.endsWith('.jpeg') ||
            filePath.endsWith('.gif') ||
            filePath.endsWith('.svg')
          ) {
            const ext = filePath.split('.').pop();
            const mime =
              ext === 'png'
                ? 'image/png'
                : ext === 'jpg' || ext === 'jpeg'
                  ? 'image/jpeg'
                  : ext === 'gif'
                    ? 'image/gif'
                    : ext === 'svg'
                      ? 'image/svg+xml'
                      : 'application/octet-stream';
            return serveFile(filePath, mime);
          }
        }
        return new Response('Not found', { status: 404 });
      }

      const { socket, response } = Deno.upgradeWebSocket(request);

      // === EVENTO: CONEXIÓN ABIERTA ===
      socket.onopen = () => {
        const clientId = crypto.randomUUID();
        allSockets.set(socket, { id: clientId, alias: undefined });
        // Add socket to default group
        defaultGroup.sockets.add(socket);
        socket.send(JSON.stringify({ type: 'id', id: clientId }));
      };

      /**
       * Elimina un grupo si existe y no es el grupo por defecto.
       * @param {string} groupId
       */
      const safeGroupDelete = (groupId) => {
        const group = groups.get(groupId);
        if (!group) return;
        if (group.id === defaultGroup.id) return; // do not delete default
        groups.delete(groupId);
        broadcastJSON(
          allSockets,
          JSON.stringify({ type: 'groupDeleted', groupId })
        );
        sendGroupsList();
      };

      /**
       * Quita un socket de todos los grupos. Elimina grupos vacíos (no default).
       * @param {WebSocket} socket
       */
      const removeSocketFromGroups = (socket) => {
        groups.forEach((group) => {
          if (group.sockets.delete(socket)) {
            // If group (non-default) becomes empty, delete it
            if (group.id !== defaultGroup.id && group.sockets.size === 0) {
              safeGroupDelete(group.id);
            } else {
              broadcastJSON(
                allSockets,
                JSON.stringify({
                  type: 'groupUpdated',
                  group: serializeGroup(group, allSockets),
                })
              );
            }
          }
        });
      };

      // === EVENTO: MENSAJE ENTRANTE ===
      socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (_) {
          return;
        }
        if (!data) return;

        switch (data.type) {
          case 'message': {
            if (
              typeof data.targetId === 'string' &&
              data.targetId.startsWith('group')
            ) {
              const group = groups.get(data.targetId);
              if (group) {
                group.sockets.forEach((s) => {
                  if (s !== socket && s.readyState === WebSocket.OPEN) {
                    s.send(
                      JSON.stringify({
                        type: 'message',
                        id_from: allSockets.get(socket)?.id ?? 'unknown',
                        from: allSockets.get(socket)?.alias ?? 'unknown',
                        groupId: data.targetId,
                        payload: sanitizeText(data.payload),
                      })
                    );
                  }
                });
              }
              break;
            }
            const targetSocket = findSocketById(allSockets, data.targetId);
            if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
              targetSocket.send(
                JSON.stringify({
                  type: 'message',
                  id_from: allSockets.get(socket)?.id ?? 'unknown',
                  id_target: data.targetId,
                  from: allSockets.get(socket)?.alias ?? 'unknown',
                  payload: sanitizeText(data.payload),
                })
              );
            }
            break;
          }
          case 'alias': {
            const entry = allSockets.get(socket);
            if (entry) entry.alias = sanitizeAlias(data.alias);
            // Inform everyone new client
            broadcastJSON(
              allSockets,
              JSON.stringify({
                type: 'newClient',
                id: data.id,
                alias: entry?.alias ?? 'User',
              })
            );
            // send clients list to requester
            socket.send(
              JSON.stringify({
                type: 'clientsList',
                clients: Array.from(allSockets.values()).map(
                  ({ id, alias }) => ({ id, alias })
                ),
              })
            );
            // broadcast groups list
            sendGroupsList();
            break;
          }
          case 'reqGroups': {
            sendGroupsList();
            break;
          }
          case 'attachment': {
            if (
              typeof data.targetId === 'string' &&
              data.targetId.startsWith('group')
            ) {
              const group = groups.get(data.targetId);
              if (group) {
                group.sockets.forEach((s) => {
                  if (s !== socket && s.readyState === WebSocket.OPEN) {
                    s.send(
                      JSON.stringify({
                        type: 'attachment',
                        data: data.data,
                        filename: sanitizeText(data.filename),
                        id_from: allSockets.get(socket)?.id ?? 'unknown',
                        from: allSockets.get(socket)?.alias ?? 'unknown',
                        groupId: data.targetId,
                      })
                    );
                  }
                });
              }
              break;
            }
            const targetSocketAttachment = findSocketById(
              allSockets,
              data.targetId
            );
            if (
              targetSocketAttachment &&
              targetSocketAttachment.readyState === WebSocket.OPEN
            ) {
              targetSocketAttachment.send(
                JSON.stringify({
                  type: 'attachment',
                  data: data.data,
                  filename: sanitizeText(data.filename),
                  id_from: allSockets.get(socket)?.id ?? 'unknown',
                  from: allSockets.get(socket)?.alias ?? 'unknown',
                  id_target: data.targetId,
                })
              );
            }
            break;
          }
          case 'createGroup': {
            const groupId = 'group-' + crypto.randomUUID();
            const alias = data.groupAlias || 'Group';
            const newGroup = { id: groupId, alias, sockets: new Set([socket]) };
            groups.set(groupId, newGroup);
            broadcastJSON(
              allSockets,
              JSON.stringify({
                type: 'groupCreated',
                group: serializeGroup(newGroup, allSockets),
              })
            );
            sendGroupsList();
            break;
          }
          case 'addClientToGroup': {
            const group = groups.get(data.groupId);
            if (!group) break;
            const targetSocket = findSocketById(allSockets, data.targetId);
            if (targetSocket) {
              group.sockets.add(targetSocket);
              broadcastJSON(
                allSockets,
                JSON.stringify({
                  type: 'groupUpdated',
                  group: serializeGroup(group, allSockets),
                })
              );
              sendGroupsList();
            }
            break;
          }
          case 'remClientToGroup': // remove client
          case 'remClientFromGroup': {
            const group = groups.get(data.groupId);
            if (!group) break;
            const targetSocket = findSocketById(allSockets, data.targetId);
            if (targetSocket && group.sockets.delete(targetSocket)) {
              if (group.id !== defaultGroup.id && group.sockets.size === 0) {
                safeGroupDelete(group.id);
              } else {
                broadcastJSON(
                  allSockets,
                  JSON.stringify({
                    type: 'groupUpdated',
                    group: serializeGroup(group, allSockets),
                  })
                );
                sendGroupsList();
              }
            }
            break;
          }
          case 'remGroup':
          case 'delGroup': {
            safeGroupDelete(data.groupId);
            break;
          }
          default:
            break;
        }
      };

      // === EVENTO: CIERRE DE CONEXIÓN ===
      socket.onclose = () => {
        const info = allSockets.get(socket);
        broadcastJSON(
          allSockets,
          JSON.stringify({
            type: 'clientDisconnected',
            id: info?.id,
            alias: info?.alias,
          })
        );
        allSockets.delete(socket);
        removeSocketFromGroups(socket);
        sendGroupsList();
      };
      // === EVENTO: ERROR EN SOCKET ===
      socket.onerror = (err) => console.error('ERROR:', err);

      return response;
    },
  });

  return server; // Expuesto para pruebas / cierre manual.
}
