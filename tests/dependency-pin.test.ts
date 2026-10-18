import {describe, expect, it} from 'vitest';
import {isExactDependencyPin} from '../scripts/dependency-pin.js';

describe('repository dependency pins', () => {
  it('accepts exact package versions and both reviewed immutable Git artifacts', () => {
    expect(isExactDependencyPin('comlink', '4.4.2')).toBe(true);
    for (const name of ['turbowarp-extension-data-editor', 'turbowarp-camera-source']) {
      expect(isExactDependencyPin(
        `@kubohiroya/${name}`,
        `git+https://github.com/kubohiroya/${name}.git#${'a'.repeat(40)}`
      )).toBe(true);
    }
  });

  it('rejects ranges, mutable refs, short commits and unrelated Git packages or origins', () => {
    for (const specifier of ['^4.4.2', '~4.4.2', '4.4.2 || 4.4.3', '4.4.2anything', 'latest']) {
      expect(isExactDependencyPin('comlink', specifier), specifier).toBe(false);
    }
    const name = '@kubohiroya/turbowarp-camera-source';
    const origin = 'git+https://github.com/kubohiroya/turbowarp-camera-source.git#';
    for (const ref of ['main', 'v0.8.0', 'abc1234', 'a'.repeat(39), 'a'.repeat(41)]) {
      expect(isExactDependencyPin(name, `${origin}${ref}`), ref).toBe(false);
    }
    const fixed = `${origin}${'a'.repeat(40)}`;
    expect(isExactDependencyPin('comlink', fixed)).toBe(false);
    expect(isExactDependencyPin('__proto__', fixed)).toBe(false);
    expect(isExactDependencyPin(name, fixed.replace('kubohiroya/', 'another-owner/'))).toBe(false);
    expect(isExactDependencyPin(name, fixed.replace('github.com', 'other.example'))).toBe(false);
    expect(isExactDependencyPin(name, fixed.replace('camera-source.git', 'camera-source-other.git'))).toBe(false);
  });
});
