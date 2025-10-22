const createResponse = async (path, mimeType) => {
  const file = await Deno.open(path, { read: true });
  const response = new Response(file.readable);
  response.headers.set('Content-Type', mimeType);
  // CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
};

const messageToGroup = (sockets, JSONstringify, exceptSocket = null) => {
  sockets.forEach((_, socket) => {
    if (socket !== exceptSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSONstringify);
    }
  });
};

const allSockets = new Map();
const groupSockets = [
  {
    id: 'groupAll',
    alias: 'All',
    sockets: allSockets,
  },
];

Deno.serve({
  port: 80,
  async handler(request) {
    if (request.headers.get('upgrade') !== 'websocket') {
      const url = new URL(request.url);
      // If the request is a normal HTTP request,
      // we serve the client HTML, CSS, or JS.
      // Servir archivos estáticos de client, screens y components
      if (url.pathname === '/client.js') {
        return await createResponse('./client.js', 'text/javascript');
      }
      if (url.pathname === '/client.css') {
        return await createResponse('./client.css', 'text/css');
      }
      if (url.pathname === '/') {
        return await createResponse('./index.html', 'text/html');
      }
      // Servir cualquier archivo dentro de /screens/ o /components/ con el mimeType adecuado
      if (
        url.pathname.startsWith('/screens/') ||
        url.pathname.startsWith('/components/')
      ) {
        const filePath = '.' + url.pathname;
        if (filePath.endsWith('.js')) {
          return await createResponse(filePath, 'text/javascript');
        }
        if (filePath.endsWith('.css')) {
          return await createResponse(filePath, 'text/css');
        }
        if (filePath.endsWith('.html')) {
          return await createResponse(filePath, 'text/html');
        }
      }
      // Si no se encuentra el archivo, responder 404 con CORS
      const notFoundResponse = new Response('Not found', {
        status: 404,
      });
      notFoundResponse.headers.set('Access-Control-Allow-Origin', '*');
      notFoundResponse.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      );
      notFoundResponse.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type'
      );
      return notFoundResponse;
    }
    // If the request is a websocket upgrade,
    // we need to use the Deno.upgradeWebSocket helper
    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.onopen = () => {
      const clientId = crypto.randomUUID(); // Generar un ID único
      allSockets.set(socket, { id: clientId }); // Asignar el ID al socket

      // Enviar el ID al cliente
      socket.send(JSON.stringify({ type: 'id', id: clientId }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data) {
          switch (data.type) {
            case 'message':
              if (data.targetId.includes('group')) {
                groupSockets.forEach(({ id, sockets }) => {
                  if (id === data.targetId) {
                    messageToGroup(
                      sockets,
                      JSON.stringify({
                        type: 'message',
                        from: sockets.get(socket).alias,
                        payload: data.payload,
                      }),
                      socket
                    );
                  }
                });
                return;
              }

              const targetSocket = Array.from(allSockets.keys()).find(
                (s) => allSockets.get(s).id === data.targetId
              );
              if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                targetSocket.send(
                  JSON.stringify({
                    type: 'message',
                    from: allSockets.get(socket).alias,
                    payload: data.payload,
                  })
                );
              }
              break;

            case 'alias':
              allSockets.get(socket).alias = data.alias;
              messageToGroup(
                allSockets,
                JSON.stringify({
                  type: 'newClient',
                  id: data.id,
                  alias: data.alias,
                })
              );
              socket.send(
                JSON.stringify({
                  type: 'clientsList',
                  clients: Array.from(allSockets.values()).map(
                    ({ id, alias }) => ({ id, alias })
                  ),
                })
              );
              break;

            case 'reqGroups':
              socket.send(
                JSON.stringify({
                  type: 'groupsList',
                  groups: groupSockets.map(({ id, alias, sockets }) => ({
                    id,
                    alias,
                    members: Array.from(sockets).map(
                      (s) => sockets.get(s).alias
                    ),
                  })),
                })
              );
              break;

            case 'attachment':
              if (data.targetId.includes('group')) {
                groupSockets.forEach(({ id, sockets }) => {
                  if (id === data.targetId) {
                    messageToGroup(
                      sockets,
                      JSON.stringify({
                        type: 'attachment',
                        data: data.data,
                        filename: data.filename,
                      }),
                      socket
                    );
                  }
                });
                return;
              }

              const targetSocketAttachment = Array.from(allSockets.keys()).find(
                (s) => allSockets.get(s).id === data.targetId
              );
              if (
                targetSocketAttachment &&
                targetSocketAttachment.readyState === WebSocket.OPEN
              ) {
                targetSocketAttachment.send(
                  JSON.stringify({
                    type: 'attachment',
                    data: data.data,
                    filename: data.filename,
                  })
                );
              }
              break;

            default:
              console.log(`Unknown message: ${JSON.stringify(data)}`);
              break;
          }
          return;
        }
      } catch (e) {
        // not JSON, ignore
      }
    };

    socket.onclose = () => {
      const sock = allSockets.get(socket);
      messageToGroup(
        allSockets,
        JSON.stringify({
          type: 'clientDisconnected',
          id: sock?.id,
          alias: sock?.alias,
        })
      );
      allSockets.delete(socket);
    };
    socket.onerror = (error) => console.error('ERROR:', error);

    return response;
  },
});
