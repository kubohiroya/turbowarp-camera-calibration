import {DICT_4X4_50} from './board/aruco.js';
import {parseFixedNumberInput} from '@kubohiroya/turbowarp-extension-data-editor';
import type {FixedInputBinding, FixedInputEditorOptions, FixedBlockSnapshot, JsonValue, LiteralValue} from '@kubohiroya/turbowarp-extension-data-editor';
import {fixedInputBundle} from './fixed-input-schema.js';

const invalid = () => [{message: 'Invalid fixed input.'}];
function number(value: JsonValue | LiteralValue): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && value.trim() === '')) throw new TypeError('Unrepresentable numeric literal.');
  const result = Number(value);
  if (!Number.isFinite(result)) throw new TypeError('Nonfinite numeric literal.');
  return result;
}
function snapshotNumber(snapshot: FixedBlockSnapshot, argument: string): number {
  const slot = snapshot.arguments[argument];
  if (slot?.kind !== 'literal') throw new TypeError('A related literal is required.');
  return number(slot.value);
}
function numericBinding(opcode: string, argument: string): FixedInputBinding {
  return {argument, schemaBundle: fixedInputBundle(opcode, argument), control: {label: argument, kind: 'number'}, read: number,
    encode(value) {
      const parsed = parseFixedNumberInput(value);
      if (parsed.kind !== 'valid') throw new TypeError('Invalid numeric token.');
      return parsed.token;
    },
    validateCandidate(candidate, _context, finalSnapshot) {
      try { number(candidate); return ownerCheck(opcode, argument, candidate, finalSnapshot) ? [] : invalid(); }
      catch { return invalid(); }
    }};
}
function enumBinding(opcode: string, argument: string, choices: readonly string[], normalization: 'none'|'trim'|'trim-lower'): FixedInputBinding {
  const project = (value: JsonValue|LiteralValue) => {
    if (typeof value !== 'string') return value;
    const normalized = normalization === 'none' ? value : normalization === 'trim' ? value.trim() : value.trim().toLowerCase();
    return choices.includes(normalized) ? normalized : value;
  };
  return {argument, schemaBundle: fixedInputBundle(opcode, argument), control: {label: argument, kind: 'enum', choices: choices.map(value=>({value}))},
    read: project,
    encode(value) { if(typeof value !== 'string' || !choices.includes(value)) throw new TypeError('Choose a known value.'); return value; },
    validateCandidate(candidate, _context, finalSnapshot) {
      try {return typeof candidate === 'string' && choices.includes(candidate) && ownerCheck(opcode, argument, candidate, finalSnapshot) ? [] : invalid();}
      catch {return invalid();}
    }};
}
// Static pair predicates from calibration/controller.ts:normalizeBoard. No controller/worker calls.
function ownerCheck(_opcode: string, argument: string, candidate: LiteralValue, snapshot: FixedBlockSnapshot): boolean {
  if (argument === 'COLUMNS' || argument === 'ROWS') {
    const columns = argument === 'COLUMNS' ? number(candidate) : snapshotNumber(snapshot, 'COLUMNS');
    const rows = argument === 'ROWS' ? number(candidate) : snapshotNumber(snapshot, 'ROWS');
    return Number.isInteger(columns) && Number.isInteger(rows) && columns>=3 && columns<=20 && rows>=3 && rows<=20 &&
      Math.floor(((columns+1)*(rows+1))/2) <= DICT_4X4_50.length;
  }
  if (argument === 'MARKER_METERS' || argument === 'SQUARE_METERS') {
    const marker = argument === 'MARKER_METERS' ? number(candidate) : snapshotNumber(snapshot, 'MARKER_METERS');
    const square = argument === 'SQUARE_METERS' ? number(candidate) : snapshotNumber(snapshot, 'SQUARE_METERS');
    return marker > 0 && square > 0 && square <= 1 && marker < square;
  }
  return true;
}

const extensionId = 'kubohiroyacameracalibration';
const validationContext = () => ({consumerId:'turbowarp-camera-calibration', nowMs:0, settings:null});
export const fixedInputEditors: readonly FixedInputEditorOptions[] = [
  {apiVersion: 1, extensionId, editorId: 'startCameraCalibration-fixed', opcodes: [`${extensionId}_startCameraCalibration`],
    contractId: 'turbowarp-camera-calibration/startCameraCalibration', contractRevision: '1', validationContext,
    readOnlyArguments: [],
    bindings: [
    numericBinding('startCameraCalibration', 'COLUMNS'),
    numericBinding('startCameraCalibration', 'ROWS'),
    numericBinding('startCameraCalibration', 'SQUARE_METERS'),
    numericBinding('startCameraCalibration', 'MARKER_METERS'),
    numericBinding('startCameraCalibration', 'MAX_ERROR_PX')
    ]
  },
  {apiVersion: 1, extensionId, editorId: 'measureCameraBoardPose-fixed', opcodes: [`${extensionId}_measureCameraBoardPose`],
    contractId: 'turbowarp-camera-calibration/measureCameraBoardPose', contractRevision: '1', validationContext,
    readOnlyArguments: [],
    bindings: [
    numericBinding('measureCameraBoardPose', 'COLUMNS'),
    numericBinding('measureCameraBoardPose', 'ROWS'),
    numericBinding('measureCameraBoardPose', 'SQUARE_METERS'),
    numericBinding('measureCameraBoardPose', 'MARKER_METERS'),
    enumBinding('measureCameraBoardPose', 'SCALE_SOURCE', ["nominal", "measured"], 'trim')
    ]
  }
];

interface RuntimeLifetime {
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
}

/** Register metadata only; the GUI startup capability owns editor activation. */
export function registerFixedInputEditors(
  scratch: unknown, definitions: readonly FixedInputEditorOptions[], runtimeOverride?: RuntimeLifetime
): () => void {
  const host = scratch as {gui?: {blockEditors?: {apiVersion?: number;
    registerFixedInputEditor?: (options: FixedInputEditorOptions) => () => void}};
    vm?: {runtime?: RuntimeLifetime}};
  const api = host.gui?.blockEditors;
  if (!definitions.length || api?.apiVersion !== 1 || typeof api.registerFixedInputEditor !== 'function') return () => {};
  const runtime = runtimeOverride ?? host.vm?.runtime;
  const removers: (() => void)[] = [];
  let active = true;
  const dispose = () => {
    if (!active) return;
    active = false;
    runtime?.off?.('RUNTIME_DISPOSED', dispose);
    for (const remove of removers.splice(0).reverse()) remove();
  };
  try {
    for (const definition of definitions) {
      const remove = api.registerFixedInputEditor.call(api, definition);
      if (typeof remove !== 'function') throw new TypeError('Invalid fixed input registration disposer.');
      removers.push(remove);
    }
    runtime?.on?.('RUNTIME_DISPOSED', dispose);
  } catch (error) {dispose(); throw error;}
  return dispose;
}
