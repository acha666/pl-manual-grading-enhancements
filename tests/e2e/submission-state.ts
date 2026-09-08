import { readFileSync } from "node:fs";

export interface SubmissionState {
  courseInstanceURL: string;
  assessmentId: string;
  instanceQuestionId: string;
}

export function readSubmissionState(): SubmissionState {
  return JSON.parse(
    readFileSync(new URL("./state/manifest.json", import.meta.url), "utf8"),
  );
}
