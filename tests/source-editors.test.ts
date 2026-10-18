import {createBlockEditorService} from '@kubohiroya/turbowarp-extension-data-editor/rjsf';
import {expect, it} from 'vitest';
import {createSourceEditorOptions, registerSourceEditors} from '../src/source-editors.js';
import definitions from '../src/block-definitions.json';
const targets: Record<string, readonly string[]> = {"importCameraCalibration": ["JSON"], "cameraCalibrationJsonValid": ["JSON"]};
it('covers every planned opcode and input against the actual block definitions', () => {
  const options = createSourceEditorOptions();
  const actual = options.flatMap(option => option.opcodes.flatMap(opcode => option.bindings.map(binding => `${opcode.slice(option.extensionId.length + 1)}.${binding.argument}`))).sort();
  expect(actual).toEqual(Object.entries(targets).flatMap(([opcode, arguments_]) => arguments_.map(argument => `${opcode}.${argument}`)).sort());
  for (const [opcode, arguments_] of Object.entries(targets)) {
    const block = definitions.blocks.find(block => block.opcode === opcode);
    expect(block).toBeDefined();
    for (const argument of arguments_) expect(block!.arguments).toHaveProperty(argument);
  }
});
it('skips old hosts, registers only through the optional source API, and removes once', () => {
  expect(() => registerSourceEditors({} )()).not.toThrow();
  expect(() => registerSourceEditors({gui: {blockEditors: {apiVersion: 1}}})()).not.toThrow();
  const seen: unknown[] = [];
  let removals = 0;
  const remove = registerSourceEditors({gui: {blockEditors: {apiVersion: 1, registerSourceEditor: (options: unknown) => {seen.push(options); return () => {removals++;};}}}});
  expect(seen.length).toBe(createSourceEditorOptions().length);
  remove(); remove(); expect(removals).toBe(seen.length);
});
it('keeps decode failures safe and preserves the exact source at owner validation', () => {
  const source = '{private-input broken';
  for (const definition of createSourceEditorOptions()) for (const binding of definition.bindings) {
    expect(() => binding.decode(source)).toThrow();
    const result = binding.validateSource(source, definition.validationContext());
    expect(result.source).toBe(source); expect(result.result.kind).toBe('invalid');
    expect(JSON.stringify(result.result)).not.toContain('private-input');
    expect(binding.variants.length).toBeGreaterThan(0);
  }
});

it('offers the existing four variants without converting their discriminator', () => {
 const binding = createSourceEditorOptions()[0]!.bindings[0]!;
 expect(binding.variants.map(variant => variant.variantId).sort()).toEqual(['camerasource','legacy','ros','twcs']);
 const source = ' {"schema":"camerasource/camera-intrinsics","unknown":true} ';
 expect(binding.decode(source)).toMatchObject({source, variantId: 'camerasource', data: {schema: 'camerasource/camera-intrinsics', unknown: true}});
});

it('registers and resolves every fully qualified opcode through the actual common service', () => {
  const service = createBlockEditorService();
  const remove = registerSourceEditors({gui: {blockEditors: service.api}});
  const options = createSourceEditorOptions();
  for (const option of options) for (const opcode of option.opcodes) {
    expect(opcode.startsWith(`${option.extensionId}_`)).toBe(true);
    expect(service.registry.resolve(opcode)).toMatchObject({extensionId: option.extensionId, editorId: option.editorId,
      editableArguments: option.bindings.map(binding => binding.argument)});
  }
  remove(); remove();
  for (const option of options) for (const opcode of option.opcodes) expect(service.registry.resolve(opcode)).toBeUndefined();
});
