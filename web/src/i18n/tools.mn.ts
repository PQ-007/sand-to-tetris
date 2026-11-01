// Toolchain хуудсуудын бичвэр: Machine ба assembler-ийн workshop.
import type { Message } from "./en";
import type { toolsEn } from "./tools.en";

export const toolsMn: Record<keyof typeof toolsEn, Message> = {
  "nav.machine": "Машин",
  "title.machine": "Машин",
  "title.assembler": "Таны ассемблер",
  "title.translator": "Таны VM translator",
  "title.compiler": "Таны хөрвүүлэгч",

  "machine.title": "Машин",
  "machine.lead":
    "Ассемблер, VM код эсвэл C Shard-аар програм бичиж, хөрвүүлээд ажиллуул: таны зохиосон компьютерийн дэлгэц, гар, регистрүүд ба RAM.",
  "machine.example": "Жишээ",
  "machine.pick": "Жишээ сонгох…",
  "machine.ex.sum": "10 + 9 + … + 1-ийн нийлбэр",
  "machine.ex.pattern": "Шатрын хөлөг (.data ашиглана)",
  "machine.ex.dot": "Сумтай товчоор цэг хөдөлгөх",
  "machine.ex.count": "Үүрд тоолох",
  "machine.ex.vm-sum": "10 + 9 + … + 1-ийн нийлбэр, давталтаар",
  "machine.ex.vm-fact": "Факториал, рекурсээр",
  "machine.ex.vm-stripes": "Дэлгэц дээрх судал",
  "machine.ex.vm-dot": "Сумтай товчоор цэг хөдөлгөх",
  "machine.ex.shard-sum": "for давталттай нийлбэр",
  "machine.ex.shard-box": "Дэлгэц дээр дөрвөлжин зурах",
  "machine.ex.shard-dot": "Сумтай товчоор цэг хөдөлгөх",
  "machine.lang.shard": "C Shard",
  "machine.sourceShard": "C Shard эх код",
  "machine.compiler": "Хөрвүүлэгч",
  "machine.cm.builtin": "Суурилуулсан",
  "machine.cm.yours": "Таных",
  "machine.compiling": "Хөрвүүлж байна…",
  "machine.vmCode": "Болсон VM код ({n} мөр)",
  "machine.language": "Хэл",
  "machine.lang.asm": "Ассемблер",
  "machine.lang.vm": "VM",
  "machine.translator": "VM translator",
  "machine.tr.builtin": "Суурилуулсан",
  "machine.tr.yours": "Таных",
  "machine.sourceVm": "VM эх код",
  "machine.translating": "Хөрвүүлж байна…",
  "machine.translation": "Болсон ассемблер код ({n} мөр)",
  "machine.stack": "Stack, оройгоос нь",
  "machine.stackEmpty": "Хоосон.",
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
  "workshop.yourAsm": "Таны кодын гаргасан ассемблер",
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
  "workshop.throws": "Алдаа шиднэ, code нь {code}",
  "workshop.threw": "Шидсэн нь {code}: {message}",
  "workshop.more": "…бас {n}.",
  "workshop.allPassed":
    "✓ Таны ассемблер бүх {n} шалгалтыг давлаа. Машин хуудас одоо үүнийг санал болгоно.",
  "workshop.toMachine": "Машин дээр турших →",
  "workshop.err.syntax": "Таны код хөрвүүлэгдэхгүй байна",
  "workshop.err.timeout":
    "Таны код 5 секундээс удаан ажилласан тул зогсоолоо (төгсгөлгүй давталт уу?)",
  "workshop.err.missing":
    "Шалгалтын дууддаг функц бүрийг таны код export хийгээгүй байна (доор харна уу)",
  "workshop.err.crash": "Таны код унасан",

  "translator.title": "Таны VM translator",
  "translator.lead":
    "VM translator-ыг өөрөө TypeScript-ээр бич: мөрийг уншиж, командын төрөл бүрийг ассемблер болгон хөрвүүл. Бүх шалгалт давбал Машин хуудас VM програмуудыг түүгээр ажиллуулж чадна.",
  "translator.how":
    "Явцдаа шалгалтуудыг ажиллуул (нийт {n}). Тухайн үе шатны командуудыг таны кодоор, бусдыг нь суурилуулсан translator-оор хөрвүүлж, төв процессор дээр ажиллуулдаг тул үе шатуудыг ямар ч дарааллаар бүтээж болно. Tab нь догол мөр хийнэ; засварлагчаас гарахын тулд Escape, дараа нь Tab дар. VM-ийн тайлбар:",
  "translator.chapter": "6-р бүлэг.",
  "translator.source": "Таны VM translator (TypeScript)",
  "translator.notRun":
    "Translator тань хэр ажиллаж байгааг харахын тулд «Шалгалтуудыг ажиллуулах»-ыг дар.",
  "translator.allPassed":
    "✓ Таны translator бүх {n} шалгалтыг давлаа. Машин хуудас одоо үүнийг санал болгоно.",
  "translator.stage.parse": "1 · Parse",
  "translator.stage.stack": "2 · push, set ба санах ой",
  "translator.stage.arith": "3 · Арифметик ба харьцуулалт",
  "translator.stage.jumps": "4 · Label ба үсрэлт",
  "translator.stage.functions": "5 · Функц",
  "translator.stage.muldiv": "6 · mul, div, mod",
  "translator.stage.program": "Бүтэн програмууд",

  "compiler.title": "Таны хөрвүүлэгч",
  "compiler.lead":
    "C Shard хөрвүүлэгчийг өөрөө TypeScript-ээр бич: token, syntax tree, нэр ба төрөл, дараа нь VM код. Бүх шалгалт давбал Машин хуудас програмуудыг түүгээр хөрвүүлж чадна.",
  "compiler.how":
    "Явцдаа шалгалтуудыг ажиллуул (нийт {n}). Үе шат бүр өмнөх үе шатны зөв гаралтаар шалгагдах тул дарааллаар нь бүтээ; таны гаргасан VM кодыг ажиллуулж, юу хийснээр нь харьцуулна. Tab нь догол мөр хийнэ; засварлагчаас гарахын тулд Escape, дараа нь Tab дар. Хэлний тайлбар:",
  "compiler.chapter": "7-р бүлэг.",
  "compiler.source": "Таны хөрвүүлэгч (TypeScript)",
  "compiler.notRun":
    "Хөрвүүлэгч тань хэр ажиллаж байгааг харахын тулд «Шалгалтуудыг ажиллуулах»-ыг дар.",
  "compiler.allPassed":
    "✓ Таны хөрвүүлэгч бүх {n} шалгалтыг давлаа. Машин хуудас одоо үүнийг санал болгоно.",
  "compiler.stage.tokenize": "1 · Tokenize",
  "compiler.stage.parse": "2 · Parse",
  "compiler.stage.check": "3 · Нэр ба төрлийг шалгах",
  "compiler.stage.generate": "4 · VM код гаргах",
  "compiler.stage.program": "Бүтэн програмууд",

  "lang.what.name": "нэр",
  "lang.what.type": "төрөл (int, bool, [int; N] эсвэл [int])",
  "lang.what.expression": "утга эсвэл илэрхийлэл",
  "lang.what.declaration": "fn, var эсвэл const",
  "lang.what.statement": "statement",
  "lang.bad-char": "Энд байж болохгүй тэмдэгт: `{char}`",
  "lang.bad-number": "0-ээс 65535 хүртэлх тоо биш: `{text}`",
  "lang.bad-char-literal":
    "Тэмдэгт биш: `{text}` ('A', '\\'', '\\\\' эсвэл '\\n' гэж бич)",
  "lang.bad-string":
    "Мөр (string) өөрийн мөрөн дээрээ, хэвлэгдэх тэмдэгтүүдтэй дуусах ёстой",
  "lang.expected": "{what} байх ёстой, гэтэл: `{found}`",
  "lang.chained-comparison":
    "Харьцуулалт гинжлэгдэхгүй: a < b and b < c гэж бич",
  "lang.unknown-name": "Зарлагдаагүй нэр: `{name}`",
  "lang.duplicate-name": "Аль хэдийн зарлагдсан нэр: `{name}`",
  "lang.reserved-name": "`{name}`: _-ээр эхэлсэн нэр хөрвүүлэгчид хамаарна",
  "lang.type-mismatch": "{expected} байх ёстой, гэтэл: {found}",
  "lang.not-a-function": "Функц биш: `{name}`",
  "lang.not-a-value":
    "Энд утга биш: массивын утга global эсвэл тогтмолд л өгөгдөнө, функцийг (...)-ээр дуудна",
  "lang.arg-count": "`{name}`: аргументын тоо {expected}, {got} биш",
  "lang.missing-type": "`{name}`: төрөл эсвэл эхлэх утга хэрэгтэй",
  "lang.not-assignable":
    "Зөвхөн хувьсагч, хувьсагч массивын элемент эсвэл mem[...]-д утга оноож болно",
  "lang.not-an-array": "Массив биш: `{name}`",
  "lang.not-constant":
    "Энэ тогтмол байх ёстой: тоо, true/false, тогтмолууд ба тэдгээр дээрх үйлдлүүд",
  "lang.bad-array-size":
    "Массивын хэмжээ 1-ээс {max} хүртэлх тогтмол байх ёстой",
  "lang.array-length": "Утгад {found} элемент байна, төрөлд {expected} гэжээ",
  "lang.break-outside-loop": "break ба continue давталт дотор байх ёстой",
  "lang.missing-return": "`{name}`: зам бүр return-ээр төгсөх ёстой",
  "lang.call-not-statement":
    "Энэ юу ч хийхгүй: зөвхөн дуудлага дангаараа statement байж болно",
  "lang.no-main": "Програмд main функц хэрэгтэй: fn main() { ... }",
  "lang.main-signature":
    "main параметргүй бөгөөд int буцаах эсвэл юу ч буцаахгүй байх ёстой",
  "lang.too-many-variables":
    "`{name}`: параметр ба local хэт олон, хамгийн ихдээ {max}",
  "lang.too-many-globals":
    "Global-ууд {words} үг эзэлж байна; хамгийн ихдээ {max} багтана",

  "vm.bad-number": "Тоо биш: `{text}` (42, -5, 0x2A эсвэл 0b101 гэж бич)",
  "vm.out-of-range": "{value} багтахгүй: {min}..{max} байх ёстой",
  "vm.bad-segment": "local, arg, global-ийн аль нь ч биш: `{text}`",
  "vm.set-constant":
    "set-д тоо биш, хувьсагч (local, arg эсвэл global) хэрэгтэй",
  "vm.unknown-command": "Ийм VM команд байхгүй: `{text}`",
  "vm.operand-count": "Operand-ын тоо буруу: {command}",
  "vm.bad-name":
    "Нэр байж болохгүй: `{text}` (үсэг, цифр, _; цифрээр эхлэхгүй, __ агуулахгүй, r0–r7 биш)",
  "vm.too-many-variables":
    "Функц нийтдээ хамгийн ихдээ {max} аргумент ба local-тай байж болно",
  "vm.outside-function": "Команд функц дотор байх ёстой: func-ээр эхэл",
  "vm.duplicate-function": "Функц хоёр удаа тодорхойлогдсон: `{name}`",
  "vm.duplicate-label": "Label хоёр удаа тодорхойлогдсон: `{name}` ({func})",
  "vm.unknown-function": "Ийм функц байхгүй: `{name}`",
  "vm.unknown-label": "Ийм label байхгүй: `{name}` ({func})",
  "vm.no-variable":
    "{func}: {seg} хувьсагчийн тоо {count}, тиймээс {seg} {n} байхгүй",
  "vm.arg-count": "`{name}`: аргументын тоо {expected}, {got} биш",
  "vm.no-main": "Програмд main функц хэрэгтэй (func main 0 k)",
  "vm.main-args": "main аргументгүй байх ёстой",
  "vm.no-return": "`{name}`: return эсвэл jump-аар төгсөх ёстой",
  "vm.function-too-long":
    "Энэ үсрэлт label-даа хүрэхгүй: функц хэт урт байна (хуваа)",
  "vm.asm": "Ассемблер хөрвүүлэлтийг хүлээж авсангүй: {message}",

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
