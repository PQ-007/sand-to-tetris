import "./style.css";
import "./components/core-status";
import { CHAPTERS, STATUS_LABEL } from "./chapters";

function renderChapters(list: HTMLElement): void {
  for (const ch of CHAPTERS) {
    const item = document.createElement("li");
    item.className = "chapter";
    item.dataset.status = ch.status;

    const num = document.createElement("span");
    num.className = "chapter-number";
    num.textContent = String(ch.number);
    num.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `Chapter ${ch.number}: ${ch.title}`;
    const summary = document.createElement("p");
    summary.textContent = ch.summary;
    const status = document.createElement("span");
    status.className = "chapter-status";
    status.textContent = STATUS_LABEL[ch.status];
    body.append(title, summary, status);

    item.append(num, body);
    list.append(item);
  }
}

const list = document.getElementById("chapters");
if (list) renderChapters(list);
