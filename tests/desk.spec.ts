/**
 * The important paths, end to end, on the sample company.
 *
 * The sample uses canned research (src/desk/sample.ts), so these specs
 * exercise the real actions, background job, quote verification, records,
 * permissions and realtime sync without one paid call.
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts. Create them with `npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin`.')

// Both specs that vote use the same two accounts and the same sample company, so run them one after the other.
test.describe.configure({ mode: 'serial' })

/** Add (or re-research) this member's sample company and wait for its scorecard. Returns the deal URL. */
async function sampleDeal(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/desk')
    await page.getByTestId('sample-button').click()
    await expect(page).toHaveURL(/\/deal\//, { timeout: 20_000 })
    await expect(page.getByTestId('score-panel')).toBeVisible({ timeout: 60_000 })
    // A run that crashed earlier may have left votes behind: start from a clean company.
    const dirty = (await page.getByTestId('committee').getAttribute('data-voting')) === 'revealed' || (await page.getByTestId('locked-count').textContent()) !== '0'
    if (!dirty) return page.url()
    await removeDeal(page)
  }
  throw new Error('Could not get a clean sample company')
}

async function removeDeal(page: Page) {
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByTestId('delete-deal').click()
  await expect(page).toHaveURL(/\/desk$/, { timeout: 20_000 })
}

async function vote(page: Page, decision: 'Invest' | 'Pass', conviction: string, reason: string) {
  await page.getByTestId('vote-form').getByLabel(decision).check()
  await page.getByLabel('Conviction').selectOption(conviction)
  await page.getByLabel('Your reason, in a sentence').fill(reason)
  await page.getByRole('button', { name: /Lock my vote|Change my vote/ }).click()
  await expect(page.getByTestId('my-vote-locked')).toContainText(decision, { timeout: 15_000 })
}

test('signed-out visitors can read the board but are asked to sign in to act', async ({ page }) => {
  await page.goto('/desk')
  await expect(page.getByRole('heading', { name: 'Pipeline' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('inline-sign-in')).toBeVisible()
  await expect(page.getByTestId('add-form')).toHaveCount(0)
})

test('research runs live and only verified quotes survive', async ({ users }) => {
  test.setTimeout(120_000)
  const [analyst] = await users(1)
  await sampleDeal(analyst.page)

  // 5 criteria, each backed by one quote found word for word in its source.
  await expect(analyst.page.getByTestId('criterion-row')).toHaveCount(5)
  await expect(analyst.page.locator('[data-testid="criterion-row"][data-scored="true"]')).toHaveCount(5)
  // The canned analysis contains 6 quotes and one of them is invented: the server must drop it.
  await expect(analyst.page.getByTestId('evidence')).toHaveCount(5)
  await expect(analyst.page.getByTestId('verification-line')).toContainText('Verified 5 of 6 quotes')
  await expect(analyst.page.getByText('Churn is below one percent')).toHaveCount(0)
  // The scorecard says a quote was removed, without repeating the unverified claim.
  await expect(analyst.page.getByTestId('dropped-note')).toHaveCount(1)
  await expect(analyst.page.getByTestId('dropped-note')).toContainText('1 quote the analyst cited was not found')
  // Both sides are argued, and the bear point with an invented quote did not survive.
  await expect(analyst.page.getByTestId('bull').getByTestId('case-point')).toHaveCount(2)
  await expect(analyst.page.getByTestId('bear').getByTestId('case-point')).toHaveCount(1)
  await expect(analyst.page.getByText('American rivals')).toHaveCount(0)
  // (9×9 + 7×7 + 7×8 + 8×8 + 5×5) ÷ 36 × 10 = 76
  await expect(analyst.page.getByTestId('score-panel').getByTestId('total-score')).toContainText('76')

  // What-if weights re-score in the browser: with risk weighted 0 the same company scores 81.
  await analyst.page.goto('/desk')
  await analyst.page.getByTestId('weight-risk').fill('0')
  await expect(analyst.page.getByTestId('what-if-note')).toBeVisible()
  await expect(analyst.page.getByTestId('deal-row').filter({ hasText: 'Tablo (sample)' }).first().getByTestId('total-score')).toContainText('81')

  // The public feed recorded the run, and the stage view files the company under Screening.
  await expect(analyst.page.locator('[data-testid="activity-row"][data-kind="scored"]').first()).toContainText('76/100, with 5 of 6 quotes verified')
  await analyst.page.getByTestId('view-stages').click()
  await expect(analyst.page.locator('[data-testid="stage-column"][data-stage="screening"]')).toContainText('Tablo (sample)')
  // And the map places it as a bubble that links to its scorecard.
  await analyst.page.getByTestId('view-map').click()
  await expect(analyst.page.getByTestId('map-bubble').filter({ hasText: 'Tablo (sample)' }).first()).toBeVisible()
})

test('the committee vote is blind until the reveal, then live for everyone', async ({ users }) => {
  test.setTimeout(150_000)
  const [lead, member] = await users(2)
  const dealUrl = await sampleDeal(lead.page)
  await member.page.goto(dealUrl)
  await expect(member.page.getByTestId('score-panel')).toBeVisible({ timeout: 20_000 })

  await vote(lead.page, 'Invest', '4', 'Sticky product and a clear path into two new countries.')
  // The other member sees the count move without a refresh, and nothing else.
  await expect(member.page.getByTestId('locked-count')).toHaveText('1', { timeout: 15_000 })
  // Not hidden by the screen: the server sent this browser zero ballots.
  await expect(member.page.getByTestId('committee')).toHaveAttribute('data-ballots-received', '0')
  await expect(member.page.getByText('Sticky product and a clear path')).toHaveCount(0)
  await expect(member.page.getByTestId('reveal-button')).toHaveCount(0)

  await vote(member.page, 'Pass', '2', 'The payment fee dispute could push churn up this year.')
  await expect(lead.page.getByTestId('locked-count')).toHaveText('2', { timeout: 15_000 })
  // Two votes exist; each member has received only their own.
  await expect(lead.page.getByTestId('committee')).toHaveAttribute('data-ballots-received', '1')
  await expect(member.page.getByTestId('committee')).toHaveAttribute('data-ballots-received', '1')
  await expect(lead.page.getByText('The payment fee dispute')).toHaveCount(0)

  // Reveal: both ballots appear on the other member's open page.
  await lead.page.getByTestId('reveal-button').click()
  // The other member did nothing, and the result is announced on their screen. 1 vote each, conviction 4 against 2: Invest.
  await expect(member.page.getByTestId('reveal-moment')).toContainText('Invest', { timeout: 20_000 })
  await expect(member.page.getByTestId('reveal-moment')).toContainText('Invest 1 · Pass 1')
  await member.page.getByRole('button', { name: 'See the ballots' }).click()
  await lead.page.getByRole('button', { name: 'See the ballots' }).click()
  await expect(member.page.getByTestId('vote-result')).toContainText('Invest 1', { timeout: 20_000 })
  await expect(member.page.getByTestId('vote-result')).toContainText('Pass 1')
  await expect(member.page.getByTestId('ballot')).toHaveCount(2)
  await expect(member.page.getByTestId('committee')).toHaveAttribute('data-ballots-received', '2')
  await expect(member.page.getByText('Sticky product and a clear path')).toBeVisible()
  await expect(member.page.getByTestId('vote-form')).toHaveCount(0)

  // The feed told everyone a vote was locked and how the reveal ended, never who voted what before it.
  await member.page.goto('/desk')
  await expect(member.page.locator('[data-testid="activity-row"][data-kind="revealed"]').first()).toContainText('Invest 1, Pass 1')
  await expect(member.page.locator('[data-testid="activity-row"][data-kind="voted"]').first()).toContainText('locked a vote on Tablo (sample)')

  await removeDeal(lead.page)
})

test('two companies can be compared side by side, and members see who else is at the desk', async ({ users }) => {
  test.setTimeout(150_000)
  const [lead, member] = await users(2)
  const leadDeal = await sampleDeal(lead.page)
  const memberDeal = await sampleDeal(member.page)

  await lead.page.goto('/desk')
  await member.page.goto('/desk')
  // Presence: each member is told the other one has the desk open (first name only).
  await expect(lead.page.getByTestId('presence-line')).toContainText('Test', { timeout: 20_000 })

  const picks = lead.page.getByTestId('compare-pick')
  await picks.nth(0).check()
  await expect(lead.page.getByTestId('compare-bar')).toContainText('Tick one more')
  await picks.nth(1).check()
  await lead.page.getByTestId('compare-link').click()
  await expect(lead.page).toHaveURL(/\/compare\?ids=/)
  await expect(lead.page.getByTestId('compare-legend').getByRole('listitem')).toHaveCount(2)
  // 5 criteria, the weighted total, and 6 profile lines.
  await expect(lead.page.getByTestId('compare-table').locator('tbody tr')).toHaveCount(12)

  // Each member removes their own sample so the next run starts clean.
  await lead.page.goto(leadDeal)
  await removeDeal(lead.page)
  await member.page.goto(memberDeal)
  await removeDeal(member.page)
})

test('a member cannot manage a company someone else added, and cannot change the thesis', async ({ users }) => {
  test.setTimeout(120_000)
  const [lead, member] = await users(2)
  const dealUrl = await sampleDeal(lead.page)
  const dealId = dealUrl.split('/').pop()

  // Borrow the member's own bearer token from a normal request, then try the owner-only actions with it.
  await member.page.goto('/desk')
  await member.page.getByLabel('Company name').fill('x')
  await member.page.getByLabel('Website').fill('localhost')
  const ownRequest = member.page.waitForRequest((r) => r.url().endsWith('/api/actions/addDeal'))
  // The form's own button: the scouted companies below the pipeline have a "Research it" each as well.
  await member.page.getByTestId('add-form').getByRole('button', { name: 'Research it' }).click()
  const authorization = (await ownRequest).headers()['authorization']
  await expect(member.page.getByTestId('form-error')).toContainText('address of the company website')

  const call = async (action: string, data: Record<string, unknown>) =>
    (await (await member.page.request.post(`/api/actions/${action}`, { headers: { Authorization: authorization }, data })).json()) as { success: boolean; error?: string }

  for (const action of ['deleteDeal', 'revealVotes', 'rerunResearch']) {
    const reply = await call(action, { dealId })
    expect(reply.success, action).toBe(false)
    expect(reply.error, action).toContain('Only the member who added this company')
  }
  expect(await call('saveThesis', { criteria: [{ key: 'risk', weight: 10 }] })).toMatchObject({ success: false, error: 'Only an admin can change the desk thesis.' })
  expect(await call('castVote', { dealId, decision: 'invest', conviction: 9, reason: 'Too enthusiastic to be valid.' })).toMatchObject({ success: false })

  await removeDeal(lead.page)
})
