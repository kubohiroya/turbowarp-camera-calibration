import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import packageMetadata from '../package.json';
import * as runtimeEntry from '../src/runtime.js';
import {extensionConfig} from '../src/config.js';

const ENTRY = new URL('../src/runtime.ts', import.meta.url);

/**
 * The surface another extension imports instead of declaring its own copy.
 *
 * A copy is checked against nothing: this package could change the shape, the
 * consumer would still typecheck, and the mismatch would surface in a browser.
 * This repository has already paid for that once in the other direction -- its
 * hand-written copy of Camera Source's registry named a method Camera Source
 * does not have -- so the entry is guarded rather than trusted.
 */
describe('the published runtime sub-entry', () => {
  it('is exposed under ./runtime, alongside the bundle and nothing else', () => {
    expect(packageMetadata.exports['./runtime']).toEqual({
      types: './lib/runtime.d.ts',
      default: './lib/runtime.js'
    });
    // No "." entry: the extension is loaded by URL from TurboWarp rather than
    // imported, and exposing it would let a stray bare import pull eleven
    // megabytes of OpenCV into a consumer's bundle.
    expect(Object.keys(packageMetadata.exports)).toEqual([
      './camera-calibration.js',
      './runtime',
      './package.json'
    ]);
    expect(packageMetadata.files).toContain('lib/');
  });

  it('does not claim the package is free of side effects', () => {
    // src/index.ts calls Scratch.extensions.register.
    expect(packageMetadata.sideEffects).toEqual(['src/index.ts', 'dist/*']);
  });

  it('publishes exactly the names a consumer is meant to reach for', () => {
    expect(Object.keys(runtimeEntry).sort()).toEqual([
      // The shape of the progress ladder, so a consumer sonifying or drawing
      // it does not write the numbers down and then disagree with the source.
      'BOARDS',
      'CALIBRATION_GATES',
      'CALIBRATION_PROGRESS_STEPS',
      'CALIBRATION_STEPS_PER_GATE',
      // The board, drawn. Published so an app that shows or prints one is
      // showing the board this extension looks for, and not its own drawing
      // of the same idea.
      'MARKER_RATIO',
      'PRINT_HEIGHT_MM',
      'PRINT_WIDTH_MM',
      'boardName',
      'cameraCalibrationExtensionId',
      'createRuntimeCapability',
      'layout',
      'patternSvg',
      'printedCellMillimetres',
      'readCameraCalibrationCapability',
      'runtimeCapabilityKey',
      'runtimeCapabilityVersion'
    ]);
    expect(runtimeEntry.runtimeCapabilityKey).toBe('kubohiroyaCameraCalibrationCapability');
    expect(runtimeEntry.runtimeCapabilityVersion).toBe(4);
  });

  it('agrees with the extension about its own identity', () => {
    expect(runtimeEntry.cameraCalibrationExtensionId).toBe(extensionConfig.id);
  });

  it('reaches only declarations and the board it draws', () => {
    // Anything reachable from here is paid for by every consumer. The
    // controller is deliberately absent: it reaches Camera Source and, on its
    // first sample, the OpenCV build.
    //
    // The two board modules are the exception, and they are here on purpose
    // rather than by drift: drawing the board is a thing consumers ask this
    // entry for, and the drawing has to come from the same numbers as the
    // detector or the two agree only until one of them changes. They are
    // arithmetic and string building over a fifty-entry table -- no document,
    // no camera, no WebAssembly.
    expect(reachableFrom(ENTRY).sort()).toEqual([
      'src/board/aruco.ts',
      'src/board/pattern.ts',
      'src/calibration/contract.ts',
      'src/calibration/types.ts',
      'src/runtime-capability.ts',
      'src/runtime.ts'
    ]);
  });

  it('keeps the board drawing as small as it claims to be', () => {
    // The claim above is "arithmetic and a table". If either module grows a
    // dependency, every consumer that only wanted to print a sheet pays for
    // it, and the sentence in the test above stops being true.
    for (const module of ['src/board/pattern.ts', 'src/board/aruco.ts']) {
      const source = readFileSync(new URL(`../${module}`, import.meta.url), 'utf8');
      for (const global of ['document', 'window', 'navigator', 'Scratch', 'require(']) {
        expect(source, module).not.toContain(global);
      }
      expect(source.match(/^import /gmu) ?? []).toHaveLength(
        module.endsWith('pattern.ts') ? 1 : 0
      );
    }
  });

  it('imports no package a consumer would have to carry', () => {
    for (const file of reachableFrom(ENTRY)) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      for (const match of source.matchAll(/from\s+'([^']+)'/gu)) {
        const specifier = match[1] as string;
        expect(specifier, `${file} imports ${specifier}`).toMatch(/^\./u);
      }
    }
  });

  it('reaches for nothing a browser has to provide', () => {
    // Comments are stripped first: the prose here talks about Scratch and about
    // OpenCV precisely because the code must not touch either, and a guard that
    // failed on the explanation would be argued away rather than kept.
    for (const file of reachableFrom(ENTRY)) {
      const code = withoutComments(
        readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      );
      for (const global of ['document', 'window', 'navigator', 'Scratch', 'requestAnimationFrame']) {
        expect(code, `${file} must not reach ${global}`).not.toMatch(
          new RegExp(`\\b${global}\\b`, 'u')
        );
      }
    }
  });

  it('narrows a runtime that carries the capability', () => {
    const capability = {requireVersion: () => capability, version: 1};
    expect(
      runtimeEntry.readCameraCalibrationCapability({
        [runtimeEntry.runtimeCapabilityKey]: capability
      })
    ).toBe(capability);
  });

  it('reads an absent extension as absent rather than throwing', () => {
    expect(runtimeEntry.readCameraCalibrationCapability({})).toBeUndefined();
    expect(runtimeEntry.readCameraCalibrationCapability(undefined)).toBeUndefined();
    expect(
      runtimeEntry.readCameraCalibrationCapability({
        [runtimeEntry.runtimeCapabilityKey]: {}
      })
    ).toBeUndefined();
  });
});

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
}

/** Every repository file reachable from an entry by static import, transitively. */
function reachableFrom(entry: URL): string[] {
  const root = new URL('../', import.meta.url);
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop() as URL;
    const relative = fileURLToPath(current).slice(fileURLToPath(root).length);
    if (seen.has(relative)) continue;
    seen.add(relative);
    const source = readFileSync(current, 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'/gu)) {
      const specifier = match[1] as string;
      // Bare specifiers are another package's problem; only this repository's
      // own files are walked.
      if (!specifier.startsWith('.')) continue;
      queue.push(new URL(specifier.replace(/\.js$/u, '.ts'), current));
    }
  }
  return [...seen];
}
