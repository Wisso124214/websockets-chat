import Chat from '../chat/Chat.js';

/**
 * <wsc-chat-list>
 * Contenedor de elementos `<wsc-chat>`.
 * Responsabilidades:
 *  - Renderizar lista dinámica de chats (usuarios / grupos).
 *  - Evitar duplicados por id.
 *  - Exponer operaciones básicas: addChat, deleteChatById, updateChat, deleteChat.
 *  - Alternar visibilidad (hideList / showList) según pantallas.
 */

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
      
      <div id="chat-list-container"></div>
      `;
  }

  hideList() {
    const chatListContainer = this.shadowRoot.getElementById(
      'chat-list-container'
    );
    chatListContainer.style.display = 'none';
  }

  showList() {
    const chatListContainer = this.shadowRoot.getElementById(
      'chat-list-container'
    );
    chatListContainer.style.display = 'flex';
  }

  addChat(clientData) {
    const {
      userName,
      id,
      members,
      lastMessage,
      timestampLastMessage,
      unreadCount,
    } = clientData;

    // Evitar duplicados por id
    const existing = Array.from(
      this.shadowRoot.getElementById('chat-list-container').children
    ).find((c) => c.userId === id);
    if (existing) return;
    const chat = new Chat({
      userName,
      userId: id,
      members,
      lastMessage,
      timestampLastMessage,
      unreadCount,
    });
    this.shadowRoot.getElementById('chat-list-container').appendChild(chat);
  }

  deleteChatById(userId) {
    const chatListContainer = this.shadowRoot.getElementById(
      'chat-list-container'
    );
    const chats = Array.from(chatListContainer.children).filter(
      (chat) => chat.userId === userId
    );
    for (let i = 0; i < chats.length; i++) {
      chats[i].remove();
      break;
    }
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
