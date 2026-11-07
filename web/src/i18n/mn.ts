// Монгол хэлний интерфейсийн бичвэр. Түлхүүр бүр en.ts-тэй ижил байх
// ёстой (төрөл шалгагч үүнийг баталгаажуулна). Нэр томьёо: боломжтой бол
// монгол үг (docs/mn/TERMS.md).
import { demosMn } from "./demos.mn";
import { toolsMn } from "./tools.mn";
import type { en, Message } from "./en";

export const mn: Record<keyof typeof en, Message> = {
  // ---- сайт ----
  "site.name": "Sand to Tetris",
  "site.skip": "Агуулга руу шилжих",
  "nav.label": "Сайт",
  "nav.learn": "Суралцах",
  "nav.build": "Бүтээх",
  "nav.glossary": "Нэр томьёо",
  "nav.programs": "Програмууд",
  "nav.language": "Хэл",
  "theme.toDark": "Харанхуй загвар",
  "theme.toLight": "Гэгээлэг загвар",
  "hud.levels": "Level",
  "hud.levelsLabel":
    "Давсан level: {total}-аас {passed}. Level-үүдийн хуудсыг нээх.",
  "core.loading": "Simulator-ыг ачаалж байна…",
  "core.ok": "Simulator {version}",
  "core.okTitle": "Simulator-ын цөм {version} ачаалагдлаа",
  "core.failed": "Simulator-ын цөмийг ачаалж чадсангүй: {error}",
  "page.error": "Энэ хуудсыг ачаалахад алдаа гарлаа",
  "page.loading": "Ачаалж байна…",
  "title.glossary": "Нэр томьёо",
  "title.programs": "Програмууд",
  "programs.lead":
    "Таны бүтээсэн компьютерт зориулж бичсэн тоглоом, програмууд: тоглож, уншиж, өөрчлөхөд.",
  "programs.intro":
    "Bitfall нь бидний хамтдаа зохиосон C Shard хэлээр, таны OS дээр бичигдсэн. Бусад нь хүмүүсийн өдөр бүр ашигладаг C хэлээр бичигдэж, шууд ассемблер руу хөрвүүлэгддэг: энэ машины хийж чадах хамгийн их зүйл. Бүгд Машин хуудсан дээр ажиллах бөгөөд эх кодыг нь өөрчлөх эрх таных.",
  "programs.play": "Машин дээр тоглох",
  "programs.try": "Машин дээр турших",
  "programs.listLabel": "Програмууд",
  "programs.lang.c": "C",
  "programs.lang.shard": "C Shard",
  "title.levels": "Level-үүд",
  "title.level": "Level",
  "title.notFound": "Олдсонгүй",

  // ---- хичээлийн бүтэц ----
  "outline.0.title": "Элснээс унтраалга хүртэл",
  "outline.0.summary":
    "Компьютер гэж юу вэ, хүмүүс электроникаас өмнө хэрхэн тооцоолж байсан, цахиур хэрхэн транзистор болдог.",
  "outline.1.title": "Транзистороос логик gate хүртэл",
  "outline.1.summary":
    "NMOS, PMOS транзисторуудыг холбож NOT, NAND, NOR gate бүтээнэ.",
  "outline.2.title": "Хослолын логик",
  "outline.2.summary": "MUX, DMUX, нэмэгч ба 16 битийн ALU.",
  "outline.3.title": "Санах ой",
  "outline.3.summary": "Latch, flip-flop, регистр, RAM ба програмын тоолуур.",
  "outline.4.title": "CPU",
  "outline.4.summary":
    "Хамтдаа зохиох instruction set, datapath ба control unit.",
  "outline.5.title": "Ассемблер",
  "outline.5.summary":
    "Програмыг тооны оронд нэрээр бичиж, тэднийг хоёртын код болгодог програмыг бүтээнэ.",
  "outline.6.title": "Виртуал машин",
  "outline.6.summary":
    "Өөрийн stack machine ба түүнийг ассемблер болгодог translator.",
  "outline.7.title": "Хөрвүүлэгч",
  "outline.7.summary": "Хамтдаа зохиох C Shard хэл ба түүний хөрвүүлэгч.",
  "outline.8.title": "Үйлдлийн систем",
  "outline.8.summary":
    "C Shard-аар бичсэн дэлгэц, текст, гар, timer ба санамсаргүй тоо.",

  // ---- нүүр ----
  "home.eyebrow": "{n} бүлэгтэй хичээл",
  "home.title": "Элснээс Тетрис хүртэл",
  "home.tagline":
    "There is no magic, just abstraction layers built on top of one another.",
  "figure.hourglass":
    "Элсэн цагны шугаман зураг: дээд бөмбөлгийн элс хүзүүгээр урсаж, доод бөмбөлөгт ширхэгүүд блок болон тогтоно: шоонуудын мөрүүд, урсгалын доор унаж буй хэсэг. Курсор нэг мөрийг сонгож өргөнө; товч элсийг урсгаж дуусгаад, цагийг эргүүлнэ.",
  "figure.computer":
    "Угсарсан tower компьютерын шугаман зураг: дөрвөн хөлтэй, агааржуулалттай дээд талтай, эрэг шургаар бэхэлсэн шилэн хажуутай; цаана нь хөргөгчүүдтэй самбар, tower хөргөгчийн доорх CPU, дөрвөн RAM, хоёр сэнстэй видео карт, тэжээлийн блок ба хоёр дисктэй тор; урд талд асаах, reset товч ба USB. Курсор нэг хэсгийг сонгож гаргана; товч бүх угсралтыг задална.",
  "figure.patch":
    "Patch panel-ийн шугаман зураг: курсорын доорх кабель өргөгдөж, хөршүүд нь хазайна. Энд бүтээх нь wire холбох юм.",
  "figure.laptop":
    "Нимгэн зөөврийн компьютерын шугаман зураг: курсорын өндөр тагийг хэр их нээхийг тогтооно.",
  "figure.loupe":
    "Шугамтай цаасан дээрх томруулдаг шилний шугаман зураг: курсор түүнийг хөдөлгөж, шилний доорх мөрүүд томорч харагдана.",
  "figure.query":
    "Цул биет болгон бүтээсэн асуултын тэмдгийн шугаман зураг: дэгээ нь курсор руу эргэнэ.",
  "figure.wafer":
    "Die-уудад хуваасан цахиурын wafer-ийн шугаман зураг: курсорын доор die-ууд wafer-аасаа өргөгдөж, хамгийн ойрынх нь хамгийн өндөр.",
  "figure.transistor":
    "Зүсэж харуулсан транзисторын шугаман зураг: курсорыг gate руу ойртуулахад доор нь электрон хуримтлагдаж, эцэст нь суваг source-ыг drain-тэй холбоно.",
  "figure.carry":
    "Дараалсан найман нэг битийн нэмэгчийн шугаман зураг: нэг битийг заахад carry 0-р битээс түүн хүртэл нэмэгч нэмэгчээр дамжина.",
  "figure.cpu":
    "Die нь ил харагдах процессорын шугаман зураг: нэг блок (регистрүүд, ALU, shifter, control unit, програмын тоолуур) руу заахад тэр нь die-аас өргөгдөнө.",
  "figure.plug":
    "Ханын розетк ба шалан дээрх залгуурын шугаман зураг: курсор залгуурыг розетк руу татна. Тогтмол бол тэжээлд холбосон wire.",
  "figure.cabinet":
    "Арван хоёр хавтан бүхий тавиурын шугаман зураг: курсорын өндөр хамгийн ойрын хавтангуудыг гаргана, хаяг санах ойн нэг хэсгийг сонгодог шиг.",
  "figure.slow":
    "Хаалгаар нэг нэгээр нь өнгөрөх туузан дээрх хайрцгуудын шугаман зураг; курсор тавихад clock удааширна, гэхдээ зогсохгүй.",
  "figure.riffle":
    "Шошгон дээрээ дугаараа цоолсон найман карттай тавиурын шугаман зураг: курсорын доорх карт босно, програмаас уншсан зааврын үг шиг.",
  "figure.exploded":
    "Давхаргуудад нь задалсан програмын шугаман зураг, энэ хичээлийн давхаргууд шиг. Курсороо хөндлөн хөдөлгөвөл давхаргууд нээгдэнэ.",
  "figure.lockers":
    "Арван хоёр шүүгээний шугаман зураг: курсорын доорх нь нээгдэнэ, санах ойн нэг нүд хаягаараа дуудагдахад хариулдаг шиг.",
  "figure.terminal":
    "Терминалын цонхны шугаман зураг: курсор мөрүүдийг нь буцааж гүйлгэнэ, жагсаалт уншиж буй мэт.",
  "figure.stack":
    "Таван stack frame-тэй call stack-ийн шугаман зураг: курсорын доорх frame-ийг нээхэд дээрх frame-үүд өргөгдөнө.",
  "figure.settle":
    "Курсор ойртоход муруй хавтангууд мод болон цэгцрэх шугаман зураг, parser текстийг syntax tree болгодог шиг.",
  "figure.keyboard":
    "Гарын шугаман зураг: курсорын доорх товч доош орж, хөршүүд нь дагаж орно.",
  "figure.phosphor":
    "Долоо долоон цэгтэй дэлгэцийн шугаман зураг, давталт тоглуулна; курсор бүдгэрдэг мөр зурна.",
  "home.start": "Уншиж эхлэх",
  "home.runSand": "Элсийг урсгах",
  "home.turnOver": "Эргүүлэх",
  "home.workbench": "Workbench нээх",
  "home.programs": "Програмуудыг тоглох",
  "home.howItWorks": "Хэрхэн ажилладаг вэ",
  "home.read": "Унш",
  "home.readText":
    "Бүлэг бүр нэг давхаргыг энгийн үгээр, оролцоот жишээтэйгээр тайлбарлана.",
  "home.build": "Бүтээ",
  "home.buildText":
    "Өмнө бүтээсэн part-уудаасаа бүрэлдэхүүнээ засварлагч дээр өөрөө холбож бүтээ.",
  "home.unlock": "Нээ",
  "home.unlockText":
    "Шалгалтыг давбал тэр нь дараагийн давхаргад ашиглах битүү блок болж toolbox-д чинь нэмэгдэнэ.",
  "home.chapters": "Бүлгүүд",
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

  // ---- level-ийн зураглал ----
  "levels.title": "Компьютерээ бүтээ",
  "levels.lead":
    "Level бүр нэг бүрэлдэхүүн. Давбал дараагийн level-үүдэд ашиглахаар toolbox-д чинь нэмэгдэнэ.",
  "levels.layer": "{n}-р давхарга: {name}",
  "status.passed": "✓ Давсан",
  "status.open": "Нээлттэй",
  "status.locked": "Хаалттай",
  "status.broken": "⚠ Эвдэрсэн",
  "levels.sideQuest": "side quest",
  "levels.opensAfter": "Дараахыг давсны дараа нээгдэнэ: {names}.",
  "levels.and": ", ",
  "levels.brokenText":
    "Ашигладаг зүйлсийн нэг нь өөрчлөгдөж, одоо шалгалтыг давахгүй байна. Нээж шалтгааныг нь үзээрэй.",
  "levels.viewLabel": "Харагдац",
  "levels.viewTree": "Tech tree",
  "levels.viewRoadmap": "Roadmap",
  "levels.roadmapLabel": "Хичээл алхам алхмаар",
  "levels.step": "Step {n}",
  "levels.builtFrom": "Ашиглах part",
  "levels.builtFromBase": "Транзистор, VDD ба GND",
  "levels.usedIn": "Ашиглагдах",
  "levels.usedInMore": "ба өөр {n}",
  "levels.usedInTop":
    "Юунд ч биш: энэ бол бэлэн компьютер. Bitfall үүн дээр ажиллана.",
  "levels.usedInNone": "Дараа нь юу ч үүнийг ашиглахгүй: заавал биш дасгал.",
  "levels.justBuilt": "өмнөх step-ээс",
  "levels.nextUp": "Дараагийнх",
  "levels.continue": "Үргэлжлүүлэх: step {n}, {name} →",
  "levels.stageDone": "Дууссан: {done}/{n}",
  "stage.gates": "Унтраалгаас gate",
  "stage.gates.intro":
    "Нэг нь дээш, нөгөө нь доош татдаг хоёр транзистор NOT болно. Хосуудыг өөрөөр холбоход тэр л санаагаар NAND, NOR гарна.",
  "stage.const": "Тогтмол дохио",
  "stage.const.intro":
    "VDD эсвэл GND-д холбосон wire тогтмол 1 эсвэл 0 болно. Дараагийн part-ууд үүнийг хэзээ ч өөрчлөгддөггүй оролтод ашиглана.",
  "stage.logic": "NAND-аас логик",
  "stage.logic.intro":
    "Эндээс эхлэн транзистор биш, gate-ээр бүтээнэ. AND, OR хийхэд NAND, NOT хангалттай, тэр хоёроос XOR гарна.",
  "stage.wide": "Нэг дор 16 бит",
  "stage.wide.intro":
    "Компьютер 16 битийн үгээр ажиллана. Давтах ×16 саяхан бүтээсэн gate-ийг чинь бит бүрт нэг хувь болгон давтана.",
  "stage.choose": "Дохио сонгох",
  "stage.choose.intro":
    "MUX нь хоёр дохионы алийг нь нэвтрүүлэхийг нэг wire-аар шийдүүлнэ. Энэ үеийн MUX бүр өмнөх MUX-аас бүтнэ.",
  "stage.route": "Дохио илгээх",
  "stage.route.intro":
    "DMUX бол эсрэгээр эргүүлсэн MUX: нэг оролтыг sel сонгосон гаралт руу илгээнэ. RAM аль үгийг бичихээ үүгээр сонгоно.",
  "stage.add": "Нэмэх",
  "stage.add.intro":
    "Хоёр бит, дараа нь гурван бит нэм, тэгээд 16 нэмэгчийг гинжлээд үг нэмэгч болго. Нэмэгч бүр саяхан бүтээснээсээ бүтнэ.",
  "stage.alu": "ALU",
  "stage.alu.intro":
    "Бүгдийг нийлүүл: OR8WAY тэгийг илрүүлнэ, shifter битүүдийг шилжүүлнэ, ALU процессорын бүх тооцоог хийнэ.",
  "stage.bit": "Нэг битийг санах",
  "stage.bit.intro":
    "Gate-ийн гаралтыг оролт руу нь эргүүлж өгвөл санадаг болно. Step бүр өмнөхийнхөө сул талыг засаж, эцэст нь зөвхөн clock edge дээр өөрчлөгддөг болно.",
  "stage.registers": "Регистрүүд",
  "stage.registers.intro":
    "16 Bit зэрэгцээд регистр болно. Найман регистр процессорын register file болно, тоолдог регистр бол програмын тоолуур.",
  "stage.ram": "RAM",
  "stage.ram.intro":
    "Хаягтай регистрүүд RAM8 болно. Илүү том RAM бүр өмнөх RAM-ынхаа хувиудаас бүтнэ.",
  "stage.control": "Удирдлага",
  "stage.control.intro":
    "Control unit заавар уншиж, процессорыг удирддаг бүх дохиог тохируулна.",
  "stage.cpu": "Процессор",
  "stage.cpu.intro":
    "Control unit, register file, ALU, shifter, програмын тоолуурыг холбож, clock бүрт нэг заавар гүйцэтгэдэг процессор бүтээ.",
  "stage.machine": "Компьютер",
  "stage.machine.intro":
    "RAM, дэлгэц, гарт хаяг өгөөд, тэр санах ойг процессортой холбо.",
  "levels.treeLabel":
    "Level-үүд tech tree хэлбэрээр: level бүр өөрт хэрэгтэй level-үүдийн доор байрлана",
  "levels.treeHelp":
    "Level бүр өөрт хэрэгтэй хэсгүүдийн доор байрлана. Аль нэгийг сонгож юу хэрэгтэй, юуг нээдгийг хар; сумтай товчоор level-үүдийн хооронд шилжинэ.",
  "levels.needs": "Хэрэгтэй",
  "levels.unlocks": "Нээдэг",
  "levels.needsNothing": "Юу ч хэрэггүй: эндээс эхэл.",
  "levels.unlocksNothing": "Одоохондоо юу ч биш: энэ бол модны оройн хэсэг.",
  "levels.play": "Level-ийг нээх →",
  "levels.fastBadge": "⚡ хурдан",
  "levels.progress": "Таны ахиц",
  "levels.saved": "Энэ хөтөчид автоматаар хадгалагдана.",
  "levels.notSaved":
    "Энэ хөтөч сайтад өгөгдөл хадгалахыг зөвшөөрөхгүй байна. Цонхоо хаахаас өмнө ахицаа файл болгон export хийгээрэй.",
  "levels.exportHint":
    "Нөөцлөх эсвэл өөр хөтөч рүү шилжүүлэхийн тулд файл болгон export хийгээрэй.",
  "levels.export": "Export",
  "levels.import": "Import",
  "levels.imported": "Import хийлээ.",
  "levels.confirmImport": "Одоогийн ахицаа import хийж буй файлаар солих уу?",
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
  "progress.damaged": "Гэмтсэн бичлэг: «{id}».",

  // ---- level-ийн хуудас ----
  "play.loading": "Simulator-ыг ачаалж байна…",
  "play.noLevel": "Ийм level алга",
  "play.backToMap": "Level-үүд рүү буцах",
  "play.locked": "Хаалттай level: {name}",
  "play.passFirst": "Эхлээд дараахыг давна уу: {names}.",
  "play.crumbs": "Байршил",
  "play.layerN": "{n}-р давхарга",
  "play.nextLevel": "Дараагийн level →",
  "play.levelMap": "Level-үүд",
  "play.toolbox": "Toolbox",
  "play.parts": "Parts",
  "play.cantRun": "Одоохондоо ажиллахгүй:",
  "play.clear": "Цэвэрлэх",
  "play.clearTitle": "Бүх part, wire-ыг устгах (Буцаах товч сэргээнэ)",
  "play.clearConfirm":
    "Бүх part ({parts}), wire-ыг ({wires}) устгах уу? Хуудаснаас гарах хүртэл Буцаах (Ctrl+Z) сэргээж чадна.",
  "play.cleared": "Canvas цэвэрлэгдлээ. Буцаах (Ctrl+Z) сэргээнэ.",
  "play.hintFirst": "Hint харах",
  "play.hintNext": "Дараагийн hint ({n}/{total})",
  "play.hintLabel": "Hint {n}:",
  "play.moreParts": "Бусад part ({n})",
  "play.fewerParts": "Цөөн part",
  "play.stepOf": "Step {n}/{total}",
  "play.addTool": "Нэмэх: {name} (эсвэл canvas дээр чирж оруулна)",
  "play.undo": "Буцаах",
  "play.redo": "Дахих",
  "play.undoTitle": "Буцаах (Ctrl+Z)",
  "play.redoTitle": "Дахих (Ctrl+Shift+Z)",
  "play.workbench": "Workbench",
  "play.narrow":
    "Засварлагч том дэлгэц дээр хамгийн тохиромжтой. Утсан дээр canvas-ыг чирж гүйлгэнэ; цэсний товч эсвэл баруун товшилт part бүрийн үйлдлүүдийг харуулна.",
  "play.sideLabel": "Зорилго, оролт ба шалгалт",
  "play.goal": "Зорилго",
  "play.notSaving":
    "Таны хөтөч энэ сайтад өгөгдөл хадгалахыг зөвшөөрөхгүй байгаа тул ахиц зөвхөн энэ цонхыг хаах хүртэл хадгалагдана. Үлдээхийн тулд level-үүдийн хуудсан дээрх «Export» товчийг ашиглаарай.",
  "play.inputs": "Оролтууд",
  "play.busHelp":
    "Олон битийн оролт бүрд тоо бичнэ: аравтын, 0x… арван зургаатын эсвэл 0b… хоёртын. Enter дарж хэрэглэнэ.",
  "play.busLabel": "{name} ({w} бит) ",
  "play.bitsOf": "Битүүд: {name}",
  "play.bitTitle": "{name}, {i}-р бит: {v}. Дарж сольно.",
  "play.bitsHelp":
    "Эсвэл битийг дарж сольж болно. Хамгийн их жинтэй бит зүүн талд, 0-р бит баруун талд.",
  "play.outputs": "Гаралтууд",
  "play.notANumber":
    "“{text}” нь 0-ээс {max} хүртэлх тоо биш байна. Аравтын, 0x… арван зургаатын эсвэл 0b… хоёртын тоо бичиж болно.",
  "play.step": "Step",
  "play.want": "{name} (хүлээгдэж буй)",
  "play.yours": "{name} (таных)",
  "play.result": "Үр дүн",
  "play.any": "дурын",
  "play.match": "✓ тохирсон",
  "play.differs": "✗ ялгаатай",
  "play.check": "Шалгах",
  "play.checking": "Шалгаж байна…",
  "play.testSteps": "Шалгалтын step-үүд",
  "play.truthTable": "Үнэний хүснэгт",
  "play.stepsHelp":
    "Step-үүд дээрээс доош дарааллаар явагдах бөгөөд хэлхээ step хооронд санаж үлдэнэ. «дурын» нь ямар ч утга болно гэсэн үг. Step дээр дарж шалгалтыг тэр хүртэл дахин явуулна.",
  "play.tableHelp":
    "Холбох тусам шууд шинэчлэгдэнэ. Мөр дээр дарж тэр оролтуудыг тохируулна.",
  "play.howPartsRun": "Part-ууд хэрхэн ажиллаж байна",
  "play.howPartsRunHelp":
    "Аль part хурдан загвараар ажиллахыг level-үүдийн хуудсан дээр сонгоно.",
  "play.runsTable":
    "үнэний хүснэгтээрээ (таны транзисторууд бүх мөрийг давсан)",
  "play.runsFast": "хурдан загвараар (таны бүтээлтэй тохирсон)",
  "play.runsYours": "таны бүтээлээр",
  "play.runsItem": "{name}: {how}",
  "play.noComponents": "Бүрэлдэхүүн хараахан алга.",
  "play.tick": "Tick ⎍",
  "play.tickTitle": "clk-ийг 1 болгоод буцааж 0 болгоно",
  "play.ticked":
    "Tick: clk 1 болж (flip-flop-ууд хадгалах агшин) буцаад 0 боллоо.",
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
  "play.shortcuts": "Shortcuts",
  "keys.add": "Part нэмэх",
  "keys.addHow": "Toolbox-оос чирэх, эсвэл дарах",
  "keys.wire": "Хоёр pin-ийг холбох",
  "keys.wireHow": "Нэг pin-ээс нөгөө рүү чирэх, эсвэл хоёуланг нь дарах",
  "keys.move": "Part, оролт, гаралтыг зөөх",
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
  "keys.panHow": "Хоосон canvas-ыг чирэх · гүйлгэх",
  "keys.zoom": "Томруулах",
  "keys.zoomHow": "Ctrl+гүйлгэх · + ба − · 0 буцаана",
  "keys.cancel": "Холболтыг цуцлах",
  "keys.cancelHow": "Escape",
  "play.changed":
    "Сүүлийн шалгалтаас хойш өөрчлөгдсөн. Дахин «Шалгах»-ыг дарна уу.",
  "play.emptyHint":
    "Toolbox-оос part энд чирж оруулах, эсвэл canvas дээр баруун товшиж нэмнэ. Дараа нь pin-ээс pin рүү чирж холбоно.",
  "play.added": "Нэмэгдлээ: {id}.",
  "play.addedFree":
    "Нэмэгдлээ: {id}. Canvas дээр Tab-аар сонгоод сумтай товчоор зөөж болно.",
  "play.duplicated": "Хуулбар нэмэгдлээ: {id} ({from}-ийн хуулбар).",
  "play.disconnectedAll": "Бүх wire-ыг салгалаа: {name}.",
  "play.disconnectedOne": "Нэг wire-ыг салгалаа: {name}.",
  "play.connected": "Холбогдлоо: {from} — {to}.",
  "play.deleted": "Устгалаа: {id}.",
  "play.deletedWire": "Утсыг устгалаа.",
  "play.movedBack": "Ирмэг рүү буцаалаа: {name}.",
  "play.settled": (v) =>
    `${v.depth} gate-ийн саатлын дараа тогтворжлоо${v.fast ? " (хурдан загвар бүрийг нэг алхмаар тооцдог тул жинхэнэ төхөөрөмж илүү удаан ажиллана)" : ""}.`,
  "play.oscillates":
    "Өөрчлөгдсөөр байна: энэ хэлхээ хэлбэлзэж, хэзээ ч тогтворждоггүй.",
  "play.slow": (v) =>
    `Энэ хэлхээ ${v.cells} gate загварчилж байгаа тул өөрчлөлт бүр хэсэг хугацаа авна. Дараахыг хурдан загвар руу шилжүүлэхэд шууд болно: ${v.names}. Үүнийг `,
  "play.slowLink": "level-үүдийн хуудсан",
  "play.slowEnd": " дээр хийнэ.",
  "play.optionsFor": "Тохиргоо: {id}",
  "play.busWidth": "Bus-ын өргөн ",
  "play.bits": "{n} бит",
  "play.repeat": "Давтах × ",
  "play.repeatHelp":
    "Хуулбар бүр олон битийн pin бүрийн өөрийн хэсгийг авна. Харин хуваалцсан оролтыг бүх хуулбар ижил уншина.",
  "play.share": " хуваалцах: {pin}",
  "play.fixTry": "Санал: ",
  "play.fixRepeat": "Давтах ×{n}: {part}",
  "play.fixRepeatWhy":
    " Bus {w} бит дамжуулна, харин part-ын нэг хуулбар {b} бит авна.",
  "play.fixShare": "Хуваалцах: {pin} ({part})",
  "play.fixShareWhy": " Бүх хуулбар ижил {b} битийн оролтыг уншина: `{pin}`.",
  "play.fixBits": "Дараагийн {n} битийг ижил аргаар холбох",
  "play.fixBitsWhy": " Дараагийнх: {first}{rest}.",
  "play.fixFill": "Сул {n} битэд холбох: {source} → {part}",
  "play.fixFillWhy":
    " Joiner дээрх ашиглаагүй битүүд ихэвчлэн тогтмол 0 авдаг.",
  "play.wiredMany": "{n} wire нэмэгдлээ.",
  "play.simError": "Загварчлалын алдаа: {error}",
  "play.showingStep1": "Step 1-ийг асаасан үеэс эхлэн харуулж байна.",
  "play.showingStep":
    "Step {n}-ийг харуулж байна (step 1–{m}-ийг дахин явуулсны дараа).",
  "play.showingRow":
    "{n}-р мөрийг харуулж байна. Тодруулсан part «!» тэмдэгтэй.",
  "play.waveform": "Waveform",
  "play.waveTest": "Шалгалтын step-үүд",
  "play.waveLive": "Шууд",
  "play.waveClear": "Арилгах",
  "play.waveLiveEmpty":
    "Оролтуудыг сэлгэх эсвэл Tick дарах: өөрчлөлт бүр энд гарна.",
  "play.waveEmpty": "Харуулах зүйл хараахан алга.",
  "play.error": "Алдаа: ",
  "play.note": "Тэмдэглэл: ",
  "play.shortNow":
    "Яг одоо богино холболт үүссэн: VDD ба GND дараахаар дамжин холбогдсон: {parts}.",
  "play.couldntCheck": "Шалгаж чадсангүй: {error}",
  "play.passed": "✓ Давлаа!",
  "play.passedRows": (v) =>
    v.random
      ? `Бүх ${v.rows} ${v.seq ? "step" : "мөр"}, ${v.random} санамсаргүй ${v.seq ? "step" : "шалгалт"} тохирлоо`
      : `Бүх ${v.rows} ${v.seq ? "step" : "мөр"} тохирлоо`,
  "play.usingTransistors": "{n} транзистор ашиглав",
  "play.usingGates": "{cells} gate ашиглав, гүн нь {depth} gate-ийн саатал",
  "play.nowInToolbox": "{name} одоо таны toolbox-д байна.",
  "play.failedRows": (v) =>
    `✗ ${v.rows} ${v.seq ? "step-ээс" : "мөрөөс"} ${v.failed} нь хараахан тохирохгүй байна.`,
  "play.failedRandom": (v) =>
    ` ${v.run} санамсаргүй ${v.seq ? "step-ээс" : "шалгалтаас"} ${v.failed} нь мөн бүтэлгүйтэв.`,
  "play.designErrors": "✗ Бүтээлд алдаа байна (доор үзнэ үү).",
  "play.hint": "Hint: ",
  "play.inside": "Дотор нь: {path}",
  "play.upOne": "Нэг давхарга дээш",
  "play.close": "Хаах",
  "play.insideNote":
    "Таны {name} бүтээл {parent} дотор авч буй утгуудаараа ажиллаж байна. Энд зөвхөн харах боломжтой: өөрийн level-ийн хуудсан дээр нь засна.",
  "play.editIt": "Засах: {name}",

  // ---- canvas ----
  "canvas.label": "Хэлхээний canvas",
  "canvas.wired": "Холболт: {list}. ",
  "canvas.notWired": "Холбогдоогүй. ",
  "canvas.partShort": ", богино холболтод оролцож байна",
  "canvas.partKeys":
    "Сумтай товч зөөнө, Delete устгана, цэсний товч бусад үйлдлийг харуулна.",
  "canvas.split": "Splitter {w}",
  "canvas.join": "Joiner {w}",
  "canvas.shared": "{pin} (хуваалцсан)",
  "canvas.pinTitle": "{pin}{bits} = {value}. Өөр pin рүү чирж холбоно.",
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
  "model.sameEnd": "Wire хоёр өөр үзүүртэй байх ёстой.",
  "model.alreadyConnected": "Энэ хоёр аль хэдийн холбогдсон байна.",
  "canvas.pendingWire": "Одоо холбох pin дээрээ дарна уу (Escape цуцална).",
  "state.on": "асаалттай",
  "state.off": "унтраалттай",
  "state.maybe": "тодорхойгүй",
  "endpoint.input": "оролт {name}",
  "endpoint.output": "гаралт {name}",
  "endpoint.bit": "бит {n}",

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
  "menu.canvas": "Canvas",
  "menu.addHere": "Энд нэмэх: {name}",
  "menu.undo": "Буцаах",
  "menu.redo": "Дахих",
  "menu.clear": "Canvas цэвэрлэх",
  "menu.wire": "Wire",
  "menu.wireTitle": "Wire: {from} — {to}",
  "menu.input": "Оролт {name}",
  "menu.output": "Гаралт {name}",
  "menu.whichPin": "{id}: аль pin-ийг холбох вэ?",
  "menu.connectTo": "{from}-г юутай холбох вэ…",
  "menu.disconnectFrom": "Wire салгах: {name}",
  "menu.allWires": "Бүх wire",
  "menu.wireCount": "{n} wire",

  // ---- waveform ----
  "wave.label":
    "{n} step-ийн waveform: {names}. Ижил утгууд хүснэгтэд бас бий.",
  "wave.replay": "Step {n} хүртэл дахин явуулах",

  // ---- toolbox-ын нэрс ----
  "tool.split": "Splitter",
  "tool.join": "Joiner",
  // ---- шалгагчийн мессеж ----
  "problem.component-mismatch":
    "Энэ бүтээл `{design}`-д зориулагдсан, гэтэл level нь `{level}` байна",
  "problem.duplicate-part":
    "Хоёр part ижил `{part}` нэртэй байна; нэр давтагдах ёсгүй",
  "problem.unknown-kind":
    "`{part}` part-ын төрөл `{kind}` гэж байна, ийм part эсвэл бүрэлдэхүүн алга",
  "problem.primitive-not-allowed":
    "`{part}` part нь дан `{kind}` байна, гэтэл энэ бол {layer}-р давхаргын level. Транзистор ба тэжээлийн шугамыг зөвхөн 1-р давхаргад шууд ашиглана; 2-р давхаргаас эхлэн өөрийн бүтээсэн бүрэлдэхүүнүүдээр бүтээнэ",
  "problem.layer-violation":
    "`{part}` part нь {kind_layer}-р давхаргын `{kind}` бүрэлдэхүүн, гэтэл энэ бол {layer}-р давхаргын level. {layer}-р давхаргын бүрэлдэхүүн зөвхөн {layer}-р болон түүнээс доош давхаргын part-ыг ашиглана",
  "problem.not-unlocked":
    "`{part}` part нь таны хараахан нээгээгүй `{kind}` бүрэлдэхүүн: эхлээд `{kind}` level-ийг давна уу",
  "problem.self-reference":
    "`{part}` part нь яг энэ бүрэлдэхүүн өөрөө байна; бүрэлдэхүүн өөрийгөө агуулж болохгүй",
  "problem.dependency-cycle":
    "Бүрэлдэхүүнүүд бие биеэсээ тойргоор хамаарч байна: {path}",
  "problem.unknown-port":
    "Нэг wire `{port}` руу явж байна, гэтэл энэ бүрэлдэхүүнд ийм оролт, гаралт алга (байгаа нь: {valid})",
  "problem.unknown-part":
    "Нэг wire `{part}` part руу явж байна, гэтэл ийм part алга",
  "problem.unknown-pin":
    "Нэг wire `{part}.{pin}` руу явж байна, гэтэл `{kind}` төрөлд `{pin}` pin алга (байгаа нь: {valid})",
  "problem.output-unconnected": "`{port}` гаралт юутай ч холбогдоогүй байна",
  "problem.bad-part": "`{part}` part: {reason}",
  "problem.width-mismatch":
    "Wire-ын хоёр үзүүрийн өргөн ялгаатай: {from} нь {from_width} бит, {to} нь {to_width} бит. Хоёр үзүүр ижил өргөнтэй байх ёстой",
  "problem.input-unused": "`{port}` оролт ашиглагдаагүй байна",
  "problem.pin-unconnected": "`{part}.{pin}` холбогдоогүй байна",
  "problem.inner-broken":
    "Энэ бүтээл доторх нэг бүрэлдэхүүн эвдэрсэн байна: {detail}",
  "problem.engine": "Загварчлах үед алдаа гарлаа: {detail}",
  "problem.two-drivers":
    "{listeners}: нэг дор хоёр дохио ирж байна ({drivers}). Хоёр гаралт нэг wire-ыг булаацалдаж байна; wire бүр яг нэг эх үүсвэртэй байх ёстой",
  "problem.too-big":
    "Бүх хэсгийг нь задлахад энэ хэлхээ {limit}-аас олон gate-тэй болох тул загварчлахад хэт том. Level-үүдийн хуудсан дээр том хэсгүүдийг (санах ой, CPU) хурдан загвар руу шилжүүл",
  "reason.widthOnlyWiring": "зөвхөн splitter ба joiner өргөнтэй байдаг",
  "reason.repeatOnlyComponents": "зөвхөн бүрэлдэхүүнийг давтаж болно",
  "reason.sharedNeedsRepeat":
    "хуваалцсан pin зөвхөн давтсан бүрэлдэхүүнд утгатай",
  "reason.needsWidth": "splitter, joiner-т өргөн заах хэрэгтэй",
  "reason.badWidth": "{n} өргөн зөвшөөрөгдөхгүй; 2-оос 64 хүртэл байна",
  "reason.badRepeat": "{n} удаа давтах боломжгүй; 1-ээс 64 хүртэл байна",
  "reason.tooWide": "давтахад pin 64 битээс өргөн болж байна",
  "reason.wiringLayer2":
    "splitter ба joiner 2-р давхаргад олон битийн bus-тай хамт гарч ирнэ",
  "diag.row": "{n}-р мөр",
  "diag.step1": "Step 1",
  "diag.step2": "Step 2 (step 1-ийн дараа)",
  "diag.stepN": "Step {n} (step 1–{m}-ийн дараа)",
  "diag.randomTest": "Санамсаргүй {n}-р шалгалт",
  "diag.randomStep1": "Санамсаргүй step 1",
  "diag.randomStep2": "Санамсаргүй step 2 (санамсаргүй step 1-ийн дараа)",
  "diag.randomStepN": "Санамсаргүй step {n} (санамсаргүй step 1–{m}-ийн дараа)",
  "diag.wrong":
    "{label}: {inputs} → {port}={expected} байх ёстой, гэтэл {port}={actual} гарлаа.",
  "diag.floating":
    "{label}: {inputs} → {port}={expected} байх ёстой, гэтэл {actual} гарлаа: `{port}` гаралт floating байна, түүнийг юу ч жолоодохгүй байна.",
  "diag.unknown":
    "{label}: {inputs} → {port}={expected} байх ёстой, гэтэл {actual} гарлаа: `{port}` гаралтын утгыг тодорхойлох боломжгүй. Холбогдоогүй оролт эсвэл гогцоо байгаа эсэхийг шалгаарай.",
  "diag.short":
    "{label}: {inputs} → богино холболт: VDD ба GND холбогдсон байна. {port}={expected} байх ёстой, гэтэл X гарлаа.",
  ...demosMn,
  ...toolsMn,
};
