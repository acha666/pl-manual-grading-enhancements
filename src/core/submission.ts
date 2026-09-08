/** Native form submission without a submitter is treated as saving a grade. */
export function isGradeSubmission(event: SubmitEvent): boolean {
  const action =
    (event.submitter as HTMLButtonElement | HTMLInputElement | null)?.value ??
    "add_manual_grade";
  return action.startsWith("add_manual_grade");
}
