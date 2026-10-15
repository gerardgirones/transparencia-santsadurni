import { test, expect, type Page } from "@playwright/test";

for (const path of ["/", "/contractes", "/empreses", "/subvencions", "/subvencions?view=convocatories&year=2026", "/transparencia", "/analisi"]) {
  test(`municipal page ${path}`, async ({page}) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("BDNS calls and granted subsidies remain separate municipal views", async ({page}) => {
  await page.goto("/subvencions");
  await expect(page.getByText("ENTITAT DE MOSTRA").first()).toBeVisible();
  await page.getByRole("link",{name:"Convocatòries (BDNS)",exact:true}).click();
  await expect(page.getByText("CONVOCATÒRIA MUNICIPAL DE MOSTRA")).toBeVisible();
  await expect(page.getByRole("link",{name:"Concessions publicades"})).toBeVisible();
});

test("analysis isolates a source failure and preserves its healthy sections", async ({page}) => {
  await page.goto("/analisi");
  await expect(page.getByRole("status").filter({hasText:"No s’ha pogut carregar el rànquing d’organismes"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"2) Pes dels contractes menors sobre el total"})).toBeVisible();
  await expect(page.getByText("Menors analitzats",{exact:true})).toBeVisible();
});

test("masked awardees have a neutral share image without combining identities", async ({request}) => {
  const response = await request.get("/empreses/***1234**/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("contract dates and sorting survive reloading and CSV export", async ({page, isMobile}) => {
  await page.goto("/contractes");
  if (isMobile) await page.getByRole("button",{name:/^Filtres/}).click();
  const from = page.getByLabel("Des de").filter({visible:true});
  await from.fill("2026-01-01");
  await page.getByLabel("Fins a").filter({visible:true}).fill("2026-10-15");
  if (isMobile) await page.getByRole("dialog").getByRole("button",{name:"Tanca",exact:true}).last().click();
  const sort = page.getByLabel("Ordenar per",{exact:true}).filter({visible:true});
  await sort.selectOption("amount-desc");
  await expect(page).toHaveURL(/sort=amount-desc/);
  await page.reload();
  await expect(page.getByLabel("Ordenar per",{exact:true}).filter({visible:true})).toHaveValue("amount-desc");
  await expect(page.getByRole("button",{name:/Treu el filtre Des de/})).toBeVisible();
  const csv = page.getByRole("link",{name:"Exporta CSV (vista actual)"});
  const href = await csv.getAttribute("href");
  expect(href).toContain("date_from=2026-01-01");
  expect(href).toContain("date_to=2026-10-15");
  expect(href).toContain("sort=amount-desc");
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  await page.screenshot({path:test.info().outputPath("contractes.png"),fullPage:false});
});

async function searchInput(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const element = document.querySelector("#home-search-input");
    return element && Object.keys(element).some(key => key.startsWith("__reactFiber"));
  });
  return page.locator("#home-search-input");
}

test("search errors offer retry and do not claim no results", async ({page}) => {
  let failing = true;
  await page.route("**/api/empreses?*", route => route.fulfill(failing
    ? {status:503,body:"temporary"}
    : {json:{data:[{identificacio_adjudicatari:"B08000002",denominacio_adjudicatari:"NETEJA PÚBLICA SL",total:"100",num_contracts:"1"}]}}));
  const input = await searchInput(page);
  await input.fill("neteja");
  await expect(page.getByRole("alert").filter({hasText:"No s’ha pogut completar la cerca"})).toBeVisible();
  await expect(page.getByText("No s'han trobat empreses.")).toHaveCount(0);
  failing = false;
  await page.getByRole("button",{name:"Torna-ho a provar"}).click();
  await expect(page.getByRole("link",{name:/NETEJA PÚBLICA SL/})).toBeVisible();
});

test("changing a search while a request runs keeps the loading state", async ({page}) => {
  let calls = 0;
  await page.route("**/api/empreses?*", async route => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.fulfill({json:{data:[{identificacio_adjudicatari:"B08000002",denominacio_adjudicatari:"NETEJA PÚBLICA SL",total:"100",num_contracts:"1"}]}});
  });
  const input = await searchInput(page);
  await input.fill("net");
  await expect.poll(() => calls).toBe(1);
  await input.fill("neteja");
  await expect(page.getByText("Cercant resultats...")).toBeVisible();
  await expect(page.getByText("No s'han trobat empreses.")).toHaveCount(0);
  await expect(page.getByRole("link",{name:/NETEJA PÚBLICA SL/})).toBeVisible();
});

test("phone navigation includes the municipal transparency and subsidy sections", async ({page,isMobile}) => {
  test.skip(!isMobile);
  await page.goto("/contractes");
  const nav = page.getByRole("navigation",{name:"Navegació principal mòbil"});
  await expect(nav.getByRole("link",{name:"Contractes"})).toHaveAttribute("aria-current","page");
  await expect(nav.getByRole("link",{name:"Subvencions"})).toBeVisible();
  await expect(nav.getByRole("link",{name:"Transparència"})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath("municipal-mobile.png"),fullPage:false});
});
