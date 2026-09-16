import {readFile, stat} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';

const bundleUrl = new URL('../dist/camera-calibration.js', import.meta.url);

describe('the committed extension bundle', () => {
  it('is one self-contained file with no module-level imports', async () => {
    const bundle = await readFile(bundleUrl, 'utf8');
    expect(bundle.startsWith('// Name: TurboWarp-Camera-Calibration')).toBe(true);
    // Node built-ins reached through the OpenCV build must be stubbed out, not
    // left as imports a browser cannot resolve.
    expect(bundle).not.toMatch(/(?:^|[^\w])(?:import|require)\s*\(?["'](?:fs|path|crypto)["']/mu);
    expect(bundle).not.toMatch(/^\s*import\s/mu);
  });

  it('carries the pinned OpenCV build and initializes it only on demand', async () => {
    const bundle = await readFile(bundleUrl, 'utf8');
    const {size} = await stat(bundleUrl);
    // The solver is the reason this extension is separate from Camera Source.
    //
    // This only says the bundle calls the name. It cannot say the OpenCV build
    // provides it -- embind registers those at run time, so they appear in
    // neither the bundle text nor opencv.js's text. An earlier version of this
    // line asserted `findChessboardCorners`, and passed for five releases while
    // that function was absent from the pinned build and no sample could be
    // taken at all. What proves the other half is a browser.
    expect(bundle).toContain('detectBoard');
    expect(bundle).toContain('calibrateCameraExtended');
    expect(size).toBeGreaterThan(5_000_000);
    // OpenCV lives behind a lazy CommonJS factory. Exactly one call site, and
    // it is the dynamic import inside the backend, so loading the extension or
    // reading the backend reporter never evaluates the WebAssembly runtime.
    const callSites = bundle.match(/require_opencv\(\)/gu) ?? [];
    expect(callSites).toHaveLength(1);
    expect(bundle).toMatch(/Promise\.resolve\(\)\.then\(\(\) => [^\n]*require_opencv\(\)/u);
  });
});
