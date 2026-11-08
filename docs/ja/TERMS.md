# Japanese terminology

**Rule:** use the established Japanese technical term (as in Japanese
textbooks and JIS usage), in katakana or kanji as it is normally written. Part
names (NOT, NAND, MUX16, RAM8, …), pin names (a, sel, clk, …), mnemonics and
code always stay in Latin letters. Course names stay as they are: Sand to
Tetris, Bitfall, C Shard.

Japanese is being translated in stages: the interface, demos, tools, levels,
checker messages and the glossary (`docs/ja/glossary.yaml`) are done; sources
and chapters follow. Until a chapter exists in `docs/ja/`, the site shows the English
original with a note (the content build checks every Japanese file that does
exist as strictly as Mongolian).

Style: plain polite form (です・ます) in the interface and chapters; hints and
level goals may use the plain form (である・だ調, or the bare dictionary form
for instructions: 「作る」「つなぐ」). Full-width punctuation 、。「」(); a
half-width space between Japanese and Latin words or numbers (「NAND ゲート」,
「16 ビット」).

| English | Japanese |
|---|---|
| Computer | コンピュータ |
| Transistor | トランジスタ |
| Switch | スイッチ |
| Logic gate / gate | 論理ゲート / ゲート |
| Gate (of a transistor) | ゲート |
| Source, drain, channel | ソース、ドレイン、チャネル |
| Body (substrate) | 基板 |
| Oxide | 酸化膜 |
| Threshold | しきい値 |
| Wafer, die | ウエハ、ダイ |
| p-n junction, depletion region | pn 接合、空乏層 |
| Hole, electron | 正孔、電子 |
| Pull-up / pull-down network | プルアップ / プルダウンの回路網 |
| Series, parallel | 直列、並列 |
| Short circuit | ショート |
| Floating | フローティング |
| Truth table | 真理値表 |
| Wire, to wire | 配線、配線する |
| Pin, port | ピン、ポート |
| Input, output | 入力、出力 |
| Bus | バス |
| Splitter, joiner | スプリッタ、ジョイナ |
| Repeat (×16), shared | 繰り返し(×16)、共有 |
| Multiplexer, demultiplexer | マルチプレクサ、デマルチプレクサ |
| Half adder, full adder | 半加算器、全加算器 |
| Carry (in / out) | キャリー(桁上げ入力 / 桁上げ出力) |
| Ripple carry | リップルキャリー |
| ALU | ALU(算術論理演算装置) |
| Shifter, barrel shifter | シフタ、バレルシフタ |
| Flag | フラグ |
| Gate delay | ゲート遅延 |
| Latch, flip-flop | ラッチ、フリップフロップ |
| Clock, clock edge, rising edge | クロック、クロックエッジ、立ち上がりエッジ |
| Feedback | フィードバック |
| Register, register file | レジスタ、レジスタファイル |
| Word, address | ワード、アドレス |
| Memory, memory map | メモリ、メモリマップ |
| Program counter | プログラムカウンタ |
| Control unit | 制御ユニット |
| Datapath | データパス |
| Instruction, instruction set (ISA) | 命令、命令セット(ISA) |
| Assembly, assembler, disassembler | アセンブリ、アセンブラ、逆アセンブラ |
| Label, directive, operand | ラベル、ディレクティブ、オペランド |
| Virtual machine, stack, frame | 仮想マシン、スタック、フレーム |
| Translator | トランスレータ |
| Compiler, token, syntax tree | コンパイラ、トークン、構文木 |
| Tokenize, parse | 字句解析、構文解析 |
| Operating system | オペレーティングシステム(OS) |
| Fast model | 高速モデル |
| Level, layer, step, stage | レベル、レイヤー、ステップ、段階 |
| Toolbox, canvas, workbench | ツールボックス、キャンバス、作業台 |
| Side quest | サイドクエスト |
| Tech tree, roadmap | テックツリー、ロードマップ |

Glossary: definitions in the plain form (である調) or ending on a noun. A
term that starts with a kanji needs a `reading:` in hiragana (a test checks):
the glossary page sorts by it and files the term under its kana row (あ, か,
さ, …); katakana and Latin terms need none.
