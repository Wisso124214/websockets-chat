export default class Chat extends HTMLElement {
  constructor({
    userName = 'User Name',
    lastMessage = '',
    timestampLastMessage = '',
    unreadCount = 0,
    userId = null,
    members = [],
  } = {}) {
    super();

    this.userName = userName;
    this.lastMessage = lastMessage;
    this.unreadCount = unreadCount;
    this.timestampLastMessage = timestampLastMessage;
    this.userId = userId;
    this.members = members;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
        <style>
          #chat-container {
            display: flex;
            flex-direction: row;
            border-radius: 12px;
            margin: 0 5px;
            margin-top: 10px;
            padding: 10px 0;
            height: 50px;
            width: calc(100% - 20px);
            transition: transform 0.3s;
          }

          #chat-container:hover, #chat-container:active {
            background-color: color-mix(in srgb, var(--primary-color), black 80%);
            cursor: pointer;
            transform: translateX(5px);
          }

          #svg-avatar {
            width: min-content;
            height: 80%;
            margin: auto 0;
            padding: 0 15px;
          }

          #svg-avatar path {
            fill: var(--text-color);
          }

          #chat-content {
            display: flex;
            flex-direction: column;
            width: 100%;
            justify-content: center;
            color: var(--text-color);
          }

          #chat-name {
            font-size: 18px;
            font-weight: bold;
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
          }

          #chat-last-message {
            font-size: 14px;
            opacity: 0.8;
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
          }

          #data-right {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: max-content;
            padding-right: 15px;
          }

          #chat-timestamp {
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 8px;
            transform: scale(0.9);
          }

          #chat-unread-count {
            background-color: var(--primary-color);
            color: var(--background-color);
            font-size: 12px;
            font-weight: bold;
            border-radius: 100px;
            padding: 4px 5px;
            text-align: center;
            box-sizing: border-box;
            transform: scale(0.9);
            min-width: 23px;
          }

          /** Mobile styles */
          @media screen and (max-width: 700px) {
            #chat-content {
              max-width: 75%;
            }
          }

          /** Desktop styles */
          @media screen and (min-width: 700px) {
            #chat-content {
              max-width: 90%;
            }
          }
        </style>
        <div id="chat-container">
          <svg id="svg-avatar" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.877014 7.49988C0.877014 3.84219 3.84216 0.877045 7.49985 0.877045C11.1575 0.877045 14.1227 3.84219 14.1227 7.49988C14.1227 11.1575 11.1575 14.1227 7.49985 14.1227C3.84216 14.1227 0.877014 11.1575 0.877014 7.49988ZM7.49985 1.82704C4.36683 1.82704 1.82701 4.36686 1.82701 7.49988C1.82701 8.97196 2.38774 10.3131 3.30727 11.3213C4.19074 9.94119 5.73818 9.02499 7.50023 9.02499C9.26206 9.02499 10.8093 9.94097 11.6929 11.3208C12.6121 10.3127 13.1727 8.97172 13.1727 7.49988C13.1727 4.36686 10.6328 1.82704 7.49985 1.82704ZM10.9818 11.9787C10.2839 10.7795 8.9857 9.97499 7.50023 9.97499C6.01458 9.97499 4.71624 10.7797 4.01845 11.9791C4.97952 12.7272 6.18765 13.1727 7.49985 13.1727C8.81227 13.1727 10.0206 12.727 10.9818 11.9787ZM5.14999 6.50487C5.14999 5.207 6.20212 4.15487 7.49999 4.15487C8.79786 4.15487 9.84999 5.207 9.84999 6.50487C9.84999 7.80274 8.79786 8.85487 7.49999 8.85487C6.20212 8.85487 5.14999 7.80274 5.14999 6.50487ZM7.49999 5.10487C6.72679 5.10487 6.09999 5.73167 6.09999 6.50487C6.09999 7.27807 6.72679 7.90487 7.49999 7.90487C8.27319 7.90487 8.89999 7.27807 8.89999 6.50487C8.89999 5.73167 8.27319 5.10487 7.49999 5.10487Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
          <div id="chat-content">
            <div id="chat-name">${this.userName}</div>
            <div id="chat-last-message">${this.lastMessage}</div>
          </div>
          <div id="data-right">
            <div id="chat-timestamp">${this.timestampLastMessage}</div>
            ${this.unreadCount > 0 ? `<div id="chat-unread-count">${this.unreadCount}</div>` : ''}
          </div>
        </div>
      `;

    const mainScreen = document.querySelector('wsc-main-screen');
    const chatContainer = this.shadowRoot.getElementById('chat-container');
    const chatScreen = document.querySelector('wsc-chat-screen');

    chatContainer.addEventListener('click', () => {
      if (chatScreen) {
        if (typeof chatScreen.selectChat === 'function') {
          chatScreen.selectChat({
            userName: this.userName,
            userId: this.userId,
          });
        }
        // Mostrar el chatScreen y ocultar el mainScreen usando los métodos públicos
        if (typeof chatScreen.showScreen === 'function') {
          chatScreen.showScreen();
        }
        if (mainScreen && typeof mainScreen.hideScreen === 'function') {
          mainScreen.hideScreen();
        }
      }
    });
    this.render();
  }

  setUserName(name) {
    this.userName = name;
    this.render();
  }

  setLastMessage(message) {
    this.lastMessage = message;
    this.render();
  }

  setTimestampLastMessage(timestamp) {
    this.timestampLastMessage = timestamp;
    this.render();
  }

  setUnreadCount(count) {
    this.unreadCount = count;
    this.render();
  }

  render() {
    this.shadowRoot.getElementById('chat-name').textContent = this.userName;
    this.shadowRoot.getElementById('chat-last-message').textContent =
      this.lastMessage;
  }

  remove() {
    super.remove();
  }

  getUserName() {
    return this.userName;
  }

  getLastMessage() {
    return this.lastMessage;
  }

  getTimestampLastMessage() {
    return this.timestampLastMessage;
  }

  getUnreadCount() {
    return this.unreadCount;
  }
}

customElements.define('wsc-chat', Chat);
