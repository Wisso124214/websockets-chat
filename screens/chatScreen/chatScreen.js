import MessageList from '../../components/messageList/messageList.js';
import InputChat from '../../components/inputChat/inputChat.js';

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
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.877014 7.49988C0.877014 3.84219 3.84216 0.877045 7.49985 0.877045C11.1575 0.877045 14.1227 3.84219 14.1227 7.49988C14.1227 11.1575 11.1575 14.1227 7.49985 14.1227C3.84216 14.1227 0.877014 11.1575 0.877014 7.49988ZM7.49985 1.82704C4.36683 1.82704 1.82701 4.36686 1.82701 7.49988C1.82701 8.97196 2.38774 10.3131 3.30727 11.3213C4.19074 9.94119 5.73818 9.02499 7.50023 9.02499C9.26206 9.02499 10.8093 9.94097 11.6929 11.3208C12.6121 10.3127 13.1727 8.97172 13.1727 7.49988C13.1727 4.36686 10.6328 1.82704 7.49985 1.82704ZM10.9818 11.9787C10.2839 10.7795 8.9857 9.97499 7.50023 9.97499C6.01458 9.97499 4.71624 10.7797 4.01845 11.9791C4.97952 12.7272 6.18765 13.1727 7.49985 13.1727C8.81227 13.1727 10.0206 12.727 10.9818 11.9787ZM5.14999 6.50487C5.14999 5.207 6.20212 4.15487 7.49999 4.15487C8.79786 4.15487 9.84999 5.207 9.84999 6.50487C9.84999 7.80274 8.79786 8.85487 7.49999 8.85487C6.20212 8.85487 5.14999 7.80274 5.14999 6.50487ZM7.49999 5.10487C6.72679 5.10487 6.09999 5.73167 6.09999 6.50487C6.09999 7.27807 6.72679 7.90487 7.49999 7.90487C8.27319 7.90487 8.89999 7.27807 8.89999 6.50487C8.89999 5.73167 8.27319 5.10487 7.49999 5.10487Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
            </div>
          </div>
          <div id="chat-screen-content">
            <wsc-message-list></wsc-message-list>
            <wsc-input-chat></wsc-input-chat>
          </div>
        </div>
      `;
  }

  connectedCallback() {}

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
  }

  static get observedAttributes() {
    return ['some-attribute'];
  }
}

customElements.define('wsc-chat-screen', ChatScreen);
