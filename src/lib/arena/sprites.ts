/**
 * Bộ sprite pixel-art cho 3 lớp nhân vật.
 *
 * Nguồn: Universal LPC Spritesheet Character Generator
 * (https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
 * — các lớp đồ hoạ LPC được phát hành theo CC-BY-SA 3.0 / GPL 3.0.
 *
 * Mỗi sheet là một dải ngang, mỗi khung 192×192 px, nhân vật quay mặt sang PHẢI.
 */
import kiemSiIdle from "@/assets/arena/kiem_si_idle.png.asset.json";
import kiemSiAttack from "@/assets/arena/kiem_si_attack.png.asset.json";
import kiemSiHurt from "@/assets/arena/kiem_si_hurt.png.asset.json";
import phapSuIdle from "@/assets/arena/phap_su_idle.png.asset.json";
import phapSuAttack from "@/assets/arena/phap_su_attack.png.asset.json";
import phapSuHurt from "@/assets/arena/phap_su_hurt.png.asset.json";
import veBinhIdle from "@/assets/arena/ve_binh_idle.png.asset.json";
import veBinhAttack from "@/assets/arena/ve_binh_attack.png.asset.json";
import veBinhHurt from "@/assets/arena/ve_binh_hurt.png.asset.json";

import { classById, type ClassId } from "./classes";

export const SPRITE_FRAME = 192;

export type SpriteAction = "idle" | "attack" | "hurt";

export type SpriteClip = {
  url: string;
  frames: number;
  /** Thời lượng một vòng chạy (ms). */
  durationMs: number;
  loop: boolean;
};

const SHEETS: Record<ClassId, Record<SpriteAction, SpriteClip>> = {
  kiem_si: {
    idle: { url: kiemSiIdle.url, frames: 2, durationMs: 1200, loop: true },
    attack: { url: kiemSiAttack.url, frames: 6, durationMs: 600, loop: false },
    hurt: { url: kiemSiHurt.url, frames: 6, durationMs: 700, loop: false },
  },
  phap_su: {
    idle: { url: phapSuIdle.url, frames: 2, durationMs: 1200, loop: true },
    attack: { url: phapSuAttack.url, frames: 7, durationMs: 700, loop: false },
    hurt: { url: phapSuHurt.url, frames: 6, durationMs: 700, loop: false },
  },
  ve_binh: {
    idle: { url: veBinhIdle.url, frames: 2, durationMs: 1400, loop: true },
    attack: { url: veBinhAttack.url, frames: 6, durationMs: 640, loop: false },
    hurt: { url: veBinhHurt.url, frames: 6, durationMs: 700, loop: false },
  },
};

export function spriteClip(classId: string | null | undefined, action: SpriteAction): SpriteClip {
  return SHEETS[classById(classId).id][action];
}

/** Danh sách URL để nạp trước, tránh giật khung đầu tiên khi vào trận. */
export function allSpriteUrls(): string[] {
  return Object.values(SHEETS).flatMap((c) => Object.values(c).map((clip) => clip.url));
}
