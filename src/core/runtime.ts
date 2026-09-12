import type { Lifecycle } from "./types.js";

/** Owns feature lifetimes and isolates failures, including cleanup failures. */
export class FeatureRuntime {
  private features = new Map<Lifecycle, { name: string; critical: boolean }>();

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
        this.cleanup(name, feature);
        return null;
      }
      this.features.set(feature, { name, critical });
      return feature;
    } catch (error) {
      if (feature) this.cleanup(name, feature);
      this.report(name, error, critical);
      return null;
    }
  }

  /** Disable a failed feature before cleanup so later callbacks cannot reuse it. */
  run<T extends Lifecycle>(feature: T | null, action: (feature: T) => void) {
    if (!feature) return;
    const registration = this.features.get(feature);
    if (!registration) return;
    try {
      action(feature);
    } catch (error) {
      this.features.delete(feature);
      this.cleanup(registration.name, feature);
      this.report(registration.name, error, registration.critical);
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
    const features = [...this.features].reverse();
    this.features.clear();
    for (const [feature, { name }] of features) this.cleanup(name, feature);
  }
}
