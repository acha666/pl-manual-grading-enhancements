import type { Locator, Page } from '@playwright/test';

import * as sqldb from '@prairielearn/postgres';
import { IdSchema } from '@prairielearn/zod';

import { dangerousFullSystemAuthz } from '../../lib/authz-data-lib.js';
import { selectAssessmentByTid } from '../../models/assessment.js';
import { ensureUncheckedEnrollment } from '../../models/enrollment.js';
import { getOrCreateUser } from '../utils/auth.js';

import { expect, test } from './fixtures.js';

const sql = sqldb.loadSqlEquiv(import.meta.url);

const STUDENT = {
  uid: 'plmge_e2e_student@example.com',
  name: 'PLMGE E2E Student',
  uin: 'PLMGE001',
};

const MARKER = 'span[data-pl-manual-grading-enhancements][hidden]';
const RUBRIC_INPUT = 'input.js-selectable-rubric-item';
const RUBRIC_LABEL = 'label.js-selectable-rubric-item-label';
const FEEDBACK = 'textarea[name="submission_note"].js-submission-feedback';

let assessmentId: string;

async function addRubricItem(page: Page, rubricTable: Locator): Promise<Locator> {
  const rubricRows = rubricTable
    .locator('tr')
    .filter({ has: page.getByRole('spinbutton', { name: 'Points' }) });
  const previousRowCount = await rubricRows.count();

  await expect(async () => {
    if ((await rubricRows.count()) === previousRowCount + 1) return;

    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(rubricRows).toHaveCount(previousRowCount + 1, { timeout: 2000 });
  }).toPass({ timeout: 10000 });

  return rubricRows.nth(previousRowCount);
}

function rubricItem(page: Page, visibleDescription: string): Locator {
  return page
    .locator(RUBRIC_LABEL)
    .filter({ hasText: visibleDescription })
    .locator(RUBRIC_INPUT);
}

test.describe.serial('PLMGE against a real PrairieLearn manual-grading page', () => {
  test.setTimeout(90000);

  test.beforeAll(async ({ courseInstance }) => {
    const student = await getOrCreateUser(STUDENT);

    await ensureUncheckedEnrollment({
      userId: student.id,
      courseInstance,
      authzData: dangerousFullSystemAuthz(),
      requiredRole: ['System'],
      actionDetail: 'implicit_joined',
    });

    const assessment = await selectAssessmentByTid({
      tid: 'hw9-internalExternalManual',
      course_instance_id: courseInstance.id,
    });
    assessmentId = assessment.id;
  });

  test('renders and exercises the element in the live upstream application', async ({
    page,
    baseURL,
    courseInstance,
  }) => {
    // Use the real student flow first. The controller must not activate in the
    // student question panel even though the question contains the element.
    await page.context().addCookies([
      { name: 'pl2_requested_uid', value: STUDENT.uid, url: baseURL },
      { name: 'pl2_requested_data_changed', value: 'true', url: baseURL },
    ]);

    await page.goto(`/pl/course_instance/${courseInstance.id}/assessments`);
    await page.getByRole('link', { name: 'Homework for Internal, External, Manual' }).click();
    await page
      .getByRole('link', { name: 'Manual Grading: Fibonacci function, file upload' })
      .click();
    await expect(page.locator(MARKER)).toHaveCount(0);

    // Submit through the real PrairieLearn endpoint so the instructor page has
    // an actual instance question to render.
    const csrfToken = await page.locator('form input[name="__csrf_token"]').first().inputValue();
    const variantId = await page.locator('form input[name="__variant_id"]').first().inputValue();
    const fileUploadName = await page
      .locator('input[name^="_file_upload"]')
      .first()
      .getAttribute('name');
    await page.request.post(page.url(), {
      form: {
        __csrf_token: csrfToken,
        __variant_id: variantId,
        __action: 'save',
        [fileUploadName!]: JSON.stringify([
          { name: 'fib.py', contents: Buffer.from('def fib(n): return n').toString('base64') },
        ]),
      },
    });

    await page.reload();
    await expect(page.locator('[data-testid="submission-status"] .badge').first()).toContainText(
      'waiting for grading',
    );

    await page.context().clearCookies();

    const iqId = await sqldb.queryScalar(
      sql.select_instance_question_for_manual_grading,
      { assessment_id: assessmentId, qid: 'manualGrade/codeUpload' },
      IdSchema,
    );
    const manualGradingIQUrl =
      `/pl/course_instance/${courseInstance.id}/instructor/assessment/${assessmentId}` +
      `/manual_grading/instance_question/${iqId}`;

    await page.goto(manualGradingIQUrl);
    await expect(page.locator(MARKER)).toHaveCount(1);
    await expect(page.locator('html[data-pl-manual-grading-enhancements]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Manual grading options' })).toBeVisible();
    await expect(page.locator(FEEDBACK)).toBeEditable();
    await expect(page.locator('#username-nav[data-view-type="instructor"]')).toContainText(
      'Dev User',
    );

    // Create a real rubric through the upstream rubric editor. The element is
    // then tested against the HTML returned by the upstream render endpoint.
    await page.locator('[aria-label="Toggle rubric settings"]').click();
    await expect(page.locator('#rubric-setting')).toBeVisible();
    const rubricTable = page.locator('#rubric-editor table[aria-label="Rubric items"] tbody');

    const openingExcellent = await addRubricItem(page, rubricTable);
    await openingExcellent.getByRole('spinbutton', { name: 'Points' }).fill('4');
    await openingExcellent
      .getByRole('textbox', { name: 'Description' })
      .fill('[Opening] Excellent');

    const openingAdequate = await addRubricItem(page, rubricTable);
    await openingAdequate.getByRole('spinbutton', { name: 'Points' }).fill('2');
    await openingAdequate
      .getByRole('textbox', { name: 'Description' })
      .fill('[Opening] Adequate');

    const headersComplete = await addRubricItem(page, rubricTable);
    await headersComplete.getByRole('spinbutton', { name: 'Points' }).fill('3');
    await headersComplete
      .getByRole('textbox', { name: 'Description' })
      .fill('[Headers] All required');

    const ungrouped = await addRubricItem(page, rubricTable);
    await ungrouped.getByRole('spinbutton', { name: 'Points' }).fill('0');
    await ungrouped.getByRole('textbox', { name: 'Description' }).fill('Ungrouped feedback');

    await page.locator('#rubric-setting').getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.js-main-grading-panel ' + RUBRIC_INPUT)).toHaveCount(4, {
      timeout: 10000,
    });

    // PrairieLearn replaces the grading panel in place after saving rubric
    // settings. Reload once so the element boots against the active-rubric
    // markup that graders see when they open the page normally.
    await page.reload();
    await expect(page.locator(MARKER)).toHaveCount(1);

    const criteria = page.locator('.plmge-criterion');
    await expect(criteria).toHaveCount(2);
    await expect(criteria.nth(0)).toContainText('Opening');
    await expect(criteria.nth(1)).toContainText('Headers');
    await expect(criteria.nth(0).locator(RUBRIC_INPUT)).toHaveCount(2);
    await expect(criteria.nth(1).locator(RUBRIC_INPUT)).toHaveCount(1);
    await expect(page.getByText('Ungrouped feedback', { exact: true })).toBeVisible();

    // Grouped items are mutually exclusive, and an incomplete criterion
    // blocks the actual manual-grade form submission.
    await rubricItem(page, 'Excellent').check();
    await rubricItem(page, 'Adequate').check();
    await expect(rubricItem(page, 'Excellent')).not.toBeChecked();
    await expect(rubricItem(page, 'Adequate')).toBeChecked();

    await page.locator('#grade-button').click();
    await expect(page.locator('.plmge-error')).toContainText('Headers');
    await expect(page).toHaveURL(manualGradingIQUrl);

    await rubricItem(page, 'All required').check();
    await expect(page.locator('.plmge-error')).toBeHidden();

    // Exercise the real settings menu and its DOM effects.
    await page.getByRole('button', { name: 'Manual grading options' }).click();
    await expect(page.getByText('Independent panel scrolling', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Independent panel scrolling' }).check();
    await expect(page.locator('.plmge-layout.plmge-split-scroll')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Collapse completed criteria' }).check();
    await expect(criteria.nth(0).locator('.plmge-criterion-body')).toBeHidden();
    await expect(criteria.nth(1).locator('.plmge-criterion-body')).toBeHidden();

    // The attribution is added to the payload of the real grade request.
    await page.locator(FEEDBACK).fill('Correct solution.');
    const [gradeRequest] = await Promise.all([
      page.waitForRequest(
        (request) =>
          request.method() === 'POST' && request.url().includes('/manual_grading/instance_question/'),
      ),
      page.locator('#grade-button').click(),
    ]);
    const gradePayload = decodeURIComponent((gradeRequest.postData() ?? '').replace(/\+/g, ' '));
    expect(gradePayload).toContain('Graded by: Dev User');

    await page.waitForLoadState('load');
    await page.goto(manualGradingIQUrl);
    await expect(page.locator(FEEDBACK)).toHaveValue(/Graded by: Dev User/);
  });
});
