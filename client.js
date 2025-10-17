const wsUri = 'ws://127.0.0.1/';
let websocket = null;
let pingInterval;

// Modificar para incluir un ID de destino
let clientId = null;
let clientSelected = { id: null, alias: null };

const logElement = document.querySelector('#log');
function log(text) {
  logElement.innerText = `${logElement.innerText}${text}\n`;
  logElement.scrollTop = logElement.scrollHeight;
}

// Nuevo: referencias al input y botón
const messageInput = document.querySelector('#messageInput');
const sendBtn = document.querySelector('#sendBtn');

// Crear un div para mostrar el Alias del cliente
const clientAliasElement = document.createElement('div');
clientAliasElement.id = 'clientAliasDisplay';
clientAliasElement.innerText = 'Your alias: ';
clientAliasElement.style.margin = '10px 0';
document.body.insertBefore(clientAliasElement, logElement);

// Open the websocket when the page is shown
window.addEventListener('pageshow', () => {
  log('OPENING');

  websocket = new WebSocket(wsUri);

  websocket.addEventListener('open', () => {
    log('CONNECTED');
    websocket.send(JSON.stringify({ type: 'reqGroups' }));
  });

  websocket.addEventListener('close', () => {
    log('DISCONNECTED');
  });

  websocket.addEventListener('message', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data) {
        switch (data.type) {
          case 'id':
            clientId = data.id;

            // Enviar alias al servidor al abrir la conexión
            let alias = prompt('Enter your alias:');
            if (alias) {
              alias = toUpperCaseFirstLetter(alias);
              clientAliasElement.innerText = `Your alias: ${alias}`;
              websocket.send(
                JSON.stringify({ type: 'alias', alias, id: clientId })
              );
            }
            break;

          case 'message':
            log(`RECEIVED from ${data.from}: ${data.payload}`);
            break;

          case 'newClient':
            const newClientAlias = `${data.alias || 'N/A'}`;
            log(`New client connected: ${newClientAlias}`);
            if (data.id !== clientId) newChatButton(data.id, newClientAlias);
            break;

          case 'clientsList':
            data.clients.forEach(({ id, alias }) => {
              if (id !== clientId) newChatButton(id, alias);
            });
            break;

          case 'clientDisconnected':
            log(`Client disconnected: ${data.alias}`);
            log(`-- Client ID: ${data.id}`);
            deleteClient(data.id, data.alias);
            break;

          case 'groupsList':
            data.groups.forEach(({ id, alias, members }) => {
              if (id !== clientId) newChatButton(id, alias, members);
            });
            break;

          default:
            log(`Unknown message: ${JSON.stringify(data)}`);
            break;
        }
        return;
      }
    } catch (err) {
      log(`Error parsing message: ${err.message}`); // Registrar errores de parseo
      log(`RECEIVED: ${e.data}`);
    }
  });

  websocket.addEventListener('error', (e) => {
    log(`ERROR: ${e.data}`);
  });

  // Nuevo: enviar contenido del input al presionar el botón
  sendBtn.addEventListener('click', () => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      log('No conectado al servidor');
      return;
    }
    const text = messageInput.value;
    const targetId = clientSelected.id;
    if (!text || !targetId) return;
    websocket.send(
      JSON.stringify({ type: 'message', payload: text, targetId })
    );
    log(`SENT to ${clientSelected.alias}: ${text}`);
    messageInput.value = '';
  });
});

// Close the websocket when the user leaves.
window.addEventListener('pagehide', () => {
  if (websocket) {
    log('CLOSING');
    websocket.close();
    websocket = null;
    window.clearInterval(pingInterval);
  }
});

const toUpperCaseFirstLetter = (string) => {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
};

const newChatButton = (id, alias, members = []) => {
  const selectClient = document.createElement('button');
  selectClient.innerText = alias;
  selectClient.id = `client-btn-${id}`;
  selectClient.addEventListener('click', () => {
    clientSelected.id = id;
    clientSelected.alias = alias;
    clientSelected.members = members;
    if (members.length > 0)
      log(`Chatting with group: ${alias} (Members: ${members.join(', ')})`);
    messageInput.focus();
  });
  document.body.insertBefore(selectClient, logElement);
};

const deleteClient = (id) => {
  const button = document.getElementById(`client-btn-${id}`);
  if (button) {
    document.body.removeChild(button);
  }
};
