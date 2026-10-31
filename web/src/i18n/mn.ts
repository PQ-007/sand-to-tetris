// Монгол хэлний интерфейсийн бичвэр. Түлхүүр бүр en.ts-тэй ижил байх
// ёстой (төрөл шалгагч үүнийг баталгаажуулна). Нэр томьёо: боломжтой бол
// монгол үг (docs/mn/TERMS.md).
import { demosMn } from "./demos.mn";
import type { en, Message } from "./en";

export const mn: Record<keyof typeof en, Message> = {
  // ---- сайт ----
  "site.name": "Элснээс Тетрис хүртэл",
  "site.skip": "Агуулга руу шилжих",
  "nav.label": "Сайт",
  "nav.learn": "Суралцах",
  "nav.build": "Бүтээх",
  "nav.glossary": "Нэр томьёо",
  "nav.language": "Хэл",
  "core.loading": "Загварчлагчийг ачаалж байна…",
  "core.ok": "Загварчлагч {version}",
  "core.okTitle": "Загварчлагчийн цөм {version} ачаалагдлаа",
  "core.failed": "Загварчлагчийн цөмийг ачаалж чадсангүй: {error}",
  "page.error": "Энэ хуудсыг ачаалахад алдаа гарлаа",
  "page.loading": "Ачаалж байна…",
  "title.glossary": "Нэр томьёо",
  "title.levels": "Түвшнүүд",
  "title.level": "Түвшин",
  "title.notFound": "Олдсонгүй",

  // ---- хичээлийн бүтэц ----
  "outline.0.title": "Элснээс унтраалга хүртэл",
  "outline.0.summary":
    "Компьютер гэж юу вэ, хүмүүс электроникаас өмнө хэрхэн тооцоолж байсан, цахиур хэрхэн транзистор болдог.",
  "outline.1.title": "Транзистороос логик хаалга хүртэл",
  "outline.1.summary":
    "NMOS, PMOS транзисторуудыг холбож NOT, NAND, NOR хаалга бүтээнэ.",
  "outline.2.title": "Хослолын логик",
  "outline.2.summary": "Сонгогч, хуваарилагч, нэмэгч ба 16 битийн АЛН.",
  "outline.3.title": "Санах ой",
  "outline.3.summary":
    "Түгжээ, сэлгүүр, хадгалуур, шууд хандалтат санах ой ба програмын тоолуур.",
  "outline.4.title": "Төв процессор",
  "outline.4.summary":
    "Хамтдаа зохиох зааврын систем, өгөгдлийн зам ба удирдлагын нэгж.",
  "outline.5.title": "Ассемблер",
  "outline.5.summary":
    "Уншихад хялбар ассемблер кодыг машины хоёртын код болгох.",
  "outline.6.title": "Виртуал машин ба хэл",
  "outline.6.summary":
    "Виртуал машин, дараа нь түүн рүү хөрвүүлэх жижиг өндөр түвшний хэл.",
  "outline.7.title": "Жижиг үйлдлийн систем",
  "outline.7.summary": "Дэлгэц, гар, цаг хэмжигч ба санамсаргүй тоо.",
  "outline.8.title": "Тетрис",
  "outline.8.summary":
    "Өөрийн хэл дээр Тетрис бичээд, өөрийн компьютер дээрээ тоглоно.",

  // ---- нүүр ----
  "home.eyebrow": "{n} бүлэгтэй хичээл",
  "home.title": "Элснээс Тетрис хүртэл",
  "home.tagline":
    "Элснээс эхэлнэ. Унтраалга, логик хаалга, санах ой, төв процессор, хөрвүүлэгч, үйлдлийн систем бүтээнэ. Эцэст нь өөрийн бүтээсэн компьютер дээр Тетрис тоглоно.",
  "home.start": "Уншиж эхлэх",
  "home.workbench": "Ажлын ширээ нээх",
  "home.howItWorks": "Хэрхэн ажилладаг вэ",
  "home.read": "Унш",
  "home.readText":
    "Бүлэг бүр нэг давхаргыг энгийн үгээр, оролцоот жишээтэйгээр тайлбарлана.",
  "home.build": "Бүтээ",
  "home.buildText":
    "Өмнө бүтээсэн эд ангиасаа бүрэлдэхүүнээ засварлагч дээр өөрөө холбож бүтээ.",
  "home.unlock": "Нээ",
  "home.unlockText":
    "Шалгалтыг давбал тэр нь дараагийн давхаргад ашиглах битүү блок болж багажинд чинь нэмэгдэнэ.",
  "home.chapters": "Бүлгүүд",
  "home.readyCount": "{total}-аас {ready} нь бэлэн",
  "home.ready": "Уншихад бэлэн",
  "home.soon": "Удахгүй",
  "home.chapterN": "{n}-р бүлэг",

  // ---- бүлгийн хуудас ----
  "chapter.n": "{n}-р бүлэг",
  "chapter.course": "Хичээл",
  "chapter.chaptersLabel": "Бүлгүүд",
  "chapter.soonSr": "(удахгүй)",
  "chapter.onThisPage": "Энэ хуудсанд",
  "chapter.inThisChapter": "Энэ бүлэгт",
  "chapter.backToTop": "↑ Дээш буцах",
  "chapter.sources": "Эх сурвалж",
  "chapter.pagerLabel": "Өмнөх ба дараагийн бүлэг",
  "chapter.previous": "← Өмнөх",
  "chapter.next": "Дараах →",
  "chapter.notWritten": "{n}-р бүлэг хараахан бичигдээгүй байна.",
  "chapter.notTranslated":
    "Энэ бүлэг хараахан орчуулагдаагүй тул англи хэлээр харуулж байна.",

  // ---- нэр томьёо ----
  "glossary.lead": "Бүлгүүдэд гардаг бүх техникийн нэр томьёо, энгийн үгээр.",
  "glossary.filterLabel": "Нэр томьёо шүүх",
  "glossary.filter": "{n} нэр томьёоноос шүүх…",
  "glossary.matches": "{total}-аас {shown} нь “{q}”-д тохирч байна.",
  "glossary.seeAlso": "Мөн үзэх:",
  "notFound.text": "Энэ хаягт хуудас алга.",
  "notFound.back": "Бүлгүүд рүү буцах",

  // ---- түвшний зураглал ----
  "levels.title": "Компьютерээ бүтээ",
  "levels.lead":
    "Түвшин бүр нэг бүрэлдэхүүн. Давбал дараагийн түвшнүүдэд ашиглахаар багажинд чинь нэмэгдэнэ.",
  "levels.layer": "{n}-р давхарга: {name}",
  "levels.passedCount": "{total}-аас {passed} нь давсан",
  "status.passed": "✓ Давсан",
  "status.open": "Нээлттэй",
  "status.locked": "Хаалттай",
  "status.broken": "⚠ Эвдэрсэн",
  "levels.sideQuest": "нэмэлт даалгавар",
  "levels.opensAfter": "Дараахыг давсны дараа нээгдэнэ: {names}.",
  "levels.and": ", ",
  "levels.brokenText":
    "Ашигладаг зүйлсийн нэг нь өөрчлөгдөж, одоо шалгалтыг давахгүй байна. Нээж шалтгааныг нь үзээрэй.",
  "levels.progress": "Таны ахиц",
  "levels.meter": "{total}-аас {passed}",
  "levels.meterText": "түвшин давсан",
  "levels.saved": "Энэ хөтөчид автоматаар хадгалагдана.",
  "levels.notSaved":
    "Энэ хөтөч сайтад өгөгдөл хадгалахыг зөвшөөрөхгүй байна. Цонхоо хаахаас өмнө ахицаа файл болгон гаргаж аваарай.",
  "levels.exportHint":
    "Нөөцлөх эсвэл өөр хөтөч рүү шилжүүлэхийн тулд файл болгон гаргаж аваарай.",
  "levels.export": "Гаргах",
  "levels.import": "Оруулах",
  "levels.imported": "Оруулж дууслаа.",
  "levels.confirmImport": "Одоогийн ахицаа оруулж буй файлаар солих уу?",
  "levels.runsAs": "Ажиллах хэлбэр: {mode}",
  "levels.fastModel": "хурдан загвар",
  "levels.yourDesign": "таны бүтээл",
  "levels.nowYours": "Одоо таны өөрийн бүтээл ажиллаж байна.",
  "levels.comparing": "Таны бүтээлийг хурдан загвартай харьцуулж байна…",
  "levels.cantSwap": "Солих боломжгүй: {error}",
  "levels.scopeAll": "боломжит бүх {n} оролт",
  "levels.scopeRandom": "{n} санамсаргүй оролт",
  "levels.scopeCycles": "{n} санамсаргүй цагийн мөчлөг",
  "levels.notSwapped":
    "✗ Солигдсонгүй: шалгасан {scope}-ын {failed} дээр таны бүтээл загвараас ялгаатай байна.",
  "levels.example":
    " Жишээ нь {inputs} үед загвар {expected} гэж, таны бүтээл {actual} гэж гаргалаа.",
  "levels.matched":
    "✓ {scope} дээр тохирлоо. Одоо хурдан загвараар ажиллаж байна.",
  "progress.badJson": "Энэ файл зөв JSON биш байна.",
  "progress.notOurs":
    "Энэ файл «Элснээс Тетрис хүртэл»-ийн ахицын файл биш байна.",

  // ---- түвшний хуудас ----
  "play.loading": "Загварчлагчийг ачаалж байна…",
  "play.noLevel": "Ийм түвшин алга",
  "play.backToMap": "Түвшнүүд рүү буцах",
  "play.locked": "Хаалттай түвшин: {name}",
  "play.passFirst": "Эхлээд дараахыг давна уу: {names}.",
  "play.crumbs": "Байршил",
  "play.layerN": "{n}-р давхарга",
  "play.nextLevel": "Дараагийн түвшин →",
  "play.levelMap": "Түвшнүүд",
  "play.toolbox": "Багаж",
  "play.parts": "Эд анги",
  "play.addTool": "Нэмэх: {name} (эсвэл зотон дээр чирж оруулна)",
  "play.undo": "Буцаах",
  "play.redo": "Дахих",
  "play.undoTitle": "Буцаах (Ctrl+Z)",
  "play.redoTitle": "Дахих (Ctrl+Shift+Z)",
  "play.workbench": "Ажлын ширээ",
  "play.narrow":
    "Засварлагч том дэлгэц дээр хамгийн тохиромжтой. Утсан дээр зотоныг чирж гүйлгэнэ; цэсний товч эсвэл баруун товшилт эд ангийн үйлдлүүдийг харуулна.",
  "play.sideLabel": "Зорилго, оролт ба шалгалт",
  "play.goal": "Зорилго",
  "play.notSaving":
    "Таны хөтөч энэ сайтад өгөгдөл хадгалахыг зөвшөөрөхгүй байгаа тул ахиц зөвхөн энэ цонхыг хаах хүртэл хадгалагдана. Үлдээхийн тулд түвшнүүдийн хуудсан дээрх «Гаргах»-ыг ашиглаарай.",
  "play.inputs": "Оролтууд",
  "play.busHelp":
    "Олон битийн оролт бүрд тоо бичнэ: аравтын, 0x… арван зургаатын эсвэл 0b… хоёртын. Enter дарж хэрэглэнэ.",
  "play.busLabel": "{name} ({w} бит) ",
  "play.notANumber":
    "“{text}” нь 0-ээс {max} хүртэлх тоо биш байна. Аравтын, 0x… арван зургаатын эсвэл 0b… хоёртын тоо бичиж болно.",
  "play.step": "Алхам",
  "play.want": "{name} (хүлээгдэж буй)",
  "play.yours": "{name} (таных)",
  "play.result": "Үр дүн",
  "play.any": "дурын",
  "play.match": "✓ тохирсон",
  "play.differs": "✗ ялгаатай",
  "play.check": "Шалгах",
  "play.checking": "Шалгаж байна…",
  "play.testSteps": "Шалгалтын алхмууд",
  "play.truthTable": "Үнэний хүснэгт",
  "play.stepsHelp":
    "Алхмууд дээрээс доош дарааллаар явагдах бөгөөд хэлхээ алхам хооронд санаж үлдэнэ. «дурын» нь ямар ч утга болно гэсэн үг. Алхам дээр дарж шалгалтыг тэр хүртэл дахин явуулна.",
  "play.tableHelp":
    "Холбох тусам шууд шинэчлэгдэнэ. Мөр дээр дарж тэр оролтуудыг тохируулна.",
  "play.howPartsRun": "Эд анги хэрхэн ажиллаж байна",
  "play.howPartsRunHelp":
    "Аль эд анги хурдан загвараар ажиллахыг түвшнүүдийн хуудсан дээр сонгоно.",
  "play.runsTable":
    "үнэний хүснэгтээрээ (таны транзисторууд бүх мөрийг давсан)",
  "play.runsFast": "хурдан загвараар (таны бүтээлтэй тохирсон)",
  "play.runsYours": "таны бүтээлээр",
  "play.runsItem": "{name}: {how}",
  "play.noComponents": "Бүрэлдэхүүн хараахан алга.",
  "play.tick": "Цагийн цохилт ⎍",
  "play.tickTitle": "clk-ийг 1 болгоод буцааж 0 болгоно",
  "play.ticked":
    "Цохилт: clk 1 болж (сэлгүүрүүд хадгалах агшин) буцаад 0 боллоо.",
  "play.resetMemory": "Санах ойг цэвэрлэх",
  "play.resetMemoryTitle":
    "Хадгалсан бүхнээ мартана: унтраагаад асаасантай адил",
  "play.memoryCleared":
    "Санах ой цэвэрлэгдлээ: асаасан үеийнх шиг хадгалсан бит бүр дахин тодорхойгүй (X) боллоо.",
  "play.zoom": "Томруулалт",
  "play.zoomOut": "Жижигрүүлэх",
  "play.zoomIn": "Томруулах",
  "play.zoomOutTitle": "Жижигрүүлэх (−)",
  "play.zoomInTitle": "Томруулах (+)",
  "play.zoomReset": "100% болгох (0)",
  "play.zoomLevel": "Томруулалтын хэмжээ; 100% болгох",
  "play.fit": "Багтаах",
  "play.fitTitle": "Хэлхээг бүхэлд нь харагдуулах",
  "play.shortcuts": "Товчлол",
  "keys.add": "Эд анги нэмэх",
  "keys.addHow": "Багажаас чирэх, эсвэл дарах",
  "keys.wire": "Хоёр хөлийг холбох",
  "keys.wireHow": "Нэг хөлөөс нөгөө рүү чирэх, эсвэл хоёуланг нь дарах",
  "keys.move": "Эд анги, оролт, гаралтыг зөөх",
  "keys.moveHow": "Чирэх · Tab-аар сонгоод сумтай товч",
  "keys.flip": "Оролтыг сэлгэх",
  "keys.flipHow": "Дарах · Enter",
  "keys.more": "Бусад үйлдэл (холбох, устгах…)",
  "keys.moreHow": "Баруун товшилт · цэсний товч эсвэл Shift+F10",
  "keys.inside": "Бүрэлдэхүүний дотрыг харах",
  "keys.insideHow": "Давхар дарах · Enter",
  "keys.delete": "Устгах",
  "keys.deleteHow": "Delete эсвэл Backspace",
  "keys.undo": "Буцаах / дахих",
  "keys.undoHow": "Ctrl+Z / Ctrl+Shift+Z",
  "keys.pan": "Гүйлгэх",
  "keys.panHow": "Хоосон зотоныг чирэх · гүйлгэх",
  "keys.zoom": "Томруулах",
  "keys.zoomHow": "Ctrl+гүйлгэх · + ба − · 0 буцаана",
  "keys.cancel": "Холболтыг цуцлах",
  "keys.cancelHow": "Escape",
  "play.changed":
    "Сүүлийн шалгалтаас хойш өөрчлөгдсөн. Дахин «Шалгах»-ыг дарна уу.",
  "play.emptyHint":
    "Багажаас эд анги энд чирж оруулах, эсвэл зотон дээр баруун товшиж нэмнэ. Дараа нь хөлөөс хөл рүү чирж холбоно.",
  "play.added": "Нэмэгдлээ: {id}.",
  "play.addedFree":
    "Нэмэгдлээ: {id}. Зотон дээр Tab-аар сонгоод сумтай товчоор зөөж болно.",
  "play.duplicated": "Хуулбар нэмэгдлээ: {id} ({from}-ийн хуулбар).",
  "play.disconnectedAll": "Бүх утсыг салгалаа: {name}.",
  "play.disconnectedOne": "Нэг утсыг салгалаа: {name}.",
  "play.connected": "Холбогдлоо: {from} — {to}.",
  "play.deleted": "Устгалаа: {id}.",
  "play.deletedWire": "Утсыг устгалаа.",
  "play.movedBack": "Ирмэг рүү буцаалаа: {name}.",
  "play.settled": (v) =>
    `${v.depth} хаалганы саатлын дараа тогтворжлоо${v.fast ? " (хурдан загвар бүрийг нэг алхмаар тооцдог тул жинхэнэ төхөөрөмж илүү удаан ажиллана)" : ""}.`,
  "play.oscillates":
    "Өөрчлөгдсөөр байна: энэ хэлхээ хэлбэлзэж, хэзээ ч тогтворждоггүй.",
  "play.slow": (v) =>
    `Энэ хэлхээ ${v.cells} хаалга загварчилж байгаа тул өөрчлөлт бүр хэсэг хугацаа авна. Дараахыг хурдан загвар руу шилжүүлэхэд шууд болно: ${v.names}. Үүнийг `,
  "play.slowLink": "түвшнүүдийн хуудсан",
  "play.slowEnd": " дээр хийнэ.",
  "play.optionsFor": "Тохиргоо: {id}",
  "play.busWidth": "Шугамын өргөн ",
  "play.bits": "{n} бит",
  "play.repeat": "Давтах × ",
  "play.repeatHelp":
    "Хуулбар бүр олон битийн хөл бүрийн өөрийн хэсгийг авна. Харин хуваалцсан оролтыг бүх хуулбар ижил уншина.",
  "play.share": " хуваалцах: {pin}",
  "play.simError": "Загварчлалын алдаа: {error}",
  "play.showingStep1": "1-р алхмыг асаасан үеэс эхлэн харуулж байна.",
  "play.showingStep":
    "{n}-р алхмыг харуулж байна (1–{m}-р алхмыг дахин явуулсны дараа).",
  "play.showingRow":
    "{n}-р мөрийг харуулж байна. Тодруулсан эд анги «!» тэмдэгтэй.",
  "play.waveform": "Долгионы зураглал",
  "play.waveTest": "Шалгалтын алхмууд",
  "play.waveLive": "Шууд",
  "play.waveClear": "Арилгах",
  "play.waveLiveEmpty":
    "Оролтуудыг сэлгэх эсвэл цагийн цохилт өгөх: өөрчлөлт бүр энд гарна.",
  "play.waveEmpty": "Харуулах зүйл хараахан алга.",
  "play.error": "Алдаа: ",
  "play.note": "Тэмдэглэл: ",
  "play.shortNow":
    "Яг одоо богино холбоо үүссэн: VDD ба GND дараахаар дамжин холбогдсон: {parts}.",
  "play.couldntCheck": "Шалгаж чадсангүй: {error}",
  "play.passed": "✓ Давлаа!",
  "play.passedRows": (v) =>
    v.random
      ? `Бүх ${v.rows} ${v.seq ? "алхам" : "мөр"}, ${v.random} санамсаргүй ${v.seq ? "алхам" : "шалгалт"} тохирлоо`
      : `Бүх ${v.rows} ${v.seq ? "алхам" : "мөр"} тохирлоо`,
  "play.usingTransistors": "{n} транзистор ашиглав",
  "play.usingGates": "{cells} хаалга ашиглав, гүн нь {depth} хаалганы саатал",
  "play.nowInToolbox": "{name} одоо таны багажинд байна.",
  "play.failedRows": (v) =>
    `✗ ${v.rows} ${v.seq ? "алхмаас" : "мөрөөс"} ${v.failed} нь хараахан тохирохгүй байна.`,
  "play.failedRandom": (v) =>
    ` ${v.run} санамсаргүй ${v.seq ? "алхмаас" : "шалгалтаас"} ${v.failed} нь мөн бүтэлгүйтэв.`,
  "play.designErrors": "✗ Бүтээлд алдаа байна (доор үзнэ үү).",
  "play.hint": "Зөвлөмж: ",
  "play.inside": "Дотор нь: {path}",
  "play.upOne": "Нэг давхарга дээш",
  "play.close": "Хаах",
  "play.insideNote":
    "Таны {name} бүтээл {parent} дотор авч буй утгуудаараа ажиллаж байна. Энд зөвхөн харах боломжтой: өөрийн түвшний хуудсан дээр нь засна.",
  "play.editIt": "Засах: {name}",

  // ---- зотон ----
  "canvas.label": "Хэлхээний зотон",
  "canvas.wired": "Холболт: {list}. ",
  "canvas.notWired": "Холбогдоогүй. ",
  "canvas.partShort": ", богино холбоонд оролцож байна",
  "canvas.partKeys":
    "Сумтай товч зөөнө, Delete устгана, цэсний товч бусад үйлдлийг харуулна.",
  "canvas.split": "Салаалагч {w}",
  "canvas.join": "Нийлүүлэгч {w}",
  "canvas.shared": "{pin} (хуваалцсан)",
  "canvas.pinTitle": "{pin}{bits} = {value}. Өөр хөл рүү чирж холбоно.",
  "canvas.pinBits": " ({n} бит)",
  "canvas.input": "Оролт",
  "canvas.output": "Гаралт",
  "canvas.portLabelIn": (v) =>
    `Оролт ${v.name} = ${v.value}. ${v.wired}${v.bus ? "Enter утгыг нь засна; " : "Enter сэлгэнэ; "}сумтай товч зөөнө, цэсний товч бусад үйлдлийг харуулна.`,
  "canvas.portLabelOut":
    "Гаралт {name} = {value}. {wired}сумтай товч зөөнө, цэсний товч бусад үйлдлийг харуулна.",
  "canvas.outTitle": "Гаралт {name}: чирж зөөнө",
  "canvas.inTitleBus": "Оролт {name}: дарж тоо бичнэ, чирж зөөнө",
  "canvas.inTitle": "Оролт {name}: дарж 0 ба 1-ийн хооронд сэлгэнэ, чирж зөөнө",
  "model.sameEnd": "Утас хоёр өөр үзүүртэй байх ёстой.",
  "model.alreadyConnected": "Энэ хоёр аль хэдийн холбогдсон байна.",
  "canvas.pendingWire": "Одоо холбох хөл дээрээ дарна уу (Escape цуцална).",
  "state.on": "нээлттэй",
  "state.off": "хаалттай",
  "state.maybe": "тодорхойгүй",
  "endpoint.input": "оролт {name}",
  "endpoint.output": "гаралт {name}",

  // ---- баруун товшилтын цэс ----
  "menu.lookInside": "Дотор нь харах",
  "menu.options": "Тохиргоо…",
  "menu.connect": "Холбох…",
  "menu.disconnect": "Салгах…",
  "menu.duplicate": "Хувилах",
  "menu.delete": "Устгах",
  "menu.deleteWire": "Утсыг устгах",
  "menu.setValue": "Утга оноох…",
  "menu.flip": "0 ↔ 1 сэлгэх",
  "menu.reset": "Ирмэг рүү буцаах",
  "menu.canvas": "Зотон",
  "menu.addHere": "Энд нэмэх: {name}",
  "menu.undo": "Буцаах",
  "menu.redo": "Дахих",
  "menu.wire": "Утас",
  "menu.wireTitle": "Утас: {from} — {to}",
  "menu.input": "Оролт {name}",
  "menu.output": "Гаралт {name}",
  "menu.whichPin": "{id}-ийн аль хөлийг холбох вэ?",
  "menu.connectTo": "{from}-г юутай холбох вэ…",
  "menu.disconnectFrom": "Утас салгах: {name}",
  "menu.allWires": "Бүх утас",
  "menu.wireCount": "{n} утас",

  // ---- долгионы зураглал ----
  "wave.label":
    "{n} алхмын долгионы зураглал: {names}. Ижил утгууд хүснэгтэд бас бий.",
  "wave.replay": "{n}-р алхам хүртэл дахин явуулах",

  // ---- багажийн нэрс ----
  "tool.split": "Салаалагч",
  "tool.join": "Нийлүүлэгч",
  // ---- шалгагчийн мессеж ----
  "problem.component-mismatch":
    "Энэ бүтээл `{design}`-д зориулагдсан, гэтэл түвшин нь `{level}` байна",
  "problem.duplicate-part":
    "Хоёр эд анги ижил `{part}` нэртэй байна; нэр давтагдах ёсгүй",
  "problem.unknown-kind":
    "`{part}` эд ангийн төрөл `{kind}` гэж байна, ийм эд анги эсвэл бүрэлдэхүүн алга",
  "problem.primitive-not-allowed":
    "`{part}` эд анги нь дан `{kind}` байна, гэтэл энэ бол {layer}-р давхаргын түвшин. Транзистор ба тэжээлийн шугамыг зөвхөн 1-р давхаргад шууд ашиглана; 2-р давхаргаас эхлэн өөрийн бүтээсэн бүрэлдэхүүнүүдээр бүтээнэ",
  "problem.layer-violation":
    "`{part}` эд анги нь {kind_layer}-р давхаргын `{kind}` бүрэлдэхүүн, гэтэл энэ бол {layer}-р давхаргын түвшин. {layer}-р давхаргын бүрэлдэхүүн зөвхөн {layer}-р болон түүнээс доош давхаргын эд ангийг ашиглана",
  "problem.not-unlocked":
    "`{part}` эд анги нь таны хараахан нээгээгүй `{kind}` бүрэлдэхүүн: эхлээд `{kind}` түвшинг давна уу",
  "problem.self-reference":
    "`{part}` эд анги нь яг энэ бүрэлдэхүүн өөрөө байна; бүрэлдэхүүн өөрийгөө агуулж болохгүй",
  "problem.dependency-cycle":
    "Бүрэлдэхүүнүүд бие биеэсээ тойргоор хамаарч байна: {path}",
  "problem.unknown-port":
    "Нэг утас `{port}` руу явж байна, гэтэл энэ бүрэлдэхүүнд ийм оролт, гаралт алга (байгаа нь: {valid})",
  "problem.unknown-part":
    "Нэг утас `{part}` эд анги руу явж байна, гэтэл ийм эд анги алга",
  "problem.unknown-pin":
    "Нэг утас `{part}.{pin}` руу явж байна, гэтэл `{kind}` төрөлд `{pin}` хөл алга (байгаа нь: {valid})",
  "problem.output-unconnected": "`{port}` гаралт юутай ч холбогдоогүй байна",
  "problem.bad-part": "`{part}` эд анги: {reason}",
  "problem.width-mismatch":
    "Утасны хоёр үзүүрийн өргөн ялгаатай: {from} нь {from_width} бит, {to} нь {to_width} бит. Хоёр үзүүр ижил өргөнтэй байх ёстой",
  "problem.input-unused": "`{port}` оролт ашиглагдаагүй байна",
  "problem.pin-unconnected": "`{part}.{pin}` холбогдоогүй байна",
  "problem.inner-broken":
    "Энэ бүтээл доторх нэг бүрэлдэхүүн эвдэрсэн байна: {detail}",
  "problem.engine": "Загварчлах үед алдаа гарлаа: {detail}",
  "reason.widthOnlyWiring": "зөвхөн салаалагч ба нийлүүлэгч өргөнтэй байдаг",
  "reason.repeatOnlyComponents": "зөвхөн бүрэлдэхүүнийг давтаж болно",
  "reason.sharedNeedsRepeat":
    "хуваалцсан хөл зөвхөн давтсан бүрэлдэхүүнд утгатай",
  "reason.needsWidth": "салаалагч, нийлүүлэгчид өргөн заах хэрэгтэй",
  "reason.badWidth": "{n} өргөн зөвшөөрөгдөхгүй; 2-оос 64 хүртэл байна",
  "reason.badRepeat": "{n} удаа давтах боломжгүй; 1-ээс 64 хүртэл байна",
  "reason.tooWide": "давтахад хөл 64 битээс өргөн болж байна",
  "reason.wiringLayer2":
    "салаалагч ба нийлүүлэгч 2-р давхаргад олон битийн шугамтай хамт гарч ирнэ",
  "diag.row": "{n}-р мөр",
  "diag.step1": "1-р алхам",
  "diag.step2": "2-р алхам (1-р алхмын дараа)",
  "diag.stepN": "{n}-р алхам (1–{m}-р алхмын дараа)",
  "diag.randomTest": "Санамсаргүй {n}-р шалгалт",
  "diag.randomStep1": "Санамсаргүй 1-р алхам",
  "diag.randomStep2": "Санамсаргүй 2-р алхам (санамсаргүй 1-р алхмын дараа)",
  "diag.randomStepN":
    "Санамсаргүй {n}-р алхам (санамсаргүй 1–{m}-р алхмын дараа)",
  "diag.wrong":
    "{label}: {inputs} → {port}={expected} байх ёстой, гэтэл {port}={actual} гарлаа.",
  "diag.floating":
    "{label}: {inputs} → {port}={expected} байх ёстой, гэтэл {actual} гарлаа: `{port}` гаралт хөвөгч байна, түүнийг юу ч жолоодохгүй байна.",
  "diag.unknown":
    "{label}: {inputs} → {port}={expected} байх ёстой, гэтэл {actual} гарлаа: `{port}` гаралтын утгыг тодорхойлох боломжгүй. Холбогдоогүй оролт эсвэл гогцоо байгаа эсэхийг шалгаарай.",
  "diag.short":
    "{label}: {inputs} → богино холбоо: VDD ба GND холбогдсон байна. {port}={expected} байх ёстой, гэтэл X гарлаа.",
  ...demosMn,
};
