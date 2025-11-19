/**
 * <wsc-modal-input>
 * Modal reutilizable para solicitar texto (prompt) o confirmación (confirm).
 * Métodos clave:
 *  - waitForInput(message?): Promise<string|null>
 *  - waitForConfirm(message, okText?, cancelText?): Promise<boolean>
 *  - changeVisibility(bool) / activate(message?)
 *  - getInputValue()
 * Internamente gestiona eventos de teclado (Escape / Enter) y limpieza de listeners.
 */
export default class ModalInput extends HTMLElement {
  constructor() {
    super();
    this.message = 'Enter your message:';
    this.inputValue = '';
    this.mode = 'prompt'; // 'prompt' | 'confirm' | 'list'
    this.okText = 'Send';
    this.cancelText = 'Cancel';
    this._listItems = [];
    this._onDelete = null;
    this._inputHandler = () => {
      const inputElement = this.shadowRoot.getElementById('modal-input');
      const inputValue = inputElement ? inputElement.value : '';
      this.inputValue = inputValue;
    };
    this._submitHandler = () => {};
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  changeVisibility(isVisible) {
    const layer =
      this.shadowRoot && this.shadowRoot.getElementById('modal-input-layer');
    if (layer) {
      if (isVisible) {
        layer.classList.add('active');
      } else {
        layer.classList.remove('active');
      }
    } else {
      // Si no existe el layer, renderizar para crearlo
      this.render();
      const newLayer =
        this.shadowRoot && this.shadowRoot.getElementById('modal-input-layer');
      if (newLayer && isVisible) {
        newLayer.classList.add('active');
      }
    }
  }

  activate(message) {
    if (message) this.message = message;
    const layer =
      this.shadowRoot && this.shadowRoot.getElementById('modal-input-layer');
    if (layer) {
      layer.classList.add('active');
    }
  }

  onSubmit() {
    if (this.mode === 'prompt') this._inputHandler();
    this._submitHandler();
    this.changeVisibility(false);
  }

  getInputValue() {
    return this.inputValue;
  }

  handleSubmit(resolve) {
    if (this.mode === 'prompt') this._inputHandler();
    this.changeVisibility(false);
    this.cleanup();
    if (typeof resolve === 'function') resolve(this.inputValue);
    if (this._escHandler)
      window.removeEventListener('keydown', this._escHandler);
  }

  handleCancel(resolve) {
    this.changeVisibility(false);
    this.cleanup();
    if (typeof resolve === 'function') resolve(null);
    if (this._escHandler)
      window.removeEventListener('keydown', this._escHandler);
  }

  cleanup() {
    const submitBtn = this.shadowRoot.getElementById('modal-submit');
    const cancelBtn = this.shadowRoot.getElementById('modal-cancel');
    if (submitBtn && this._submitHandler)
      submitBtn.removeEventListener('click', this._submitHandler);
    if (cancelBtn && this._cancelHandler)
      cancelBtn.removeEventListener('click', this._cancelHandler);
    this._submitHandler = null;
    this._cancelHandler = null;
  }

  connectedCallback() {}

  render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        /* Mobile styles */
        @media screen and (max-width: 700px) {
        }
        /* Desktop styles */
        @media screen and (min-width: 700px) {
        }
        #modal-input-layer {
          position: absolute;
          top: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: none;
        }
        #modal-input-layer.active {
          display: block;
        }
        #modal-input-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: var(--background-color, #fff);
          border: 2px solid var(--primary-color, #007bff);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          width: max-content;
          max-width: 60%;
          z-index: 1000;
        }
        #modal-label {
          display: block;
          margin-bottom: 10px;
          color: var(--text-color, #222);
          margin-bottom: 15px;
        }
        #modal-input {
          background-color: var(--background-color, #fff);
          border: 2px solid var(--primary-color, #007bff);
          border-radius: 12px;
          color: var(--text-color, #222);
          padding: 10px;
          margin-bottom: 20px;
          height: max-content;
          width: 100%;
          box-sizing: border-box;
        }
        #modal-buttons {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        #session-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 50vh;
          overflow-y: auto;
          min-width: 280px;
        }
        .session-item {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          border: 1px solid color-mix(in srgb, var(--text-color) 35%, transparent);
          border-radius: 10px;
          padding: 8px 10px;
        }
        .session-select {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--text-color, #222);
          text-align: left;
          cursor: pointer;
        }
        .session-delete {
          display: flex;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid color-mix(in srgb, var(--text-color) 35%, transparent);
          background: color-mix(in srgb, var(--background-color), white 5%);
        }
        .session-delete:hover {
          background: color-mix(in srgb, var(--background-color), white 10%);
        }
        .session-delete svg { width: 18px; height: 18px; }
        .session-delete svg path { fill: var(--text-color); }
        #modal-submit, #modal-cancel {
          border: 2px solid var(--primary-color, #007bff);
          border-radius: 20px;
          padding: 6px 12px;
          width: 35%;
          text-align: center;
          cursor: pointer;
        }
        #modal-submit {
          background-color: color-mix(in srgb, var(--primary-color, #007bff), black 10%);
          border-color: color-mix(in srgb, var(--primary-color, #007bff), black 10%);
          color: var(--background-color, #fff);
          font-weight: bold;
        }
        #modal-submit:hover {
          background-color: var(--primary-color, #007bff);
          border-color: var(--primary-color, #007bff);
        }
        #modal-cancel {
          background-color: var(--background-color, #fff);
          color: var(--text-color, #222);
        }
        #modal-cancel:hover {
          background-color: color-mix(in srgb, var(--primary-color, #007bff), black 90%);
        }
      </style>
      <div id="modal-input-layer">
        <div id="modal-input-container">
          <label id="modal-label" for="modal-input">${this.message}</label>
          ${this.mode === 'prompt' ? '<input id="modal-input" type="text" />' : ''}
          ${
            this.mode === 'list'
              ? `
            <div id="session-list">
              ${this._listItems
                .map(
                  (it, idx) => `
                    <div class="session-item" data-index="${idx}">
                      <button class="session-select" data-index="${idx}">${
                        it.alias || it.sessionId || 'Sesión'
                      }</button>
                      <div class="session-delete" title="Eliminar sesión" data-index="${idx}">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C4.44772 13 4 12.5523 4 12V4L3.5 4C3.22386 4 3 3.77614 3 3.5ZM5 4H10V12H5V4Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                      </div>
                    </div>
                  `
                )
                .join('')}
            </div>
          `
              : ''
          }
          <div id="modal-buttons">
            <div id="modal-cancel">${this.cancelText}</div>
            <div id="modal-submit" style="display: ${
              this.mode === 'list' ? 'none' : 'block'
            }">${this.okText}</div>
          </div>
        </div>
      </div>
    `;
    // Asignar eventos (por defecto solo cierran el modal)
    const cancelBtn = this.shadowRoot.getElementById('modal-cancel');
    const submitBtn = this.shadowRoot.getElementById('modal-submit');
    if (cancelBtn) cancelBtn.onclick = () => this.changeVisibility(false);
    if (submitBtn) submitBtn.onclick = () => this.onSubmit();
    // El listener de Enter se agrega en waitForInput

    // Listeners específicos para modo lista
    if (this.mode === 'list') {
      const container = this.shadowRoot.getElementById('session-list');
      if (container) {
        container.querySelectorAll('.session-select').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-index'));
            const item = this._listItems[idx];
            if (!item) return;
            if (this._resolveList) {
              const payload = { ...item, index: idx };
              this.changeVisibility(false);
              this.cleanup();
              if (this._escHandler)
                window.removeEventListener('keydown', this._escHandler);
              this._resolveList(payload);
              this._resolveList = null;
            }
          });
        });
        container.querySelectorAll('.session-delete').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = Number(btn.getAttribute('data-index'));
            const item = this._listItems[idx];
            if (!item) return;
            if (typeof this._onDelete === 'function') {
              try {
                await this._onDelete(item, idx);
              } catch {}
            }
          });
        });
      }
    }
  }

  /**
   * Muestra el modal y retorna una promesa que se resuelve con el valor ingresado o null si se cancela
   * @param {string} [message] Mensaje opcional a mostrar
   * @returns {Promise<string|null>}
   */
  waitForInput(message) {
    if (message) this.message = message;
    this.mode = 'prompt';
    this.okText = 'Send';
    this.cancelText = 'Cancel';
    this.render();
    this.changeVisibility(true);

    // Usar requestAnimationFrame para asegurar que el input esté en el DOM y visible
    requestAnimationFrame(() => {
      const inputElement = this.shadowRoot.getElementById('modal-input');
      if (inputElement) inputElement.focus();
    });
    return new Promise((resolve) => {
      const submitBtn = this.shadowRoot.getElementById('modal-submit');
      const cancelBtn = this.shadowRoot.getElementById('modal-cancel');
      this._submitHandler = () => this.handleSubmit(resolve);
      this._cancelHandler = () => this.handleCancel(resolve);
      if (submitBtn) submitBtn.addEventListener('click', this._submitHandler);
      if (cancelBtn) cancelBtn.addEventListener('click', this._cancelHandler);
      // Permitir cerrar con Escape
      this._escHandler = (e) => {
        if (e.key === 'Escape') {
          this.handleCancel(resolve);
        }
      };
      const inputElement = this.shadowRoot.getElementById('modal-input');
      if (inputElement) {
        inputElement.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            this.handleSubmit(resolve);
          }
        });
      }
      window.addEventListener('keydown', this._escHandler);
    });
  }

  /**
   * Muestra un modal de confirmación sin input. Retorna true si acepta, false si cancela.
   * @param {string} message
   * @param {string} [okText='Aceptar']
   * @param {string} [cancelText='Cancelar']
   * @returns {Promise<boolean>}
   */
  waitForConfirm(message, okText = 'Aceptar', cancelText = 'Cancelar') {
    if (message) this.message = message;
    this.mode = 'confirm';
    this.okText = okText;
    this.cancelText = cancelText;
    this.render();
    this.changeVisibility(true);
    return new Promise((resolve) => {
      const submitBtn = this.shadowRoot.getElementById('modal-submit');
      const cancelBtn = this.shadowRoot.getElementById('modal-cancel');
      this._submitHandler = () => {
        this.changeVisibility(false);
        this.cleanup();
        if (this._escHandler)
          window.removeEventListener('keydown', this._escHandler);
        resolve(true);
      };
      this._cancelHandler = () => {
        this.changeVisibility(false);
        this.cleanup();
        if (this._escHandler)
          window.removeEventListener('keydown', this._escHandler);
        resolve(false);
      };
      if (submitBtn) submitBtn.addEventListener('click', this._submitHandler);
      if (cancelBtn) cancelBtn.addEventListener('click', this._cancelHandler);
      this._escHandler = (e) => {
        if (e.key === 'Escape') this._cancelHandler();
      };
      window.addEventListener('keydown', this._escHandler);
    });
  }

  /**
   * Muestra una lista de elementos seleccionables con acción de eliminar.
   * items: Array<{ sessionId: string, alias?: string }>
   * options.onDelete?: (item, index) => Promise<void> | void
   * @param {Array} items
   * @param {{onDelete?:Function, message?:string}} options
   * @returns {Promise<object|null>} Elemento seleccionado o null si se cierra.
   */
  waitForSelection(items = [], options = {}) {
    const { onDelete = null, message } = options;
    if (message) this.message = message;
    this.mode = 'list';
    this.cancelText = 'Cerrar';
    this.okText = '';
    this._listItems = Array.isArray(items) ? items.slice() : [];
    this._onDelete = typeof onDelete === 'function' ? onDelete : null;
    this.render();
    this.changeVisibility(true);
    return new Promise((resolve) => {
      this._resolveList = resolve;
      // Permitir cerrar con Escape
      this._escHandler = (e) => {
        if (e.key === 'Escape') {
          this.changeVisibility(false);
          this.cleanup();
          resolve(null);
          window.removeEventListener('keydown', this._escHandler);
        }
      };
      window.addEventListener('keydown', this._escHandler);
      const cancelBtn = this.shadowRoot.getElementById('modal-cancel');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          this.changeVisibility(false);
          this.cleanup();
          resolve(null);
          if (this._escHandler)
            window.removeEventListener('keydown', this._escHandler);
        };
      }
    });
  }

  disconnectedCallback() {}

  attributeChangedCallback() {}

  static get observedAttributes() {
    return [];
  }
}

customElements.define('wsc-modal-input', ModalInput);
