import ChatList from '../../components/chatList/ChatList.js';

/**
 * <wsc-main-screen>
 * Pantalla principal inicial del chat.
 * Muestra el título y controla la visibilidad de la lista de chats.
 * Métodos:
 *  - showScreen(): Hace visible la pantalla y muestra la lista de chats.
 *  - hideScreen(): Oculta la pantalla y la lista de chats.
 */

export default class MainScreen extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
        <style>
          #main-title {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            margin: 0;
            padding: 20px;
            width: calc(100vw - 40px);
            background-color: color-mix(in srgb, var(--background-color), white 2%);
          }

          #refresh-button {
            position: absolute;
            top: 20px;
            right: 155px;
            width: 34px;
            height: 34px;
            border-radius: 999px;
            border: 1px solid color-mix(in srgb, var(--text-color) 35%, transparent);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            background: color-mix(in srgb, var(--background-color), white 5%);
            transition: background-color .2s;
          }
          #refresh-button:hover {
            background: color-mix(in srgb, var(--background-color), white 12%);
          }
          #refresh-button svg { width: 18px; height: 18px; }
          #refresh-button svg path { fill: var(--text-color); }

          #session-badge {
            position: absolute;
            top: 22px;
            right: 20px;
            background-color: var(--primary-color, #007bff);
            color: var(--background-color, #fff);
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            display: none;
            max-width: 50vw;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            transition: background-color .25s;
          }
          #session-badge:hover {
            background-color: color-mix(in srgb, var(--primary-color, #007bff), black 15%);
          }
          
          /* Mobile styles */
          @media screen and (max-width: 700px) {
            #main-title {
              font-size: 25px;
            }
          }

          /* Desktop styles */
          @media screen and (min-width: 700px) {
            #main-title {
              font-size: 28px;
            }
          }
        </style>
        <h1 id="main-title">WebSockets Chat</h1>
        <div id="refresh-button" title="Refrescar historial">
          <svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 1.5C4.73858 1.5 2.5 3.73858 2.5 6.5C2.5 7.0657 2.59226 7.60944 2.76158 8.11692C2.82718 8.3131 2.71929 8.52638 2.52312 8.59198C2.32694 8.65758 2.11366 8.54969 2.04806 8.35351C1.85339 7.76965 1.75 7.14686 1.75 6.5C1.75 3.32436 4.32436 0.75 7.5 0.75C9.26282 0.75 10.8417 1.50547 11.9395 2.71631V1.5C11.9395 1.22386 12.1634 1 12.4395 1C12.7156 1 12.9395 1.22386 12.9395 1.5V4.25C12.9395 4.52614 12.7156 4.75 12.4395 4.75H9.68945C9.41331 4.75 9.18945 4.52614 9.18945 4.25C9.18945 3.97386 9.41331 3.75 9.68945 3.75H11.1407C10.1873 2.58422 8.91474 1.85644 7.5 1.85644V1.5ZM12.2384 6.88308C12.1728 6.6869 12.2807 6.47362 12.4769 6.40802C12.6731 6.34242 12.8863 6.45031 12.9519 6.64649C13.1466 7.23035 13.25 7.85314 13.25 8.5C13.25 11.6756 10.6756 14.25 7.5 14.25C5.73718 14.25 4.1583 13.4945 3.06055 12.2837V13.5C3.06055 13.7761 2.83669 14 2.56055 14C2.28441 14 2.06055 13.7761 2.06055 13.5V10.75C2.06055 10.4739 2.28441 10.25 2.56055 10.25H5.31055C5.58669 10.25 5.81055 10.4739 5.81055 10.75C5.81055 11.0261 5.58669 11.25 5.31055 11.25H3.85929C4.81273 12.4158 6.08526 13.1436 7.5 13.1436C10.6756 13.1436 13.25 10.5692 13.25 7.39355C13.25 6.8343 13.1577 6.29056 12.9884 5.78308Z"/></svg>
        </div>
        <div id="session-badge"></div>
      `;
  }

  hideScreen() {
    this.style.display = 'none';
    const chatList = document.getElementById('wsc-chat-list');
    if (chatList) {
      chatList.hideList();
    }
  }

  showScreen() {
    this.style.display = 'block';
    const chatList = document.getElementById('wsc-chat-list');
    if (chatList) {
      chatList.showList();
    }
  }

  setActiveSessionLabel(text) {
    const badge = this.shadowRoot.getElementById('session-badge');
    if (!badge) return;
    if (text && String(text).trim().length > 0) {
      badge.textContent = `Sesión activa: ${text}`;
      badge.style.display = 'inline-block';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  connectedCallback() {
    const badge = this.shadowRoot.getElementById('session-badge');
    if (badge) {
      badge.addEventListener('click', () => {
        if (typeof window.openSessionSwitcher === 'function') {
          window.openSessionSwitcher();
        }
      });
    }
    const refreshBtn = this.shadowRoot.getElementById('refresh-button');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (typeof window.refreshSessionHistory === 'function') {
          window.refreshSessionHistory();
        }
      });
    }
  }

  disconnectedCallback() {}
}

customElements.define('wsc-main-screen', MainScreen);
