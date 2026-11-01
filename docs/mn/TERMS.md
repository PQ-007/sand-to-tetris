# Mongolian terminology

**Rule:** use a Mongolian word only when it is already in use. A term with no
established Mongolian word stays in English, in Latin letters (latch,
flip-flop, carry, bus, gate, source, drain, …). Don't coin a new word for it.
Loan words that Mongolian already uses (транзистор, процессор, регистр, реле,
конденсатор, интеграл схем) stay in Cyrillic. Part names (NOT, NAND, MUX,
RAM8, …), pin names and code are always in Latin letters.

The same goes for interface jargon: Workbench, Toolbox, Canvas, Simulator,
Export / Import, Tech tree, Shortcuts, Tick, side quest, Waveform, Splitter /
Joiner stay in English (not "ажлын ширээ", "багаж", "зотон", "загварчлагч").
Everyday words stay Mongolian: түвшин, давхарга, хөл, эд анги, утас,
шалгах, буцаах, ахиц, томруулах.

Suffixes on English words follow the pronunciation, after a hyphen: latch-ийн,
latch-д, flip-flop-ын, carry-г, bus-ыг, gate-ийн, source-оос, drain-тэй.

The glossary (`docs/mn/glossary.yaml`) is the source of truth; this table is
for review. If a term changes, change it everywhere: the glossary, the
chapters in `docs/mn/chapters/`, `hdl/levels/mn.yaml`, `web/src/i18n/mn.ts`
and `web/src/i18n/demos.mn.ts`.

## All glossary terms

| English | Mongolian site |
|---|---|
| Computer | Компьютер |
| Input | Оролт |
| Output | Гаралт |
| Memory | Санах ой |
| Processor | Процессор |
| Program | Програм |
| Algorithm | Алгоритм |
| General-purpose | Ерөнхий зориулалттай |
| Stored-program computer | Програмаа санах ойдоо хадгалдаг компьютер |
| Punched card | Punched card |
| Logarithm | Логарифм |
| Slide rule | Slide rule |
| Analog | Аналог |
| Digital | Цифрлэг |
| Bit | Бит |
| Binary | Хоёртын тоолол |
| Boolean algebra | Булийн алгебр |
| Logic gate | Логик хаалга |
| Turing machine | Тьюрингийн машин |
| Switch | Унтраалга |
| Relay | Реле |
| Vacuum tube | Вакуум чийдэн |
| Transistor | Транзистор |
| Semiconductor | Хагас дамжуулагч |
| Germanium | Германи |
| Silicon | Цахиур |
| Silicon dioxide | Цахиурын давхар исэл |
| Band gap | Хориотой бүс |
| Leakage current | Алдагдлын гүйдэл |
| Integrated circuit | Интеграл схем |
| Microprocessor | Микропроцессор |
| Moore's law | Мурын хууль |
| Wafer | Wafer |
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
| Depletion region | Depletion region |
| Diode | Диод |
| Forward bias | Forward bias |
| Reverse bias | Reverse bias |
| MOSFET | MOSFET |
| Gate (of a transistor) | Gate (транзисторын) |
| Source and drain | Source ба drain |
| Channel | Суваг |
| Threshold voltage | Босго хүчдэл |
| NMOS | NMOS |
| PMOS | PMOS |
| CMOS | CMOS |
| Voltage | Хүчдэл |
| Current | Гүйдэл |
| Noise | Шуугиан |
| Logic level | Логик түвшин |
| Noise margin | Noise margin |
| Transfer curve | Transfer curve |
| Series and parallel | Цуваа ба зэрэгцээ |
| Truth table | Үнэний хүснэгт |
| Pull-up network | Pull-up network |
| Pull-down network | Pull-down network |
| Floating | Floating |
| Short circuit | Богино холболт |
| Universal gate | Universal gate |
| Abstraction | Хийсвэрлэл |
| Gate delay | Хаалганы саатал |
| Multiplexer (MUX) | Multiplexer (MUX) |
| Demultiplexer (DMUX) | Demultiplexer (DMUX) |
| Bus | Bus |
| Splitter and joiner | Splitter ба joiner |
| Half adder | Хагас нэмэгч |
| Full adder | Бүтэн нэмэгч |
| Carry | Carry |
| Ripple-carry adder | Ripple-carry adder |
| Two's complement | Two's complement |
| Fast model | Хурдан загвар |
| ALU (arithmetic logic unit) | ALU (arithmetic logic unit) |
| Flags | Flags |
| Sequential circuit | Sequential circuit |
| Feedback | Эргэх холбоо |
| Latch | Latch |
| Flip-flop | Flip-flop |
| Clock | Clock |
| Clock edge | Clock edge |
| Setup time | Setup time |
| Register | Регистр |
| Address | Хаяг |
| RAM | Шууд хандалтат санах ой (RAM) |
| Program counter | Програмын тоолуур |
| Waveform | Waveform |
| Magnetic-core memory | Соронзон цагирагт санах ой |
| SRAM | SRAM |
| DRAM | DRAM |
| Capacitor | Конденсатор |
| Instruction | Заавар |
| Instruction set (ISA) | Instruction set (ISA) |
| Machine code | Машины код |
| Assembly language | Ассемблер хэл |
| Fetch–decode–execute cycle | Fetch–decode–execute cycle |
| Control unit | Control unit |
| Datapath | Datapath |
| Register file | Register file |
| Barrel shifter | Barrel shifter |
| Subroutine | Дэд програм |
| Link register | Link register |
| Harvard architecture | Harvard architecture |
| RISC | RISC |
| Memory-mapped I/O | Memory-mapped I/O |
