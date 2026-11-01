// The starting point of the OS workshop, in each language: the constants,
// the font (taken from the built-in OS: it's data, not the exercise), the
// globals, and every function with an empty body to write.
import type { Lang } from "./i18n";
import { BUILTIN_OS } from "./os";

/** The `const OS_FONT ... ];` block of the built-in OS. */
function fontBlock(): string {
  const start = BUILTIN_OS.indexOf("const OS_FONT");
  const end = BUILTIN_OS.indexOf("];", start);
  return start >= 0 && end > start ? BUILTIN_OS.slice(start, end + 2) : "";
}

interface Words {
  head: string;
  helpers: string;
  screen: string;
  clear: string;
  plot: string;
  fillRect: string;
  drawRect: string;
  text: string;
  font: string;
  drawChar: string;
  drawText: string;
  drawInt: string;
  time: string;
  key: string;
  ticks: string;
  wait: string;
  waitKey: string;
  random: string;
  seed: string;
  next: string;
  below: string;
}

const EN: Words = {
  head: `// Your OS, in C Shard (docs/OS.md). The Machine page puts it in front of
// every C Shard program once all its tests pass. The tests run small
// programs on your OS and on the built-in one and compare the screen and
// the result. Text uses your plot and fill_rect, so go in order.`,
  helpers: "// ---- small helpers ----",
  screen:
    "// ---- the screen: 128 x 96, row y is the 8 words at OS_SCREEN + 8y, the\n// leftmost pixel of a word in bit 15 ----",
  clear: "// Every pixel off: all 768 words to 0.",
  plot: "// One pixel on or off; outside the screen (x 0..127, y 0..95) do nothing.",
  fillRect:
    "// w x h pixels from (x, y), on or off, clipped to the screen. Hint: a word\n// at a time, with a mask of the pixels in that word.",
  drawRect: "// The outline of a w x h rectangle (on).",
  text: "// ---- text: 3 x 5 glyphs in 4 x 6 cells, 32 columns x 16 rows ----",
  font: "// One word per character from ' ' (32) to '_' (95): 5 rows of 3 bits,\n// the top row in bits 14-12, the leftmost pixel in a row's highest bit.",
  drawChar:
    "// c in cell (col, row): clear the 4 x 6 cell, then plot the glyph from\n// (4 col, 6 row). Lowercase as capitals; anything else outside 32..95 as '?'.",
  drawText: "// n characters of s from cell (col, row) rightwards.",
  drawInt:
    "// v in decimal (with '-' if negative) from cell (col, row); return how\n// many cells it took. Careful: -32768 has no positive twin.",
  time: "// ---- keyboard and time ----",
  key: "// The key held now (mem[OS_KEYBOARD]), 0 if none.",
  ticks: "// Frames since the start (mem[OS_TIMER]), 60 a second.",
  wait: "// Wait this many frames.",
  waitKey:
    "// Wait for a key press, then its release; return its code. On the first\n// press, also seed_random(os_seed ^ ticks()) and set os_seeded.",
  random: "// ---- random numbers: 16-bit xorshift ----",
  seed: "// Start the sequence from s (0 counts as 1).",
  next: "// os_seed = os_seed ^ (os_seed << 7), then ^ (>> 9), then ^ (<< 8);\n// return os_seed & 0x7FFF.",
  below: "// 0 .. n - 1 (0 if n <= 0): random() % n.",
};

const MN: Words = {
  head: `// Таны OS, C Shard-аар (docs/OS.md). Бүх шалгалт давмагц Машин хуудас
// үүнийг C Shard програм бүрийн өмнө тавина. Шалгалтууд жижиг програмуудыг
// таны OS болон суурилуулсан OS дээр ажиллуулж, дэлгэц ба үр дүнг харьцуулна.
// Бичвэр таны plot ба fill_rect-ийг ашигладаг тул дарааллаар нь яв.`,
  helpers: "// ---- жижиг туслахууд ----",
  screen:
    "// ---- дэлгэц: 128 x 96, y мөр нь OS_SCREEN + 8y дахь 8 үг, үгийн хамгийн\n// зүүн пиксел 15-р битэд ----",
  clear: "// Бүх пикселийг унтраа: 768 үгийг бүгдийг 0 болго.",
  plot: "// Нэг пикселийг асаах эсвэл унтраах; дэлгэцээс гадна (x 0..127, y 0..95) юу ч хийхгүй.",
  fillRect:
    "// (x, y)-ээс w x h пиксел, асаах эсвэл унтраах, дэлгэцээр тайрна. Зөвлөгөө:\n// нэг удаад нэг үг, тухайн үг дэх пикселүүдийн mask-аар.",
  drawRect: "// w x h тэгш өнцөгтийн хүрээ (асаалттай).",
  text: "// ---- бичвэр: 4 x 6 нүдэнд 3 x 5 тэмдэгт, 32 багана x 16 мөр ----",
  font: "// ' ' (32)-оос '_' (95) хүртэлх тэмдэгт бүрд нэг үг: 3 битийн 5 мөр, дээд\n// мөр нь 14-12-р битэд, мөрийн хамгийн зүүн пиксел хамгийн өндөр битэд.",
  drawChar:
    "// c-г (col, row) нүдэнд: 4 x 6 нүдийг цэвэрлээд (4 col, 6 row)-оос тэмдэгтийг\n// зур. Жижиг үсгийг томоор; 32..95-аас гадуурхыг '?' болгон.",
  drawText: "// s-ийн n тэмдэгтийг (col, row) нүднээс баруун тийш.",
  drawInt:
    "// v-г аравтын тоогоор (сөрөг бол '-'-тэй) (col, row) нүднээс; хэдэн нүд\n// эзэлснийг буцаа. Анхаар: -32768-д эерэг хос байхгүй.",
  time: "// ---- гар ба цаг ----",
  key: "// Одоо дарсан товч (mem[OS_KEYBOARD]), байхгүй бол 0.",
  ticks: "// Эхэлснээс хойших frame-ийн тоо (mem[OS_TIMER]), секундэд 60.",
  wait: "// Энэ олон frame хүлээ.",
  waitKey:
    "// Товч дарагдаад, дараа нь суллагдахыг хүлээж, кодыг нь буцаа. Анх дарахад\n// бас seed_random(os_seed ^ ticks()) хийж, os_seeded-ийг тохируул.",
  random: "// ---- санамсаргүй тоо: 16 битийн xorshift ----",
  seed: "// Дарааллыг s-ээс эхлүүл (0 нь 1 гэж тооцогдоно).",
  next: "// os_seed = os_seed ^ (os_seed << 7), дараа нь ^ (>> 9), дараа нь ^ (<< 8);\n// os_seed & 0x7FFF-ийг буцаа.",
  below: "// 0 .. n - 1 (n <= 0 бол 0): random() % n.",
};

function starter(w: Words): string {
  const font = fontBlock().replace(
    /^const OS_FONT/,
    `${w.font}\nconst OS_FONT`,
  );
  return `${w.head}

const OS_SCREEN = 0x4000;
const OS_KEYBOARD = 0x6000;
const OS_TIMER = 0x6001;

${w.helpers}

fn abs(x: int) -> int {
    return 0;
}

fn min(a: int, b: int) -> int {
    return 0;
}

fn max(a: int, b: int) -> int {
    return 0;
}

${w.screen}

${w.clear}
fn clear() {
}

${w.plot}
fn plot(x: int, y: int, on: bool) {
}

${w.fillRect}
fn fill_rect(x: int, y: int, w: int, h: int, on: bool) {
}

${w.drawRect}
fn draw_rect(x: int, y: int, w: int, h: int) {
}

${w.text}

${font}

${w.drawChar}
fn draw_char(c: int, col: int, row: int) {
}

${w.drawText}
fn draw_text(s: [int], n: int, col: int, row: int) {
}

var os_digits: [int; 5];

${w.drawInt}
fn draw_int(v: int, col: int, row: int) -> int {
    return 0;
}

${w.time}

${w.key}
fn key() -> int {
    return 0;
}

${w.ticks}
fn ticks() -> int {
    return 0;
}

${w.wait}
fn wait(frames: int) {
}

var os_seeded = false;

${w.waitKey}
fn wait_key() -> int {
    return 0;
}

${w.random}

var os_seed = 1;

${w.seed}
fn seed_random(s: int) {
}

${w.next}
fn random() -> int {
    return 0;
}

${w.below}
fn random_below(n: int) -> int {
    return 0;
}
`;
}

export const OS_STARTERS: Record<Lang, string> = {
  en: starter(EN),
  mn: starter(MN),
};
