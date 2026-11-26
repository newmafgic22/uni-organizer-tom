export type Material = {
  id: string;
  course_id: string;
  ordner: string;
  dateiname: string;
  groesse: number | null;
  updated_at: string;
  hat_text?: boolean;
};

export function fmtGroesse(b: number | null) {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function icon(name: string) {
  const e = name.toLowerCase().split(".").pop();
  if (name.endsWith("(Lernmodul).txt")) return "📖";
  if (e === "pdf") return "📄";
  if (e === "ppt" || e === "pptx") return "📊";
  if (e === "xls" || e === "xlsx" || e === "csv") return "📈";
  if (e === "doc" || e === "docx") return "📝";
  if (e === "mp4" || e === "mov") return "🎬";
  if (e === "zip") return "🗜️";
  return "📎";
}

/** Natürliche Sortierung: "2 Thema" vor "10 Thema". */
export const natSort = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" });
