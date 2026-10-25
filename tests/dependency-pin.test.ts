import {describe, expect, it} from 'vitest';
import {isExactDependencyPin, isReviewedFamilyCaret} from '../scripts/dependency-pin.js';

describe('repository dependency pins', () => {
  it('allows caret ranges only for the two reviewed family packages', () => {
    expect(isReviewedFamilyCaret('@kubohiroya/turbowarp-camera-source', '^0.19.3')).toBe(true);
    expect(isReviewedFamilyCaret('@kubohiroya/turbowarp-extension-data-editor', '^0.2.1')).toBe(true);
    for (const name of ['comlink', '@kubohiroya/other', '__proto__']) {
      expect(isReviewedFamilyCaret(name, '^0.19.3'), name).toBe(false);
    }
    for (const specifier of ['~0.19.3', '^0.19.3 || 1.0.0', '^latest', '^0.19.3anything']) {
      expect(isReviewedFamilyCaret('@kubohiroya/turbowarp-camera-source', specifier), specifier).toBe(false);
    }
  });

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
