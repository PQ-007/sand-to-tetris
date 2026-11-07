// 章のデモの日本語テキスト(ja.ts に統合される)。
import type { demosEn } from "./demos.en";
import type { Message } from "./en";

export const demosJa: Record<keyof typeof demosEn, Message> = {
  "kit.wide": "図(小さい画面では横にスクロールできます)",

  // ---- スイッチの歴史 ----
  "sw.caption": "時代とともに変わったスイッチ",
  "sw.captionText":
    "スイッチを選ぶと、そのおおよその大きさと速さが分かります。どちらの軸も対数目盛りで、一目盛り進むごとに 100 倍か 1,000 倍になります。",
  "sw.choose": "スイッチを選ぶ",
  "sw.sizeAxis": "スイッチ 1 個の大きさ",
  "sw.timeAxis": "1 回切り替わる時間",
  "sw.compareWith": "比べる相手: ",
  "sw.plotLabel": "{name}: 大きさ {size}、切り替え時間 {time}",
  "sw.example": "例: {example}。大きさ {size}、{time} で切り替わる。",
  "sw.pickOther": "比べるには別のスイッチを選んでください。",
  "sw.compare": "{a} と {b}: 大きさは{size}、速さは{speed}。",
  "sw.same": "ほぼ同じ",
  "sw.times": "約{n}倍",
  "sw.longer": "{ratio}大きい",
  "sw.shorter": "{ratio}小さい",
  "sw.slower": "{ratio}遅い",
  "sw.faster": "{ratio}速い",
  "sw.thousand": "千",
  "sw.million": "百万",
  "sw.billion": "十億",
  "sw.trillion": "一兆",
  "sw.gear.era": "1640 年代–1940 年代",
  "sw.gear.name": "歯車",
  "sw.gear.example": "パスカリーヌ、微分解析機",
  "sw.gear.how":
    "歯の付いた車輪が 1 段回る。桁上がりは、一つの車輪が次の車輪を押すこと。",
  "sw.relay.era": "1930 年代–1940 年代",
  "sw.relay.name": "リレー",
  "sw.relay.example": "Harvard Mark I",
  "sw.relay.how":
    "電磁石が金属のアームを引き寄せ、接点を閉じたり開いたりする。",
  "sw.tube.era": "1940 年代–1950 年代",
  "sw.tube.name": "真空管",
  "sw.tube.example": "ENIAC",
  "sw.tube.how":
    "金網(グリッド)にかけた電圧が、真空中を流れる電子を通したり止めたりする。",
  "sw.transistor-1947.era": "1947 年",
  "sw.transistor-1947.name": "最初のトランジスタ",
  "sw.transistor-1947.example": "ベル研究所の点接触トランジスタ",
  "sw.transistor-1947.how":
    "ゲルマニウムの上の 2 つの金の接点: 一方に流す電流が、もう一方を通る電流を制御する。",
  "sw.transistor-1971.era": "1971 年",
  "sw.transistor-1971.name": "チップ上のトランジスタ",
  "sw.transistor-1971.example": "Intel 4004",
  "sw.transistor-1971.how":
    "MOSFET: ゲートの電圧が、シリコンの中に電気を通すチャネルを作ったり消したりする。",
  "sw.transistor-today.era": "2020 年代",
  "sw.transistor-today.name": "現在のトランジスタ",
  "sw.transistor-today.example": "スマートフォンやノートパソコンのプロセッサ",
  "sw.transistor-today.how":
    "同じ MOSFET の考えを、爪ほどのチップに何十億個も載るまで小さくしたもの。",

  // ---- 砂からウエハへ ----
  "wafer.caption": "砂からウエハへ",
  "wafer.captionText":
    "6 つの工程で、石英がほぼ完全な結晶の円盤になります。工程を選んでください。",
  "wafer.prev": "← 前の工程",
  "wafer.next": "次の工程 →",
  "wafer.step": "工程 {n}: {title}",
  "wafer.temperature": "温度: {t}",
  "wafer.purity": "純度",
  "wafer.purityText": "シリコン約 {pct}%: {ratio} 個に 1 個ほどの異物の原子",
  "wafer.source": "出典",
  "wafer.sand.title": "珪砂",
  "wafer.sand.what": "二酸化ケイ素(SiO₂): 酸素と結びついたシリコン。",
  "wafer.sand.detail":
    "ふつうの海辺の砂は不純物が多すぎるため、産業では高純度の石英を使います。シリコンは岩石のどこにでもありますが、いつも酸素と結びついています。",
  "wafer.furnace.title": "アーク炉",
  "wafer.furnace.what": "炭素がシリコンから酸素を引きはがす。",
  "wafer.furnace.detail":
    "石英と炭素を電気アークで加熱します。炭素が酸素を奪い(一酸化炭素として出ていく)、液体のシリコンが底にたまります: 金属グレードのシリコンです。",
  "wafer.furnace.temperature": "約 1900 °C 以上",
  "wafer.trichlorosilane.title": "液体にして蒸留する",
  "wafer.trichlorosilane.what":
    "シリコンを、蒸留できるトリクロロシラン(SiHCl₃)に変える。",
  "wafer.trichlorosilane.detail":
    "シリコンを塩化水素と反応させると液体になります。液体は、純度の高いアルコールを作るときのように蒸留で精製でき、残りの不純物のほとんどが取り除かれます。",
  "wafer.siemens.title": "シーメンス法",
  "wafer.siemens.what": "純粋なシリコンを多結晶シリコンとして析出させる。",
  "wafer.siemens.detail":
    "精製したトリクロロシランを、熱したシリコン棒の上で分解します。シリコンが層ごとに積み重なり、電子グレードの多結晶シリコンになります: 小さな結晶の集まりですが、非常に純粋です。",
  "wafer.siemens.temperature": "約 1100 °C(棒の温度)",
  "wafer.czochralski.title": "一つの結晶を育てる",
  "wafer.czochralski.what": "溶けたシリコンから、種結晶をゆっくり引き上げる。",
  "wafer.czochralski.detail":
    "多結晶シリコンを石英のるつぼで溶かします。ウエハを p 型か n 型にするなら、慎重に量ったごく少量のドーパントを加えます。小さな種結晶を融液に触れさせ、回しながらゆっくり引き上げます。原子が種結晶にそろって並ぶので、インゴット全体が一つの単結晶になります。",
  "wafer.czochralski.temperature":
    "1400 °C 以上(シリコンは約 1414 °C で溶ける)",
  "wafer.slice.title": "切って磨く",
  "wafer.slice.what": "インゴットを薄い円盤に切り、鏡のように滑らかに磨く。",
  "wafer.slice.detail":
    "ワイヤーソーでインゴットを厚さ 1 ミリ未満のウエハに切ります。研削、エッチング、研磨で、細菌よりはるかに小さな模様を焼き付けられるほど平らな表面にします。",

  // ---- pn 接合 ----
  "pn.caption": "pn 接合の内部",
  "pn.captionHtml":
    "p 型シリコン(左)には余分な<em>正孔</em>(+)が、n 型(右)には余分な<em>電子</em>(−)があります。両者が出会うところでは打ち消し合い、自由なキャリアのない薄い<em>空乏層</em>が残ります。接合にかかる電圧を変えてみましょう。",
  "pn.slider": "接合にかかる電圧",
  "pn.voltage": "電圧",
  "pn.width": "空乏層の幅",
  "pn.current": "電流",
  "pn.resting": "平常時の {n} 倍",
  "pn.label": "接合の電圧は {v} ボルト。空乏層は平常時の幅の {w} 倍。{state}",
  "pn.reverse":
    "逆方向バイアス: 空乏層が広がります。電流はほとんど流れません。接合は電流を遮ります。",
  "pn.unbiased":
    "電圧なし: 空乏層は、その中の電荷を帯びた原子が作る電場によって、自然な幅に保たれています。電流は流れません。",
  "pn.weak-forward":
    "弱い順方向バイアス: 空乏層は縮みますが、障壁はまだ高いままです。ごくわずかしか流れません。",
  "pn.conducting":
    "約 0.6 V を超える順方向バイアス: 障壁が崩れ、電子と正孔が流れ込みます。電流が急に増えます。",
  "pn.pSide": "p 型(正孔 +)",
  "pn.nSide": "n 型(電子 −)",
  "pn.depletion": "空乏層",
  "pn.ivLabel":
    "電圧に対する電流のグラフ: ゼロ付近では平らで、約 0.6 ボルトを超えると急に上がる。",
  "pn.vAxis": "電圧 →",
  "pn.iAxis": "電流 ↑(10 mA まで)",

  // ---- MOSFET ----
  "mos.caption": "MOSFET: 動く部品のないスイッチ",
  "mos.captionHtml":
    "ガラスのような薄い酸化膜が、ゲートとシリコンを隔てています。ゲートの電圧がキャリアを表面に引き寄せ、ソースとドレインをつなぐ<em>チャネル</em>を作ります。ゲート電圧をドラッグしてみましょう。",
  "mos.type": "トランジスタの種類",
  "mos.nmos": "NMOS(n チャネル)",
  "mos.pmos": "PMOS(p チャネル)",
  "mos.gateSlider": "ゲート電圧",
  "mos.gate": "ゲート",
  "mos.switch": "スイッチ",
  "mos.current": "電流、ソース → ドレイン",
  "mos.on": "オン(閉)",
  "mos.off": "オフ(開)",
  "mos.label": "{type} トランジスタ、ゲートは {g} ボルト: スイッチは{state}。",
  "mos.stateOn": "オン、チャネルあり",
  "mos.stateOff": "オフ、チャネルなし",
  "mos.body": "{body} 型シリコン(基板)",
  "mos.source": "{wells}+ ソース",
  "mos.drain": "{wells}+ ドレイン",
  "mos.gateV": "ゲート: {v} V",
  "mos.sourceV": "ソース: {v}",
  "mos.oxide": "酸化膜",
  "mos.drainLabel": "ドレイン",
  "mos.gateLabel": "ゲート",
  "mos.nmosOn":
    "ゲートがソースより {vth} V 以上高い: 電子が酸化膜の下に集まり、n 型のチャネルができます。電流が流れます。",
  "mos.nmosOff":
    "ゲートがしきい値({vth} V)より低い: チャネルがないので、スイッチは開いています。ごくわずかなリーク電流しか流れません。",
  "mos.pmosOn":
    "ゲートがソース({vdd} V)より {vth} V 以上低い: 正孔が酸化膜の下に集まり、p 型のチャネルができます。電流が流れます。PMOS はゲートが LOW のときにオンになります。",
  "mos.pmosOff":
    "ゲートがソースの電圧({vdd} V)に近すぎる: チャネルがありません。PMOS はゲートが HIGH のときオフで、NMOS と逆です。",
  "mos.plotLabel":
    "ゲート電圧に対する電流の対数グラフ。オフとオンの間で百万倍以上の差がある。",
  "mos.gAxis": "ゲート電圧 →",
  "mos.grid": "目盛り 1 本ごとに電流 1,000 倍",

  // ---- ノイズの連鎖 ----
  "noise.caption": "アナログのずれとデジタルの復元",
  "noise.captionHtml":
    "1 ビットが段の連なりを通っていきます。各段は少しずつランダムなノイズを加えます。<em>アナログ</em>の段は受け取った電圧をそのまま渡します。<em>デジタル</em>の段は、まず電圧を 0 か 1 の方へ戻してから渡します。",
  "noise.bit": "送るビット",
  "noise.stages": "段数",
  "noise.noise": "段ごとのノイズ",
  "noise.again": "もう一度送る",
  "noise.analog": "アナログ(破線)の到着値",
  "noise.digital": "デジタル(実線)の到着値",
  "noise.errors": "1,000 回送ったときの誤り",
  "noise.whyTitle": "デジタルが勝つ理由: S 字曲線",
  "noise.whyHtml":
    "デジタルの段の<em>伝達曲線</em>は、入力電圧を出力電圧に対応させます。真ん中は急で両端は平らなので、少しずれた 1 はよりきれいな 1 になって出てきます。<em>ノイズマージン</em>とは、正しい出力がどれだけノイズを拾っても、次の段で正しく読めるかの余裕です。",
  "noise.reads1": "1 と読む",
  "noise.unreliable": "不確かな領域",
  "noise.reads0": "0 と読む",
  "noise.stageN": "段 {n}",
  "noise.correct": "✓ 正しい",
  "noise.wrong": "✗ 誤り",
  "noise.errorCounts": "アナログ {a}、デジタル {d}",
  "noise.label":
    "{bit} を {n} 段に通して送る。アナログの連鎖は {a} ボルト、デジタルの連鎖は {d} ボルトで終わる。",
  "noise.curveLabel":
    "デジタルの段の伝達曲線。{vil} ボルト未満の入力は 0、{vih} ボルトを超える入力は 1 と読む。ノイズマージンは約 {nm} ボルト。",
  "noise.inAxis": "入力電圧 →",
  "noise.sender": "送信側",
  "noise.outAxis": "出力 ↑",
  "noise.margin": "ノイズマージン",

  // ---- スイッチの回路 ----
  "net.caption": "計算するスイッチ",
  "net.captionHtml":
    "2 つのスイッチを切り替えてみましょう。<em>直列</em>(次々につなぐ)では、両方が閉じているときだけ電流がランプに届きます。<em>並列</em>(横に並べる)では、どちらか一方で十分です。",
  "net.series": "直列",
  "net.parallel": "並列",
  "net.switch": "スイッチ {name}: {state}",
  "net.closed1": "閉(1)",
  "net.open0": "開(0)",
  "net.closed": "閉",
  "net.open": "開",
  "net.picLabel": "{arr}回路: ランプ{state}",
  "net.lampOn": "ランプ点灯",
  "net.lampOff": "ランプ消灯",
  "net.on": "点灯",
  "net.off": "消灯",
  "net.result": "A={a}、B={b} → ランプ{state}",
  "net.on1": "点灯(1)",
  "net.off0": "消灯(0)",
  "net.table": "真理値表({logic})",
  "net.lamp": "ランプ",

  // ---- リップルキャリー加算器 ----
  "ripple.caption": "波のように伝わるキャリー",
  "ripple.captionHtml":
    '各列が全加算器です。2 つのビットが等しい列は、自分の桁上げ出力をすぐに知ることができます。そうでなければ、右隣の列からのキャリーを待たなければなりません。<span class="muted">?</span> は「まだ分からない」という意味です。',
  "ripple.step": "1 ステップ",
  "ripple.play": "再生",
  "ripple.reset": "リセット",
  "ripple.longCarry": "255 + 1(長いキャリー)",
  "ripple.noCarry": "255 + 0(キャリーなし、それでも待つ)",
  "ripple.noWait": "12 + 12(待ちなし)",
  "ripple.carryOut": "桁上げ出力",
  "ripple.bit": "ビット {n}",
  "ripple.carryIn": "桁上げ入力",
  "ripple.sum": "和",
  "ripple.done": (v) =>
    `${v.n} ステップで完了: ${v.a} + ${v.b} = ${v.sum}${v.dropped ?? ""}。`,
  "ripple.dropped": "(桁上げ出力は捨てられる: 8 ビットでは {total} を表せない)",
  "ripple.waiting":
    "ステップ {step}/{total}: キャリーが伝わるのをまだ待っています。",

  // ---- ラッチ ----
  "latch.caption": "値を覚えるループ",
  "latch.captionText":
    "2 つの NOR ゲートが、互いの出力をもう一方の入力につないでいます。s か r を 1 にしてから 0 に戻すと、ラッチは値を保ちます。変化はゲート遅延 1 段ずつループを回ります。",
  "latch.s": "s(セット)= {v}",
  "latch.r": "r(リセット)= {v}",
  "latch.release": "両方を同時に離す",
  "latch.power": "電源を切って入れ直す",
  "latch.picLabel":
    "2 つの NOR ゲート。上: 入力 r = {r} と q̄ = {qn}、出力 q = {q}。下: 入力 s = {s} と q = {q}、出力 q̄ = {qn}。",
  "latch.delays": (v) => `ゲート遅延 ${v.n} 段の後`,
  "latch.oscillates":
    "落ち着きません: q = q̄ = 0 から両方の入力を離すと、両方のゲートが 1 に変わり、また両方 0 に戻り、それが永遠に続きます。実際のゲートは完全に同じではないのでどちらかが勝ちますが、どちらかは予測できません。だからラッチに s = r = 1 を与えてはいけないのです。",
  "latch.unknown":
    "不明(X): 電源投入時には、まだ誰もラッチをセットもリセットもしていません。s か r を 1 にしてください。",
  "latch.forbidden":
    "禁止状態: s = r = 1 では両方の出力が 0 になり、q と q̄ が反対ではなくなります。",
  "latch.holding":
    "{q} を保持: q が下のゲートに入って q̄ を {qn} に保ち、それが q を {q} に保ちます。外から何も駆動していないのに、ループが覚えています。",
  "latch.setting":
    "セット中: s = 1 が q̄ を 0 にし、次に上のゲートが q = 1 にします。",
  "latch.resetting":
    "リセット中: r = 1 が q を 0 にし、次に下のゲートが q̄ = 1 にします。",

  // ---- CPU ----
  "cpu.caption": "1 命令ずつ動く CPU",
  "cpu.captionText":
    "これは私たちが設計した CPU が小さなプログラムを実行しているところです。各ステップで PC の位置の命令を取り出し、解読し、1 クロックサイクルで実行します。",
  "cpu.program": "プログラム",
  "cpu.sum": "10 + 9 + … + 1 の合計",
  "cpu.call": "呼び出しと復帰",
  "cpu.screen": "画面に描く",
  "cpu.step": "ステップ",
  "cpu.run": "実行",
  "cpu.reset": "リセット",
  "cpu.listing": "プログラム ROM",
  "cpu.addr": "アドレス",
  "cpu.instr": "命令",
  "cpu.current": "PC の位置の命令",
  "cpu.state": "レジスタ",
  "cpu.flags": "フラグ",
  "cpu.new": "← 変化",
  "cpu.screenLabel": "画面の左上隅(16 × 2 ピクセル):",
  "cpu.pixelRow": "行 {y}: {bits}",
  "cpu.start":
    "リセット: PC は 0 です。ステップを押すと最初の命令を実行します。",
  "cpu.did": "ステップ {n}: {asm}。",
  "cpu.group.alu":
    "レジスタファイルが 2 つのレジスタを読み、ALU がそれらを組み合わせ、結果がレジスタに戻ります。フラグが保存されます。",
  "cpu.group.cmp":
    "ALU が引き算をして 2 つのレジスタを比べます。残るのはフラグだけです。",
  "cpu.group.imm":
    "数は命令そのものの中にあります。SET と SETH はそれを読み込み、ADDI と SUBI はそれを足すか引いて、フラグを保存します。",
  "cpu.group.shift":
    "バレルシフタが、レジスタのビットを 1 ステップでずらします。",
  "cpu.group.load":
    "ALU がレジスタにオフセットを足してアドレスを作り、そのアドレスのワードがレジスタに入ります。",
  "cpu.group.store":
    "ALU がアドレスを作り、レジスタの値がメモリのその場所に書き込まれます。",
  "cpu.group.jump":
    "制御ユニットが保存されたフラグで条件を調べます。成り立てば、PC は PC + 1 ではなく PC + オフセットになります。",
  "cpu.group.call":
    "CALL は戻り先アドレスを r7 に保存してジャンプし、RET は r7 のアドレスへ戻ります。",
  "cpu.chReg": "r{r}: {from} → {to}",
  "cpu.chFlags": "フラグ: Z={z} N={n} C={c}",
  "cpu.chMem": "メモリ {addr} ← {value}",
  "cpu.chJump": "PC が {to} へジャンプ",
  "cpu.nothing": "レジスタもメモリも変わらず、PC が次の命令へ進みます。",
  "cpu.halted":
    "プログラムは停止しました: JMP 0 が自分自身へ永遠にジャンプします。もう一度実行するにはリセットを押してください。",

  // ---- 1 つの命令をビットごとに ----
  "asmd.caption": "1 つの命令をビットごとに",
  "asmd.captionText":
    "命令を入力するか選ぶと、アセンブラがそこから作る 16 ビットをフィールドごとに見られます。",
  "asmd.try": "試す",
  "asmd.instruction": "命令",
  "asmd.group": "グループ",
  "asmd.unused": "未使用",
  "asmd.readsBack": "逆アセンブラで読み戻すと:",

  // ---- Bitfall の行 ----
  "brow.caption": "盤面は数でできている",
  "brow.captionText":
    "Bitfall の盤面の各行は 10 ビットの数です。セルをクリックして行を変えてみましょう: すべて 1 の行(1023)は消え、目標と等しい行もボーナス付きで消えます。下では、ピースの行が最後の行の上を滑ります: 両方に 1 がある場所では AND が 0 にならず、ピースは止まります。",
  "brow.target": "目標: {bits}",
  "brow.rowLabel": "行 {n}",
  "brow.cellOn": "行 {row}、セル {col}: 埋まっている",
  "brow.cellOff": "行 {row}、セル {col}: 空",
  "brow.fate.full": "満杯(1023): 消える、+10",
  "brow.fate.target": "目標と等しい: 消える、+50",
  "brow.fate.stays": "残る",
  "brow.pieceHead": "最後の行の上のピースの行",
  "brow.pieceLabel": "列 {col} にあるピースの行: {bits}",
  "brow.column": "ピースの列",
  "brow.fits": "ピース AND 行 = {and}: 収まります。",
  "brow.blocked": "ピース AND 行 = {and}: 0 ではないので止まります。",

  // ---- フォント ----
  "font.caption": "フォントは数でできている",
  "font.captionText":
    "OS のフォントの各文字は 3 × 5 ピクセルで、1 ワード(15 ビット、上の行から)に保存されています。ピクセルをクリック(または Enter)してビットを反転し、ワードが変わるのを見てみましょう。",
  "font.try": "試す",
  "font.char": "文字",
  "font.gridLabel": "{char} のピクセル",
  "font.pixelOn": "行 {row}、列 {col}: オン",
  "font.pixelOff": "行 {row}、列 {col}: オフ",
  "font.bitsTitle": "ビット 15(未使用)、続いて 5 つの行",
  "font.note":
    "draw_char はこのワードを読み、1 ごとにピクセルを描きます: (word >> (14 − 3·row − column)) & 1。フォント全体で 64 ワード、128 バイトです。",

  // ---- コンパイラ ----
  "cmp.caption": "段階ごとのコンパイラ",
  "cmp.captionText":
    "プログラムを編集して各段階を見てみましょう: トークン、構文木(各演算子がその対象の上にある)、VM コード。間違いがあると、それを見つけた段階と行が表示されます。",
  "cmp.try": "試す",
  "cmp.ex.expr": "優先順位",
  "cmp.ex.if": "if と呼び出し",
  "cmp.ex.loop": "ループと配列",
  "cmp.source": "C Shard のソース",
  "cmp.tokens": "1 · トークン({n} 個)",
  "cmp.tree": "2 · 構文木",
  "cmp.vm": "3–4 · 検査、そして VM コード({n} 行)",
  "cmp.error": "{line} 行目: {message}",
  "cmp.kind.num": "数",
  "cmp.kind.str": "文字列",
  "cmp.kind.name": "名前",
  "cmp.kind.kw": "キーワード",
  "cmp.kind.sym": "記号",

  // ---- スタックマシン ----
  "stk.caption": "1 コマンドずつ動くスタックマシン",
  "stk.captionText":
    "プログラムを選んで 1 ステップずつ進めましょう。スタックは上から順に表示され、各ワードには役割が書かれています: 作業用の値、変数、または関数のフレームの一部。",
  "stk.program": "プログラム",
  "stk.expr": "x = (3 + 4) × 2",
  "stk.call": "呼び出し: area(5, 3)",
  "stk.fact": "再帰: 3!",
  "stk.step": "ステップ",
  "stk.back": "戻る",
  "stk.run": "実行",
  "stk.reset": "リセット",
  "stk.code": "VM コード",
  "stk.stack": "スタック(上から)",
  "stk.addr": "アドレス",
  "stk.value": "値",
  "stk.what": "内容",
  "stk.operand": "作業用の値({func})",
  "stk.local": "{func} のローカル {index}",
  "stk.arg": "{func} の引数 {index}",
  "stk.saved-fp": "{func}: 呼び出し元の FP",
  "stk.return": "{func}: 戻り先アドレス",
  "stk.result": "main の結果",
  "stk.empty": "スタックは空です。",
  "stk.current": "次のコマンド",
  "stk.start": "ステップを押すと最初のコマンドを実行します。",
  "stk.next": "ステップ {n}。次: {line} 行目。",
  "stk.done": "完了: main が {value} を返しました。",
};
