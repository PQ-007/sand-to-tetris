import { t } from "../i18n";
import { getCoreVersion } from "../sim/core";

/**
 * <s2t-core-status>: shows whether the simulator core loaded, and which
 * version. Makes a stale or failed WASM build visible at a glance.
 */
export class CoreStatus extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute("role", "status");
    this.update();
    document.addEventListener("s2t-lang", () => this.update());
  }

  private update(): void {
    this.textContent = t("core.loading");
    getCoreVersion().then(
      (version) => {
        this.textContent = t("core.ok", { version });
        this.title = t("core.okTitle", { version });
        this.dataset.state = "ok";
      },
      (err: unknown) => {
        this.textContent = t("core.failed", { error: String(err) });
        this.dataset.state = "error";
      },
    );
  }
}

customElements.define("s2t-core-status", CoreStatus);
