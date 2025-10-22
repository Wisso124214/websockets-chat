import Chat from '../Chat/Chat.js';

export default class ChatList extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>  
        #chat-list-container {
          position: absolute;
          top: 70px;
          left: 0;
          width: 100vw;
          height: calc(100vh - 70px);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
      </style>
      
      <div id="chat-list-container">
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
        <wsc-chat></wsc-chat>
      </div>
      `;
  }

  addChat(userName, lastMessage, timestampLastMessage, unreadCount) {
    const chat = new Chat({
      userName,
      lastMessage,
      timestampLastMessage,
      unreadCount,
    });
    this.shadowRoot.getElementById('chat-list-container').appendChild(chat);
  }

  getChat(index) {
    const chatListContainer = this.shadowRoot.getElementById(
      'chat-list-container'
    );
    return chatListContainer.children[index];
  }

  updateChat(
    index,
    { userName, lastMessage, timestampLastMessage, unreadCount }
  ) {
    const chat = this.getChat(index);
    if (chat) {
      if (userName !== undefined) chat.setUserName(userName);
      if (lastMessage !== undefined) chat.setLastMessage(lastMessage);
      if (timestampLastMessage !== undefined)
        chat.setTimestampLastMessage(timestampLastMessage);
      if (unreadCount !== undefined) chat.setUnreadCount(unreadCount);
    }
  }

  deleteChat(index) {
    const chat = this.getChat(index);
    if (chat) {
      chat.remove();
    }
  }
}

customElements.define('wsc-chat-list', ChatList);
