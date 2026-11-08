// 日本語のインターフェース文。キーは en.ts と同じでなければならない
// (型チェッカーが保証する)。用語は docs/ja/TERMS.md を参照: 日本語で定着
// した技術用語(トランジスタ、論理ゲート、ラッチ、レジスタ…)を使い、部品名
// (NOT, NAND, MUX, RAM8…)、ピン名、コードはラテン文字のまま。
import { demosJa } from "./demos.ja";
import type { en, Message } from "./en";
import { toolsJa } from "./tools.ja";

export const ja: Record<keyof typeof en, Message> = {
  // ---- サイト ----
  "site.name": "Sand to Tetris",
  "site.skip": "本文へ移動",
  "nav.label": "サイト",
  "nav.learn": "学ぶ",
  "nav.build": "作る",
  "nav.glossary": "用語集",
  "nav.programs": "プログラム",
  "nav.language": "言語",
  "nav.menu": "メニュー",
  "theme.toDark": "ダークテーマ",
  "theme.toLight": "ライトテーマ",
  "hud.levels": "レベル",
  "hud.levelsLabel":
    "クリアしたレベル: {total} 個中 {passed} 個。レベルマップを開く。",
  "core.loading": "シミュレータを読み込み中…",
  "core.ok": "シミュレータ {version}",
  "core.okTitle": "シミュレータコア {version} を読み込みました",
  "core.failed": "シミュレータコアを読み込めませんでした: {error}",
  "page.error": "このページの読み込み中に問題が起きました",
  "page.loading": "読み込み中…",
  "title.glossary": "用語集",
  "title.programs": "プログラム",
  "programs.lead":
    "あなたが作ったコンピュータのために書かれたゲームとプログラム。遊んで、読んで、書き換えられます。",
  "programs.intro":
    "Bitfall は一緒に設計した言語 C Shard で、あなたの OS の上に書かれています。ほかは日々使われている言語 C で書かれ、アセンブリへ直接コンパイルされます: このマシンにできる最大限です。どれもマシンのページで動き、ソースは自由に書き換えられます。",
  "programs.play": "マシンで遊ぶ",
  "programs.try": "マシンで試す",
  "programs.listLabel": "プログラム",
  "programs.lang.c": "C",
  "programs.lang.shard": "C Shard",
  "title.levels": "レベル",
  "title.level": "レベル",
  "title.notFound": "見つかりません",

  // ---- コースの概要(章のタイトルと要約) ----
  "outline.0.title": "砂からスイッチへ",
  "outline.0.summary":
    "コンピュータとは何か、電子機器以前の人々はどう計算したか、そしてシリコンがどうトランジスタになるか。",
  "outline.1.title": "トランジスタからゲートへ",
  "outline.1.summary":
    "NMOS と PMOS トランジスタを配線して NOT, NAND, NOR ゲートを作る。",
  "outline.2.title": "組み合わせ回路",
  "outline.2.summary":
    "マルチプレクサ、デコーダ、加算器、そして 16 ビット ALU。",
  "outline.3.title": "メモリ",
  "outline.3.summary":
    "ラッチ、フリップフロップ、レジスタ、RAM、プログラムカウンタ。",
  "outline.4.title": "CPU",
  "outline.4.summary": "一緒に設計する命令セット、データパス、制御ユニット。",
  "outline.5.title": "アセンブラ",
  "outline.5.summary":
    "数字の代わりに名前でプログラムを書き、それを 2 進数に変えるプログラムを作る。",
  "outline.6.title": "仮想マシン",
  "outline.6.summary":
    "自分たちのスタックマシンと、それをアセンブリに変換するトランスレータ。",
  "outline.7.title": "コンパイラ",
  "outline.7.summary": "一緒に設計する言語 C Shard と、そのコンパイラ。",
  "outline.8.title": "オペレーティングシステム",
  "outline.8.summary": "画面、文字、キーボード、タイマー、乱数を C Shard で。",

  // ---- ホーム ----
  "home.eyebrow": "全 {n} 章のコース",
  "home.title": "砂から Tetris へ",
  "home.tagline":
    "魔法はありません。あるのは、積み重ねられた抽象化の層だけです。",
  "figure.hourglass":
    "砂時計の線画: 上の球の砂がくびれを通って落ち、下の球では粒がブロックとなって積もる。立方体の列と、流れの下を落ちてくるピース。ポインタで列を選ぶと持ち上がる。ボタンで砂を落とし切り、砂時計をひっくり返す。",
  "figure.computer":
    "組み立てたタワー型 PC の線画: 4 本の脚、通気口のある天板、ねじで留めたガラスの側面。その奥にヒートシンク付きのボード、タワークーラーの下の CPU、RAM 4 枚、ファン 2 基のグラフィックボード、電源、ドライブ 2 台のケージ。前面に電源とリセットのボタン、USB。ポインタで部品を選ぶと引き出され、ボタンで全体を分解できる。",
  "figure.patch":
    "パッチパネルの線画: ポインタの下のケーブルが持ち上がり、隣のケーブルが離れるように傾く。ここで作ることは配線すること。",
  "figure.laptop":
    "薄いノートパソコンの線画: ポインタの高さで蓋の開き具合が決まる。",
  "figure.loupe":
    "罫線の入った紙の上のスタンドルーペの線画: ポインタでルーペを動かすと、ガラスの下の罫線が拡大されて流れる。",
  "figure.query":
    "立体として作った疑問符の線画: 鉤の部分がポインタの方へ回る。",
  "figure.wafer":
    "ダイに区切られたシリコンウエハの線画: ポインタの下のダイがウエハから持ち上がり、近いものほど高くなる。",
  "figure.transistor":
    "断面を見せたトランジスタの線画: ポインタをゲートに近づけると、その下に電子が集まり、やがてチャネルがソースとドレインをつなぐ。",
  "figure.carry":
    "1 ビット加算器が 8 個並んだ線画: ビットを指すと、キャリーがビット 0 からそこまで加算器を一つずつ伝わっていく。",
  "figure.cpu":
    "ダイがむき出しのプロセッサの線画: ブロック(レジスタ、ALU、シフタ、制御ユニット、プログラムカウンタ)を指すと、ダイから持ち上がる。",
  "figure.plug":
    "壁のコンセントと床のプラグの線画: ポインタでプラグをコンセントへ引き寄せる。定数は電源につないだ配線です。",
  "figure.cabinet":
    "12 枚のブレードが入ったラックの線画: ポインタの高さで近いものがレールに沿って引き出される。アドレスがメモリの一つのバンクを選ぶように。",
  "figure.slow":
    "ベルトに乗った箱がゲートを一つずつ通る線画。ポインタを載せるとクロックが遅くなるが、止まりはしない。",
  "figure.riffle":
    "8 枚のカードが入ったトレイの線画。各カードのタブに番号が穴で開けられている: ポインタの下のカードが立ち上がる。プログラムから読み出された命令のワードのように。",
  "figure.exploded":
    "層に分解したアプリの線画。このコースの層のよう。ポインタを横に動かすと層が開く。",
  "figure.lockers":
    "12 個のロッカーの線画: ポインタの下のロッカーが開く。メモリの一つのセルがアドレスに応えるように。",
  "figure.terminal":
    "ターミナル画面の線画: ポインタで行をさかのぼってスクロールする。リストを読むように。",
  "figure.stack":
    "5 つのフレームからなるコールスタックの線画: ポインタの下のフレームを開くため、上のフレームが持ち上がる。",
  "figure.settle":
    "ポインタが近づくと、ばらばらのタイルが木の形に収まる線画。パーサがテキストを構文木に変えるように。",
  "figure.keyboard":
    "キーボードの線画: ポインタの下のキーが沈み、隣のキーもそれに続く。",
  "figure.phosphor":
    "7 × 7 のドット画面がループを再生している線画。ポインタでなぞると、消えていく跡が残る。",
  "home.start": "読み始める",
  "home.runSand": "砂を落とす",
  "home.turnOver": "ひっくり返す",
  "home.workbench": "作業台を開く",
  "home.programs": "プログラムで遊ぶ",
  "home.howItWorks": "進め方",
  "home.read": "読む",
  "home.readText":
    "各章は一つの層をやさしい言葉で、動かせるデモとともに説明します。",
  "home.build": "作る",
  "home.buildText":
    "エディタで部品を自分で配線します。使うのは、もう作った部品だけ。",
  "home.unlock": "解放する",
  "home.unlockText":
    "テストに合格すると、次の層で使える封をしたブロックとしてツールボックスに加わります。",
  "home.chapters": "章",
  "home.chapterN": "第 {n} 章",

  // ---- 章のページ ----
  "chapter.n": "第 {n} 章",
  "chapter.course": "コース",
  "chapter.chaptersLabel": "章",
  "chapter.soonSr": "(準備中)",
  "chapter.onThisPage": "このページの内容",
  "chapter.inThisChapter": "この章の内容",
  "chapter.backToTop": "↑ ページの先頭へ",
  "chapter.sources": "出典",
  "chapter.pagerLabel": "前の章と次の章",
  "chapter.previous": "← 前へ",
  "chapter.next": "次へ →",
  "chapter.notWritten": "第 {n} 章はまだ書かれていません。",
  "chapter.notTranslated":
    "この章はまだ日本語に翻訳されていません。英語の原文を表示しています。",

  // ---- 用語集 ----
  "glossary.lead":
    "コースに出てくる技術用語を、やさしい言葉で。章ごとに、出てくる順に並べ、ほかの言語での呼び名も添えています。",
  "glossary.filterLabel": "用語を絞り込む",
  "glossary.filter": "{n} 個の用語を絞り込む(どの言語でも)…",
  "glossary.matches": "{total} 個中 {shown} 個の用語が「{q}」に一致します。",
  "glossary.seeAlso": "関連項目:",
  "glossary.clear": "絞り込みを解除",
  "glossary.other": "その他の用語",
  "pic.on": "オン",
  "pic.off": "オフ",
  "pic.program": "プログラム",
  "pic.data": "データ",
  "pic.back": "裏",
  "pic.front": "表",
  "pic.fetch": "フェッチ",
  "pic.decode": "デコード",
  "pic.execute": "実行",
  "pic.input": "入力",
  "pic.update": "更新",
  "pic.draw": "描画",
  "pic.logic": "論理",
  "pic.memory": "メモリ",
  "glossary.none": "「{q}」に一致する用語はありません。",
  "notFound.text": "このアドレスにはページがありません。",
  "notFound.back": "章の一覧へ戻る",

  // ---- レベルマップ ----
  "levels.title": "コンピュータを作ろう",
  "levels.lead":
    "各レベルが一つの部品です。クリアすると、その後のレベルで使えるようツールボックスに加わります。",
  "levels.layer": "レイヤー {n}: {name}",
  "status.passed": "✓ クリア",
  "status.open": "挑戦可能",
  "status.locked": "ロック中",
  "status.broken": "⚠ 壊れている",
  "levels.sideQuest": "サイドクエスト",
  "levels.opensAfter": "{names} の後に開きます。",
  "levels.and": "、",
  "levels.brokenText":
    "使っている部品が変わったため、もう合格しません。開いて理由を確かめましょう。",
  "levels.viewLabel": "表示",
  "levels.viewTree": "テックツリー",
  "levels.viewRoadmap": "ロードマップ",
  "levels.roadmapLabel": "コースを一歩ずつ",
  "levels.step": "ステップ {n}",
  "levels.builtFrom": "材料",
  "levels.builtFromBase": "トランジスタ、VDD と GND",
  "levels.usedIn": "使われる場所",
  "levels.usedInMore": "ほか {n} 個",
  "levels.usedInTop":
    "なし: これが完成したコンピュータです。Bitfall はこの上で動きます。",
  "levels.usedInNone": "後のどの部品にも使われません: 任意の準備運動です。",
  "levels.justBuilt": "一つ前のステップから",
  "levels.nextUp": "次はこれ",
  "levels.continue": "続ける: ステップ {n}、{name} →",
  "levels.stageDone": "{done}/{n} 完了",
  "stage.gates": "スイッチからゲートへ",
  "stage.gates.intro":
    "引き上げる側と引き下げる側の 2 つのトランジスタで NOT ができます。組を別の形で配線すれば、同じ考えで NAND と NOR ができます。",
  "stage.const": "固定の信号",
  "stage.const.intro":
    "VDD か GND につないだ配線は、定数 1 か 0 になります。後の部品は、変わらない入力にこれを使います。",
  "stage.logic": "NAND から論理を",
  "stage.logic.intro":
    "ここからはトランジスタではなくゲートで作ります。AND と OR には NAND と NOT で十分で、その 2 つから XOR ができます。",
  "stage.wide": "16 ビットを一度に",
  "stage.wide.intro":
    "コンピュータは 16 ビットのワードで動きます。繰り返し ×16 で、作ったばかりのゲートをビットごとに一つずつ複製します。",
  "stage.choose": "信号を選ぶ",
  "stage.choose.intro":
    "MUX は、2 つの信号のどちらを通すかを 1 本の配線で決めます。この段階の MUX はどれも、一つ前の MUX から作ります。",
  "stage.route": "信号を送る",
  "stage.route.intro":
    "DMUX は MUX を逆にしたもの: 1 つの入力を sel が選んだ出力へ送ります。RAM はこれで書き込むワードを選びます。",
  "stage.add": "足し算",
  "stage.add.intro":
    "2 ビット、次に 3 ビットを足し、16 個の加算器をつないでワードの加算器にします。どの加算器も、作ったばかりのものから作ります。",
  "stage.alu": "ALU",
  "stage.alu.intro":
    "まとめましょう: OR8WAY がゼロを見つけ、シフタがビットを動かし、ALU が CPU の計算をすべて行います。",
  "stage.bit": "1 ビットを覚える",
  "stage.bit.intro":
    "ゲートの出力を入力に戻すと、値を覚えるようになります。各ステップが一つ前の弱点を直し、最後にはクロックエッジでだけ変わるようになります。",
  "stage.registers": "レジスタ",
  "stage.registers.intro":
    "Bit を 16 個並べるとレジスタになります。レジスタ 8 個で CPU のレジスタファイルになり、数を数えるレジスタがプログラムカウンタです。",
  "stage.ram": "RAM",
  "stage.ram.intro":
    "アドレス付きのレジスタが RAM8 になります。大きい RAM はどれも、一つ前の RAM の複製から作ります。",
  "stage.control": "制御",
  "stage.control.intro":
    "制御ユニットは命令を読み、CPU を動かすすべての信号を設定します。",
  "stage.cpu": "プロセッサ",
  "stage.cpu.intro":
    "制御ユニット、レジスタファイル、ALU、シフタ、プログラムカウンタを配線して、1 クロックに 1 命令を実行する CPU にします。",
  "stage.machine": "コンピュータ",
  "stage.machine.intro":
    "RAM、画面、キーボードにアドレスを割り当て、そのメモリを CPU につなぎます。",
  "levels.treeLabel":
    "テックツリーとしてのレベル: 各レベルは、必要なレベルの下に置かれる",
  "levels.treeHelp":
    "各レベルは、必要な部品の下に置かれています。一つ選ぶと、必要なものと解放されるものが見られます。矢印キーでレベル間を移動できます。",
  "levels.needs": "必要",
  "levels.unlocks": "解放",
  "levels.needsNothing": "なし: ここから始めましょう。",
  "levels.unlocksNothing": "まだなし: 今のところツリーの頂上です。",
  "levels.play": "レベルを開く →",
  "levels.fastBadge": "⚡ 高速",
  "levels.progress": "あなたの進捗",
  "levels.saved": "このブラウザに自動で保存されます。",
  "levels.notSaved":
    "このブラウザではサイトがデータを保存できません。タブを閉じる前に進捗をエクスポートしてください。",
  "levels.exportHint":
    "ファイルにエクスポートすると、バックアップや別のブラウザへの移動ができます。",
  "levels.export": "エクスポート",
  "levels.import": "インポート",
  "levels.imported": "インポートしました。",
  "levels.confirmImport": "今の進捗を、インポートしたファイルで置き換えますか?",
  "levels.runsAs": "実行方法: {mode}",
  "levels.fastModel": "高速モデル",
  "levels.yourDesign": "あなたの設計",
  "levels.nowYours": "あなた自身の設計で実行するようにしました。",
  "levels.comparing": "あなたの設計と高速モデルを比べています…",
  "levels.cantSwap": "切り替えられません: {error}",
  "levels.scopeAll": "考えられる {n} 通りすべての入力",
  "levels.scopeRandom": "{n} 個のランダムな入力",
  "levels.scopeCycles": "{n} 回のランダムなクロックサイクル",
  "levels.notSwapped":
    "✗ 切り替えませんでした: {scope}のうち {failed} 個で、あなたの設計はモデルと違います。",
  "levels.example":
    " 例えば {inputs} のとき: モデルは {expected}、あなたの設計は {actual} です。",
  "levels.matched":
    "✓ {scope}で一致しました。高速モデルで実行するようにしました。",
  "progress.badJson": "そのファイルは正しい JSON ではありません。",
  "progress.notOurs":
    "そのファイルは Sand to Tetris の進捗ファイルではありません。",
  "progress.damaged": "「{id}」の項目が壊れています。",

  // ---- レベルのページ ----
  "play.loading": "シミュレータを読み込み中…",
  "play.noLevel": "そのレベルはありません",
  "play.backToMap": "レベルマップへ戻る",
  "play.locked": "{name} はロック中です",
  "play.passFirst": "先にこれらをクリアしてください: {names}。",
  "play.crumbs": "パンくずリスト",
  "play.layerN": "レイヤー {n}",
  "play.nextLevel": "次のレベル →",
  "play.levelMap": "レベルマップ",
  "play.toolbox": "ツールボックス",
  "play.parts": "部品",
  "play.cantRun": "まだ動かせません:",
  "play.clear": "クリア",
  "play.clearTitle": "部品と配線をすべて消す(元に戻すで復元できます)",
  "play.clearConfirm":
    "部品 {parts} 個と配線 {wires} 本をすべて消しますか?ページを離れるまでは、元に戻す(Ctrl+Z)で復元できます。",
  "play.cleared": "キャンバスを消去しました。元に戻す(Ctrl+Z)で復元できます。",
  "play.hintFirst": "ヒントを見る",
  "play.hintNext": "次のヒントを見る({total} 個中 {n} 個目)",
  "play.hintLabel": "ヒント {n}:",
  "play.moreParts": "ほかの部品({n})",
  "play.fewerParts": "部品を減らす",
  "play.stepOf": "ステップ {n}/{total}",
  "play.addTool": "{name} を追加(キャンバスへドラッグもできます)",
  "play.undo": "元に戻す",
  "play.redo": "やり直す",
  "play.undoTitle": "元に戻す(Ctrl+Z)",
  "play.redoTitle": "やり直す(Ctrl+Shift+Z)",
  "play.workbench": "作業台",
  "play.narrow":
    "エディタは大きな画面の方が使いやすいです。スマートフォンでは、キャンバスをドラッグして移動し、メニューキーか右クリックで各部品の操作を表示します。",
  "play.sideLabel": "目標、入力、テスト",
  "play.goal": "目標",
  "play.notSaving":
    "このブラウザではサイトがデータを保存できないため、進捗はこのタブを閉じるまでしか残りません。残すにはレベルマップのエクスポートを使ってください。",
  "play.inputs": "入力",
  "play.busHelp":
    "バス入力ごとに数値を入力します: 10 進数、0x… の 16 進数、0b… の 2 進数。Enter で反映します。",
  "play.busLabel": "{name}({w} ビット) ",
  "play.bitsOf": "{name} のビット",
  "play.bitTitle": "{name} のビット {i} は {v} です。クリックで反転します。",
  "play.bitsHelp":
    "ビットをクリックして反転することもできます。最上位ビットが左、ビット 0 が右です。",
  "play.outputs": "出力",
  "play.notANumber":
    "「{text}」は 0 から {max} までの数ではありません。10 進数、0x… の 16 進数、0b… の 2 進数で入力できます。",
  "play.step": "ステップ",
  "play.want": "{name}(期待)",
  "play.yours": "{name}(あなた)",
  "play.result": "結果",
  "play.any": "任意",
  "play.match": "✓ 一致",
  "play.differs": "✗ 不一致",
  "play.check": "チェック",
  "play.checking": "チェック中…",
  "play.testSteps": "テストのステップ",
  "play.truthTable": "真理値表",
  "play.stepsHelp":
    "ステップは上から順に実行され、回路はその間の状態を覚えています。「任意」はどの値でもよいという意味です。ステップをクリックすると、そこまでのテストを再生します。",
  "play.tableHelp":
    "配線すると即座に更新されます。行をクリックすると、その入力を設定します。",
  "play.howPartsRun": "部品の実行方法",
  "play.howPartsRunHelp":
    "どの部品を高速モデルで実行するかは、レベルマップで変えられます。",
  "play.runsTable": "その真理値表(あなたのトランジスタはすべての行に合格済み)",
  "play.runsFast": "高速モデル(あなたの設計と一致済み)",
  "play.runsYours": "あなたの設計",
  "play.runsItem": "{name}: {how}",
  "play.noComponents": "部品はまだありません。",
  "play.tick": "clk を刻む ⎍",
  "play.tickTitle": "clk を 1 にしてから 0 に戻す",
  "play.ticked":
    "刻み: clk が 1 に上がり(フリップフロップが値を保存する瞬間)、0 に戻りました。",
  "play.resetMemory": "メモリをリセット",
  "play.resetMemoryTitle":
    "保存したものをすべて忘れる。電源を切って入れ直すように",
  "play.memoryCleared":
    "メモリを消去しました: 電源投入時のように、保存されたビットはすべて不明(X)に戻りました。",
  "play.zoom": "ズーム",
  "play.zoomOut": "縮小",
  "play.zoomIn": "拡大",
  "play.zoomOutTitle": "縮小(−)",
  "play.zoomInTitle": "拡大(+)",
  "play.zoomReset": "100% に戻す(0)",
  "play.zoomLevel": "ズーム倍率。100% に戻す",
  "play.fit": "全体",
  "play.fitTitle": "回路全体を表示する",
  "play.shortcuts": "ショートカット",
  "keys.add": "部品を追加",
  "keys.addHow": "ツールボックスからドラッグ、またはクリック",
  "keys.wire": "2 つのピンを配線",
  "keys.wireHow": "一方のピンからもう一方へドラッグ、または両方をクリック",
  "keys.move": "部品、入力、出力を移動",
  "keys.moveHow": "ドラッグ · Tab で選んで矢印キー",
  "keys.flip": "入力を反転",
  "keys.flipHow": "クリック · Enter",
  "keys.more": "ほかの操作(接続、削除…)",
  "keys.moreHow": "右クリック · メニューキーまたは Shift+F10",
  "keys.inside": "部品の中を見る",
  "keys.insideHow": "ダブルクリック · Enter",
  "keys.delete": "削除",
  "keys.deleteHow": "Delete または Backspace",
  "keys.undo": "元に戻す / やり直す",
  "keys.undoHow": "Ctrl+Z / Ctrl+Shift+Z",
  "keys.pan": "移動",
  "keys.panHow": "何もないキャンバスをドラッグ · スクロール",
  "keys.zoom": "ズーム",
  "keys.zoomHow": "Ctrl+スクロール · + と − · 0 で戻す",
  "keys.cancel": "配線をやめる",
  "keys.cancelHow": "Escape",
  "play.changed":
    "前回のチェックから変わりました。もう一度チェックしてください。",
  "play.emptyHint":
    "ツールボックスから部品をここへドラッグするか、キャンバスを右クリックして追加します。そしてピンからピンへドラッグして配線します。",
  "play.added": "{id} を追加しました。",
  "play.addedFree":
    "{id} を追加しました。キャンバス上で Tab で選ぶと、矢印キーで動かせます。",
  "play.duplicated": "{from} の複製 {id} を追加しました。",
  "play.disconnectedAll": "{name} の配線をすべて外しました。",
  "play.disconnectedOne": "{name} の配線を 1 本外しました。",
  "play.connected": "{from} を {to} につなぎました。",
  "play.deleted": "{id} を削除しました。",
  "play.deletedWire": "配線を削除しました。",
  "play.movedBack": "{name} を端に戻しました。",
  "play.settled": (v) =>
    `ゲート遅延 ${v.depth} 段で落ち着きました${v.fast ? "(高速モデルは 1 段と数えるので、実際のハードウェアではもっと時間がかかります)" : ""}。`,
  "play.oscillates":
    "まだ変化しています: この回路は発振していて、落ち着きません。",
  "play.slow": (v) =>
    `この回路は ${v.cells} 個のゲートをシミュレートするので、変更のたびに少し時間がかかります。${v.names} を高速モデルに切り替えるには、`,
  "play.slowLink": "レベルマップ",
  "play.slowEnd": " で設定すると即座に動きます。",
  "play.optionsFor": "{id} のオプション",
  "play.busWidth": "バス幅 ",
  "play.bits": "{n} ビット",
  "play.repeat": "繰り返し × ",
  "play.repeatHelp":
    "各複製はバスの各ピンから自分の分のビットを受け取ります。ただし共有入力は、すべての複製が同じものを読みます。",
  "play.share": " {pin} を共有",
  "play.fixTry": "試す: ",
  "play.fixRepeat": "{part} を ×{n} 繰り返す",
  "play.fixRepeatWhy":
    " バスは {w} ビットを運び、部品 1 個は {b} ビットを受け取ります。",
  "play.fixShare": "{part} の {pin} を共有する",
  "play.fixShareWhy": " どの複製も同じ {b} ビットの `{pin}` を読むはずです。",
  "play.fixBits": "次の {n} ビットも同じように配線する",
  "play.fixBitsWhy": " 次: {first}{rest}。",
  "play.fixFill": "{source} を {part} の空いている {n} ビットにつなぐ",
  "play.fixFillWhy":
    " ジョイナの使わないビットには、ふつう定数 0 をつなぎます。",
  "play.wiredMany": "配線を {n} 本追加しました。",
  "play.simError": "シミュレーションのエラー: {error}",
  "play.showingStep1": "電源投入からのステップ 1 を表示しています。",
  "play.showingStep":
    "ステップ 1–{m} を再生した後の、ステップ {n} を表示しています。",
  "play.showingRow":
    "行 {n} を表示しています。強調された部品には「!」が付いています。",
  "play.waveform": "波形",
  "play.waveTest": "テストのステップ",
  "play.waveLive": "ライブ",
  "play.waveClear": "消去",
  "play.waveLiveEmpty":
    "入力を反転したりクロックを刻んだりすると、変化がここに現れます。",
  "play.waveEmpty": "まだ表示するものがありません。",
  "play.error": "エラー: ",
  "play.note": "注意: ",
  "play.shortNow":
    "今ショートしています: VDD と GND が {parts} を通してつながっています。",
  "play.couldntCheck": "チェックできませんでした: {error}",
  "play.passed": "✓ クリア!",
  "play.passedRows": (v) =>
    v.random
      ? `${v.rows} 個の${v.seq ? "ステップ" : "行"}と ${v.random} 個のランダムな${v.seq ? "ステップ" : "テスト"}がすべて一致`
      : `${v.rows} 個の${v.seq ? "ステップ" : "行"}がすべて一致`,
  "play.usingTransistors": "トランジスタ {n} 個を使用",
  "play.usingGates": (v) =>
    `ゲート ${v.cells} 個、ゲート遅延 ${v.depth} 段を使用`,
  "play.nowInToolbox": "{name} がツールボックスに入りました。",
  "play.failedRows": (v) =>
    `✗ ${v.rows} 個の${v.seq ? "ステップ" : "行"}のうち ${v.failed} 個がまだ一致しません。`,
  "play.failedRandom": (v) =>
    ` ${v.run} 個のランダムな${v.seq ? "ステップ" : "テスト"}のうち ${v.failed} 個も失敗します。`,
  "play.designErrors": "✗ 設計にエラーがあります(下を参照)。",
  "play.hint": "ヒント: ",
  "play.inside": "内部: {path}",
  "play.upOne": "一つ上へ",
  "play.close": "閉じる",
  "play.insideNote":
    "{parent} の中で受け取る値で動いている、あなたの {name} の設計です。ここでは読み取り専用: 編集はそのレベルのページで。",
  "play.editIt": "{name} を編集",

  // ---- キャンバス ----
  "canvas.label": "回路キャンバス",
  "canvas.wired": "配線: {list}。",
  "canvas.notWired": "未配線。",
  "canvas.partShort": "、ショートの一部",
  "canvas.partKeys":
    "矢印キーで移動、Delete で削除、メニューキーでほかの操作。",
  "canvas.split": "スプリッタ {w}",
  "canvas.join": "ジョイナ {w}",
  "canvas.shared": "{pin}(共有)",
  "canvas.pinTitle":
    "{pin}{bits} = {value}。別のピンへドラッグして配線します。",
  "canvas.pinBits": "({n} ビット)",
  "canvas.input": "入力",
  "canvas.output": "出力",
  "canvas.portLabelIn": (v) =>
    `入力 ${v.name} = ${v.value}。${v.wired}${v.bus ? "Enter で値を編集、" : "Enter で反転、"}矢印キーで移動、メニューキーでほかの操作。`,
  "canvas.portLabelOut":
    "出力 {name} = {value}。{wired}矢印キーで移動、メニューキーでほかの操作。",
  "canvas.outTitle": "出力 {name}: ドラッグで移動",
  "canvas.inTitleBus": "入力 {name}: クリックで数値を入力、ドラッグで移動",
  "canvas.inTitle": "入力 {name}: クリックで 0 と 1 を反転、ドラッグで移動",
  "model.sameEnd": "配線には異なる 2 つの端が必要です。",
  "model.alreadyConnected": "その 2 つはすでにつながっています。",
  "canvas.pendingWire":
    "つなぐ先のピンをクリックしてください(Escape でやめます)。",
  "state.on": "オン",
  "state.off": "オフ",
  "state.maybe": "不定",
  "endpoint.input": "入力 {name}",
  "endpoint.output": "出力 {name}",
  "endpoint.bit": "ビット {n}",

  // ---- 右クリックメニュー ----
  "menu.lookInside": "中を見る",
  "menu.options": "オプション…",
  "menu.connect": "接続…",
  "menu.disconnect": "接続を外す…",
  "menu.duplicate": "複製",
  "menu.delete": "削除",
  "menu.deleteWire": "配線を削除",
  "menu.setValue": "値を設定…",
  "menu.flip": "0 ↔ 1 を反転",
  "menu.reset": "端に戻す",
  "menu.canvas": "キャンバス",
  "menu.addHere": "ここに {name} を追加",
  "menu.undo": "元に戻す",
  "menu.redo": "やり直す",
  "menu.clear": "キャンバスを消去",
  "menu.wire": "配線",
  "menu.wireTitle": "配線 {from} — {to}",
  "menu.input": "入力 {name}",
  "menu.output": "出力 {name}",
  "menu.whichPin": "{id} のどのピンをつなぎますか?",
  "menu.connectTo": "{from} をつなぐ先…",
  "menu.disconnectFrom": "{name} から配線を外す",
  "menu.allWires": "すべての配線",
  "menu.wireCount": "配線 {n} 本",

  // ---- 波形 ----
  "wave.label":
    "{n} ステップにわたる {names} の波形。同じ値が表にも載っています。",
  "wave.replay": "ステップ {n} まで再生",

  // ---- 基本部品と配線部品のツールボックス名 ----
  "tool.split": "スプリッタ",
  "tool.join": "ジョイナ",
  // ---- チェッカーのメッセージ ----
  "problem.component-mismatch":
    "この設計は `{design}` 用ですが、レベルは `{level}` です",
  "problem.duplicate-part":
    "2 つの部品が同じ id `{part}` を持っています。id は一意でなければなりません",
  "problem.unknown-kind":
    "部品 `{part}` は `{kind}` ですが、それは既知の部品でもコンポーネントでもありません",
  "problem.primitive-not-allowed":
    "部品 `{part}` はむき出しの `{kind}` ですが、これはレイヤー {layer} のレベルです。トランジスタと電源レールを直接使うのはレイヤー 1 だけで、レイヤー 2 からは自分で作ったコンポーネントで組み立てます",
  "problem.layer-violation":
    "部品 `{part}` はレイヤー {kind_layer} のコンポーネント `{kind}` ですが、これはレイヤー {layer} のレベルです。レイヤー {layer} のコンポーネントは、レイヤー {layer} 以下の部品しか使えません",
  "problem.not-unlocked":
    "部品 `{part}` は、まだ解放していない `{kind}` です: 先に `{kind}` のレベルをクリアしてください",
  "problem.self-reference":
    "部品 `{part}` はこのコンポーネント自身です。コンポーネントは自分自身を含められません",
  "problem.dependency-cycle":
    "コンポーネントが互いに循環して依存しています: {path}",
  "problem.unknown-port":
    "配線がポート `{port}` につながっていますが、このコンポーネントにそのポートはありません(ポート: {valid})",
  "problem.unknown-part":
    "配線が部品 `{part}` につながっていますが、その部品はありません",
  "problem.unknown-pin":
    "配線が `{part}.{pin}` につながっていますが、`{kind}` にピン `{pin}` はありません(ピン: {valid})",
  "problem.output-unconnected": "出力 `{port}` がどこにもつながっていません",
  "problem.bad-part": "部品 `{part}`: {reason}",
  "problem.width-mismatch":
    "配線が {from}({from_width} ビット)と {to}({to_width} ビット)をつないでいます。両端の幅は同じでなければなりません",
  "problem.input-unused": "入力 `{port}` が使われていません",
  "problem.pin-unconnected": "`{part}.{pin}` がつながっていません",
  "problem.inner-broken":
    "この設計の中のコンポーネントが壊れています: {detail}",
  "problem.engine": "シミュレーション中のエラー: {detail}",
  "problem.two-drivers":
    "{listeners} が {drivers} から同時に 2 つの信号を受けています: 2 つの出力が 1 本の配線を取り合っています。配線の信号源はちょうど 1 つでなければなりません",
  "problem.too-big":
    "部品をすべて展開すると、この回路はゲート {limit} 個を超え、シミュレートするには大きすぎます。レベルマップで大きな部品(メモリ、CPU)を高速モデルに切り替えてください",
  "reason.widthOnlyWiring": "幅を持つのはスプリッタとジョイナだけです",
  "reason.repeatOnlyComponents": "繰り返せるのはコンポーネントだけです",
  "reason.sharedNeedsRepeat":
    "共有ピンは、繰り返したコンポーネントでのみ意味があります",
  "reason.needsWidth": "スプリッタとジョイナには幅が必要です",
  "reason.badWidth": "幅 {n} は使えません。2 から 64 にしてください",
  "reason.badRepeat": "繰り返し {n} は使えません。1 から 64 にしてください",
  "reason.tooWide": "繰り返すとピンの幅が 64 ビットを超えます",
  "reason.wiringLayer2":
    "スプリッタとジョイナはバスとともにレイヤー 2 で登場します",
  "diag.row": "行 {n}",
  "diag.step1": "ステップ 1",
  "diag.step2": "ステップ 2(ステップ 1 の後)",
  "diag.stepN": "ステップ {n}(ステップ 1–{m} の後)",
  "diag.randomTest": "ランダムテスト {n}",
  "diag.randomStep1": "ランダムステップ 1",
  "diag.randomStep2": "ランダムステップ 2(ランダムステップ 1 の後)",
  "diag.randomStepN": "ランダムステップ {n}(ランダムステップ 1–{m} の後)",
  "diag.wrong":
    "{label}: {inputs} → 期待 {port}={expected}、実際 {port}={actual}。",
  "diag.floating":
    "{label}: {inputs} → 期待 {port}={expected}、実際 {actual}: `{port}` がフローティングです。何も駆動していません。",
  "diag.unknown":
    "{label}: {inputs} → 期待 {port}={expected}、実際 {actual}: `{port}` の値が決まりません。つながっていない入力かループを探してください。",
  "diag.short":
    "{label}: {inputs} → ショート: VDD と GND がつながっています。期待 {port}={expected}、実際 X。",
  ...demosJa,
  ...toolsJa,
};
