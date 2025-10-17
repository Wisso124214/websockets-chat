const createResponse = async (path, mimeType) => {
  const file = await Deno.open(path, { read: true });
  const response = new Response(file.readable);
  response.headers.set('Content-Type', mimeType);
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
      switch (url.pathname) {
        case '/client.js':
          return await createResponse('./client.js', 'text/javascript');
        case '/client.css':
          return await createResponse('./client.css', 'text/css');
        case '/':
          return await createResponse('./index.html', 'text/html');
        default:
          return new Response('Not found', {
            status: 404,
          });
      }
    }
    // If the request is a websocket upgrade,
    // we need to use the Deno.upgradeWebSocket helper
    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.onopen = () => {
      console.log('CONNECTED');
      const clientId = crypto.randomUUID(); // Generar un ID único
      allSockets.set(socket, { id: clientId }); // Asignar el ID al socket

      // Enviar el ID al cliente
      socket.send(JSON.stringify({ type: 'id', id: clientId }));
    };

    socket.onmessage = (event) => {
      console.log(`RECEIVED: ${event.data}`);
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
      console.log('DISCONNECTED');
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
