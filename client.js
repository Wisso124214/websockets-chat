import MainScreen from './screens/mainScreen/MainScreen.js';
import ModalInput from './components/modalInput/modalInput.js';
import ChatScreen from './screens/chatScreen/ChatScreen.js';

// Usar solo el modal ya presente en el DOM
const modalInput = document.querySelector('wsc-modal-input');
// const MAX_PAYLOAD_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_PAYLOAD_SIZE = 1024 * 1024 * 5; // 5 MB
const wsUri = `ws://${location.hostname}/`;
let websocket = null;
let pingInterval;

// Modificar para incluir un ID de destino
let clientId = null;
let clientAlias = null;
let clientSelected = { id: null, alias: null };
let date = null;

const logElement = document.querySelector('#log');
function log(text) {
  console.log(text);
  // if (logElement) {
  //   logElement.innerText = `${logElement.innerText}${text}\n`;
  //   logElement.scrollTop = logElement.scrollHeight;
  // }
}

// Nuevo: referencias al input y botón
const messageInput = document.querySelector('#messageInput');
const sendBtn = document.querySelector('#sendBtn');
const fileInput = document.querySelector('#fileInput');
const downloadContainer = document.querySelector('#downloadContainer');

// Crear un div para mostrar el Alias del cliente
const clientAliasElement = document.getElementById('clientAliasDisplay');
if (clientAliasElement) {
  clientAliasElement.innerText = 'Your alias: ';
  clientAliasElement.style.margin = '10px 0';
  document.body.insertBefore(clientAliasElement, logElement);
}

// Open the websocket when the page is shown
window.addEventListener('pageshow', () => {
  log('OPENING');

  websocket = new WebSocket(wsUri);
  window.websocket = websocket;
  window.clientSelected = clientSelected;

  websocket.addEventListener('open', () => {
    log('CONNECTED');
  });

  websocket.addEventListener('close', () => {
    log('DISCONNECTED');
  });

  websocket.addEventListener('message', (e) => {
    try {
      const data = JSON.parse(e.data);
      console.log('Received data:', data);
      if (data) {
        switch (data.type) {
          case 'id':
            clientId = data.id;

            // Enviar alias al servidor al abrir la conexión
            (async () => {
              try {
                // do {
                //   clientAlias = await modalInput.waitForInput('Enter your alias:');
                // } while (!clientAlias);
                clientAlias = 'alias';
                if (clientAlias) {
                  clientAlias = toUpperCaseFirstLetter(clientAlias);
                  console.log(`Hello ${clientAlias}`);
                  if (clientAliasElement)
                    clientAliasElement.innerText = `Your alias: ${clientAlias}`;
                  websocket.send(
                    JSON.stringify({
                      type: 'alias',
                      alias: clientAlias,
                      id: clientId,
                    })
                  );
                }
              } catch (err) {
                console.error(err);
              }
            })();
            break;

          case 'message':
            log(`RECEIVED from ${data.from}: ${data.payload}`);
            // Agregar mensaje recibido al componente wsc-message-list
            const messageListRecv = document.querySelector('wsc-message-list');
            date = new Date();
            if (messageListRecv) {
              messageListRecv.addMessage({
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
            const newClientAlias = `${data.alias || 'N/A'}`;
            log(`New client connected: ${newClientAlias}`);
            log(`-- Client ID: ${data.id}`);
            if (data.id !== clientId)
              newChatButton({ id: data.id, alias: newClientAlias });
            break;

          case 'clientsList':
            data.clients.forEach(({ id, alias }) => {
              if (id !== clientId) newChatButton({ id, alias });
            });
            websocket.send(
              JSON.stringify({
                type: 'reqGroups',
                alias: clientAlias,
                id: clientId,
              })
            );
            break;

          case 'clientDisconnected':
            log(`Client disconnected: ${data.alias}`);
            log(`-- Client ID: ${data.id}`);
            deleteClient(data.id);
            break;

          case 'groupsList':
            console.log('Groups received:', data.groups);
            data.groups.forEach(({ id, alias, members }) => {
              newChatButton({ id, alias, members });
            });
            break;

          case 'attachment':
            const blob = new Blob([new Uint8Array(data.data)], {
              type: 'application/octet-stream',
            });
            const url = URL.createObjectURL(blob);
            // Mostrar el archivo como mensaje en el chat
            const messageListFile = document.querySelector('wsc-message-list');
            date = new Date();
            if (messageListFile) {
              messageListFile.addMessage({
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
            log(
              `File received: ${data.filename || 'file'} from ${data.from || 'unknown'}`
            );
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
  sendBtn?.addEventListener('click', () => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      log('No conectado al servidor');
      return;
    }
    const text = messageInput.value;
    const targetId = clientSelected.id;
    if (!text) return;
    if (targetId) {
      websocket.send(
        JSON.stringify({ type: 'message', payload: text, targetId })
      );
      log(`SENT to ${clientSelected.alias}: ${text}`);
    } else {
      websocket.send(JSON.stringify({ type: 'broadcast', payload: text }));
      log(`SENT broadcast: ${text}`);
    }
    // Agregar mensaje enviado al componente wsc-message-list
    const messageListSend = document.querySelector('wsc-message-list');
    if (messageListSend) {
      messageListSend.addMessage({
        title: 'Tú',
        text: text,
        timestamp: new Date().toLocaleTimeString(),
        isIncoming: false,
        type: 'text',
      });
    }
    messageInput.value = '';
  });

  fileInput?.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      uploadFile(e, websocket, clientSelected.id);
      fileInput.value = '';
    }
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

const deleteClient = (id) => {
  const chatList = document.querySelector('wsc-chat-list');
  if (chatList && typeof chatList.deleteChatById === 'function') {
    chatList.deleteChatById(id);
  }
};

const getPayloadDecoded = (frame, firstIndexAfterPayloadLength) => {
  const mask = frame.slice(
    firstIndexAfterPayloadLength,
    firstIndexAfterPayloadLength + 4
  );
  const encodedPayload = frame.slice(firstIndexAfterPayloadLength + 4);
  // XOR each 4-byte sequence in the payload with the bitmask
  const decodedPayload = encodedPayload.map((byte, i) => byte ^ mask[i % 4]);
  return decodedPayload;
};

const generateFrame = (payload, options) => {
  const { isEnd = true, type = 'text' } = options ? options : {};
  const payloadLength = payload.length;
  const frame = [];
  let firstByte = 0b00000000;

  if (isEnd) {
    firstByte |= 0b10000000; // Set FIN bit
  }
  if (type === 'text') {
    firstByte |= 0b00000001; // Set opcode to 0x1 (text)
  } else {
    firstByte |= 0b00000010; // Set opcode to 0x2 (binary)
  }

  frame.push(firstByte);

  if (payloadLength <= 125) {
    frame.push(0b10000000 | payloadLength); // MASK bit set to 1
  } else if (payloadLength <= 65535) {
    frame.push(0b10000000 | 126); // MASK bit set to 1, extended payload length indicator
    frame.push((payloadLength >> 8) & 0xff);
    frame.push(payloadLength & 0xff);
  } else {
    frame.push(0b10000000 | 127); // MASK bit set to 1, extended payload length indicator
    for (let i = 7; i >= 0; i--) {
      frame.push((payloadLength >> (i * 8)) & 0xff);
    }
  }

  const mask = generateMask();
  frame.push(...mask);

  for (let i = 0; i < payloadLength; i++) {
    frame.push(payload.charCodeAt(i) ^ mask[i % 4]); // Apply mask to payload
  }

  return Uint8Array.from(frame);
};

const generateMask = () => {
  return [
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
  ];
};

// getFirstIndexAfterPayloadLength (gFIAPL)
const gFIAPL = (frame) => {
  const secondByte = frame[1];
  let payloadLength = secondByte & 0b01111111;
  let index = 2;
  if (payloadLength === 126) {
    index += 2;
  } else if (payloadLength === 127) {
    index += 8;
  }
  return index;
};

const uploadFile = (e, socket, to) => {
  const file = e.target.files[0];

  if (!file) {
    return;
  }
  if (file.size > MAX_PAYLOAD_SIZE) {
    alert('File should be smaller than 1MB');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const rawData = e.target.result;
    socket.send(
      JSON.stringify({
        type: 'attachment',
        data: Array.from(new Uint8Array(rawData)),
        filename: file.name,
        targetId: to,
      })
    );
    log(`File sent: ${file.name}`);
  };

  reader.readAsArrayBuffer(file);
};

const encodePayload = (payload, options) => {
  const frame = generateFrame(payload, options);
  console.log(getPayloadDecoded(frame, gFIAPL(frame)));
  return getPayloadDecoded(frame, gFIAPL(frame));
};

const decodeTextPayload = (encodedPayload, options) => {
  const decoded = new TextDecoder().decode(encodedPayload);
  return decoded;
};
