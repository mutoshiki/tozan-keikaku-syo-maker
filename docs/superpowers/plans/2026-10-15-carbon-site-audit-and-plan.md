# 公開サイトのCarbon評価と改善 Implementation Plan

> **実行状況:** この計画の作成時点では提案のみの依頼だったが、ユーザーが後続ターンで実装を明示し、「今はもうLuna」と指定したため、このチェックアウトで実行した。チェック欄は現在の実施状態を示す。

**Goal:** 登山計画の入力、画像読み取り結果の修正、内容確認、PDF出力を、操作手段や画面幅によらず迷わず完了できるようにする。

**Architecture:** 現在のReact画面とclassic script互換層を維持し、入力・行程編集・出力の既存所有ファイルで改善する。情報設計、状態管理、アクセシビリティを先に直し、その後Carbonの標準コンポーネントとGrid・タイプ・余白を整える。互換層の全面撤去は本計画の前提にしない。

**Tech Stack:** React 19、Vite 7、`@carbon/react`（宣言範囲 `^1.114.0`）、`@carbon/icons-react`、html2canvas、jsPDF、既存Playwright/Vitest。

**Spec:** この文書の「評価と提案仕様」と、2026-10-15のユーザー依頼。Carbon MCPとcarbon-builderによる評価後、ユーザーの明示指示によりLunaが実装と検証を実施した。

## Global Constraints

- 現在の依頼範囲は既存計画の実装とローカル検証。公開、push、PR、merge、デプロイは含まない。
- ユーザーは実装再開とLunaでの実行を明示した。この同じ作業スレッドでLunaが計画を実行する。
- 今回の評価対象は `https://mutoshiki.github.io/tozan-keikaku-syo-maker/`。
- Official guidance（Carbon公式の指針）とProject interpretation（このサイトへの判断）を区別する。
- React版を前提にする。実装時は実際に解決されたCarbonバージョン・公開API・公式MCPの契約を再確認する。
- 最初に提供された `1-写真1.jpg`（私的なチャット画面）は評価・解析送信・テストfixtureから除外する。チャット添付の削除や元ファイルの物理削除は実施していない。この除外指定を、後から追加された画面スクリーンショットの「画像1」へ取り違えない。
- 最初の写真セットの `2-写真2.jpg` をルート、`3-写真3.jpg`〜`5-写真5.jpg` を行程として使用する。これらの新しい添付画像は、追加検証停止の指示後にはエージェントから送信・操作検証していない。後からユーザーが提供したサイト画面は、ユーザー操作の結果として評価に用いる。
- 実連絡先をテストデータとして保存しない。テストは架空の学籍番号・氏名・電話番号で行う。
- 行程の掲載選択、休憩後の時刻調整、複数管轄、A4の3ページ、iOSの共有に必要なクリック直後の処理を保つ。
- UIのテーマと、印刷用PDFの白背景・固定組版を区別する。
- 無関係な変更を破棄しない。公開・push・PR・mergeは本計画の実行範囲に含めない。

## Review Focus

1. 行程を削除した直後に出力しても、削除前のPDFが使われないこと。Task 1が所有する。
2. PDF準備中に編集・画面移動が起きても、古い準備結果が新しい結果を上書きしないこと。Task 1が所有する。
3. キーボードで画像追加から出力まで到達でき、閉じたテーマ設定へフォーカスが入らないこと。Task 2・3が所有する。
4. 行程の追加・時刻変更による並べ替え・休憩編集・削除で操作位置が失われないこと。Task 3が所有する。
5. 画像不足・解析失敗・重複範囲のある複数画像・長い地点名でも修正して進めること。Task 4・5・6が所有する。

## 評価の範囲と証拠

評価日：2026-10-15。公開サイトのPC幅1280pxとモバイル幅390px、ダーク表示、DOM・アクセシビリティツリー、キーボード、基本情報→画像追加→確認、行程の追加・休憩編集・削除を確認した。追加検証停止の指示後はサイトを操作していない。評価で一時設定したブラウザ幅は解除済み。

Carbon MCPは `code_audit`、`docs_search`、`code_search` を使用した。コード監査は6ファイル・109件の機械的指摘だったが、これは確定不具合件数ではない。指摘をDOM・呼び出し経路・公式文書で解釈し直した。

|段階|今回の確認内容|評価|
|---|---|---|
|1. 基本情報|見出し、入力、空欄のまま「次へ」、初期値、連絡先保存の配置|まとまりは分かる。必須／任意とエラー説明が不足|
|2. YAMAP画像|公開見本3枚の追加、解析開始・完了、Tab移動、390px表示|画像追加がキーボード非対応。見本が操作より先に大きく表示される|
|3. 確認・編集|解析された17地点、数値・管轄、行程追加・休憩変更・削除|編集機能はあるが、名前のない入力・フォーカス消失・横スクロールがある|
|4. 出力|準備中／準備済み、削除後の出力用DOM、共有ボタンの操作、およびユーザー提供のOS共有画面|出力用DOMの更新漏れを確認。ユーザーの画面ではPDFを添付したWindowsの共有画面が開いている。送信先への共有完了・PDF紙面は未確認|
|5. テーマ設定|閉じた状態で設定ボタンの次にTab移動|画面外のラジオへフォーカスが入る|

公開見本の元サイズはルート220×228px、行程140×303pxと220×476pxだった。1回の解析は完了したが、この画像を根拠に読み取りの正確性を合格とはしていない。今回の公開見本と後から提供された新しい画像は、時刻や掲載地点も同一ではないため、期待値を流用しない。

新しい添付画像によるエージェントの再現検証、ライト表示、スクリーンリーダー実機、200〜400%ズーム、コントラスト全件の数値測定、解析エラーの実発生、共有先への送信完了、実iPhoneの共有、生成PDFの紙面確認は後続検証。

### 後から提供された11枚の画面の評価

追加の9枚と、基本情報の2枚を本評価へ統合した。サイトの新しい操作は行っていない。9枚目はiPhone 15 Proの393×852エミュレーションとWindowsの共有画面を示しており、実iPhone上の検証とは区別する。

|提供画面|新しく分かったこと|評価への反映|
|---|---|---|
|9枚セットの1〜2枚目|アップロード済みの画像が大きく縦に並ぶ。ファイル名は日時中心。見本と登録画像の両方が主な面積を占める|一覧は小さなサムネイル＋「ルート／行程1・2・3」＋名前＋操作を基本にし、必要時に拡大。拡大画像だけに掲載判断を依存させない|
|同3〜4枚目|「読み取り完了」と灰色の「次へ」が同時に見える。同じ内容の画像が含まれる|恒常的な操作不能と断定しない。処理完了と確認画面へ進める条件を分け、不足があれば理由を表示する|
|同5枚目|山名、市町村、394分、9.6km、上り880m・下り878mが表示される|数値の要約に「6時間34分」も表示し、入力単位と読みやすい確認表示を両立する|
|同6枚目|空の3件目の管轄入力が常設され、行程に到達するまで縦に長い|既存の管轄を表示し、空の追加欄は「管轄を追加」から開く。既存情報の削除や自動上書きは前提にしない|
|同7〜8枚目|時刻と地点の右側に操作が隠れ、表全体に横スクロールがある。午後がAM/PM表記|行程の操作を縦に収める。時刻の確認表示は24時間表記に統一。ネイティブの入力欄がAM/PMになること自体をCarbon違反とは断定しない|
|同9枚目|PDF名と791.7KBのファイルがWindowsの共有画面に渡っている|「共有が開けない」「出力ボタンは実は保存だけ」という評価をしない。送信完了と紙面内容は別途検証する|
|追加2枚の基本情報|「企画者／留守本部」でまとまりがある。電話番号に1文字の「5」が入り、日付はMM/DD/YYYY。集合場所の末尾が入力幅に収まらない|まとまりは維持。必須と電話の書式を説明し、1桁の電話では出力前にエラー。日本語の日付の確認表示と、集合場所を全文で読める要約を追加|

固定ヘッダーの下に通常スクロール中の内容が隠れるだけでは違反と断定しない。キーボードでフォーカスした要素が見えなくならないことを、後続の受入条件とする。

### 保存済み画面

画面はリポジトリ外の次のフォルダへ保存済み：
`C:/Users/toshi/.codex/visualizations/2026/10/14/01a13cba-81d9-7dc1-8d72-2dd74de80bb5/carbon-audit-2026-10-15/`

ユーザー提供の9枚を `user-01.png`〜`user-09.png`、追加の基本情報2枚を `user-10.png`・`user-11.png` として同じフォルダに保存した。`user-03.png`と`user-04.png`は同じ内容の画面であり、独立した再現証拠として数えない。

6lunaの画像fixture元は `C:/Users/toshi/.codex/codex-remote-attachments/01a13cba-81d9-7dc1-8d72-2dd74de80bb5/F00A58DC-A312-42DB-940A-5A1E9AF3C1A2/` 内の `2-写真2.jpg`〜`5-写真5.jpg`。除外対象の `1-写真1.jpg` は参照しない。

- `03-basic-empty-next.png`：未入力で「次へ」を押しても説明文が出ない。
- `04-yamap-desktop.png`、`06-yamap-mobile-top.png`：見本・画像追加の情報順。
- `07-theme-hidden-focus.png`：閉じた設定内へTab移動した状態。対象が見えないためDOMの観察も根拠とする。
- `09-analysis-result-mobile.png`：読み取り完了の案内。
- `10-review-mobile.png`、`11-review-desktop.png`：確認画面全体と行程表。
- `12-itinerary-rest-focus.png`：休憩変更後。フォーカスはbodyへ消失。
- `13-itinerary-after-delete.png`：07:01の行を削除後。出力用DOMには旧行が残る。
- `14-after-pdf-action.png`：共有ボタン操作後。ダウンロードイベントは取得できなかった。

## Official guidance：公式根拠

以下はCarbon MCPから取得した指針。G1〜G3は公式Webページでも内容を確認した。URLは公式サイトの現行のwww付き経路にそろえている。

|ID|指針|公式参照|
|---|---|---|
|G1|画像追加の領域もTabで到達し、Enter／Spaceで操作できる。削除ボタンには対象ファイル名を関連付ける|[File uploader / Accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/file-uploader/accessibility)|
|G2|フォームの要求を開始時に説明し、入力とラベル・補足を関連付け、エラーを表示と支援技術の両方へ伝える|[Form / Accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/form/accessibility)|
|G3|直線的な3段階以上の作業に進捗表示を使用できる。完了・現在・未開始・エラーなどの状態を区別する|[Progress indicator / Guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/guidelines)|
|G4|各ステップのラベルには、その段階の状態を明確に含める|[Progress indicator / Accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/accessibility#accessibility-considerations)|
|G5|複数列フォームはグリッドに沿って配置する。標準フォームの列間はwide gutterの32pxが基準|[Form / Two column forms](https://www.carbondesignsystem.com/building-blocks/core/components/form/guidelines#two-column-forms)|
|G6|ファイル選択の目的・形式・制限を説明し、エラーには解消方法を示す|[File uploader / Guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/file-uploader/guidelines#main-elements)、[Validation](https://www.carbondesignsystem.com/building-blocks/core/components/file-uploader/guidelines#validation)|
|G7|処理中・成功・失敗で、その処理に対応した状態の説明を更新する|[Inline loading](https://www.carbondesignsystem.com/building-blocks/core/components/inline-loading/guidelines#main-elements)|
|G8|AIが関与する内容を明示し、説明へアクセスできるようにする|[AI label / Guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/ai-label/guidelines#mark-ai-generated-content)|
|G9|余白で情報の重要度とまとまりを伝える|[Spacing / Creating hierarchy](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview#creating-hierarchy)|
|G10|関連する操作には強弱を付ける。主操作同士を競合させない|[Button / Multiple button emphasis](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines#multiple-button-emphasis)|
|G11|ヘッダーはアイコン名・フォーカス・本文へのスキップを考慮する|[UI shell header / Accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-header/accessibility#labeling)|
|G12|ラベルは短く明確にし、何を入力すべきかを伝える。入力にはラベルを設ける|[Form / Labels](https://www.carbondesignsystem.com/building-blocks/core/components/form/guidelines#best-practices-for-labels)|

この指針から「このサイトにはモバイル用カードが必須」「4ステップに分割すべき」「すべての欄にAIラベルが必須」とは結論しない。以下の情報設計と優先順位は本サイトへの判断である。

## Project interpretation：評価と提案仕様

利用者の目的は「計画書として読める内容を、誤りを直して出力すること」。作業は基本情報→画像から取り込み→内容の修正と確認→保存／共有。3段階の構成を維持し、3段階目の中に出力前確認を置く案を採用する。

優先度：P1＝完走・入力／出力の信頼性に関わる、P2＝誤解・見落とし・大きな操作負担を減らす、P3＝一貫性の仕上げ。

|ID・優先度|観察・判定|採用する改善と理由|採用しない案と理由|根拠|
|---|---|---|---|---|
|R1 / P1|画像追加のlabelはtabIndex=-1、inputはhidden。Tabで追加欄を飛ばす|Carbonの標準FileUploader系を優先し、追加・削除をキーボードと対象名付きで扱えるようにする。主作業が止まるため最優先|labelに見た目だけのフォーカス枠を足す案。操作可能性を解決しない|G1|
|R2 / P1|行程の時刻・地点にアクセシブルネームがない。休憩変更・削除後にフォーカスがbodyになる|各欄に地点／行を含む名前を付け、編集した欄または隣の行へフォーカスを維持・移動する。閉じた設定内へのTab移動も止める|色やツールチップだけで状態を示す案。キーボード・読み上げの問題が残る|G1・G2・G11|
|R3 / P1|必須空欄で「次へ」を押しても入力へ移動するだけ。空欄の理由が表示されない。追加画面では電話番号「5」にエラーが見えない|冒頭の必須／任意説明、欄ごとの日本語エラー、入力への関連付けを採用。電話の書式と数値制約も確認し、送信／出力直前に統一した検証を使う|すべてのエラーをalertだけで伝える案、根拠のない学籍番号の書式制限。修正対象との対応が弱く、正常な入力も拒否し得る|G2・G12|
|R4 / P1|行程を17→16地点に削除後も出力用DOMに旧地点が残り、PDF準備済み表示も変わらない。コードの準備済みPDF無効化はinput/change中心|追加・削除を含む編集をPDF準備の無効化へつなぐ。出力直前の入力検証も共有経路に適用する。画面と出力の一致を優先する|ボタン文言や成功通知だけを直す案。データの不一致が残る|G2・G7を判断材料とする。本件の更新契約自体はプロジェクト固有|
|R5 / P2|行程表の最小幅680pxに対しPCの内容幅は約584px、390px画面の表示領域は約375px。掲載・休憩・削除が横の先にある|PCは行程に十分な列幅を割り当てる。モバイルは1地点を1組として主要欄と操作を縦にまとめる。全欄を見つけやすくする|表の横スクロールだけをWCAG違反と断定する案。表には例外があり、今回は操作発見性を問題にする|G2・G5・G9|
|R6 / P2|ステップ名「YAMAP」「確認」だけでは作業が分かりにくい。進捗の状態がクラスにしかなく、未来の段階も押せる外観|「基本情報／画像を取り込む／確認して出力」とし、現在・完了・未開始を読み上げにも伝える。戻った後も完了履歴を保持する|常設サイドバーや4枚目の画面を先に増やす案。短い直線的な作業には負担が増える|G3・G4|
|R7 / P2|見本と登録済み画像で縦に長い。必要枚数・自動解析条件・外部解析・復帰手段の説明が不足。「読み取り完了」と灰色の次へが同時に見える提供画面もある|追加操作を先に置き、「ルート1枚＋行程1枚以上」「長い行程は重ねて複数枚」を説明。登録済み画像は小さな一覧＋任意の拡大。見本は補助の折りたたみ。読み取り成功と進行可能を分け、処理状態・再試行・修正への経路を置く|低解像度見本の引き伸ばし、根拠のない解像度・容量閾値の固定、静止画だけで次へが壊れていると断定すること|G6・G7・G9|
|R8 / P2|「確認」は編集欄の集合で、基本情報のまとめ・完成するPDFの可視プレビュー・AI由来の説明がない|確認画面の先頭に日付・山名・開始／終了・連絡先の要約を置く。AI抽出箇所と確認事項、PDFプレビュー、環境に応じた保存／共有の文言を用意する|全入力にAIラベルを付ける案。手入力や固定データまでAI由来と誤認させる。自動処理の確信度の捏造もしない|G8・G9・G10|
|R9 / P3|テーマ色と主／副ボタンは既に活用。フォーム列間16px、内容と離れた主操作、独自の文字・余白指定は統一余地がある|既存の控えめな外観を基に、Carbon Grid・タイプ・余白とフォームの32px列間を適用。操作を内容列に合わせ、連絡先保存は「このブラウザに保存」と説明する|装飾カードやアイコンを全面追加する案、PDFの紙面までダーク化する案。入力・印刷の目的に寄与しない|G5・G9・G10|

### 機械的なコード監査指摘の採否

- **採用候補**：UI部分の「No custom font-size values」「No arbitrary rem/em values for spacing」「Validate Carbon Grid usage」はP3として整理する。値がCarbonのスケールと一致するだけではトークン化済みとは扱わない。
- **置換案の例**：監査の「No arbitrary rem/em values for spacing」にある `padding: 1rem` → `padding: $spacing-05`、`gap: 2rem` → `gap: $spacing-07` は、該当SCSSの用途を確認してから適用する候補。Typographyは単純置換せず、適切なtype-styleを選ぶ。
- **不採用**：App単体への「Missing Theme wrapper」。`src/main.jsx` → `ThemePreferenceProvider`でGlobalThemeとCarbonThemeが既に祖先に存在する。
- **不採用**：ネイティブselectへの「Select missing labelText」。Carbon Selectのprop検査をHTML selectへ適用している。現在のselectにはlabelがある。統一のための標準部品化と、ラベル欠落の断定を分ける。
- **不採用**：すべての「Button missing kind, size」を不具合扱いすること。既定値と実際の用途を確認して判断する。
- **不採用**：AM/PM表示やMM/DD/YYYYだけを理由にネイティブの入力を全面廃止すること。ブラウザのロケールと入力支援を考慮し、まず日付・24時間時刻・集合場所の読みやすい確認表示を添える。
- **不採用**：印刷用白背景・黒文字・明朝体・mm指定をUIのテーマ違反として一括修正すること。提出書類の組版は別の契約を持つ。
- **要判断**：「Contentがないのでヘッダーに隠れる」という断定。現行は独自paddingで位置を調整している。標準化の候補だが、wrapper不在だけで表示不良とは判定しない。
- **限界**：`app-share.js`は監査で0件だったが、行程削除とPDF準備の更新契約までは検査できない。機械監査の合格をフロー全体の合格にしない。

## ファイルの責務

|ファイル|現在の責務・変更候補|
|---|---|
|`src/App.jsx`|3段階の骨格、基本情報、アップローダー、確認画面、説明・要約・ラベル|
|`src/ThemeToggle.jsx`|設定の開閉、ラジオ、閉じている場合のフォーカス除外と閉じた後の復帰|
|`src/styles.scss`|画面用Grid、文字、余白、レスポンシブな行程編集、フォーカス|
|`src/theme-shell.scss`|テーマ対応のShell。Carbon内部クラスの追加上書きを増やさず公開契約を優先|
|`app-view.js`|validateStep1、validateStep3、goToStep、addFiles、renderItinerary、編集ハンドラ、出力用DOM|
|`app-flow.js`|画像解析と状態通知。自動生成された内容・管轄の表示と読み取り失敗時の説明|
|`app-share.js`|markDirty、preparePdf、sharePreparedPdf、準備の世代管理、保存／共有の分岐|
|`src/LegacyRuntime.jsx`|classic scriptのロード順・共有スコープ。今回の全面書換え対象にしない|

## 6luna向け実行計画

以下は後続実行の手順であり、チェックは未実施。

### Task 1：入力とPDFの一致を保証する（R3・R4）

**Files:** Modify `app-view.js`、`app-share.js`、`src/App.jsx`。Test `e2e/share-export-v2.spec.js`、必要ならCreate `e2e/export-consistency.spec.js`。

**Interfaces:** 既存の `validateStep1(): boolean`、`validateStep3(): boolean`、`window.__tozanShare.markDirty(): void`、`preparePdf(): Promise<void>` を接続する。共有のクリック直後に必要な処理は同期のまま保つ。

- [x] `npm.cmd ls @carbon/react --depth=0` と既存テストの共有・PDF取得手段を確認し、実行環境のバージョンを記録する。
- [x] `removingItineraryRowInvalidatesPreparedPdf`：準備後に掲載地点を1つ削除し、再出力でその地点が含まれないことを確かめる回帰テストを先に置く。
- [x] `latestEditWinsDuringPdfPreparation`：準備中に編集／画面移動し、古いPDFが共有されないことを確認する。
- [x] `invalidRequiredValuesBlockExport`：山名・管轄の必須欄やmin/maxに反する数値では、欄のエラーが出て保存／共有が始まらないことを確認する。
- [x] `phoneFormatErrorsAreExplained`：電話番号「5」はエラー、ハイフン付きの国内固定電話・携帯は受け付ける。学籍番号には未確認の書式規則を追加しない。
- [x] 行程の追加・削除も準備済みPDFを無効化し、共有経路にも最終検証を適用する。エラーには日本語の理由・修正方法を示す。
- [x] 上記の対象テストと既存の `e2e/share-export-v2.spec.js`、`e2e/pdf-export.spec.js` を実行する。PDFの3ページと編集反映、iOS向けクリック直後の共有契約を確認して変更を区切る。

### Task 2：画像追加とテーマ設定をキーボードで操作できるようにする（R1・R2）

**Files:** Modify `src/App.jsx`、`src/ThemeToggle.jsx`、`src/styles.scss`、必要なイベント接続のみ `app-view.js`。Test Create `e2e/carbon-accessibility.spec.js`、既存 `e2e/theme.spec.js`。

**Interfaces:** `addFiles(files: File[], kind: 'route' | 'itinerary'): Promise<void>` と既存アップロードリストの識別を維持する。Carbon部品の公開APIは実装時にMCPと導入版で確認する。

- [x] `keyboardCanChooseRouteAndItinerary`：Tab→Enter／Spaceで各選択ダイアログを開き、戻ったフォーカスが追加操作にあることを確認する。
- [x] `collapsedThemePanelIsNotFocusable`：閉じた設定内のラジオがTab順・支援技術の対象から外れ、開閉とEscape後の復帰先が正しいことを確認する。
- [x] FileUploader系で追加・削除を標準化し、削除には対象ファイル名を含める。画像形式・単数／複数の違いを維持する。
- [x] 閉じた設定の子要素を確実に操作対象から外す。Carbon内部CSSに依存した視覚的な隠し方だけで解決しない。
- [x] 対象テストと `e2e/theme.spec.js` を実行し、ライト／ダーク双方のフォーカスを確認する。

### Task 3：行程編集と進捗の状態を明確にする（R2・R5・R6）

**Files:** Modify `src/App.jsx`、`app-view.js`、`src/styles.scss`。Test Create `e2e/itinerary-editing.spec.js`。

**Interfaces:** `renderItinerary(): void`、`goToStep(step: number): void`、各rowの `time / place / major / restMinutes` と `adjustedRows()` の既存計算契約を維持する。

- [x] `itineraryControlsHaveContextualNames`：時刻・地点・掲載・休憩・削除の名前から対象地点を特定できることを確認する。
- [x] `editingRestPreservesFocus`、`sortingTimePreservesEditedRow`、`removingRowMovesFocusToNeighbor`：再描画後の操作位置を確認する。
- [x] `completedStepRemainsRevisitable`：3段階目から戻っても完了済み段階へ適切に再移動できることを確認する。
- [x] 編集のたびにtbody全体を破棄してフォーカスを失う経路を改める。追加時は新規行、削除時は次行／前行／追加ボタンへ移動する。
- [x] PCでは行程を広い列へ配置し、モバイルでは各地点の欄を縦にまとめる。時刻の並べ替え・休憩計算・掲載選択を変えない。
- [x] 進捗名と状態を読み上げにも伝える。各段階への移動時に見出しへフォーカスを移す。
- [x] 390px・1280pxで長い地点名を含む対象テストを実行し、操作が横の先に隠れないことを確認する。

### Task 4：画像入力の説明と失敗からの復帰を整える（R7）

**Files:** Modify `src/App.jsx`、`app-view.js`、`app-flow.js`、`src/styles.scss`。Test `e2e/carbon-accessibility.spec.js`、必要ならCreate `e2e/image-import-feedback.spec.js`。

**Interfaces:** `addFiles(files, kind)`、`analyzeUploads(): Promise<void>`、`showStatus(message: string, error?: boolean): void` の処理経路を使用する。ワーカーや解析プロンプトの変更は前提にしない。

- [x] `missingItineraryExplainsNextAction`：ルートだけの場合、何を追加すれば進めるか分かることを確認する。
- [x] `analysisFailureAllowsRetry`、`unsupportedImageShowsActionableError`：入力を保持し、失敗原因と再試行／画像差替えへ到達できることを確認する。
- [x] `completedAnalysisExplainsUnmetProgressionRequirements`：解析が終わっても行程が空なら「行程を読み取れませんでした」などの理由を示し、完了表示だけで終えない。正常時の次へは操作可能な状態と一致する。
- [x] 画像追加を見本の前に置く。必要枚数、複数の行程画像、自動解析の開始条件、外部解析について簡潔に説明する。
- [x] 見本は任意に開く補助へ移す。登録済み画像は小さなサムネイルと「ルート／行程1・2・3」、ファイル名、拡大・削除操作を持つ一覧へまとめる。画像の削除・差替え後も状態を一致させる。
- [x] 読み取り中／完了／失敗を操作の近くに表示し、支援技術にも伝える。説明なしの無効な「次へ」だけで終えない。
- [x] 対象テストを実行する。容量・解像度の一律閾値は、API制約や実測なしに追加しない。

### Task 5：確認画面を出力前確認として成立させる（R8）

**Files:** Modify `src/App.jsx`、`app-view.js`、`app-share.js`、`src/styles.scss`。Test `e2e/pdf-export.spec.js`、必要ならCreate `e2e/review-summary.spec.js`。

**Interfaces:** `renderDocument(): void` と `createPdfFile(): Promise<File>` を同じ入力状態に結び付ける。プレビューと共有用に別々の内容計算を作らない。

- [x] `summaryAndPreviewReflectLatestEdits`：基本情報・時刻調整・掲載地点・連絡先が要約とPDFで一致することを確認する。
- [x] 確認画面の先頭に重要情報の要約を置き、各情報の修正先へ戻れるようにする。空の3件目管轄は「管轄を追加」から開く。
- [x] 要約は日本語の日付・24時間表記の開始／終了・「6時間34分」のような所要時間・折り返して全文が読める集合場所を示す。入力側のネイティブUIとは表示契約を分ける。
- [x] AI抽出部分の説明と元画像への参照を置く。読み取り結果や自動補完された連絡先は確認対象であることを明示する。
- [x] PDFプレビューを任意に開けるようにし、保存環境では「PDFを保存」、共有できる環境では「PDFを共有」とする。主操作を競合させない。
- [x] 実際のPDF・対応端末の共有を対象テストで確認する。旧ブラウザでのプレビュー代替も確認する。

### Task 6：見た目の統一と最終受入（R9・全体）

**Files:** Modify `src/App.jsx`、`src/styles.scss`、必要に応じて `src/theme-shell.scss`。印刷用定義はUI変更の置換対象から除外する。

**Interfaces:** 上記タスクの挙動とDOMの名前を維持し、画面用レイアウト・タイプ・余白のみ整える。

- [x] Carbon Gridの列、標準フォームの32px列間、見出しと補足のタイプ、主操作と内容の揃えを適用する。
- [x] 「連絡先を保存」を「このブラウザに連絡先を保存」など保存先が分かる文言へ直す。保存しない場合の挙動を保持する。
- [ ] 最初の写真セットの `2-写真2.jpg` をルート、`3-写真3.jpg`〜`5-写真5.jpg` を行程として検証する。`1-写真1.jpg` はコピーも送信もしない。追加の画面スクリーンショットと取り違えない。
- [ ] 新画像の期待値は、8:00出発・14:34到着、6時間34分、9.6km、上り880m・下り878mを元画像と照合する。旧見本の7:00／13:34を流用しない。重複範囲による地点の二重取り込みを確認する。
- [ ] 390px・1280px、200〜400%ズーム、キーボード、スクリーンリーダー、通常／高コントラストで確認する。観測していない適合性を合格としない。
- [x] `npm.cmd run test`、対象E2E、`npm.cmd run build` を実行し、変更に関係する失敗を解消する。無関係な失敗は切り分けて記録する。
- [x] 新しいコードにCarbon MCP監査をかけ、残る指摘と採否理由を記録する。109件をゼロにすることだけを受入条件にしない。

## 計画作成時の引き継ぎ状態

計画作成ターンの時点では評価と計画のみで、アプリやスタイルは変更していなかった。

先に実施した公開見本での観察と、ユーザーが追加した11枚の画面を証拠として評価を更新した。ユーザー提供画面でPDF付きWindows共有画面の起動は確認できた。出力の不一致は「出力用DOMと準備状態の不整合」として報告し、実ファイルの内容が違ったとまでは断定しない。

## Luna実装結果（2026-10-15）

- Task 1〜5の実装とローカルE2Eを完了。変更内容はフォーム検証とPDF再生成、Carbon FileUploaderとテーマ設定のキーボード対応、行程カードとフォーカス維持、解析失敗時の再試行、確認要約・PDFプレビュー。
- Task 6のCarbon spacing/type適用、保存先が分かる連絡先設定文、320pxの狭幅と高コントラストの自動確認を実施。連続した行程詳細は計画どおり印刷PDF専用の組版を保持。
- `npm.cmd run test` は7件、`npm.cmd run test:e2e -- --reporter=line --workers=1` は23件、`npm.cmd run build` は成功。ビルドには既存Carbon Sassの非推奨警告、解決時に残るフォントURL、500KBを超えるバンドル警告が出る。
- Carbon MCPの最終監査は変更した6つの実装ファイルを対象に行い、113件（error 54、warning 39、info 20）を返した。監査のerrorは実行時エラー件数ではない。ThemeProvider祖先（`main.jsx`のproviderを単一ファイル解析が見落とす）、ラベルで関連付けたネイティブselect、実行時に`aria-describedby`を付ける検証エラーは誤検知として不採用。色・書体の多くは固定紙面のPDF契約なのでUIテーマへ置換しない。CSSの16/8列グリッドはCarbonの列幅に合わせており、モバイルの1地点カードは横スクロールを避ける判断として維持。一方、すべての既存余白・文字サイズをトークン化する作業は未実施であり、残件として認識する。
- 添付写真の実解析確認は、誤選択された `1-写真1.jpg` を参照せず `2-写真2.jpg`〜`5-写真5.jpg` のみを選んで一度試行したが、解析サービスが60秒以内に応答しなかった。コード側には45秒タイムアウトと再試行案内を追加した。実解析結果の期待値照合、200〜400%実ズーム、スクリーンリーダー実機は未確認のため、該当受入チェックは未完了のままとする。
- 公開反映は行っていない。
