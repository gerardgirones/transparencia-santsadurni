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
