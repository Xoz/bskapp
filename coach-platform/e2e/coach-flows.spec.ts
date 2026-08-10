import { expect, test } from "@playwright/test";

test("alla huvudvyer är åtkomliga för lokal tränarsession", async ({ page }) => {
  for (const path of ["/", "/planering", "/traningspass", "/kalender", "/ovningar", "/spelare", "/matcher", "/analys"]) {
    const response = await page.goto(path);
    expect(response?.ok(), `${path} svarade inte OK`).toBe(true);
    await expect(page.getByText("Planlinjen", { exact: true }).first()).toBeVisible();
  }
});

test("tränaren kan skapa, hitta och ta bort en övning", async ({ page }) => {
  const exerciseName = `E2E säker övning ${Date.now()}`;
  await page.goto("/ovningar");
  await page.getByText("+ Ny övning", { exact: true }).click();
  const createForm = page.locator("details.create-panel form");
  await createForm.getByPlaceholder("Namn").fill(exerciseName);
  await createForm.getByPlaceholder("Kort beskrivning").fill("Tillfällig verifieringsövning");
  await createForm.getByRole("button", { name: "Skapa" }).click();

  await page.getByLabel("Sök övning").fill(exerciseName);
  const card = page.locator("article.exercise-card").filter({ hasText: exerciseName });
  await expect(card).toHaveCount(1);
  await card.getByText("Redigera", { exact: true }).click();
  await card.getByRole("button", { name: "Ta bort" }).click();
  await expect(card).toHaveCount(0);
});

test("huvudtränaren kan exportera, begränsa och radera en testspelare", async ({ page }) => {
  const playerName = `GDPR Testspelare ${Date.now()}`;
  await page.goto("/spelare");
  await page.getByText("+ Lägg till spelare", { exact: true }).click();
  const createForm = page.locator("details.create-panel form");
  await createForm.getByPlaceholder("Namn").fill(playerName);
  await createForm.getByLabel("Födelseår").fill("2014");
  await createForm.getByRole("button", { name: "Lägg till" }).click();

  const card = page.locator("article.player-card").filter({ hasText: playerName });
  await expect(card).toHaveCount(1);
  const exportHref = await card.getByRole("link", { name: "Ladda ner spelarutdrag (JSON)" }).getAttribute("href");
  expect(exportHref).toBeTruthy();
  const exportResponse = await page.request.get(exportHref!);
  expect(exportResponse.ok()).toBe(true);
  const exported = await exportResponse.json();
  expect(exported.schemaVersion).toBe(1);
  expect(exported.player.name).toBe(playerName);

  await card.getByRole("button", { name: "Begränsa behandling" }).click();
  await expect(card.getByText("BEGRÄNSAD", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await card.getByText("Permanent radering", { exact: true }).click();
  await card.locator('input[name="confirmation"]').fill(playerName);
  await card.getByRole("button", { name: "Radera permanent" }).click();
  await expect(card).toHaveCount(0);
});
