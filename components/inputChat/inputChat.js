// Side-effect import innecesario removido: MessageList ya se registra vía ChatScreen
/**
 * <wsc-input-chat>
 * Barra inferior de entrada de mensajes y envío de archivos.
 * Funcionalidades:
 *  - Envío de texto (Enter / click) al chat seleccionado.
 *  - Adjuntar archivos: lectura como ArrayBuffer y envío como attachment.
 *  - Persistencia de mensajes salientes (texto/archivo) en IndexedDB.
 *  - Mantiene focus fácil vía método público focus().
 * Notas:
 *  - Usa `window.websocket` y `wsc-chat-screen.selectedClient` para determinar destino.
 *  - Limita tamaño de archivo (500MB) con validación previa.
 */
import { saveMessage } from '../db/indexedDB.js';

export default class InputChat extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
        <style>
          #input-chat-container {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100vw;
            height: 60px;
            display: flex;
            align-items: center;
            z-index: 100;
          }

          #input-chat-field {
            flex: 1;
            height: 40px;
            margin: 0;
            margin-left: 15px;
            margin-right: 10px;
            padding-right: 18px;
            padding-left: 44px;
            border: none;
            border-radius: 20px;
            background-color: color-mix(in srgb, var(--background-color), white 10%);
            color: var(--text-color);
            font-size: 14px;
            outline: none;
            width: 100vw;
          }

          #send-button {
            width: 50px;
            height: 50px;
            margin-right: 15px;
            border-radius: 100px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            color: var(--text-color);
            transition: background-color 0.3s;
            background-color: var(--primary-color);
          }

          #send-button:hover {
            background-color: color-mix(in srgb, var(--primary-color), black 10%);
          }

          #send-button:active {
            background-color: color-mix(in srgb, var(--primary-color), black 20%);
          }

          #send-button svg {
            width: 50%;
            height: 50%;
          }

          #send-button svg path {
            fill: var(--background-color);
            stroke: var(--background-color);
            stroke-width: 1;
          }

          #attach-button {
            position: absolute;
            left: 22px;
            bottom: 15px;
            width: 15px;
            height: 15px;
            padding: 8px;
            border-radius: 100px;
            cursor: pointer;
            transition: background-color 0.3s;
          }

          #attach-button:hover {
            background-color: color-mix(in srgb, var(--background-color), white 20%);
          }
          
          #attach-button:active {
            background-color: color-mix(in srgb, var(--background-color), white 30%);
          }

          #attach-button svg {
            width: 100%;
            height: 100%;
          }

          #attach-button svg path {
            fill: var(--text-color) !important;
            stroke: var(--text-color) !important;
            stroke-width: 2 !important;
          }

        </style>
        <div id="input-chat-container">
          <div id="attach-button">
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="256" height="256" viewBox="0 0 256 256" xml:space="preserve">
              <g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
                <path d="M 26.827 89.998 c -5.832 0 -11.664 -2.22 -16.104 -6.66 c -8.88 -8.88 -8.88 -23.329 0 -32.209 L 56.932 4.921 c 6.563 -6.564 17.244 -6.563 23.805 0 c 6.563 6.563 6.563 17.241 0 23.804 L 37.658 71.804 c -4.245 4.247 -11.155 4.247 -15.401 0 c -4.246 -4.246 -4.246 -11.155 0 -15.401 l 39.3 -39.3 c 0.781 -0.781 2.047 -0.781 2.829 0 c 0.781 0.781 0.781 2.048 0 2.829 l -39.3 39.3 c -2.686 2.686 -2.686 7.057 0 9.743 c 2.687 2.687 7.058 2.685 9.743 0 l 43.079 -43.079 c 5.003 -5.003 5.003 -13.144 0 -18.147 c -5.004 -5.004 -13.145 -5.003 -18.147 0 L 13.552 53.959 c -7.319 7.32 -7.319 19.231 0 26.551 c 7.322 7.32 19.232 7.319 26.551 0 L 82.533 38.08 c 0.781 -0.781 2.047 -0.781 2.829 0 c 0.781 0.781 0.781 2.048 0 2.829 L 42.931 83.339 C 38.491 87.778 32.659 89.998 26.827 89.998 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round"/>
              </g>
            </svg>
          </div>
            <input type="text" id="input-chat-field" placeholder="Type a message..." autocomplete="off" />
          <div id="send-button">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.20308 1.04312C1.00481 0.954998 0.772341 1.0048 0.627577 1.16641C0.482813 1.32802 0.458794 1.56455 0.568117 1.75196L3.92115 7.50002L0.568117 13.2481C0.458794 13.4355 0.482813 13.672 0.627577 13.8336C0.772341 13.9952 1.00481 14.045 1.20308 13.9569L14.7031 7.95693C14.8836 7.87668 15 7.69762 15 7.50002C15 7.30243 14.8836 7.12337 14.7031 7.04312L1.20308 1.04312ZM4.84553 7.10002L2.21234 2.586L13.2689 7.50002L2.21234 12.414L4.84552 7.90002H9C9.22092 7.90002 9.4 7.72094 9.4 7.50002C9.4 7.27911 9.22092 7.10002 9 7.10002H4.84553Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
          </div>
        </div>
      `;
  }

  focus() {
    const inputField = this.shadowRoot.getElementById('input-chat-field');
    inputField.focus();
  }

  connectedCallback() {
    const sendButton = this.shadowRoot.getElementById('send-button');
    const inputField = this.shadowRoot.getElementById('input-chat-field');
    const attachButton = this.shadowRoot.getElementById('attach-button');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    this.shadowRoot.appendChild(fileInput);

    attachButton.addEventListener('click', () => {
      fileInput.click();
    });

    // Manejar envío de archivos como uploadFile en client.js
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const MAX_PAYLOAD_SIZE = 1024 * 1024 * 500; // 500 MB
      if (file.size > MAX_PAYLOAD_SIZE) {
        alert('El archivo debe ser menor a 500MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rawData = ev.target.result;
        let websocket = window.websocket;
        let chatScreen = document.querySelector('wsc-chat-screen');
        let clientSelected = chatScreen?.selectedClient || { id: null };
        const targetId = clientSelected.id || 'groupAll';
        websocket?.send(
          JSON.stringify({
            type: 'attachment',
            data: Array.from(new Uint8Array(rawData)),
            filename: file.name,
            targetId,
            from: window.clientAlias ?? 'nullOnAttachmentClientInput',
          })
        );
        // Opcional: mostrar en el chat
        const messageListFile = document.querySelector('wsc-message-list');
        const blob = new Blob([new Uint8Array(rawData)], {
          type: 'application/octet-stream',
        });
        const url = URL.createObjectURL(blob);
        const date = new Date();
        // Persistir en IndexedDB como saliente
        try {
          saveMessage({
            sessionId: window.clientId,
            chatId: targetId,
            direction: 'out',
            type: 'file',
            title: 'Tú',
            text: '',
            fileName: file.name,
            blob,
            createdAt: Date.now(),
          });
        } catch {}
        if (messageListFile) {
          // Mostrar archivo únicamente en el chat actualmente seleccionado
          messageListFile.addMessage({
            chatId: clientSelected.id,
            title: 'Tú',
            timestamp:
              date.getHours().toString().padStart(2, '0') +
              ':' +
              date.getMinutes().toString().padStart(2, '0') +
              (date.getHours() >= 12 ? ' pm' : ' am'),
            isIncoming: false,
            type: 'file',
            fileName: file.name,
            blob,
            url,
          });
        }
        fileInput.value = '';
      };
      reader.readAsArrayBuffer(file);
    });

    const sendMessage = () => {
      const message = inputField.value.trim();
      if (!message) return;

      let websocket = window.websocket;
      let chatScreen = document.querySelector('wsc-chat-screen');
      let clientSelected = chatScreen?.selectedClient || {
        id: null,
        alias: null,
      };

      if (!websocket || websocket.readyState !== 1) {
        // 1 = OPEN
        return;
      }
      const targetId = clientSelected.id || 'groupAll';
      if (targetId) {
        websocket.send(
          JSON.stringify({ type: 'message', payload: message, targetId })
        );
      }

      // Guardar y agregar mensaje enviado al componente wsc-message-list
      try {
        saveMessage({
          sessionId: window.clientId,
          chatId: targetId,
          direction: 'out',
          type: 'text',
          title: 'Tú',
          text: message,
          createdAt: Date.now(),
        });
      } catch {}
      const messageListSend = document.querySelector('wsc-message-list');
      if (messageListSend) {
        const date = new Date();
        // Mostrar mensaje propio únicamente en el chat actualmente seleccionado
        messageListSend.addMessage({
          chatId: targetId || null,
          title: 'Tú',
          text: message,
          timestamp:
            date.getHours().toString().padStart(2, '0') +
            ':' +
            date.getMinutes().toString().padStart(2, '0') +
            (date.getHours() >= 12 ? ' pm' : ' am'),
          isIncoming: false,
          type: 'text',
        });
      }
      inputField.value = '';
    };

    sendButton.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  disconnectedCallback() {}

  attributeChangedCallback() {}

  static get observedAttributes() {
    return [];
  }
}

customElements.define('wsc-input-chat', InputChat);
