// A hairline figure inside a chapter: <line-figure name="cabinet"></line-figure>
// on its own line. Unlike the demos it renders in the page (no shadow DOM):
// the figure engine puts its styles in the document, and main.ts draws
// every `.hl-figure` it finds there.
import { figureSlot, type FigureName } from "../figures";
import { t, type Key } from "../i18n";

class LineFigure extends HTMLElement {
  connectedCallback(): void {
    if (this.firstChild) return;
    const name = (this.getAttribute("name") ?? "") as FigureName;
    this.innerHTML = figureSlot(name, t(`figure.${name}` as Key), "inline");
  }
}

customElements.define("line-figure", LineFigure);
