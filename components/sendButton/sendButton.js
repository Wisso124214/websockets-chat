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
    console.log('MyCustomElement added to the DOM');
  }

  disconnectedCallback() {
    console.log('MyCustomElement removed from the DOM');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
  }

  static get observedAttributes() {
    return ['some-attribute']; // Attributes to observe for changes
  }
}

customElements.define('my-custom-element', MyCustomElement);
