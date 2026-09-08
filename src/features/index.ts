import type { Contract } from "../core/contract.js";
import { composeFeatures } from "./composition.js";

export function startFeatures(
  contract: Contract,
  report: (name: string, error: unknown, critical: boolean) => void,
) {
  return composeFeatures(contract, report);
}
