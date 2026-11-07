// ツールチェーンのページ(マシンと各ワークショップ)の日本語テキスト
// (ja.ts に統合される)。
import type { Message } from "./en";
import type { toolsEn } from "./tools.en";

export const toolsJa: Record<keyof typeof toolsEn, Message> = {
  "nav.machine": "マシン",
  "title.machine": "マシン",
  "title.assembler": "あなたのアセンブラ",
  "title.translator": "あなたの VM トランスレータ",
  "title.compiler": "あなたのコンパイラ",
  "title.os": "あなたの OS",

  // ---- マシンのページ ----
  "machine.title": "マシン",
  "machine.lead":
    "アセンブリ、VM コード、C Shard、C でプログラムを書き、ビルドして実行します: あなたが設計したコンピュータの画面、キーボード、レジスタ、RAM で。",
  "machine.example": "例",
  "machine.pick": "例を選ぶ…",
  "machine.ex.sum": "10 + 9 + … + 1 の合計",
  "machine.ex.pattern": "市松模様(.data を使う)",
  "machine.ex.dot": "矢印キーで点を動かす",
  "machine.ex.count": "ずっと数える",
  "machine.ex.vm-sum": "ループで 10 + 9 + … + 1 の合計",
  "machine.ex.vm-fact": "再帰で階乗",
  "machine.ex.vm-stripes": "画面に縞模様",
  "machine.ex.vm-dot": "矢印キーで点を動かす",
  "machine.ex.shard-sum": "for ループで合計",
  "machine.ex.shard-box": "画面に箱を描く",
  "machine.ex.shard-dot": "矢印キーで点を動かす",
  "machine.ex.shard-hello": "文字、キー、サイコロ(OS を使う)",
  "machine.ex.bitfall": "Bitfall: ゲーム",
  "machine.lang.shard": "C Shard",
  "machine.sourceShard": "C Shard のソース",
  "machine.compiler": "コンパイラ",
  "machine.os": "OS",
  "machine.os.builtin": "組み込み",
  "machine.os.yours": "あなたの",
  "machine.osError": "OS の {line} 行目: {message}",
  "machine.cm.builtin": "組み込み",
  "machine.cm.yours": "あなたの",
  "machine.compiling": "コンパイル中…",
  "machine.vmCode": "変換された VM コード({n} 行)",
  "machine.language": "言語",
  "machine.lang.asm": "アセンブリ",
  "machine.lang.vm": "VM",
  "machine.translator": "VM トランスレータ",
  "machine.tr.builtin": "組み込み",
  "machine.tr.yours": "あなたの",
  "machine.sourceVm": "VM のソース",
  "machine.translating": "変換中…",
  "machine.translation": "変換されたアセンブリ({n} 行)",
  "machine.stack": "スタック(上から)",
  "machine.stackEmpty": "空です。",
  "machine.assembler": "アセンブラ",
  "machine.asm.builtin": "組み込み",
  "machine.asm.yours": "あなたの",
  "machine.codeLabel": "プログラム",
  "machine.source": "アセンブリのソース",
  "machine.run": "ビルドして実行",
  "machine.pause": "一時停止",
  "machine.step": "ステップ",
  "machine.reset": "リセット",
  "machine.speed": "速度",
  "machine.speed.slow": "遅い(毎秒 60)",
  "machine.speed.medium": "中",
  "machine.speed.fast": "速い",
  "machine.screenLabel":
    "128 × 96 ピクセルの画面。フォーカスするとキー入力がプログラムに送られます。",
  "machine.keysHelp":
    "画面をクリックしてから文字を打つか矢印キーを使います。プログラムは 0x6000 でキーを読みます。",
  "machine.keyHeld": "押されているキー: {code}。",
  "machine.ramFrom": "RAM の開始アドレス",
  "machine.flags": "フラグ",
  "machine.ready": "準備完了。ビルドして実行を押してください。",
  "machine.assembling": "アセンブル中…",
  "machine.hasErrors":
    "エラーが {n} 個あります: 直してからもう一度試してください。",
  "machine.running": "実行中: これまでに {steps} 命令。",
  "machine.paused": "{steps} 命令の後で一時停止しました。",
  "machine.halted": "{steps} 命令の後で停止しました。",
  "machine.errorLine": "{line} 行目: {message}",

  // ---- アセンブラのワークショップ ----
  "workshop.title": "あなたのアセンブラ",
  "workshop.lead":
    "アセンブラを自分で TypeScript で書きます: 4 つの段階に、それぞれテストがあります。すべてのテストに合格すると、マシンのページでそれを使ってプログラムを実行できます。",
  "workshop.how":
    "書きながらテストを実行しましょう(全 {n} 個)。各段階は前の段階の正しい出力でテストされるので、順番に作ってください。Tab でインデント、Escape の後に Tab でエディタから出られます。言語の説明は",
  "workshop.chapter": "第 5 章にあります。",
  "workshop.codeLabel": "あなたのコード",
  "workshop.source": "あなたのアセンブラ(TypeScript)",
  "workshop.yourAsm": "あなたのコードが作ったアセンブリ",
  "workshop.run": "テストを実行",
  "workshop.starter": "最初からやり直す",
  "workshop.confirmStarter":
    "コードを最初のテンプレートに置き換えますか?今のコードは失われます。",
  "workshop.saved": "保存済み",
  "workshop.notRun":
    "テストを実行を押すと、あなたのアセンブラの状況が分かります。",
  "workshop.passedBefore":
    "このコードはすべてのテストに合格しました。マシンのページで使えます。",
  "workshop.running": "テストを実行中…",
  "workshop.stage.tokenize": "1 · 字句解析",
  "workshop.stage.parse": "2 · 構文解析",
  "workshop.stage.layout": "3 · 配置(パス 1)",
  "workshop.stage.encode": "4 · 符号化(パス 2)",
  "workshop.stage.program": "プログラム全体",
  "workshop.emptyLine": "(空行)",
  "workshop.input": "入力",
  "workshop.expected": "期待",
  "workshop.got": "あなた",
  "workshop.throws": "コード {code} のエラーを投げる",
  "workshop.threw": "{code} を投げました: {message}",
  "workshop.more": "…ほか {n} 個。",
  "workshop.allPassed":
    "✓ あなたのアセンブラは {n} 個のテストすべてに合格しました。マシンのページで選べるようになりました。",
  "workshop.toMachine": "マシンで試す →",
  "workshop.err.syntax": "あなたのコードはコンパイルできません",
  "workshop.err.timeout":
    "あなたのコードは 5 秒以上動いたので止められました(無限ループ?)",
  "workshop.err.missing":
    "あなたのコードは、テストが呼ぶ関数をすべてエクスポートしていません(下を参照)",
  "workshop.err.crash": "あなたのコードがクラッシュしました",

  // ---- VM トランスレータのワークショップ ----
  "translator.title": "あなたの VM トランスレータ",
  "translator.lead":
    "VM トランスレータを自分で TypeScript で書きます: 1 行を読み、コマンドの種類ごとにアセンブリへ変換します。すべてのテストに合格すると、マシンのページでそれを使って VM プログラムを実行できます。",
  "translator.how":
    "書きながらテストを実行しましょう(全 {n} 個)。各段階のコマンドはあなたのコードで、残りは組み込みのトランスレータで変換して CPU で実行するので、段階はどの順番で作っても構いません。Tab でインデント、Escape の後に Tab でエディタから出られます。VM の説明は",
  "translator.chapter": "第 6 章にあります。",
  "translator.source": "あなたの VM トランスレータ(TypeScript)",
  "translator.notRun":
    "テストを実行を押すと、あなたのトランスレータの状況が分かります。",
  "translator.allPassed":
    "✓ あなたのトランスレータは {n} 個のテストすべてに合格しました。マシンのページで選べるようになりました。",
  "translator.stage.parse": "1 · 構文解析",
  "translator.stage.stack": "2 · push、set とメモリ",
  "translator.stage.arith": "3 · 算術と比較",
  "translator.stage.jumps": "4 · ラベルとジャンプ",
  "translator.stage.functions": "5 · 関数",
  "translator.stage.muldiv": "6 · mul、div、mod",
  "translator.stage.program": "プログラム全体",

  // ---- コンパイラのワークショップ ----
  "compiler.title": "あなたのコンパイラ",
  "compiler.lead":
    "C Shard のコンパイラを自分で TypeScript で書きます: トークン、構文木、名前と型、そして VM コード。すべてのテストに合格すると、マシンのページでそれを使ってプログラムをコンパイルできます。",
  "compiler.how":
    "書きながらテストを実行しましょう(全 {n} 個)。各段階は前の段階の正しい出力でテストされるので、順番に作ってください。生成した VM コードは実行され、その動作で比べられます。Tab でインデント、Escape の後に Tab でエディタから出られます。言語の説明は",
  "compiler.chapter": "第 7 章にあります。",
  "compiler.source": "あなたのコンパイラ(TypeScript)",
  "compiler.notRun":
    "テストを実行を押すと、あなたのコンパイラの状況が分かります。",
  "compiler.allPassed":
    "✓ あなたのコンパイラは {n} 個のテストすべてに合格しました。マシンのページで選べるようになりました。",
  "compiler.stage.tokenize": "1 · 字句解析",
  "compiler.stage.parse": "2 · 構文解析",
  "compiler.stage.check": "3 · 名前と型の検査",
  "compiler.stage.generate": "4 · VM コードの生成",
  "compiler.stage.program": "プログラム全体",

  // ---- OS のワークショップ ----
  "osw.title": "あなたの OS",
  "osw.lead":
    "オペレーティングシステムを自分で C Shard で書きます: ピクセル、長方形、文字、キーボード、時間、乱数。すべてのテストに合格すると、マシンのページはすべての C Shard プログラムの前にあなたの OS を置きます。",
  "osw.how":
    "書きながらテストを実行しましょう(全 {n} 個)。各テストは小さなプログラムをあなたの OS と組み込みの OS で動かし、画面と結果を比べます。文字はあなたの plot と fill_rect を使うので、段階は順番に作ってください。OS の説明は",
  "osw.chapter": "第 8 章にあります。",
  "osw.source": "あなたの OS(C Shard)",
  "osw.notRun": "テストを実行を押すと、あなたの OS の状況が分かります。",
  "osw.allPassed":
    "✓ あなたの OS は {n} 個のテストすべてに合格しました。マシンのページで選べるようになりました。",
  "osw.stage.helpers": "1 · 補助関数",
  "osw.stage.screen": "2 · 画面",
  "osw.stage.text": "3 · 文字",
  "osw.stage.time": "4 · キーボードと時間",
  "osw.stage.random": "5 · 乱数",

  // ---- C Shard のエラー(コードは docs/LANGUAGE.md) ----
  "lang.what.name": "名前",
  "lang.what.type": "型(int、bool、[int; N] または [int])",
  "lang.what.expression": "値または式",
  "lang.what.declaration": "fn、var または const",
  "lang.what.statement": "文",
  "lang.bad-char": "`{char}` はここに書けません",
  "lang.bad-number": "`{text}` は 0 から 65535 までの数ではありません",
  "lang.bad-char-literal":
    "`{text}` は文字ではありません: 'A'、'\\''、'\\\\' または '\\n' と書いてください",
  "lang.bad-string":
    "文字列は、印字可能な文字で、その行のうちに終わらなければなりません",
  "lang.expected": "{what} が必要ですが、`{found}` があります",
  "lang.chained-comparison":
    "比較は連鎖できません: a < b and b < c と書いてください",
  "lang.unknown-name": "`{name}` は宣言されていません",
  "lang.duplicate-name": "`{name}` はすでに宣言されています",
  "lang.reserved-name": "`{name}`: _ で始まる名前はコンパイラのものです",
  "lang.type-mismatch": "{expected} が必要ですが、{found} があります",
  "lang.not-a-function": "`{name}` は関数ではありません",
  "lang.not-a-value":
    "これはここでは値ではありません: 配列の値はグローバルか定数のもので、関数には (...) が必要です",
  "lang.arg-count": "`{name}` の引数は {got} 個ではなく {expected} 個です",
  "lang.missing-type": "`{name}` には型か初期値が必要です",
  "lang.not-assignable":
    "代入できるのは、変数、変数の配列の要素、または mem[...] だけです",
  "lang.not-an-array": "`{name}` は配列ではありません",
  "lang.not-constant":
    "これは定数でなければなりません: 数、true/false、定数と、それらに対する演算子",
  "lang.bad-array-size":
    "配列の大きさは 1 から {max} までの定数でなければなりません",
  "lang.array-length":
    "値の要素は {found} 個ですが、型は {expected} 個だと言っています",
  "lang.break-outside-loop": "break と continue はループの中に書きます",
  "lang.missing-return":
    "`{name}` は(どの経路でも)return で終わらなければなりません",
  "lang.call-not-statement":
    "これは何もしません: 単独で文になれるのは呼び出しだけです",
  "lang.no-main": "プログラムには関数 main が必要です: fn main() { ... }",
  "lang.main-signature": "main は引数を取らず、int を返すか何も返しません",
  "lang.too-many-variables":
    "`{name}` の引数とローカル変数が多すぎます: 最大 {max} 個です",
  "lang.too-many-globals":
    "グローバル変数が {words} ワードを使っています。入るのは最大 {max} ワードです",

  // ---- VM のエラー(コードは docs/VM.md) ----
  "vm.bad-number":
    "`{text}` は数ではありません: 42、-5、0x2A または 0b101 と書いてください",
  "vm.out-of-range":
    "{value} は収まりません: {min}..{max} でなければなりません",
  "vm.bad-segment": "`{text}` は local、arg、global のどれでもありません",
  "vm.set-constant":
    "set には数ではなく変数(local、arg または global)が必要です",
  "vm.unknown-command": "`{text}` は VM のコマンドではありません",
  "vm.operand-count": "{command} のオペランドの数が違います",
  "vm.bad-name":
    "`{text}` は名前にできません: 英字、数字と _ で、数字で始まらず、__ を含まず、r0–r7 以外",
  "vm.too-many-variables":
    "関数の引数とローカル変数は合わせて最大 {max} 個です",
  "vm.outside-function":
    "コマンドは関数の中に書きます: func から始めてください",
  "vm.duplicate-function": "関数 `{name}` が 2 回定義されています",
  "vm.duplicate-label": "ラベル `{name}` が {func} の中で 2 回定義されています",
  "vm.unknown-function": "関数 `{name}` はありません",
  "vm.unknown-label": "{func} にラベル `{name}` はありません",
  "vm.no-variable":
    "{func} の {seg} 変数は {count} 個なので、{seg} {n} はありません",
  "vm.arg-count": "`{name}` の引数は {got} 個ではなく {expected} 個です",
  "vm.no-main": "プログラムには関数 main が必要です(func main 0 k)",
  "vm.main-args": "main は引数を取りません",
  "vm.no-return": "`{name}` は return か jump で終わらなければなりません",
  "vm.function-too-long":
    "このジャンプはラベルに届きません: 関数が長すぎます(分けてください)",
  "vm.asm": "アセンブラが変換結果を受け付けませんでした: {message}",

  // ---- アセンブラのエラー(コードは docs/ASSEMBLY.md) ----
  "asm.what.instruction": "命令またはディレクティブ",
  "asm.what.comma": "カンマ",
  "asm.what.end": "行の終わり",
  "asm.what.register": "レジスタ(r0–r7)",
  "asm.what.offset": "数または名前",
  "asm.what.rbracket": "`]`",
  "asm.what.operand": "オペランド",
  "asm.expect.number": "数",
  "asm.expect.memory": "[r1 + 2] のようなメモリ参照",
  "asm.bad-char": "`{char}` はここに書けません",
  "asm.bad-number":
    "`{text}` は数ではありません: 42、-5、0x2A、0b101 または 'A' と書いてください",
  "asm.bad-name":
    "`{found}` は名前ではありません: 名前は英字、数字と _ で、数字で始まりません",
  "asm.expected": "{what} が必要ですが、`{found}` があります",
  "asm.unknown-mnemonic": "`{mnemonic}` は命令ではありません",
  "asm.unknown-directive":
    "`.{name}` はディレクティブではありません: .equ、.code、.data、.word、.space を使ってください",
  "asm.operand-count":
    "{mnemonic} のオペランドは {found} 個ではなく {expected} 個です",
  "asm.not-a-register": "レジスタ(r0–r7)が必要ですが、{found} があります",
  "asm.bad-operand": "{expected} が必要ですが、{found} があります",
  "asm.out-of-range":
    "{what} = {value} は収まりません: {range} でなければなりません",
  "asm.unknown-symbol": "`{name}` は定義されていません",
  "asm.duplicate-symbol": "`{name}` はすでに {first} 行目で定義されています",
  "asm.data-in-code":
    "`.{name}` はプログラムにデータを置きます: .data の後に書いてください",
  "asm.code-in-data": "命令は .data ではなく .code に書きます",
  "asm.jump-to-data":
    "`{name}` はデータのアドレス(RAM)で、プログラムの中の場所ではありません",
  "asm.jump-too-far":
    "`{target}` は {distance} 命令離れています。{mnemonic} が届くのは {range} です",
  // C on the machine (docs/C.md): the Machine page and the compiler's errors.
  "machine.lang.c": "C",
  "machine.sourceC": "C のソース",
  "machine.ex.c-hello": "文字、キー、サイコロ",
  "machine.ex.c-bounce": "跳ねるボール(struct、バッファ)",
  "machine.ex.wyrm": "Wyrm: 伸びる虫を操る",
  "machine.ex.rally": "Rally: パドルの対戦",
  "machine.ex.shatter": "Shatter: 壁を崩す",
  "machine.ex.swarm": "Swarm: 編隊を食い止める",
  "machine.ex.debris": "Debris: 宇宙の岩",
  "machine.ex.prowl": "Prowl: 迷路の追いかけっこ",
  "machine.ex.corridors": "Corridors: 3D の迷路",
  "machine.screenArea": "画面と操作",
  "machine.registers": "レジスタ",
  "machine.hideCode": "コードを隠す",
  "machine.showCode": "コードを表示",
  "machine.fullscreen": "全画面",
  "c.bad-char": "{char} はここでは使えません",
  "c.bad-number": "{text} はマシンが扱える数(0〜65535)ではありません",
  "c.bad-string": "この文字列または文字の書き方が正しくありません",
  "c.unterminated-comment": "この /* コメントが閉じていません(*/ がありません)",
  "c.bad-directive": "#{what} の書き方が正しくありません",
  "c.bad-include": "include できるのは <machine.h> だけです({file} ではなく)",
  "c.unterminated-if": "この #if に #endif がありません",
  "c.macro-args": "マクロ {name} の引数が正しくありません",
  "c.expected": "ここには {what} が必要ですが、{found} があります",
  "c.unsupported": "{what}: このマシンの C にはありません",
  "c.u.variadic-macro": "... を使うマクロ",
  "c.u.paste": "マクロの ##",
  "c.u.stringize": "マクロの #",
  "c.u.long": "long(マシンは 16 ビット)",
  "c.u.float": "浮動小数点(固定小数点の int を使う)",
  "c.u.bit-fields": "ビットフィールド",
  "c.u.variadic": "... を使う関数",
  "c.u.struct-return": "struct を返すこと(ポインタを返す)",
  "c.u.struct-param": "struct を渡すこと(ポインタを渡す)",
  "c.u.struct-value": "この struct の値(変数から代入する)",
  "c.u.struct-member": "struct の値のメンバ(変数を使う)",
  "c.u.other": "これ",
  "c.what.name": "名前",
  "c.what.one-type": "型ひとつ",
  "c.what.type": "型",
  "c.what.struct-name": "struct の名前か `{`",
  "c.what.member": "メンバ名",
  "c.what.value": "値",
  "c.what.operator": "演算子",
  "c.unknown-name": "{name} は宣言されていません",
  "c.unknown-type":
    "この型にはここで大きさがありません(void、関数、またはまだ定義されていない struct)",
  "c.unknown-member": "メンバ {name} はありません",
  "c.duplicate": "{name} が二度宣言されています",
  "c.not-lvalue": "これには代入できません: 変数、要素、メンバではありません",
  "c.type-mismatch": "ここで型が合いません",
  "c.not-callable": "呼び出せるのは関数と関数ポインタだけです",
  "c.arg-count": "{name} の引数は {want} 個です({got} 個ではなく)",
  "c.not-constant": "これはコンパイル時にわかる定数でなければなりません",
  "c.bad-initializer": "この初期値は合いません",
  "c.void-value": "void には使える値がありません",
  "c.break-outside": "break はループか switch の中だけで使えます",
  "c.continue-outside": "continue はループの中だけで使えます",
  "c.case-outside": "{what} は switch の中だけで使えます",
  "c.duplicate-case": "case {value} が二度あります",
  "c.unknown-label": "この関数にラベル {name} はありません",
  "c.no-main": "プログラムには関数 main が必要です",
  "c.too-big": "プログラムがマシンのメモリに入りません",
  "c.internal":
    "コンパイラがアセンブルできないコードを作りました(コンパイラのバグ)",
};
