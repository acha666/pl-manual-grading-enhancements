import type { Lifecycle } from "./types.js";

/** Owns feature lifetimes and isolates failures, including cleanup failures. */
export class FeatureRuntime {
  private cleanups: (() => void)[] = [];

  constructor(
    private report: (name: string, error: unknown, critical: boolean) => void,
  ) {}

  mount<T extends Lifecycle>(
    name: string,
    create: () => T,
    critical = false,
  ): T | null {
    let feature: T | undefined;
    try {
      feature = create();
      if (feature.start() === false) {
        feature.stop();
        return null;
      }
      const active = feature;
      this.cleanups.push(() => this.cleanup(name, active));
      return feature;
    } catch (error) {
      if (feature) this.cleanup(name, feature);
      this.report(name, error, critical);
      return null;
    }
  }

  private cleanup(name: string, feature: Lifecycle) {
    try {
      feature.stop();
    } catch (error) {
      console.error(
        `Manual grading enhancement cleanup failed: ${name}.`,
        error,
      );
    }
  }

  stop() {
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
  }
}
