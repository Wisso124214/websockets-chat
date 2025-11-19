import Message from '../message/Message.js';

/**
 * <wsc-message-list>
 * Panel que muestra los mensajes del chat seleccionado.
 * Responsabilidades:
 *  - Mantener scroll al fondo automáticamente usando MutationObserver.
 *  - Reproducir notificaciones (audio / beep) diferenciando chat activo vs otros.
 *  - addMessage decide si renderizar según chat actualmente seleccionado para evitar mezcla.
 *  - clearMessages para reiniciar vista.
 *  - Diferenciar tipo de mensaje (texto/archivo) delegando a `<wsc-message>`.
 */

// Pre-carga de audios de notificación.
// "current" = mensaje entrante en el chat abierto actualmente.
// "other" = mensaje entrante para otro chat (no seleccionado).
const incomingAudio = new Audio('./assets/message-incoming.mp3');
incomingAudio.preload = 'auto';
incomingAudio.volume = 0.85;
const otherAudio = new Audio('./assets/notification.mp3');
otherAudio.preload = 'auto';
otherAudio.volume = 0.75;

function playNotification(kind) {
  const audio = kind === 'current' ? incomingAudio : otherAudio;
  // Intentar reproducir; si falla (autoplay), hacer un beep de fallback.
  audio.currentTime = 0; // reiniciar para reproducir múltiples veces seguidas
  audio.play().catch(() => {
    // Fallback mínimo usando Web Audio si el usuario ya otorgó interacción.
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = kind === 'current' ? 660 : 440;
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  });
}

export default class MessageList extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        /* Mobile styles */
        @media screen and (max-width: 700px) {}

        /* Desktop styles */
        @media screen and (min-width: 700px) {}

        #message-list-container-background {
          position: absolute;
          top: 70px;
          left: 0;
          width: 100vw;
          height: calc(100vh - 70px);
          background-color: color-mix(in srgb, var(--primary-color), black 90%);
          z-index: 0;
        }

        #message-list-image-container {
          position: absolute;
          top: 70px;
          left: 0;
          width: 100vw;
          height: calc(100vh - 70px);

          background-image: url('./assets/background.png');
          background-size: 200px;
          background-repeat: repeat;
          opacity: .2;
          z-index: 1;
          pointer-events: none;
        }

        #message-list-container {
          position: absolute;
          top: 70px;
          left: 0;
          width: 100vw;
          height: calc(100vh - 130px);
          touch-action: pan-y;
          overflow: hidden;
          scrollbar-width: thin;

          align-items: start;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          backdrop-filter: blur(1px);
          z-index: 2;
        }
      </style>
      <div id="message-list-container-background"></div>
      <div id="message-list-image-container"></div>
      <div id="message-list-container"></div>
    `;

    // Promesa para esperar a que messageContainer esté disponible
    this._containerReady = new Promise((resolve) => {
      this._resolveContainerReady = resolve;
    });
  }

  connectedCallback() {
    this.loadMessageContainer();
  }
  /**
   * Carga el contenedor de mensajes y configura el observer
   */
  loadMessageContainer() {
    this.messageContainer = this.shadowRoot.querySelector(
      '#message-list-container'
    );
    this.scrollToBottom();
    this.observer = new MutationObserver(() => {
      this.scrollToBottom();
    });
    this.observer.observe(this.messageContainer, {
      childList: true,
      subtree: false,
    });
    // Resolver la promesa cuando el container esté listo
    if (this._resolveContainerReady) {
      this._resolveContainerReady();
    }
  }

  /**
   * Agrega un mensaje dinámicamente
   * @param {Object} options { title, text, timestamp, isIncoming, type, fileName, blob }
   */
  addMessage({
    id_target,
    chatId,
    title,
    text,
    timestamp,
    isIncoming,
    type = 'text',
    fileName,
    blob,
    id,
  }) {
    // Obtener los chats dentro del Shadow DOM de wsc-chat-list
    const chatListEl = document.getElementById('wsc-chat-list');
    let chat = null;
    const targetChatId =
      chatId || (id_target && id_target.startsWith('group') ? id_target : null);
    if (chatListEl && chatListEl.shadowRoot) {
      const container = chatListEl.shadowRoot.getElementById(
        'chat-list-container'
      );
      console.log('container', container);
      if (container) {
        const chats = Array.from(container.children);
        console.log('chats', chats);
        if (targetChatId) {
          for (const ch of chats) {
            console.log(
              'try match',
              ch.userId,
              targetChatId,
              ch.userId === targetChatId
            );
            if (ch.userId === targetChatId) {
              chat = ch;
              break;
            }
          }
        }
      }
    }

    console.log('chat', chat);
    if (chat) {
      // Evitar contar como no leído si el chat está seleccionado actualmente
      const chatScreen = document.querySelector('wsc-chat-screen');
      const selectedId =
        chatScreen && chatScreen.selectedClient
          ? chatScreen.selectedClient.id
          : null;
      const isSelected =
        selectedId && targetChatId && selectedId === targetChatId;
      const newUnread = chat.unreadCount + (isIncoming && !isSelected ? 1 : 0);
      chat.setData({
        lastMessage: type === 'text' ? text : `Archivo: ${fileName}`,
        timestampLastMessage: timestamp,
        unreadCount: newUnread,
      });

      // Mover el chat al tope por actividad reciente
      const chatListEl = document.getElementById('wsc-chat-list');
      if (chatListEl && chatListEl.shadowRoot) {
        const container = chatListEl.shadowRoot.getElementById(
          'chat-list-container'
        );
        if (container && chat.parentElement === container) {
          container.prepend(chat);
        }
      }
      // Solo renderizar el mensaje en el panel si es el chat seleccionado
      // Reproducir sonido según si el mensaje entra al chat abierto o a otro.
      if (isIncoming) {
        playNotification(isSelected ? 'current' : 'other');
      }
      if (!isSelected) {
        return; // No renderizar mensajes de otros chats aquí
      }
    } else {
      // Si no encontramos chat destino, no renderizar en el panel global
      // para evitar mezclar mensajes entre chats.
      if (isIncoming) {
        playNotification('other');
      }
      return;
    }

    // Si el contenedor no está cargado, cargarlo y esperar
    if (!this.messageContainer) {
      this.loadMessageContainer();
    }
    // Esperar a que messageContainer esté disponible usando la promesa
    this._containerReady.then(() => {
      const chatType =
        targetChatId && String(targetChatId).startsWith('group')
          ? 'group'
          : 'personal';
      const msg = new Message({
        title,
        text,
        timestamp,
        isIncoming,
        type,
        fileName,
        blob,
        chat: chatType,
      });
      this.messageContainer.appendChild(msg);
      msg.render();
      // El sonido para mensajes del chat abierto ya se reproduce antes del render.
    });
  }

  /**
   * Limpia todos los mensajes
   */
  clearMessages() {
    this.messageContainer.innerHTML = '';
  }

  disconnectedCallback() {
    // Limpiar el observer cuando se destruye el componente
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  scrollToBottom() {
    if (this.messageContainer) {
      this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
  }

  attributeChangedCallback() {}

  static get observedAttributes() {
    return [];
  }
}

customElements.define('wsc-message-list', MessageList);
