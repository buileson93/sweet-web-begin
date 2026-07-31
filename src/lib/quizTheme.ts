import { BookOpen, Gavel, Lightbulb, Radar, type LucideIcon } from "lucide-react";

/** Chủ đề trực quan của cuộc thi, suy ra từ tiêu đề để ảnh và màu luôn đúng nội dung. */
export type QuizTheme = {
  key: "energy" | "law" | "skill" | "general";
  label: string;
  Icon: LucideIcon;
  /** Ảnh chìm dựng sẵn tương ứng. */
  presetId: string;
  /** Lớp nền mềm cho ô biểu tượng. */
  chip: string;
  /** Lớp chữ nhấn. */
  text: string;
  /** Lớp viền/vệt màu bên trái. */
  bar: string;
};

const THEMES: Record<QuizTheme["key"], QuizTheme> = {
  energy: {
    key: "energy",
    label: "Tiết kiệm — chống lãng phí",
    Icon: Lightbulb,
    presetId: "preset:energy",
    chip: "bg-gold/20 text-gold-foreground",
    text: "text-gold-foreground",
    bar: "bg-gold",
  },
  law: {
    key: "law",
    label: "Pháp luật hàng không",
    Icon: Gavel,
    presetId: "preset:law",
    chip: "bg-primary/15 text-primary",
    text: "text-primary",
    bar: "bg-primary",
  },
  skill: {
    key: "skill",
    label: "Năng định chuyên môn",
    Icon: Radar,
    presetId: "preset:skill",
    chip: "bg-success/15 text-success",
    text: "text-success",
    bar: "bg-success",
  },
  general: {
    key: "general",
    label: "Kiến thức chung",
    Icon: BookOpen,
    presetId: "preset:book",
    chip: "bg-accent/20 text-accent-foreground",
    text: "text-accent-foreground",
    bar: "bg-accent",
  },
};

const RULES: Array<{ key: QuizTheme["key"]; words: string[] }> = [
  { key: "energy", words: ["tiết kiệm", "lãng phí", "điện", "năng lượng", "tiet kiem", "lang phi"] },
  { key: "law", words: ["luật", "pháp", "văn bản", "nghị định", "thông tư", "luat", "phap"] },
  { key: "skill", words: ["năng định", "chuyên môn", "nghiệp vụ", "nang dinh", "ôn luyện", "on luyen"] },
];

/** Chọn chủ đề phù hợp nhất theo tên cuộc thi. */
export function quizTheme(title: string | null | undefined): QuizTheme {
  const t = (title ?? "").toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => t.includes(w))) return THEMES[rule.key];
  }
  return THEMES.general;
}
