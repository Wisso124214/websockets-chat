import Message from '../message/Message.js';

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
    title,
    text,
    timestamp,
    isIncoming,
    type = 'text',
    fileName,
    blob,
  }) {
    // Si el contenedor no está cargado, cargarlo y esperar
    if (!this.messageContainer) {
      this.loadMessageContainer();
    }
    // Esperar a que messageContainer esté disponible usando la promesa
    this._containerReady.then(() => {
      const msg = new Message({
        title,
        text,
        timestamp,
        isIncoming,
        type,
        fileName,
        blob,
      });
      this.messageContainer.appendChild(msg);
      msg.render();
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

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
  }

  static get observedAttributes() {
    return ['some-attribute'];
  }
}

customElements.define('wsc-message-list', MessageList);
