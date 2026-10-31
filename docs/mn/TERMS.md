# Mongolian terminology

The Mongolian site uses native words where a clear one exists, and keeps the
international word in brackets the first time where learners will meet it in
other books (e.g. "Хадгалуур (регистр)"). Part names that appear in circuits
(NOT, NAND, MUX, RAM8, …), pin names and code stay in Latin letters.

The glossary (`docs/mn/glossary.yaml`) is the source of truth; this table is
for review. If a term changes, change it everywhere: the glossary, the four
chapters in `docs/mn/chapters/`, `hdl/levels/mn.yaml` and `web/src/i18n/mn.ts`.

## Choices that most need a native speaker's review

| English | Mongolian | Why / alternatives |
|---|---|---|
| Gate (of a transistor) | Хаалт | Kept apart from "логик хаалга" (logic gate); some textbooks use "хаалт" for both or "сэлгүүр" for the electrode. |
| Source and drain | Эх ба цутгал | Literal water metaphor, as in English; "исток / сток" (Russian loans) are also common. |
| Carry | Шилжүүлэг | Avoids "шилжилт", which is already the p-n junction. "Дамжуулалт" is another option. |
| Latch | Түгжээ | Literal; some texts use "триггер" for both latch and flip-flop. |
| Flip-flop | Сэлгүүр | Native coinage; "триггер" is the common loan word. |
| Register | Хадгалуур (регистр) | "Регистр" alone is the usual word in Mongolian CS teaching. |
| Bus | Шугам | "Шин" (from Russian) is also used. |
| Depletion region | Хоосорсон муж | Physics texts may say "хоосролын давхарга". |
| Hole | Нүх | Standard in Mongolian semiconductor physics ("нүхэн дамжуулал"). |
| Waveform | Долгионы зураглал | For the timing diagram view. |
| Splitter / joiner | Салаалагч / нийлүүлэгч | Editor tools; coined for this site. |

## All glossary terms

| English | Mongolian |
|---|---|
| Computer | Компьютер |
| Input | Оролт |
| Output | Гаралт |
| Memory | Санах ой |
| Processor | Боловсруулагч (процессор) |
| Program | Програм |
| Algorithm | Алгоритм |
| General-purpose | Ерөнхий зориулалттай |
| Stored-program computer | Програмаа санах ойдоо хадгалдаг компьютер |
| Punched card | Цоолбортой карт |
| Logarithm | Логарифм |
| Slide rule | Гулсдаг шугам |
| Analog | Аналог |
| Digital | Цифрлэг |
| Bit | Бит |
| Binary | Хоёртын тоолол |
| Boolean algebra | Булийн алгебр |
| Logic gate | Логик хаалга |
| Turing machine | Тьюрингийн машин |
| Switch | Унтраалга |
| Relay | Цахилгаан соронзон унтраалга (реле) |
| Vacuum tube | Вакуум чийдэн |
| Transistor | Транзистор |
| Semiconductor | Хагас дамжуулагч |
| Germanium | Германи |
| Silicon | Цахиур |
| Silicon dioxide | Цахиурын давхар исэл |
| Band gap | Хориотой бүс |
| Leakage current | Алдагдлын гүйдэл |
| Integrated circuit | Нэгдмэл хэлхээ (интеграл схем) |
| Microprocessor | Бичил процессор |
| Moore's law | Мурын хууль |
| Wafer | Ялтас |
| Polysilicon | Олон талст цахиур |
| Single crystal | Нэг талст |
| Czochralski process | Чохральскийн арга |
| Doping | Хольцлох |
| Dopant | Хольц |
| Electron | Электрон |
| Hole | Нүх |
| n-type | n-төрөл |
| p-type | p-төрөл |
| p-n junction | p-n шилжилт |
| Depletion region | Хоосорсон муж |
| Diode | Диод |
| Forward bias | Шууд хэвийлт |
| Reverse bias | Урвуу хэвийлт |
| MOSFET | MOSFET |
| Gate (of a transistor) | Хаалт (транзисторын) |
| Source and drain | Эх ба цутгал |
| Channel | Суваг |
| Threshold voltage | Босго хүчдэл |
| NMOS | NMOS |
| PMOS | PMOS |
| CMOS | CMOS |
| Voltage | Хүчдэл |
| Current | Гүйдэл |
| Noise | Шуугиан |
| Logic level | Логик түвшин |
| Noise margin | Шуугианы нөөц |
| Transfer curve | Дамжуулах муруй |
| Series and parallel | Цуваа ба зэрэгцээ |
| Truth table | Үнэний хүснэгт |
| Pull-up network | Дээш татах сүлжээ |
| Pull-down network | Доош татах сүлжээ |
| Floating | Хөвөгч |
| Short circuit | Богино холбоо |
| Universal gate | Бүх нийтийн хаалга |
| Abstraction | Хийсвэрлэл |
| Gate delay | Хаалганы саатал |
| Multiplexer (MUX) | Сонгогч (MUX) |
| Demultiplexer (DMUX) | Хуваарилагч (DMUX) |
| Bus | Шугам (олон битийн) |
| Splitter and joiner | Салаалагч ба нийлүүлэгч |
| Half adder | Хагас нэмэгч |
| Full adder | Бүтэн нэмэгч |
| Carry | Шилжүүлэг |
| Ripple-carry adder | Дамжих шилжүүлэгтэй нэмэгч |
| Two's complement | Хоёрын гүйцээлт |
| Fast model | Хурдан загвар |
| ALU (arithmetic logic unit) | Арифметик-логикийн нэгж (АЛН) |
| Flags | Төлөвийн туг |
| Sequential circuit | Дараалсан хэлхээ |
| Feedback | Эргэх холбоо |
| Latch | Түгжээ |
| Flip-flop | Сэлгүүр |
| Clock | Цагийн дохио |
| Clock edge | Цагийн дохионы ирмэг |
| Setup time | Бэлтгэх хугацаа |
| Register | Хадгалуур (регистр) |
| Address | Хаяг |
| RAM | Шууд хандалтат санах ой (RAM) |
| Program counter | Програмын тоолуур |
| Waveform | Долгионы зураглал |
| Magnetic-core memory | Соронзон цагирагт санах ой |
| SRAM | SRAM |
| DRAM | DRAM |
| Capacitor | Цэнэг хураагуур (конденсатор) |
