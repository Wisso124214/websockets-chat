import MessageList from '../../components/messageList/MessageList.js';
import InputChat from '../../components/inputChat/InputChat.js';
import {
  getMessagesByChat,
  deleteMessagesByChat,
} from '../../components/db/indexedDB.js';

export default class ChatScreen extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
        <style>
          #chat-screen-header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            width: calc(100vw);
            background-color: color-mix(in srgb, var(--background-color), white 2%);
            display: flex;
            align-items: center;
          }

          #chat-screen-title {
            margin: 0;
            padding: 20px;
            padding-right: 20px;
            font-weight: bold;
            text-align: right;
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
            width: calc(100vw - 170px);
          }
          
          #back-button {
            margin-left: 15px;
            font-size: 24px;
            cursor: pointer;
            z-index: 1000;
            width: 50px;
            height: 50px;
            text-align: center;
            top: 15px;
            justify-content: center;
            align-items: center;
            display: flex;
            border-radius: 100px;
            color: var(--text-color);
            transition: background-color 0.3s;
          }

          #back-button:hover {
            background-color: color-mix(in srgb, var(--background-color), white 10%);
          }
          
          #back-button:active {
            background-color: color-mix(in srgb, var(--background-color), white 17%);
          }

          #back-button svg {
            width: 30px;
            height: 30px;
          }

          #back-button svg path {
            fill: var(--text-color);
            stroke: var(--text-color);
            stroke-width: 1px;
          }

          #header-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 10px;
          }

          #header-content svg {
            width: 40px;
            height: 40px;
            margin-right: 10px;
          }

          /* Avatar menu */
          #chat-screen-header { position: relative; }
          #avatar-menu {
            position: absolute;
            top: 60px;
            right: 10px;
            background: color-mix(in srgb, var(--background-color), white 3%);
            border: 1px solid color-mix(in srgb, var(--text-color) 40%, transparent);
            border-radius: 8px;
            box-shadow: 0 6px 16px rgba(0,0,0,.25);
            min-width: 220px;
            padding: 6px 0;
            display: none;
            z-index: 1200;
          }
          #avatar-menu.active { display: block; }
          .menu-item {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 14px;
            cursor: pointer;
            color: var(--text-color);
          }
          .menu-item:hover { background: color-mix(in srgb, var(--background-color), white 10%); }
          .menu-item svg { width: 18px; height: 18px; }

          /* Mobile styles */
          @media screen and (max-width: 700px) {
            #chat-screen-title {
              font-size: 22px;
            }
          }

          /* Desktop styles */
          @media screen and (min-width: 700px) {
            #chat-screen-title {
              font-size: 24px;
            }
          }
        </style>
        <div id="chat-screen-container">
          <div id="chat-screen-header">
              <div id="back-button">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.85355 3.14645C7.04882 3.34171 7.04882 3.65829 6.85355 3.85355L3.70711 7H12.5C12.7761 7 13 7.22386 13 7.5C13 7.77614 12.7761 8 12.5 8H3.70711L6.85355 11.1464C7.04882 11.3417 7.04882 11.6583 6.85355 11.8536C6.65829 12.0488 6.34171 12.0488 6.14645 11.8536L2.14645 7.85355C1.95118 7.65829 1.95118 7.34171 2.14645 7.14645L6.14645 3.14645C6.34171 2.95118 6.65829 2.95118 6.85355 3.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
            </div>
            <div id="header-content">
              <div id="chat-screen-title">Chat Screen</div>
              <svg id="icon-avatar" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.877014 7.49988C0.877014 3.84219 3.84216 0.877045 7.49985 0.877045C11.1575 0.877045 14.1227 3.84219 14.1227 7.49988C14.1227 11.1575 11.1575 14.1227 7.49985 14.1227C3.84216 14.1227 0.877014 11.1575 0.877014 7.49988ZM7.49985 1.82704C4.36683 1.82704 1.82701 4.36686 1.82701 7.49988C1.82701 8.97196 2.38774 10.3131 3.30727 11.3213C4.19074 9.94119 5.73818 9.02499 7.50023 9.02499C9.26206 9.02499 10.8093 9.94097 11.6929 11.3208C12.6121 10.3127 13.1727 8.97172 13.1727 7.49988C13.1727 4.36686 10.6328 1.82704 7.49985 1.82704ZM10.9818 11.9787C10.2839 10.7795 8.9857 9.97499 7.50023 9.97499C6.01458 9.97499 4.71624 10.7797 4.01845 11.9791C4.97952 12.7272 6.18765 13.1727 7.49985 13.1727C8.81227 13.1727 10.0206 12.727 10.9818 11.9787ZM5.14999 6.50487C5.14999 5.207 6.20212 4.15487 7.49999 4.15487C8.79786 4.15487 9.84999 5.207 9.84999 6.50487C9.84999 7.80274 8.79786 8.85487 7.49999 8.85487C6.20212 8.85487 5.14999 7.80274 5.14999 6.50487ZM7.49999 5.10487C6.72679 5.10487 6.09999 5.73167 6.09999 6.50487C6.09999 7.27807 6.72679 7.90487 7.49999 7.90487C8.27319 7.90487 8.89999 7.27807 8.89999 6.50487C8.89999 5.73167 8.27319 5.10487 7.49999 5.10487Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
            </div>
            <div id="avatar-menu">
              <div id="menu-clear-chat" class="menu-item">
                <span>Eliminar mensajes</span>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C4.44772 13 4 12.5523 4 12V4L3.5 4C3.22386 4 3 3.77614 3 3.5ZM5 4H10V12H5V4Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
              </div>
            </div>
          </div>
          <div id="chat-screen-content"></div>
        </div>
      `;

    const chatScreen = this.shadowRoot.getElementById('chat-screen-container');
    this.hideScreen();

    // Agregar el event listener al botón back
    const backButton = this.shadowRoot.getElementById('back-button');
    if (backButton && chatScreen) {
      backButton.addEventListener('click', () => {
        this.hideScreen();
        const mainScreen = document.querySelector('wsc-main-screen');
        if (mainScreen) {
          mainScreen.showScreen();
        }
      });
    }

    // Menú del avatar
    const avatarIcon = this.shadowRoot.getElementById('icon-avatar');
    const avatarMenu = this.shadowRoot.getElementById('avatar-menu');
    const menuClear = this.shadowRoot.getElementById('menu-clear-chat');
    const closeMenu = () => avatarMenu?.classList.remove('active');
    const toggleMenu = (e) => {
      e?.stopPropagation();
      if (!avatarMenu) return;
      avatarMenu.classList.toggle('active');
    };
    if (avatarIcon) {
      avatarIcon.style.cursor = 'pointer';
      avatarIcon.addEventListener('click', toggleMenu);
    }
    // Cerrar al hacer click fuera
    const outsideHandler = (e) => {
      if (!avatarMenu || !avatarMenu.classList.contains('active')) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (!path.includes(avatarMenu) && !path.includes(avatarIcon)) {
        closeMenu();
      }
    };
    window.addEventListener('click', outsideHandler);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    if (menuClear) {
      menuClear.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        const userId = this.chatUserId;
        const userName =
          this.shadowRoot.getElementById('chat-screen-title')?.textContent ||
          '';
        if (!userId) return;
        const modal = document.querySelector('wsc-modal-input');
        if (!modal) return;
        // Configurar modal en modo confirm y delegar acción al _submitHandler
        modal.message = `¿Borrar todos los mensajes de "${userName}"?`;
        modal.mode = 'confirm';
        modal.okText = 'Aceptar';
        modal.cancelText = 'Cancelar';
        modal._submitHandler = async () => {
          try {
            await deleteMessagesByChat(userId, window.clientId);
          } catch {}
          const messageList = document.querySelector('wsc-message-list');
          if (messageList && typeof messageList.clearMessages === 'function') {
            messageList.clearMessages();
          }
          const chatListEl = document.getElementById('wsc-chat-list');
          if (chatListEl && chatListEl.shadowRoot) {
            const container = chatListEl.shadowRoot.getElementById(
              'chat-list-container'
            );
            if (container) {
              const chats = Array.from(container.children);
              for (const ch of chats) {
                if (ch.userId === userId) {
                  ch.setData({
                    lastMessage: '',
                    timestampLastMessage: '',
                    unreadCount: 0,
                  });
                  break;
                }
              }
            }
          }
          // Evitar fugas: resetear handler tras uso
          modal._submitHandler = () => {};
        };
        modal.render();
        modal.changeVisibility(true);
      });
    }
  }

  hideScreen() {
    const chatScreen = this.shadowRoot.getElementById('chat-screen-container');
    if (chatScreen) {
      chatScreen.style.display = 'none';
    }
    // Al ocultar la pantalla, limpiar el chat seleccionado para que
    // nuevos mensajes incrementen correctamente los no leídos.
    this.chatUserId = null;
    // Ocultar los componentes globales
    const messageList = document.querySelector('wsc-message-list');
    if (messageList) messageList.style.display = 'none';
    const inputChat = document.querySelector('wsc-input-chat');
    if (inputChat) inputChat.style.display = 'none';
  }

  showScreen() {
    const chatScreen = this.shadowRoot.getElementById('chat-screen-container');
    if (chatScreen) {
      chatScreen.style.display = 'flex';
    }
    // Mostrar los componentes globales
    const messageList = document.querySelector('wsc-message-list');
    if (messageList) messageList.style.display = 'block';
    const inputChat = document.querySelector('wsc-input-chat');
    if (inputChat) {
      inputChat.style.display = 'block';
      inputChat.focus();
    }
  }

  async selectChat({ userName, userId }) {
    const chatScreenTitle = this.shadowRoot.getElementById('chat-screen-title');
    if (chatScreenTitle) {
      chatScreenTitle.textContent = userName;
    }
    this.setChatUserName(userName);
    this.setChatUserId(userId);

    // Resetear contador de no leídos del chat seleccionado
    const chatListEl = document.getElementById('wsc-chat-list');
    if (chatListEl && chatListEl.shadowRoot) {
      const container = chatListEl.shadowRoot.getElementById(
        'chat-list-container'
      );
      if (container) {
        const chats = Array.from(container.children);
        for (const ch of chats) {
          if (ch.userId === userId) {
            ch.setData({ unreadCount: 0 });
            break;
          }
        }
      }
    }

    // Cargar historial desde IndexedDB para este chat
    const messageList = document.querySelector('wsc-message-list');
    if (messageList && typeof messageList.clearMessages === 'function') {
      messageList.clearMessages();
      try {
        const history = await getMessagesByChat(userId, window.clientId);
        for (const m of history) {
          const d = new Date(m.createdAt || Date.now());
          const ts =
            d.getHours().toString().padStart(2, '0') +
            ':' +
            d.getMinutes().toString().padStart(2, '0') +
            (d.getHours() >= 12 ? ' pm' : ' am');
          messageList.addMessage({
            chatId: userId,
            title: m.title || (m.direction === 'out' ? 'Tú' : ''),
            text: m.type === 'text' ? m.text : undefined,
            timestamp: ts,
            isIncoming: m.direction !== 'out',
            type: m.type,
            fileName: m.fileName,
            blob: m.blob || null,
          });
        }
      } catch (e) {
        // si falla, no bloquea UI
      }
    }
  }

  setChatUserName(userName) {
    const chatScreenTitle = this.shadowRoot.getElementById('chat-screen-title');
    if (chatScreenTitle) {
      chatScreenTitle.textContent = userName;
    }
  }

  setChatUserId(userId) {
    this.chatUserId = userId;
  }

  // Getter para obtener el cliente seleccionado
  get selectedClient() {
    return {
      id: this.chatUserId || null,
      alias:
        this.shadowRoot.getElementById('chat-screen-title')?.textContent ||
        null,
    };
  }

  connectedCallback() {}

  disconnectedCallback() {}

  attributeChangedCallback() {}

  static get observedAttributes() {
    return [];
  }
}

customElements.define('wsc-chat-screen', ChatScreen);
