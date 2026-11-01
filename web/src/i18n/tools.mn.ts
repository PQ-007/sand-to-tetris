// Toolchain хуудсуудын бичвэр: Machine ба assembler-ийн workshop.
import type { Message } from "./en";
import type { toolsEn } from "./tools.en";

export const toolsMn: Record<keyof typeof toolsEn, Message> = {
  "nav.machine": "Машин",
  "title.machine": "Машин",
  "title.assembler": "Таны ассемблер",

  "machine.title": "Машин",
  "machine.lead":
    "Ассемблер хэлээр програм бичиж, хөрвүүлээд ажиллуул: таны зохиосон компьютерийн дэлгэц, гар, регистрүүд ба RAM.",
  "machine.example": "Жишээ",
  "machine.pick": "Жишээ сонгох…",
  "machine.ex.sum": "10 + 9 + … + 1-ийн нийлбэр",
  "machine.ex.pattern": "Шатрын хөлөг (.data ашиглана)",
  "machine.ex.dot": "Сумтай товчоор цэг хөдөлгөх",
  "machine.ex.count": "Үүрд тоолох",
  "machine.assembler": "Ассемблер",
  "machine.asm.builtin": "Суурилуулсан",
  "machine.asm.yours": "Таных",
  "machine.codeLabel": "Програм",
  "machine.source": "Ассемблер эх код",
  "machine.run": "Хөрвүүлж ажиллуулах",
  "machine.pause": "Түр зогсоох",
  "machine.step": "Алхам",
  "machine.reset": "Эхлүүлэх",
  "machine.speed": "Хурд",
  "machine.speed.slow": "Удаан (секундэд 60)",
  "machine.speed.medium": "Дунд",
  "machine.speed.fast": "Хурдан",
  "machine.screenLabel":
    "Дэлгэц, 128 x 96 пиксел. Програмд товч илгээхийн тулд үүн дээр focus хий.",
  "machine.keysHelp":
    "Дэлгэц дээр дараад бичих эсвэл сумтай товч ашигла; програм товчийг 0x6000-аас уншина.",
  "machine.keyHeld": "Дарсан товч: {code}.",
  "machine.ramFrom": "RAM-ыг хаягаас",
  "machine.flags": "Flag-ууд",
  "machine.ready": "Бэлэн. «Хөрвүүлж ажиллуулах»-ыг дар.",
  "machine.assembling": "Хөрвүүлж байна…",
  "machine.hasErrors": "Алдааны тоо: {n}. Засаад дахин оролд.",
  "machine.running": "Ажиллаж байна: одоогоор {steps} заавар.",
  "machine.paused": "Түр зогссон: {steps} заавар.",
  "machine.halted": "Зогссон: {steps} заавар.",
  "machine.errorLine": "{line}-р мөр: {message}",

  "workshop.title": "Таны ассемблер",
  "workshop.lead":
    "Ассемблерийг өөрөө TypeScript-ээр бич: дөрвөн үе шат, тус бүр өөрийн шалгалттай. Бүх шалгалт давбал Машин хуудас програмуудыг түүгээр ажиллуулж чадна.",
  "workshop.how":
    "Явцдаа шалгалтуудыг ажиллуул (нийт {n}). Үе шат бүр өмнөх үе шатны зөв гаралтаар шалгагдах тул дарааллаар нь бүтээ. Tab нь догол мөр хийнэ; засварлагчаас гарахын тулд Escape, дараа нь Tab дар. Хэлний тайлбар:",
  "workshop.chapter": "5-р бүлэг.",
  "workshop.codeLabel": "Таны код",
  "workshop.source": "Таны ассемблер (TypeScript)",
  "workshop.run": "Шалгалтуудыг ажиллуулах",
  "workshop.starter": "Дахин эхлэх",
  "workshop.confirmStarter":
    "Кодоо эхлэлийн загвараар солих уу? Одоогийн код тань устана.",
  "workshop.saved": "Хадгалсан",
  "workshop.notRun":
    "Ассемблер тань хэр ажиллаж байгааг харахын тулд «Шалгалтуудыг ажиллуулах»-ыг дар.",
  "workshop.passedBefore":
    "Энэ код бүх шалгалтыг давсан. Машин хуудас үүнийг ашиглаж чадна.",
  "workshop.running": "Шалгалтуудыг ажиллуулж байна…",
  "workshop.stage.tokenize": "1 · Tokenize",
  "workshop.stage.parse": "2 · Parse",
  "workshop.stage.layout": "3 · Layout (1-р давталт)",
  "workshop.stage.encode": "4 · Encode (2-р давталт)",
  "workshop.stage.program": "Бүтэн програмууд",
  "workshop.emptyLine": "(хоосон мөр)",
  "workshop.input": "Оролт",
  "workshop.expected": "Хүлээгдэж буй",
  "workshop.got": "Таных",
  "workshop.throws": "AsmError шиднэ, code нь {code}",
  "workshop.threw": "Шидсэн нь {code}: {message}",
  "workshop.more": "…бас {n}.",
  "workshop.allPassed":
    "✓ Таны ассемблер бүх {n} шалгалтыг давлаа. Машин хуудас одоо үүнийг санал болгоно.",
  "workshop.toMachine": "Машин дээр турших →",
  "workshop.err.syntax": "Таны код хөрвүүлэгдэхгүй байна",
  "workshop.err.timeout":
    "Таны код 5 секундээс удаан ажилласан тул зогсоолоо (төгсгөлгүй давталт уу?)",
  "workshop.err.missing":
    "Таны код tokenize, parse, layout, encode-ыг export хийх ёстой",
  "workshop.err.crash": "Таны код унасан",

  "asm.what.instruction": "заавар эсвэл directive",
  "asm.what.comma": "таслал",
  "asm.what.end": "мөрийн төгсгөл",
  "asm.what.register": "register (r0–r7)",
  "asm.what.offset": "тоо эсвэл нэр",
  "asm.what.rbracket": "`]`",
  "asm.what.operand": "operand",
  "asm.expect.number": "тоо",
  "asm.expect.memory": "[r1 + 2] маягийн санах ойн хаяг",
  "asm.bad-char": "Энд байж болохгүй тэмдэгт: `{char}`",
  "asm.bad-number": "Тоо биш: `{text}` (42, -5, 0x2A, 0b101 эсвэл 'A' гэж бич)",
  "asm.bad-name":
    "Нэр биш: `{found}` (нэр нь үсэг, цифр, _-аас тогтож, цифрээр эхэлдэггүй)",
  "asm.expected": "{what} байх ёстой, гэтэл: `{found}`",
  "asm.unknown-mnemonic": "Ийм заавар байхгүй: `{mnemonic}`",
  "asm.unknown-directive":
    "Ийм directive байхгүй: `.{name}` (.equ, .code, .data, .word, .space ашигла)",
  "asm.operand-count":
    "{mnemonic}: operand-ын тоо {expected} байх ёстой, гэтэл {found}",
  "asm.not-a-register": "Register (r0–r7) байх ёстой, гэтэл: {found}",
  "asm.bad-operand": "{expected} байх ёстой, гэтэл: {found}",
  "asm.out-of-range": "{what} = {value} багтахгүй: {range} байх ёстой",
  "asm.unknown-symbol": "Тодорхойлогдоогүй нэр: `{name}`",
  "asm.duplicate-symbol":
    "Аль хэдийн тодорхойлсон нэр: `{name}` ({first}-р мөр)",
  "asm.data-in-code": "Өгөгдөл: `.{name}` нь .data-ийн дараа байх ёстой",
  "asm.code-in-data": "Заавар .code-д байх ёстой, .data-д биш",
  "asm.jump-to-data": "Өгөгдлийн хаяг (RAM), програмын байр биш: `{name}`",
  "asm.jump-too-far":
    "Хэт хол: `{target}` хүртэл {distance} заавар; {mnemonic} нь {range} хүрнэ",
};
