import { getCoreVersion } from "../sim/core";

/**
 * <s2t-core-status>: shows whether the simulator core loaded, and which
 * version. Makes a stale or failed WASM build visible at a glance.
 */
export class CoreStatus extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute("role", "status");
    this.textContent = "Loading simulator core…";
    getCoreVersion().then(
      (version) => {
        this.textContent = `Simulator core ${version} loaded`;
        this.dataset.state = "ok";
      },
      (err: unknown) => {
        this.textContent = `Simulator core failed to load: ${String(err)}`;
        this.dataset.state = "error";
      },
    );
  }
}

customElements.define("s2t-core-status", CoreStatus);
