import Message from '../message/message.js';

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
      <div id="message-list-container">
        <wsc-message
        
          title="User1"
          text="Hey! How's it going?"
          timestamp="12:00"
          is-incoming
          type="text"
        ></wsc-message>
        <wsc-message
          title="User2"
          text="Really good, thanks! What about you?ssssssssssssssssssssssssssss"
          timestamp="12:01"
          type="text"
        ></wsc-message>
        <wsc-message
          title="User1"
          type="text"
          text="Check out this file I found."
          timestamp="12:02"
          is-incoming
        ></wsc-message>
        <wsc-message
          title="User2"
          type="text"
          
          text="Heyy, this is a longer message to test how text wrapping and overflow handling works in the message component. Let's see if it looks good! Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.&#10;&#10;
            
            Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.&#10;&#10;
            
            Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. "
          timestamp="12:02"
        ></wsc-message>
        <wsc-message
          title="User1"
          type="file"
          file-name="document.pdf"
          blob='<a href="#" download>Download</a>'
          timestamp="12:02"
          is-incoming
        ></wsc-message>

        <wsc-message
          title="User2"
          type="text"
          text="That's really interesting! Thanks for sharing."
          timestamp="12:10"
        ></wsc-message>
        <wsc-message
          title="User2"
          type="file"
          file-name="document2.pdf"
          blob='<a href="#" download>Download</a>'
          timestamp="12:04"
        ></wsc-message>
        <wsc-message
          title="User2"
          type="text"
          text="That's really interesting! Thanks for sharing."
          timestamp="12:10"
          is-incoming
        ></wsc-message>
        <wsc-message
          title="User2"
          text="Really good, thanks! What about you?ssssssssssssssssssssssssssss"
          timestamp="12:01"
          type="text"
        ></wsc-message>
      </div>
    `;
  }

  connectedCallback() {
    this.messageContainer = this.shadowRoot.querySelector(
      '#message-list-container'
    );

    // Hacer scroll al final cuando se carga el componente
    this.scrollToBottom();

    // Observar cambios en los hijos del contenedor
    this.observer = new MutationObserver(() => {
      this.scrollToBottom();
    });

    this.observer.observe(this.messageContainer, {
      childList: true,
      subtree: false,
    });
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
