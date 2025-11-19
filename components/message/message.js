/**
 * <wsc-message>
 * Representa un mensaje individual (texto o archivo) dentro de un chat.
 * Características:
 *  - Diferencia mensajes entrantes vs salientes (estilos y ocultar título propio).
 *  - Soporta truncado/expandir texto largo (toggleExpand).
 *  - Manejo de blobs para archivos con botón de descarga y metadatos (tamaño/extensión).
 *  - Limpieza de recursos URL al desconectarse.
 * Props relevantes:
 *  - title: Alias del emisor (para grupos) o "Tú" si saliente.
 *  - text: Contenido textual (si type==='text').
 *  - timestamp: Hora formateada del mensaje.
 *  - isIncoming: Booleano de dirección.
 *  - type: 'text' | 'file'.
 *  - fileName, blob, url: Datos del archivo si aplica.
 *  - chat: 'personal' | 'group' usado para mostrar título.
 */
export default class Message extends HTMLElement {
  constructor({
    title = '',
    text = '',
    timestamp = '',
    isIncoming = false,
    type = 'text',
    chat = 'personal',
    fileName = '',
    blob = null,
    url = '',
  } = {}) {
    super();
    this.title = title;
    this.text = text;
    this.timestamp = timestamp;
    this.isIncoming = isIncoming;
    this.type = type;
    this.fileName = fileName;
    this.blob = blob;
    this.url = url;
    this.fileUrl = null; // URL creada a partir del blob
    this.initialCharLimit = 1100; // caracteres iniciales a mostrar
    this.incrementChars = 1000; // caracteres adicionales por cada clic en "ver más"
    this.currentCharLimit = this.initialCharLimit;
    this.chat = chat; // 'personal' | 'group'

    this.attachShadow({ mode: 'open' });
    this.styleTemplate = `
        <style>
          #message-container-background {
            color: white;
            width: 100vw;
            display: flex;            
          }

          #message-container {
            border-radius: 10px;
            padding: 15px 22px;
            margin: 8px 0;
            width: max-content;
            max-width: 65%;
            text-align: left;
          }

          
          #message-container.outgoing {
            background-color: color-mix(in srgb, var(--primary-color), black 45%);
            margin-left: auto;
            margin-right: 15px;
            align-self: flex-end;
          }
          
          #message-container.incoming {
            background-color: color-mix(in srgb, var(--background-color), white 5%);
            margin-right: auto;
            margin-left: 15px;
            align-self: flex-start;
          }

          #message-container.outgoing > #message-title {
            display: none;
          }
          
          #message-container.incoming > #message-title {
            color: color-mix(in srgb, var(--primary-color), black 25%);
          }

          #message-container #message-timestamp {
            display: absolute;
            text-align: right;
            margin-right: -6px;
            margin-top: 7px;
            margin-bottom: -22px;
            padding-bottom: 15px;
            font-size: 10px;
          }

          #message-container.outgoing > #message-timestamp {
            color: color-mix(in srgb, color-mix(in srgb, var(--text-color), transparent 20%), black 0%);
          }
          
          #message-container.incoming #message-timestamp {
            margin-bottom: -21px;
            color: color-mix(in srgb, color-mix(in srgb, var(--text-color), transparent 15%), black 10%);
          }

          #message-content {
            width: 100%;
            margin: 0 auto;
          }

          #message-title {
            font-weight: bold;
            margin-bottom: 10px;
            margin-top: -5px;
            margin-left: -6px;
            font-size: 14px;
          }

          #message-text {
            width: max-content;
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
          }

          #see-more-button {
            position: relative;
            background: none;
            padding: 0;
            border: none;
            color: var(--primary-color-detail);
            font-family: Verdana, sans-serif;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
            text-decoration: underline;
            display: inline-block;
            transform: scale(.9);
            margin: 10px 0;
            width: max-content;
          }

          #message-container.outgoing #see-more-button:hover.more {
            color: color-mix(in srgb, var(--primary-color-detail), blue 15%);
          }

          #message-container.outgoing #see-more-button:active.more {
            color: color-mix(in srgb, var(--primary-color-detail), blue 20%);
          }

          #message-container.outgoing #see-more-button.less {
            color: color-mix(in srgb, color-mix(in srgb, var(--background-color), blue 0%), white 5%);
          }

          #message-container.outgoing #see-more-button:hover.less {
            color: color-mix(in srgb, color-mix(in srgb, var(--background-color), blue 0%), white 15%);
          }

          #message-container.outgoing #see-more-button:active.less {
            color: color-mix(in srgb, color-mix(in srgb, var(--background-color), blue 0%), white 20%);
          }

          #message-container.incoming #see-more-button {
            left: 35px;
          }
          
          #message-container.incoming #see-more-button.more {
            color: color-mix(in srgb, var(--primary-color-detail), blue 15%);
          }

          #message-container.incoming #see-more-button:hover.more {
            color: color-mix(in srgb, var(--primary-color-detail), blue 30%);
          }

          #message-container.incoming #see-more-button:active.more {
            color: color-mix(in srgb, var(--primary-color-detail), blue 35%);
          }

          #message-container.incoming #see-more-button.less {
            color: color-mix(in srgb, color-mix(in srgb, var(--primary-color-detail), blue 20%), transparent 25%);
          }

          #message-container.incoming #see-more-button:hover.less {
            color: color-mix(in srgb, color-mix(in srgb, var(--primary-color-detail), blue 20%), transparent 45%);
          }

          #message-container.incoming #see-more-button:active.less {
            color: color-mix(in srgb, color-mix(in srgb, var(--primary-color-detail), blue 20%), transparent 50%);
          }


          /* File message styles */

          #message-file-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          #message-file-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            width: 100%;
            padding: 12px 18px;
            border-radius: 10px;
            align-self: center;
          }

          #message-container.outgoing #message-file-content {
            background-color: color-mix(in srgb, var(--primary-color), black 60%);
          }
          
          #message-container.incoming #message-file-content {
            background-color: color-mix(in srgb, var(--background-color), white 15%);            
          }

          #message-file {
            font-weight: bold;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
          }

          #download-button {
            cursor: pointer;
            width: 20px;
            height: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 100px;
            padding: 3px;
            margin: 0;
            border: 1px solid color-mix(in srgb, var(--text-color) 70%, transparent);
          }

          #download-button:hover {
            background-color: color-mix(in srgb, var(--background-color) 20%, transparent);
          }

          #download-button:active {
            background-color: color-mix(in srgb, var(--background-color) 35%, transparent);
          }

          #download-button svg {
            width: 80%;
            height: 80%;
          }

          #download-button svg path {
            stroke: var(--text-color);
            stroke-width: 2px;
          }

          #metadata-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin-bottom: -15px;
            width: max-content;
            margin-left: -10px;
          }

          #file-size {
            font-size: 12px;
            color: var(--secondary-text-color);
          }

          #file-separator {
            margin: 0 8px;
            font-weight: bold;
            color: var(--secondary-text-color);
          }

          #file-extension {
            font-size: 12px;
            color: var(--secondary-text-color);
          }

          /* Mobile styles */
          @media screen and (max-width: 700px) {
            #message-container {
              font-size: 13px;
            }

            #message-container.outgoing #see-more-button {
              margin-left: calc(87% - 35px);
            }
          }

          /* Desktop styles */
          @media screen and (min-width: 700px) {
            #message-container.outgoing #see-more-button {
              margin-left: calc(95% - 35px);
            }
          }
        </style>
    `;
    this.shadowRoot.innerHTML =
      this.styleTemplate +
      `
        <div id="message-container-background">
          <div id="message-container" class=${this.isIncoming ? '"incoming"' : '"outgoing"'}">
            <div id="message-title">${this.title}</div>
            <div id="message-content" class=${this.type}">
              ${
                this.type === 'text'
                  ? `<div id="message-text">${this.text}</div>`
                  : null
              }
            </div>
            <div id="message-timestamp">${this.timestamp}</div>
          </div>
        </div>
      `;
  }

  render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML =
      this.styleTemplate +
      `
      <div id="message-container-background">
        <div id="message-container" class="${this.isIncoming ? 'incoming' : 'outgoing'}">
          ${this.chat !== 'personal' ? `<div id='message-title'>${this.title}</div>` : ''}
          <div id="message-content" class="${this.type}">
            ${
              this.type === 'text'
                ? `<div id="message-text">${this.text}</div>`
                : ''
            }
          </div>
          <div id="message-timestamp">${this.timestamp}</div>
        </div>
      </div>
    `;

    // Actualizar el contenido según el tipo
    const messageContent = this.shadowRoot.querySelector('#message-content');
    if (messageContent) {
      if (this.type === 'text') {
        const isLongText = this.text.length > this.initialCharLimit;
        const isFullyExpanded = this.currentCharLimit >= this.text.length;
        const displayText =
          isLongText && !isFullyExpanded
            ? this.text.substring(0, this.currentCharLimit) + '...'
            : this.text;

        messageContent.innerHTML = `
          <div id="message-text">${displayText}</div>
          ${isLongText && !isFullyExpanded ? `<button id="see-more-button" class="more">Ver más...</button>` : ''}
          ${isLongText && isFullyExpanded && this.currentCharLimit > this.initialCharLimit ? `<button id="see-more-button" class="less">Ver menos</button>` : ''}
        `;

        // Agregar event listener al botón si existe
        const seeMoreButton = messageContent.querySelector('#see-more-button');
        if (seeMoreButton) {
          seeMoreButton.addEventListener('click', () => this.toggleExpand());
        }
      } else if (this.type === 'file') {
        // Limpiar URL anterior si existe
        if (this.fileUrl) {
          URL.revokeObjectURL(this.fileUrl);
          this.fileUrl = null;
        }
        // Crear URL a partir del blob si existe
        if (this.blob instanceof Blob) {
          this.fileUrl = URL.createObjectURL(this.blob);
        } else if (this.url) {
          this.fileUrl = this.url;
        } else {
          this.fileUrl = '';
        }
        // Calcular tamaño del archivo
        let fileSize = '';
        if (this.blob && this.blob.size) {
          const size = this.blob.size;
          if (size < 1024) fileSize = size + ' B';
          else if (size < 1024 * 1024)
            fileSize = (size / 1024).toFixed(1) + ' KB';
          else fileSize = (size / (1024 * 1024)).toFixed(2) + ' MB';
        } else {
          fileSize = 'Desconocido';
        }
        messageContent.innerHTML = `
          <div id="message-file-container">
            <div id="message-file-content">
              <div id="message-file">${this.fileName}</div>
              <a id="download-button" href="${this.fileUrl}" download="${this.fileName}">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="Interface / Download"> <path id="Vector" d="M6 21H18M12 3V17M12 17L17 12M12 17L7 12" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g> </g></svg>
              </a>
            </div>
            <div id="metadata-container">
              <div id="file-size">${fileSize}</div>
              <div id="file-separator">·</div>
              <div id="file-extension">${this.fileName.split('.').pop().toUpperCase()}</div>
            </div>
          </div>`;
      }
    }
  }

  toggleExpand() {
    const isFullyExpanded = this.currentCharLimit >= this.text.length;

    if (isFullyExpanded) {
      // Si está completamente expandido, colapsar al estado inicial
      this.currentCharLimit = this.initialCharLimit;
    } else {
      // Si no está completamente expandido, incrementar el límite
      this.currentCharLimit += this.incrementChars;
    }

    this.render();
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // Limpiar el objeto URL si existe
    if (this.fileUrl) {
      URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = null;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'is-incoming') {
        this.isIncoming = newValue !== null;
      } else {
        const propName = name.replace(/-([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        this[propName] = newValue;
      }
      if (name === 'text') {
        this.currentCharLimit = this.initialCharLimit;
      }
      // Solo renderizar si el shadowRoot existe
      if (this.shadowRoot) this.render();
    }
  }

  static get observedAttributes() {
    return [
      'title',
      'text',
      'timestamp',
      'is-incoming',
      'type',
      'file-name',
      'blob',
    ];
  }
}

customElements.define('wsc-message', Message);
