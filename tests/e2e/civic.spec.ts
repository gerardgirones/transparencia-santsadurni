import {test,expect} from "@playwright/test";

test("plenary catalogue filters by year and opens a sourced digest", async ({page}) => {
  await page.goto("/plens");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Resums dels plens");
  await page.getByLabel("Any de la sessió").selectOption("2026");
  await page.getByRole("button",{name:"Filtra",exact:true}).click();
  await expect(page.getByRole("link",{name:"Llegir resum"})).toHaveCount(1);
  await page.getByRole("link",{name:"Llegir resum"}).click();
  await expect(page.getByRole("heading",{level:1})).toContainText("26/05/2026");
  await expect(page.getByRole("heading",{name:/Aprovacio d[’']una subvencio cultural/})).toBeVisible();
  await expect(page.getByText("A favor: 15, En contra: 0, Abstencions: 1",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:/Veure el punt a l’acta/}).first()).toHaveAttribute("href",/#page=1$/);
  await page.screenshot({path:test.info().outputPath("resum-ple.png")});
});

test("unknown plenary id shows not found instead of a fabricated digest", async ({page}) => {
  await page.goto("/plens/does-not-exist");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Acta no trobada");
  await expect(page.getByText("Punt 1",{exact:false})).toHaveCount(0);
});

test("review covers complete source catalogues and explains findings with evidence", async ({page}) => {
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/revisio");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Revisió ciutadana");
  await expect(page.getByText("Revisió parcial:",{exact:false})).toHaveCount(0);
  await page.getByLabel("Dades",{exact:true}).selectOption("subvencions");
  await page.getByRole("button",{name:"Filtra avisos"}).click();
  await expect(page.getByRole("heading",{name:"Concessions coincidents dins d’una convocatòria"})).toBeVisible();
  await page.getByText("Veure els 2 registres i les fonts",{exact:true}).click();
  await expect(page.getByText("Identificador del registre: 1",{exact:true})).toBeVisible();
  await expect(page.getByText("Identificador del registre: 2",{exact:true})).toBeVisible();
  await expect(page.getByText(/Això no prova un doble cobrament/)).toBeVisible();
  await page.screenshot({path:test.info().outputPath("revisio.png")});
  await page.getByRole("link",{name:"Com es fa aquesta revisió?"}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Com es fa la revisió ciutadana?");
  expect(errors).toEqual([]);
});

test("new civic pages fit on the phone and are reachable from navigation", async ({page,isMobile}) => {
  test.skip(!isMobile);
  await page.goto("/plens");
  await expect(page.getByRole("navigation",{name:"Navegació principal mòbil"}).getByRole("link",{name:"Plens"})).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:"Obre menú"}).click();
  await page.getByRole("link",{name:"Revisió",exact:true}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Revisió ciutadana");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a review case compares the exact publication and exports its sources", async ({page}) => {
  await page.goto("/revisio?section=contractes&kind=revisio");
  await page.getByRole("link",{name:"Obre la fitxa i contrasta les fonts →"}).first().click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Import proper al llindar de referència");
  await expect(page.getByText("Publicació contrastada",{exact:true})).toBeVisible();
  await expect(page.getByText("PUBLICACIÓ TRIMESTRAL DE MOSTRA",{exact:false})).toBeVisible();
  await expect(page.locator("dd p").filter({hasText:"2024-09-21"})).toHaveCount(2);
  await expect(page.getByText("Difereix",{exact:true})).toHaveCount(0);
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("link",{name:"Descarrega la fitxa"}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe("fitxa-revisio.txt");
  const response=await page.request.get((await page.getByRole("link",{name:"Descarrega la fitxa"}).getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("https://contractaciopublica.cat/portal-api/documents-publicacio/json/300700407");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath("fitxa-contrast.png"),fullPage:true});
});

test("grant cases show call context without claiming to verify the award or payment", async ({page}) => {
  await page.goto("/revisio?section=subvencions");
  await page.getByRole("link",{name:"Obre la fitxa i contrasta les fonts →"}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Concessions coincidents dins d’una convocatòria");
  await expect(page.getByText("Pressupost de la convocatòria",{exact:true})).toBeVisible();
  await expect(page.getByText("19.000,00 €",{exact:true})).toBeVisible();
  await expect(page.getByText(/La resolució de les concessions continua pendent de lectura/)).toBeVisible();
  await expect(page.getByText("Publicació contrastada",{exact:true})).toHaveCount(0);
});

test("unknown review cases are not treated as resolved",async ({page,request})=>{
  await page.goto("/revisio/cas/does-not-exist");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Avís no disponible");
  await expect(page.getByText(/això no acredita que l’expedient estigui resolt/)).toBeVisible();
  expect((await request.get("/api/revisio/does-not-exist")).status()).toBe(404);
});
