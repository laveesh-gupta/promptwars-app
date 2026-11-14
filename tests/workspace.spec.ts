import { expect, test } from '@playwright/test';

test('three roles, evidence and next-period action notes remain connected', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Load Sample Data', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Inspect the leading observed location' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: /Housing society/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Inspect entrance and onsite practices' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: /School Care|^School$/ }).click();
  await page
    .getByLabel('Verification note', { exact: true })
    .first()
    .fill('Arrival check recorded for next review.');
  await page.getByRole('button', { name: 'Explore period 2' }).click();
  await expect(
    page.getByText('Last check: Arrival check recorded for next review.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Market junction 104/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Society entrance 46.*No comparable change/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Follow the evidence' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/School gate,PM2.5,70/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Follow the evidence' })).toBeFocused();
});

test('Hindi documents and reading-level controls stay in the communication view', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Load Sample Data', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Communication', exact: true }).click();
  await page.getByRole('button', { name: 'हिन्दी', exact: true }).click();
  await expect(page.locator('article[lang="hi"]')).toContainText('स्थानीय');
  await page.getByRole('button', { name: 'Internal note', exact: true }).click();
  await expect(page.locator('article[lang="hi"]')).toContainText('स्थिति');
  await page
    .getByRole('combobox', { name: 'Reading level', exact: true })
    .selectOption('Standard');
  await expect(page.getByRole('heading', { name: 'Ready to communicate' })).toBeVisible();
  await expect(page.locator('article[lang="hi"]')).toContainText('आंतरिक कार्य-समीक्षा');
});

test('390px navigation is usable and file inputs stay hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('input[type=file]').first()).toBeHidden();
  await page.getByRole('button', { name: 'Readings & evidence', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Bring your local readings' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Brief history', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The local record' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('saved sample action notes survive reload and reopening history', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Load Sample Data', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Verification note', { exact: true })
    .first()
    .fill('Saved local check');
  await page.getByRole('button', { name: 'Save brief', exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vayumanak.history.v1') || '[]'),
  );
  expect(Object.values(saved[0].notes)).toContain('Saved local check');
  await page.reload();
  await page.getByRole('button', { name: 'Brief history', exact: true }).click();
  await page.getByRole('button', { name: 'Open brief', exact: true }).click();
  await expect(page.getByLabel('Verification note', { exact: true }).first()).toHaveValue(
    'Saved local check',
  );
});

test('dashboard filters, context confirmation and chart evidence stay local and accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Load Sample Data', exact: true })
    .first()
    .click();
  const dashboard = page.getByRole('region', { name: 'Evidence dashboard' });
  await expect(dashboard).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('dashboard-desktop.png'),
    fullPage: true,
  });
  let calls = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/generate')) calls++;
  });
  const before = await dashboard
    .getByRole('heading', { name: 'Which site needs a closer look?' })
    .isVisible();
  expect(before).toBe(true);
  await dashboard.getByLabel('Observed window start').selectOption({ index: 1 });
  await expect(dashboard.getByText('Filtered view', { exact: true })).toBeVisible();
  await expect(
    dashboard.getByText('Partial window: reset time filters to compare'),
  ).toBeVisible();
  await dashboard.getByRole('button', { name: 'Clear filters', exact: true }).click();
  const detail = dashboard.locator('.priority-detail').first();
  await detail.locator('summary').click();
  await detail.getByLabel('Confirmed sensitive-site context').selectOption('yes');
  await detail.getByLabel('Action within requester remit').selectOption('yes');
  await detail
    .getByLabel('Confirmation rationale')
    .fill('Confirmed by site coordinator for a local inspection.');
  await expect(detail.locator('summary')).toContainText('/ 100');
  await detail.getByRole('button', { name: /Inspect .* evidence/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(calls).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath('dashboard-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
});

test('bounded large dataset remains explorable', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Load Sample Data', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Save brief', exact: true }).click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('vayumanak.history.v1') || '[]');
    const b = saved[0];
    const template = b.dataset.observations[0];
    b.dataset.observations = Array.from({ length: 2000 }, (_, i) => ({
      ...template,
      id: `large-${i}`,
      line: 2 + Math.floor(i / 4),
      site: `Site ${i % 10}`,
      value: 20 + (i % 90),
      unit: 'µg/m³',
      timestamp: new Date(Date.UTC(2026, 10, 10, 0, i)).toISOString(),
      originalValue: 20 + (i % 90),
      originalUnit: 'µg/m³',
      flags: [],
    }));
    b.narrative = {
      summary: 'Inspect the supplied locations.',
      findings: [],
      actions: [
        {
          id: 'action-inspect',
          title: 'Inspect supplied sites',
          owner: 'Local coordinator',
          rationale: 'Check the source and conditions.',
          verification: 'Confirm sensor placement.',
          horizon: 'Next review',
          evidence: [],
          basis: 'Data repair',
        },
      ],
      internal: 'Review the supplied evidence.',
      citizen: 'Review the supplied evidence.',
      translated: 'स्थानीय समीक्षा',
      internalTranslated: 'स्थानीय समीक्षा',
    };
    localStorage.setItem('vayumanak.history.v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Brief history', exact: true }).click();
  const started = Date.now();
  await page.getByRole('button', { name: 'Open brief', exact: true }).click();
  const dashboard = page.getByRole('region', { name: 'Evidence dashboard' });
  await expect(dashboard.getByText(/2000 of 2000 supplied observations/)).toBeVisible();
  const opened = Date.now() - started;
  const filtered = Date.now();
  await dashboard.getByLabel('Site 0', { exact: true }).check();
  await expect(dashboard.getByText(/200 of 2000 supplied observations/)).toBeVisible();
  console.log(
    `Large dashboard: open ${opened} ms; filter ${Date.now() - filtered} ms (includes Playwright interaction/waits).`,
  );
});
