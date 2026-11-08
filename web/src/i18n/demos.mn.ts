// Бүлгүүдийн оролцоот жишээнүүдийн монгол бичвэр (mn.ts-д нийлнэ).
import type { Message } from "./en";
import type { demosEn } from "./demos.en";

export const demosMn: Record<keyof typeof demosEn, Message> = {
  "kit.wide": "Диаграм (жижиг дэлгэц дээр хажуу тийш гүйлгэнэ)",

  // ---- унтраалгын он цаг ----
  "sw.caption": "Цаг үеийн унтраалгууд",
  "sw.captionText":
    "Хоёр хуваарь хоёулаа логарифм: тэмдэг бүр өмнөхөөсөө 100 эсвэл 1,000 дахин их.",
  "sw.choose": "Унтраалга сонгох",
  "sw.sizeAxis": "Нэг унтраалгын хэмжээ",
  "sw.timeAxis": "Нэг удаа сэлгэх хугацаа",
  "sw.vsToday": "Өнөөгийн транзистортой харьцуулахад",
  "sw.vsGear": "Шүд араатай харьцуулахад",
  "sw.bigger": "том",
  "sw.smaller": "жижиг",
  "sw.slowerWord": "удаан",
  "sw.fasterWord": "хурдан",
  "sw.plotLabel": "{name}: хэмжээ {size}, сэлгэх хугацаа {time}",
  "sw.gear.era": "1640–1940-өөд он",
  "sw.gear.name": "Шүд араа",
  "sw.gear.how":
    "Шүдтэй дугуй нэг алхам эргэнэ. Оронг шилжүүлэх нь нэг дугуй дараагийнхаа дугуйг түлхэх явдал.",
  "sw.relay.era": "1930–1940-өөд он",
  "sw.relay.name": "Реле",
  "sw.relay.how":
    "Цахилгаан соронз төмөр гарыг татаж, контактыг хаах эсвэл нээх.",
  "sw.tube.era": "1940–1950-иад он",
  "sw.tube.name": "Вакуум чийдэн",
  "sw.tube.how":
    "Торон утсан (grid) дээрх хүчдэл электроныг вакуумаар урсгах эсвэл хаах.",
  "sw.transistor-1947.era": "1947",
  "sw.transistor-1947.name": "Анхны транзистор",
  "sw.transistor-1947.how":
    "Германи дээрх хоёр алтан контакт: нэгэн рүү орох гүйдэл нөгөөгөөр урсах гүйдлийг удирдана.",
  "sw.transistor-1971.era": "1971",
  "sw.transistor-1971.name": "Чип дээрх транзистор",
  "sw.transistor-1971.how":
    "MOSFET: gate дээрх хүчдэл цахиурт гүйдэл дамжуулах суваг үүсгэх эсвэл арилгана.",
  "sw.transistor-today.era": "2020-иод он",
  "sw.transistor-today.name": "Өнөөгийн транзистор",
  "sw.transistor-today.how":
    "Ижил MOSFET санаа, хумсны хэмжээтэй чипэнд тэрбумаар багтах хүртэл жижигрүүлсэн.",

  // ---- элснээс wafer хүртэл ----
  "wafer.caption": "Элснээс wafer хүртэл",
  "wafer.captionText":
    "Кварцаас бараг төгс талстан хавтан хүртэл зургаан алхам.",
  "wafer.prev": "← Өмнөх алхам",
  "wafer.next": "Дараах алхам →",
  "wafer.step": "{n}-р алхам: {title}",
  "wafer.temperature": "Температур: {t}",
  "wafer.purity": "Цэвэршилт",
  "wafer.purityText":
    "≈ {pct}% цахиур: {ratio} атом тутамд нэг орчим гадны атом",
  "wafer.source": "Эх сурвалж",
  "wafer.sand.title": "Кварц элс",
  "wafer.sand.what":
    "Цахиурын давхар исэл (SiO₂): хүчилтөрөгчтэй холбогдсон цахиур.",
  "wafer.furnace.title": "Нуман зуух",
  "wafer.furnace.what": "Нүүрстөрөгч цахиураас хүчилтөрөгчийг салгана.",
  "wafer.furnace.temperature": "≈ 1900 °C буюу түүнээс дээш",
  "wafer.trichlorosilane.title": "Шингэн болгож нэрэх",
  "wafer.trichlorosilane.what":
    "Цахиур нэрж болох трихлорсилан (SiHCl₃) болно.",
  "wafer.siemens.title": "Сименсийн арга",
  "wafer.siemens.what": "Цэвэр цахиур олон талст цахиур болж буцаж тунана.",
  "wafer.siemens.temperature": "≈ 1100 °C (саваанууд)",
  "wafer.czochralski.title": "Нэг талст ургуулах",
  "wafer.czochralski.what": "Үр талстыг хайлсан цахиураас аажмаар татна.",
  "wafer.czochralski.temperature":
    "1400 °C-ээс дээш (цахиур ойролцоогоор 1414 °C-д хайлна)",
  "wafer.slice.title": "Зүсэж өнгөлөх",
  "wafer.slice.what":
    "Ембүүг нимгэн хавтангууд болгон хөрөөдөж, толь шиг гөлгөр өнгөлнө.",

  // ---- p-n шилжилт ----
  "pn.caption": "p-n шилжилтийн дотор",
  "pn.captionHtml":
    "p-төрөл (<em>нүх</em>, +) ба n-төрөл (<em>электрон</em>, −) уулзсан газарт <em>depletion region</em> үүснэ. Хүчдэлийг өөрчил.",
  "pn.slider": "Шилжилтийн хүчдэл",
  "pn.voltage": "Хүчдэл",
  "pn.width": "Depletion region-ий өргөн",
  "pn.current": "Гүйдэл",
  "pn.resting": "тайван үеийнхээс {n}×",
  "pn.label":
    "Шилжилт {v} вольт дээр. Depletion region тайван үеийн өргөнөөсөө {w} дахин. {state}",
  "pn.reverse":
    "Reverse bias: depletion region өргөсөнө. Бараг гүйдэл урсахгүй. Шилжилт хаана.",
  "pn.unbiased":
    "Хүчдэл өгөөгүй: depletion region доторх цэнэгтэй атомуудын цахилгаан оронд баригдан байгалийн өргөнөөрөө байна. Гүйдэл урсахгүй.",
  "pn.weak-forward":
    "Бага forward bias: depletion region нарийсна, гэхдээ саад өндөр хэвээр. Ердөө бага зэрэг урсана.",
  "pn.conducting":
    "≈ 0.6 В-оос давсан forward bias: саад нурж, электрон ба нүхнүүд урсан гарна. Гүйдэл огцом өснө.",
  "pn.pSide": "p-төрөл (нүх +)",
  "pn.nSide": "n-төрөл (электрон −)",
  "pn.depletion": "depletion region",
  "pn.ivLabel":
    "Гүйдлийг хүчдэлээс хамааруулсан график: тэгийн ойролцоо хавтгай, ойролцоогоор 0.6 вольтоос дээш огцом өснө.",
  "pn.vAxis": "хүчдэл →",
  "pn.iAxis": "гүйдэл ↑ (10 мА хүртэл)",

  // ---- MOSFET ----
  "mos.caption": "MOSFET: хөдөлгөөнт хэсэггүй унтраалга",
  "mos.captionHtml":
    "Gate дээрх хүчдэл source-оос drain хүртэл <em>суваг</em> нээнэ. Чирж үз.",
  "mos.type": "Транзисторын төрөл",
  "mos.nmos": "NMOS (n-суваг)",
  "mos.pmos": "PMOS (p-суваг)",
  "mos.gateSlider": "Gate-ийн хүчдэл",
  "mos.gate": "Gate",
  "mos.switch": "Унтраалга",
  "mos.current": "Гүйдэл, source → drain",
  "mos.on": "АСААЛТТАЙ (хаалттай)",
  "mos.off": "УНТРААЛТТАЙ (нээлттэй)",
  "mos.label": "{type} транзистор, gate {g} вольт: унтраалга {state}.",
  "mos.stateOn": "асаалттай, суваг үүссэн",
  "mos.stateOff": "унтраалттай, суваггүй",
  "mos.body": "{body}-төрлийн цахиур (бие)",
  "mos.source": "{wells}+ source",
  "mos.drain": "{wells}+ drain",
  "mos.gateV": "gate: {v} В",
  "mos.sourceV": "source: {v}",
  "mos.oxide": "исэл",
  "mos.drainLabel": "drain",
  "mos.gateLabel": "gate",
  "mos.nmosOn":
    "Gate source-оос {vth} В-оос илүү өндөр: электронууд ислийн доор цугларч n-төрлийн суваг үүсгэнэ. Гүйдэл урсана.",
  "mos.nmosOff":
    "Gate босгоос ({vth} В) доогуур: суваг байхгүй тул унтраалга нээлттэй. Ердөө маш бага алдагдлын гүйдэл урсана.",
  "mos.pmosOn":
    "Gate source-оос ({vdd} В) дор хаяж {vth} В-оор доогуур: нүхнүүд ислийн доор цугларч p-төрлийн суваг үүсгэнэ. Гүйдэл урсана. PMOS-ийн gate нь НАМ үед асдаг.",
  "mos.pmosOff":
    "Gate source-ын хүчдэлд ({vdd} В) хэт ойр: суваг байхгүй. PMOS-ийн gate нь ӨНДӨР үед унтардаг, NMOS-ийн эсрэг.",
  "mos.plotLabel":
    "Гүйдлийг gate-ийн хүчдэлээс хамааруулсан логарифм хуваарьтай график, унтраалттай ба асаалттай хооронд сая гаруй дахин ялгаатай.",
  "mos.gAxis": "gate-ийн хүчдэл →",
  "mos.grid": "тор бүр: гүйдэл 1,000× их",

  // ---- шуугиантай гинж ----
  "noise.caption": "Аналог гулсалт ба дижитал сэргээлт",
  "noise.captionHtml":
    "Шат бүр шуугиан нэмнэ. <em>Аналог</em> шат түүнийг дамжуулна; <em>дижитал</em> шат 0 эсвэл 1 рүү буцааж тааруулна.",
  "noise.bit": "Илгээх бит",
  "noise.stages": "Шатууд",
  "noise.noise": "Шат бүрийн шуугиан",
  "noise.again": "Дахин илгээх",
  "noise.analog": "Аналог (тасархай) ирэх утга",
  "noise.digital": "Дижитал (бүтэн) ирэх утга",
  "noise.errors": "1,000 илгээлт дэх алдаа",
  "noise.whyTitle": "Дижитал яагаад ялдаг вэ: S муруй",
  "noise.whyHtml":
    "Дунд нь эгц, төгсгөлдөө хавтгай: бага зэрэг хазайсан 1 цэвэр 1 болж гарна. <em>Noise margin</em> бол дохио хэр их хазайсан ч зөв уншигдах хэмжээ.",
  "noise.reads1": "1 гэж уншигдана",
  "noise.unreliable": "найдваргүй бүс",
  "noise.reads0": "0 гэж уншигдана",
  "noise.stageN": "{n}-р шат",
  "noise.correct": "✓ зөв",
  "noise.wrong": "✗ буруу",
  "noise.errorCounts": "аналог {a}, дижитал {d}",
  "noise.label":
    "{bit}-ийг {n} шатаар илгээж байна. Аналог гинж {a} вольтоор, дижитал гинж {d} вольтоор төгсөнө.",
  "noise.curveLabel":
    "Дижитал шатны transfer curve. {vil} вольтоос доош оролт 0, {vih}-ээс дээш оролт 1 гэж уншигдана. Noise margin ойролцоогоор {nm} вольт.",
  "noise.inAxis": "оролтын хүчдэл →",
  "noise.sender": "илгээгч",
  "noise.outAxis": "гаралт ↑",
  "noise.margin": "noise margin",

  // ---- унтраалгын сүлжээ ----
  "net.caption": "Тооцоолдог унтраалгууд",
  "net.captionHtml":
    "<em>Цуваа</em>: хоёр унтраалга хоёулаа хаагдах ёстой (БА). <em>Зэрэгцээ</em>: аль нэг нь хангалттай (ЭСВЭЛ).",
  "net.series": "Цуваа",
  "net.parallel": "Зэрэгцээ",
  "net.switch": "Унтраалга {name}: {state}",
  "net.closed1": "хаалттай (1)",
  "net.open0": "нээлттэй (0)",
  "net.closed": "хаалттай",
  "net.open": "нээлттэй",
  "net.picLabel": "{arr} хэлхээ: чийдэн {state}",
  "net.lampOn": "чийдэн АСАВ",
  "net.lampOff": "чийдэн унтарсан",
  "net.on": "асаалттай",
  "net.off": "унтраалттай",
  "net.result": "A={a}, B={b} → чийдэн {state}",
  "net.on1": "асаалттай (1)",
  "net.off0": "унтраалттай (0)",
  "net.table": "Үнэний хүснэгт ({logic})",
  "net.lamp": "чийдэн",

  // ---- ripple carry ----
  "ripple.caption": "Дамжин урсах carry",
  "ripple.captionHtml":
    'Хоёр бит нь тэнцүү багана carry-гээ шууд мэднэ; бусад нь баруунаас ирэх carry-г хүлээнэ. <span class="muted">?</span> = хараахан тодорхойгүй.',
  "ripple.step": "Step",
  "ripple.play": "Тоглуулах",
  "ripple.reset": "Эхлүүлэх",
  "ripple.longCarry": "255 + 1 (урт carry)",
  "ripple.noCarry": "255 + 0 (carry-гүй, гэхдээ хүлээнэ)",
  "ripple.noWait": "12 + 12 (хүлээхгүй)",
  "ripple.carryOut": "гарах carry",
  "ripple.bit": "{n}-р бит",
  "ripple.carryIn": "орох carry",
  "ripple.sum": "нийлбэр",
  "ripple.done": "{n} step-ийн дараа дууслаа: {a} + {b} = {sum}{dropped}.",
  "ripple.dropped":
    " (гарах carry хаягдана: 8 бит {total}-ийг багтааж чадахгүй)",
  "ripple.waiting": "Step {step}/{total}: carry дамжихыг хүлээсээр байна.",

  // ---- latch ----
  "latch.caption": "Санаж үлддэг гогцоо",
  "latch.captionText":
    "Бие биеэ тэжээдэг хоёр NOR gate: s эсвэл r-ийг 1, дараа нь 0 болгоход latch санаж үлдэнэ.",
  "latch.s": "s (тохируулах) = {v}",
  "latch.r": "r (арилгах) = {v}",
  "latch.release": "Хоёуланг зэрэг суллах",
  "latch.power": "Унтраагаад асаах",
  "latch.picLabel":
    "Хоёр NOR gate. Дээд: оролт r = {r} ба q̄ = {qn}, гаралт q = {q}. Доод: оролт s = {s} ба q = {q}, гаралт q̄ = {qn}.",
  "latch.delays": "{n} gate-ийн саатлын дараа",
  "latch.oscillates":
    "Хэзээ ч тогтворжихгүй: q = q̄ = 0 үеэс хоёр оролтыг суллахад хоёр gate хоёулаа 1 болж, дараа нь хоёулаа 0 болж, үүрд үргэлжилнэ. Бодит gate-үүд хэзээ ч яг ижил байдаггүй тул нэг нь ялна, гэхдээ алийг нь урьдчилан хэлж чадахгүй. Тиймээс latch-д хэзээ ч s = r = 1 өгч болохгүй.",
  "latch.unknown":
    "Тодорхойгүй (X): асаахад latch-ийг хараахан юу ч тохируулж, арилгаагүй. s эсвэл r-ийг 1 болго.",
  "latch.forbidden":
    "Хориотой: s = r = 1 үед хоёр гаралт хоёулаа 0 тул q ба q̄ эсрэг байхаа болино.",
  "latch.holding":
    "{q}-ийг хадгалж байна: q доод gate-ийг тэжээж q̄-г {qn}-д, q̄ нь q-г {q}-д барина. Гаднаас юу ч жолоодохгүй; гогцоо санаж байна.",
  "latch.setting":
    "Тохируулж байна: s = 1 нь q̄-г 0 болгож, дараа нь дээд gate q = 1 болгоно.",
  "latch.resetting":
    "Арилгаж байна: r = 1 нь q-г 0 болгож, дараа нь доод gate q̄ = 1 болгоно.",

  // ---- CPU ----
  "cpu.caption": "CPU, нэг удаад нэг заавар",
  "cpu.captionText":
    "Бидний CPU програм ажиллуулж байна: Step бүр нэг clock циклд нэг заавар.",
  "cpu.program": "Програм",
  "cpu.sum": "10 + 9 + … + 1-ийн нийлбэр",
  "cpu.call": "Дуудах ба буцах",
  "cpu.screen": "Дэлгэц дээр зурах",
  "cpu.step": "Step",
  "cpu.run": "Ажиллуулах",
  "cpu.reset": "Эхлүүлэх",
  "cpu.listing": "Програмын ROM",
  "cpu.addr": "Хаяг",
  "cpu.instr": "Заавар",
  "cpu.current": "PC дээрх заавар",
  "cpu.state": "Регистрүүд",
  "cpu.flags": "Flag-ууд",
  "cpu.new": "← өөрчлөгдсөн",
  "cpu.screenLabel": "Дэлгэцийн зүүн дээд булан (16 × 2 пиксел):",
  "cpu.pixelRow": "{y}-р мөр: {bits}",
  "cpu.start":
    "Reset: PC нь 0. Эхний зааврыг ажиллуулахын тулд «Step» дарна уу.",
  "cpu.did": "Step {n}: {asm}.",
  "cpu.group.alu":
    "Register file хоёр регистр уншиж, ALU тэдгээрийг нэгтгэж, үр дүн регистрт буцаж бичигдэнэ. Flag-ууд хадгалагдана.",
  "cpu.group.cmp":
    "ALU хоёр регистрийг харьцуулахын тулд хасна; зөвхөн flag-ууд үлдэнэ.",
  "cpu.group.imm":
    "Тоо нь зааврын дотор өөрт нь байна. SET ба SETH түүнийг ачаална; ADDI ба SUBI нэмж эсвэл хасаад flag-уудыг хадгална.",
  "cpu.group.shift":
    "Barrel shifter регистрийн битүүдийг нэг алхамд шилжүүлнэ.",
  "cpu.group.load":
    "ALU регистр дээр offset нэмж хаяг гаргана, тэр хаяг дахь үг регистрт орно.",
  "cpu.group.store":
    "ALU хаягийг гаргаж, регистрийн утга санах ойн тэр хаягт бичигдэнэ.",
  "cpu.group.jump":
    "Control unit хадгалсан flag-ууд дээр нөхцөлийг шалгана. Биелвэл PC нь PC + 1 биш, PC + offset болно.",
  "cpu.group.call":
    "CALL буцах хаягийг r7-д хадгалж үсэрнэ; RET нь r7 дахь хаяг руу буцаж үсэрнэ.",
  "cpu.chReg": "r{r}: {from} → {to}",
  "cpu.chFlags": "flag-ууд: Z={z} N={n} C={c}",
  "cpu.chMem": "санах ойн хаяг {addr} ← {value}",
  "cpu.chJump": "PC үсэрнэ: {to}",
  "cpu.nothing":
    "Регистр ч, санах ой ч өөрчлөгдсөнгүй; PC дараагийн заавар руу шилжинэ.",
  "cpu.halted":
    "Програм зогслоо: JMP 0 өөр рүүгээ үүрд үсэрнэ. Дахин ажиллуулахын тулд «Эхлүүлэх» дарна уу.",

  // ---- нэг заавар, бит бүрээр ----
  "asmd.caption": "Нэг заавар, бит бүрээр",
  "asmd.captionText":
    "Заавар сонгох эсвэл бичих: хэсэг бүр нь 16 битийн үгийн нэг талбар болно.",
  "asmd.try": "Турших",
  "asmd.instruction": "Заавар",
  "asmd.group": "бүлэг",
  "asmd.unused": "ашиглагдаагүй",

  "brow.caption": "Талбай бол тоо",
  "brow.captionText":
    "Мөр бүр 10 битийн тоо. Нүдэн дээр дар: бүтэн мөр (1023) эсвэл target-тэй тэнцүү мөр арилна. Доор AND хэсгийг сүүлийн мөртэй шалгана.",
  "brow.target": "Target: {bits}",
  "brow.rowLabel": "{n}-р мөр",
  "brow.cellOn": "{row}-р мөр, {col}-р нүд: дүүрсэн",
  "brow.cellOff": "{row}-р мөр, {col}-р нүд: хоосон",
  "brow.fate.full": "дүүрсэн (1023): арилна, +10",
  "brow.fate.target": "target-тэй тэнцүү: арилна, +50",
  "brow.fate.stays": "үлдэнэ",
  "brow.pieceHead": "Сүүлийн мөрийн дээрх хэсгийн мөр",
  "brow.pieceLabel": "{col}-р багана дахь хэсгийн мөр: {bits}",
  "brow.column": "Хэсгийн багана",
  "brow.fits": "хэсэг AND мөр = {and}: багтана.",
  "brow.blocked": "хэсэг AND мөр = {and}: 0 биш тул хаагдана.",

  "font.caption": "Фонт бол тоо",
  "font.captionText":
    "Тэмдэгт бүр нэг үгэнд 3 × 5 пиксел. Пиксел дээр дарж битийг нь соль.",
  "font.try": "Турших",
  "font.char": "Тэмдэгт",
  "font.gridLabel": "Пикселүүд: {char}",
  "font.pixelOn": "{row}-р мөр, {col}-р багана: асаалттай",
  "font.pixelOff": "{row}-р мөр, {col}-р багана: унтраалттай",
  "font.bitsTitle": "15-р бит (ашиглагдаагүй), дараа нь таван мөр",
  "font.note":
    "draw_char энэ үгийг уншиж, 1 бүрд пиксел зурна: (word >> (14 − 3·row − column)) & 1. Бүх фонт 64 үг: 128 байт.",

  "cmp.caption": "Хөрвүүлэгч, үе шат бүрээр",
  "cmp.captionText":
    "Програмыг засаад үе шат бүрийг хар: token, syntax tree, VM код.",
  "cmp.try": "Турших",
  "cmp.ex.expr": "Үйлдлийн дараалал",
  "cmp.ex.if": "if ба дуудлага",
  "cmp.ex.loop": "Давталт ба массив",
  "cmp.source": "C Shard эх код",
  "cmp.tokens": "1 · Token-ууд ({n})",
  "cmp.tree": "2 · Syntax tree",
  "cmp.vm": "3–4 · Шалгасны дараах VM код ({n} мөр)",
  "cmp.error": "{line}-р мөр: {message}",
  "cmp.kind.num": "тоо",
  "cmp.kind.str": "string",
  "cmp.kind.name": "нэр",
  "cmp.kind.kw": "түлхүүр үг",
  "cmp.kind.sym": "тэмдэгт",

  "stk.caption": "Stack machine, нэг удаад нэг команд",
  "stk.captionText":
    "Програмыг алхам алхмаар ажиллуулж, stack-ийг оройгоос нь хар.",
  "stk.program": "Програм",
  "stk.expr": "x = (3 + 4) × 2",
  "stk.call": "Дуудлага: area(5, 3)",
  "stk.fact": "Рекурс: 3!",
  "stk.step": "Step",
  "stk.back": "Буцах",
  "stk.run": "Ажиллуулах",
  "stk.reset": "Эхлүүлэх",
  "stk.code": "VM код",
  "stk.stack": "Stack, оройгоос нь",
  "stk.operand": "ажлын утга ({func})",
  "stk.local": "local {index} ({func})",
  "stk.arg": "arg {index} ({func})",
  "stk.saved-fp": "{func}: дуудагчийн FP",
  "stk.return": "{func}: буцах хаяг",
  "stk.result": "main-ийн үр дүн",
  "stk.empty": "Stack хоосон.",
  "stk.current": "дараагийн команд",
  "stk.start": "Эхний командыг ажиллуулахын тулд «Step» дарна уу.",
  "stk.next": "Step {n}. Дараа нь: {line}-р мөр.",
  "stk.done": "Дууслаа: main {value} буцаалаа.",
};
