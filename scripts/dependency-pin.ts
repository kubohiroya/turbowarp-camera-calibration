const GIT_ARTIFACT_PREFIXES: Readonly<Record<string, string>> = {
  '@kubohiroya/turbowarp-extension-data-editor':
    'git+https://github.com/kubohiroya/turbowarp-extension-data-editor.git#',
  '@kubohiroya/turbowarp-camera-source':
    'git+https://github.com/kubohiroya/turbowarp-camera-source.git#'
};

export function isExactDependencyPin(name: string, specifier: string): boolean {
  if (/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/iu.test(specifier)) return true;
  const prefix = Object.hasOwn(GIT_ARTIFACT_PREFIXES, name)
    ? GIT_ARTIFACT_PREFIXES[name]
    : undefined;
  return prefix !== undefined && specifier.startsWith(prefix) &&
    /^[\da-f]{40}$/u.test(specifier.slice(prefix.length));
}
