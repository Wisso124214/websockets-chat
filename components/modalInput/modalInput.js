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
    this.mode = 'prompt'; // 'prompt' | 'confirm'
    this.okText = 'Send';
    this.cancelText = 'Cancel';
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
          <div id="modal-buttons">
            <div id="modal-cancel">${this.cancelText}</div>
            <div id="modal-submit">${this.okText}</div>
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

  disconnectedCallback() {}

  attributeChangedCallback() {}

  static get observedAttributes() {
    return [];
  }
}

customElements.define('wsc-modal-input', ModalInput);
