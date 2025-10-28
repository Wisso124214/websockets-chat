import ChatList from '../../components/chatList/ChatList.js';

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

  connectedCallback() {}

  disconnectedCallback() {}
}

customElements.define('wsc-main-screen', MainScreen);
