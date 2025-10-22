export default class BlankTemplate extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
        <style>
          /* Mobile styles */
          @media screen and (max-width: 700px) {
          
          }

          /* Desktop styles */
          @media screen and (min-width: 700px) {
          
          }
        </style>
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

customElements.define('wsc-blank-template', BlankTemplate);
