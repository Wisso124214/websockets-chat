export default class Message extends HTMLElement {
  constructor() {
    super();
    this.title = 'Username';
    this.text = 'This is a message text.';
    this.timestamp = '12:00';
    this.isIncoming = false;
    this.type = 'file'; // could be 'text' or 'file'
    this.fileName = 'document.pdf';
    this.blob = '<a href="#" download>Download</a>';
    this.initialCharLimit = 1100; // caracteres iniciales a mostrar
    this.incrementChars = 1000; // caracteres adicionales por cada clic en "ver más"
    this.currentCharLimit = this.initialCharLimit;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
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
            max-width: 65%;
            min-width: 150px;
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

          // #message-container.outgoing {}
          // #message-container.incoming {}

          #message-container.outgoing > #message-title {
            display: none;
          }
          
          #message-container.incoming > #message-title {
            color: color-mix(in srgb, var(--primary-color), black 25%);
          }

          // #message-container #message-timestamp {
          //   display: absolute;
          //   margin-top: 10px;
          //   padding-bottom: 15px;
          //   font-size: 10px;
          // }

          // #message-container.outgoing > #message-timestamp {
          //   color: color-mix(in srgb, color-mix(in srgb, var(--text-color), transparent 20%), black 0%);
          //   text-align: left;
          //   margin-left: -6px;
          //   margin-bottom: -20px;
          // }
          
          // #message-container.incoming #message-timestamp {
          //   text-align: right;
          //   margin-right: -6px;
          //   margin-bottom: -21px;
          //   color: color-mix(in srgb, color-mix(in srgb, var(--text-color), transparent 15%), black 10%);
          // }

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
            width: 95%;
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
            background-color: red;
            width: 88%;
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
        <div id="message-container-background">
          <div id="message-container" class=${this.isIncoming ? '"incoming"' : '"outgoing"'}">
            <div id="message-title">${this.title}</div>
            <div id="message-content" class=${this.type}">
              ${
                this.type === 'text'
                  ? `<div id="message-text">${this.text}</div>`
                  : `<div id="message-file">${this.fileName}</div>
                    <div id="download-button">${this.blob}</div>`
              }
            </div>
            <div id="message-timestamp">${this.timestamp}</div>
          </div>
        </div>
      `;
  }

  render() {
    const messageContainer =
      this.shadowRoot.querySelector('#message-container');
    const messageTitle = this.shadowRoot.querySelector('#message-title');
    const messageContent = this.shadowRoot.querySelector('#message-content');
    const messageTimestamp =
      this.shadowRoot.querySelector('#message-timestamp');

    // Actualizar el título
    if (messageTitle) {
      messageTitle.textContent = this.title;
    }

    // Actualizar la clase según isIncoming
    if (messageContainer) {
      messageContainer.className = this.isIncoming ? 'incoming' : 'outgoing';
    }

    // Actualizar el contenido según el tipo
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
        messageContent.innerHTML = `<div id="message-file">${this.fileName}</div>
                    <div id="download-button">${this.blob}</div>`;
      }
    }

    // Actualizar el timestamp
    if (messageTimestamp) {
      messageTimestamp.textContent = this.timestamp;
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

  connectedCallback() {}

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      // console.log(name, oldValue, newValue);
      if (name === 'is-incoming') {
        this.isIncoming = newValue !== null;
        console.log('isIncoming set to', this.isIncoming);
      } else {
        // Convertir kebab-case a camelCase para propiedades
        const propName = name.replace(/-([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        this[propName] = newValue;
      }
      // Resetear el límite de caracteres cuando cambia el texto
      if (name === 'text') {
        this.currentCharLimit = this.initialCharLimit;
      }
      this.render();
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
