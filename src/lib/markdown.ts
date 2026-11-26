import { Marked } from "marked";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Rohes HTML im Text wird nur angezeigt, nicht ausgeführt.
const md = new Marked({ gfm: true, breaks: true, renderer: { html: ({ text }) => esc(text) } });

export function markdown(text: string) {
  return md.parse(text, { async: false }) as string;
}
