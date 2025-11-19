import './chat.css';

class MyCustomElement extends HTMLElement {
  constructor() {
    super(); // Always call super() in the constructor
    // Initialize shadow DOM and add content
    this.attachShadow({ mode: 'open' }); // or 'closed'
    this.shadowRoot.innerHTML = `
        <style>
            /* Component-specific styles */
            div {
                padding: 10px;
                border: 1px solid blue;
            }
        </style>
        <div>Hello from MyCustomElement!</div>
    `;
  }

  // Lifecycle callbacks (optional)
  connectedCallback() {
    // no-op
  }

  disconnectedCallback() {
    // no-op
  }

  attributeChangedCallback() {}

  static get observedAttributes() {
    return []; // No attributes observed
  }
}

customElements.define('my-custom-element', MyCustomElement);
