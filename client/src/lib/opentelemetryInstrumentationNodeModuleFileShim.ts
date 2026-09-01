export class InstrumentationNodeModuleFile {
  name: string;
  supportedVersions: readonly string[];
  patch: unknown;
  unpatch: unknown;

  constructor(
    name: string,
    supportedVersions: readonly string[],
    patch: unknown,
    unpatch: unknown,
  ) {
    this.name = name;
    this.supportedVersions = supportedVersions;
    this.patch = patch;
    this.unpatch = unpatch;
  }
}
