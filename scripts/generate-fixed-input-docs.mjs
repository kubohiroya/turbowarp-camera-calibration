import {URL} from 'node:url';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import process from 'node:process';
const root = new URL('../', import.meta.url);
const help = {"startCameraCalibration": "COLUMNS・ROWS・SQUARE_METERS・MARKER_METERS・MAX_ERROR_PXを固定フォームで編集します。数値は有限数値の完全なJSON表記を使用し、範囲と静的な関連入力を検証します。enumは既知候補から選択します。未変更の空白・大小文字・数値表記は原文を保持し、reporterは評価しません。対象外の入力は変更しません。COLUMNS/ROWSのmarker数は辞書50件以内、0<MARKER_METERS<SQUARE_METERS<=1を最終候補の組で検証します。関連reporterは評価せず編集を拒否します。", "measureCameraBoardPose": "COLUMNS・ROWS・SQUARE_METERS・MARKER_METERS・SCALE_SOURCEを固定フォームで編集します。数値は有限数値の完全なJSON表記を使用し、範囲と静的な関連入力を検証します。enumは既知候補から選択します。未変更の空白・大小文字・数値表記は原文を保持し、reporterは評価しません。対象外の入力は変更しません。COLUMNS/ROWSのmarker数は辞書50件以内、0<MARKER_METERS<SQUARE_METERS<=1を最終候補の組で検証します。関連reporterは評価せず編集を拒否します。"};
const check = process.argv.includes('--check');
const start = '<!-- BEGIN FIXED INPUT {"startCameraCalibration": "COLUMNS・ROWS・SQUARE_METERS・MARKER_METERS・MAX_ERROR_PXを固定フォームで編集します。数値は有限数値の完全なJSON表記を使用し、範囲と静的な関連入力を検証します。enumは既知候補から選択します。未変更の空白・大小文字・数値表記は原文を保持し、reporterは評価しません。対象外の入力は変更しません。COLUMNS/ROWSのmarker数は辞書50件以内、0<MARKER_METERS<SQUARE_METERS<=1を最終候補の組で検証します。関連reporterは評価せず編集を拒否します。", "measureCameraBoardPose": "COLUMNS・ROWS・SQUARE_METERS・MARKER_METERS・SCALE_SOURCEを固定フォームで編集します。数値は有限数値の完全なJSON表記を使用し、範囲と静的な関連入力を検証します。enumは既知候補から選択します。未変更の空白・大小文字・数値表記は原文を保持し、reporterは評価しません。対象外の入力は変更しません。COLUMNS/ROWSのmarker数は辞書50件以内、0<MARKER_METERS<SQUARE_METERS<=1を最終候補の組で検証します。関連reporterは評価せず編集を拒否します。"} -->';
const end = '<!-- END FIXED INPUT {"startCameraCalibration": "COLUMNS・ROWS・SQUARE_METERS・MARKER_METERS・MAX_ERROR_PXを固定フォームで編集します。数値は有限数値の完全なJSON表記を使用し、範囲と静的な関連入力を検証します。enumは既知候補から選択します。未変更の空白・大小文字・数値表記は原文を保持し、reporterは評価しません。対象外の入力は変更しません。COLUMNS/ROWSのmarker数は辞書50件以内、0<MARKER_METERS<SQUARE_METERS<=1を最終候補の組で検証します。関連reporterは評価せず編集を拒否します。", "measureCameraBoardPose": "COLUMNS・ROWS・SQUARE_METERS・MARKER_METERS・SCALE_SOURCEを固定フォームで編集します。数値は有限数値の完全なJSON表記を使用し、範囲と静的な関連入力を検証します。enumは既知候補から選択します。未変更の空白・大小文字・数値表記は原文を保持し、reporterは評価しません。対象外の入力は変更しません。COLUMNS/ROWSのmarker数は辞書50件以内、0<MARKER_METERS<SQUARE_METERS<=1を最終候補の組で検証します。関連reporterは評価せず編集を拒否します。"} -->';
const target = new URL('docs/index.html', root);
let current = await readFile(target, 'utf8');
let next = current;
for (const [opcode, text] of Object.entries(help)) {
  const article = new RegExp(`(<article id="block-${opcode}"[^>]*>)([\\s\\S]*?)(</article>)`);
  if (!article.test(next)) throw new Error(`Missing stable block anchor: ${opcode}`);
  next = next.replace(article, (_all, opening, body, closing) => opening + body.replace(new RegExp(`${start}[\\s\\S]*?${end}`), '') +
    `${start}<p id="fixed-input-${opcode}">${text} GUIのDialogs/FixedInputsは起動時既定OFFです。有効にして再読込すると利用できます。</p>${end}` + closing);
}
if(check) {if(current!==next) throw new Error('Fixed input help is out of date.');}
else await writeFile(target, next);
const schema = await readFile(new URL('schemas/block-editor-fixed-inputs.schema.json', root));
const output = new URL('docs/schemas/block-editor-fixed-inputs.schema.json', root);
if(check) {if(!(await readFile(output)).equals(schema)) throw new Error('Generated Schema differs.');}
else {await mkdir(new URL('docs/schemas/',root),{recursive:true}); await writeFile(output,schema);}
