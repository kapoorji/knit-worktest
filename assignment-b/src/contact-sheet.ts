/**
 * Renders the demo output as a single self-contained HTML page (the "notebook"
 * stand-in for a Node project). Images are embedded as base64 so the file opens
 * anywhere with no server.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";

export interface Item {
  caption: string;
  png: Buffer;
  sub?: string;
}
export interface Section {
  title: string;
  note?: string;
  items: Item[];
}

const CSS = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px 32px; background: #fafafa; color: #1a1a1a; }
  @media (prefers-color-scheme: dark) { body { background: #17181a; color: #e8e8e8; } figure { background: #222 !important; } }
  h1 { font-size: 22px; } h2 { font-size: 17px; margin-top: 32px; border-bottom: 1px solid #8884; padding-bottom: 6px; }
  .note { color: #888; font-size: 13px; max-width: 900px; margin: 6px 0 14px; }
  .row { display: flex; flex-wrap: wrap; gap: 14px; }
  figure { margin: 0; background: #fff; border-radius: 10px; padding: 10px; box-shadow: 0 1px 4px #0002; width: 200px; }
  figure img { width: 180px; height: 180px; object-fit: cover; border-radius: 6px; display: block; }
  figcaption { font-size: 12px; margin-top: 8px; } figcaption small { color: #888; }
`;

export async function writeContactSheet(title: string, subtitle: string, sections: Section[], outDir: string): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const body = sections
    .map((sec) => {
      const items = sec.items
        .map(
          (it) =>
            `<figure><img alt="${it.caption}" src="data:image/png;base64,${it.png.toString("base64")}"/>` +
            `<figcaption>${it.caption}${it.sub ? `<br><small>${it.sub}</small>` : ""}</figcaption></figure>`,
        )
        .join("");
      return `<section><h2>${sec.title}</h2>${sec.note ? `<p class="note">${sec.note}</p>` : ""}<div class="row">${items}</div></section>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head>` +
    `<body><h1>${title}</h1><p class="note">${subtitle}</p>${body}</body></html>`;
  const path = join(outDir, "index.html");
  await fs.writeFile(path, html);
  return path;
}
