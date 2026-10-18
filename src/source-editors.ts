import type {SourceBinding, SourceEditorOptions, SourceValidation} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {extensionConfig} from './config.js';

function checkedSource(value: {source: string; result: {kind: 'valid' | 'invalid' | 'execution-error' | 'schema-error'; diagnostics: readonly {code: string; dataPath?: string}[]}}): SourceValidation {
  return value.result.kind === 'valid'
    ? {source: value.source, result: {kind: 'valid', diagnostics: []}}
    : {source: value.source, result: {kind: value.result.kind, diagnostics: value.result.diagnostics}};
}
import {calibrationSchemaBundles, decodeCalibrationSource, validateCalibrationSource} from './editor-schema.js';
export function createSourceEditorOptions(nowMs: () => number = Date.now): readonly SourceEditorOptions[] {
  const context = () => ({consumerId: extensionConfig.id, nowMs: nowMs(), settings: null});
  return [
    {apiVersion: 1, extensionId: extensionConfig.id, editorId: 'calibration-source', opcodes: ["importCameraCalibration", "cameraCalibrationJsonValid"].map(opcode => `${extensionConfig.id}_${opcode}`), bindings: [{argument: 'JSON', variants: Object.entries(calibrationSchemaBundles).map(([variantId, schemaBundle]) => ({variantId, format: variantId === 'ros' ? 'yaml' as const : 'json' as const, schemaBundle})), decode: source => {const decoded = decodeCalibrationSource(source); return {...decoded, data: decoded.data as ReturnType<SourceBinding['decode']>['data']};}, validateSource: (source, context) => checkedSource(validateCalibrationSource(source, context))}], validationContext: context}
  ];
}

/** Optional capability: old GUIs continue executing blocks without editor registration. */
export function registerSourceEditors(scratch: unknown, nowMs: () => number = Date.now): () => void {
  const api = (scratch as {gui?: {blockEditors?: {apiVersion?: number; registerSourceEditor?: (options: SourceEditorOptions) => () => void}}})?.gui?.blockEditors;
  if (api?.apiVersion !== 1 || typeof api.registerSourceEditor !== 'function') return () => {};
  const removers: (() => void)[] = [];
  try {
    for (const options of createSourceEditorOptions(nowMs)) removers.push(api.registerSourceEditor(options));
  } catch {
    for (const remove of removers.reverse()) remove();
    return () => {};
  }
  let active = true;
  return () => {if (active) {active = false; for (const remove of removers.reverse()) remove();}};
}
