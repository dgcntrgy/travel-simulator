import type { MotionProps, Variants } from "framer-motion";

/** Apple tarzı yumuşak çıkış eğrisi */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Adımlar arası sahne geçişi; her adımın kök motion.div'ine yayılır.
 * Girişte sadece opaklık: hareketi içteki paneller (SLIDE_FROM_LEFT/RIGHT) ve kart dalgası (riseIn) verir.
 */
export const STEP_TRANSITION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: EASE_OUT_EXPO },
} satisfies MotionProps;

/** Kart "spotlight" yükselişi: hover'da hafifçe yukarı kalkar */
export const CARD_HOVER = {
  whileHover: { y: -6 },
  transition: { type: "spring", stiffness: 320, damping: 24 },
} satisfies MotionProps;

/**
 * Spotlight kartlarının boştaki cam kenarlığı (aydınlık: ince slate + mavi gölge, koyu: beyaz/15 parlama).
 * Sadece seçili/vurgulu OLMAYAN kartlara uygulanır; `dark:` important sınıfları seçim rengini ezmesin.
 * `backdrop-blur-xl` kartın temel sınıflarında kalır.
 */
export const GLASS_CARD =
  "border-slate-200/80! shadow-xl! shadow-blue-500/5! dark:border-slate-800/80! dark:shadow-black/50!";

/** Kart fotoğrafının hover'da yavaşça yakınlaşması */
export const PHOTO_ZOOM = "transition-[transform,opacity] duration-700 ease-out group-hover:scale-110";

/** Ortak yay: elemanlar yerine "sürüklenerek" oturur */
export const SPRING_IN = { type: "spring", stiffness: 260, damping: 25 } as const;

/** Sol seçim paneli: soldan sağa yaylanarak gelir */
export const SLIDE_FROM_LEFT = {
  initial: { x: -80, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: SPRING_IN,
} satisfies MotionProps;

/** Sağ harita paneli: sağdan kayarak oturur (biraz gecikmeli, sol panelden sonra) */
export const SLIDE_FROM_RIGHT = {
  initial: { x: 80, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { ...SPRING_IN, delay: 0.06 },
} satisfies MotionProps;

/** Kart listeleri için sıralı dalga: ebeveyn `initial="hidden" animate="show"`, çocuklar `variants={RISE_ITEM}` */
export const STAGGER_PARENT: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/** Aşağıdan yukarıya akan kart (STAGGER_PARENT çocuğu) */
export const RISE_ITEM: Variants = {
  hidden: { y: 35, opacity: 0 },
  show: { y: 0, opacity: 1, transition: SPRING_IN },
};

/**
 * STAGGER_PARENT kullanılamayan listeler (AnimatePresence popLayout, layout'lu kartlar) için
 * aynı dalgayı sıra numarasından gecikmeyle verir. Hover/exit kendi `transition`'ını taşımalı (gecikme almasın).
 */
export const riseIn = (index: number) =>
  ({
    initial: { y: 35, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { ...SPRING_IN, delay: Math.min(index, 12) * 0.07, layout: SPRING_IN },
  }) satisfies MotionProps;
