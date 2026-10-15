# contractes.cat

Anàlisi independent de la contractació pública a Catalunya.

## Context del lloc (instància actual)

- Domini públic: `https://transparenciasantsadurni.cat`
- Àmbit principal: **Sant Sadurní d'Anoia**
- Comarca: **Alt Penedès** (Barcelona)
- Administració principal: **Ajuntament de Sant Sadurní d'Anoia**
- Codi ENS de referència: `824010007`

En aquesta instància, l'experiència i els filtres es prioritzen per dades del municipi de Sant Sadurní d'Anoia.

**Aquesta no és una web oficial del govern.** Les dades provenen de la [Plataforma de Transparència de Catalunya](https://analisi.transparenciacatalunya.cat) i es mostren amb finalitat informativa.

## Funcionalitats

- **Dashboard** amb indicadors clau: total de contractes, import total adjudicat, nombre d'empreses
- **Rànquing d'empreses** per import total de contractes adjudicats, amb cerca i paginació
- **Detall d'empresa** amb evolució anual i llistat de contractes
- **Explorador de contractes** amb filtres per any, tipus, procediment, import i òrgan de contractació
- **Anàlisi** del llindar de contractes menors (15.000 EUR), distribucions per tipus i procediment

## Stack tecnològic

- [Next.js](https://nextjs.org) 16 (App Router, Server Components)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Recharts](https://recharts.org) per a gràfiques
- TypeScript
- Dades: [Socrata Open Data API (SODA)](https://dev.socrata.com/)

## Desenvolupament

```bash
pnpm install
pnpm dev
```

Obre [http://localhost:3000](http://localhost:3000) al navegador.

### Comprovacions

Amb Node.js 24, executa `pnpm test`, `pnpm lint` i `pnpm build`.
Les proves cobreixen els tipus dels filtres CKAN, la paginació completa,
els imports decimals i la resposta del resum quan una font deixa de funcionar.

### Cobertura de subvencions

L'explorador mostra concessions consultades directament a la BDNS, sense limitar l'històric a
2.500 registres. Indica la data de la darrera concessió disponible i avisa quan
la font encara no conté dades de l'any en curs. L'absència de registres no
demostra que no s'hagin concedit ajuts. Les convocatòries i els ajuts previstos
s'han de consultar separadament a les fonts oficials enllaçades.

El pressupost usa només les despeses de nivell 1 de la classificació funcional,
per evitar sumar de nou les mateixes despeses en la classificació econòmica.
Si una font falla, el portal de transparència manté les altres seccions i marca
les dades afectades com a no disponibles.

### Connexió automàtica amb la BDNS

La vista `/subvencions?view=convocatories` consulta l'API pública oficial de
la BDNS (`https://www.subvenciones.gob.es/bdnstrans/api`). El filtre obligatori
`organos=413` selecciona l'Ajuntament de Sant Sadurní d'Anoia com a concedent;
no selecciona subvencions rebudes per l'Ajuntament.

La cerca usa `/convocatorias/busqueda`, paginació de 20 elements i dates de
registre `fechaDesde`/`fechaHasta`. El detall de cada convocatòria es consulta
a `/convocatorias?numConv=...` per obtenir el pressupost previst i el procediment.
No es barregen aquests pressupostos amb els imports de concessions.

La vista de concessions, el rànquing, l'exportació CSV i els indicadors de
transparència usen `/concesiones/busqueda`, també amb `organos=413`, i recorren
totes les pàgines de 100 registres. L'import prové de `importe`, no del pressupost
de la convocatòria. Els identificadors BDNS eviten duplicats; una resposta
incompleta o un import no vàlid es tracta com a error, no com a zero. L'AOC no
se suma a aquest catàleg per no comptar dues vegades les mateixes concessions.

Les respostes es guarden en la memòria cau de Next.js durant sis hores. La
revalidació es produeix a partir d'una nova visita, no mitjançant un procés
programat en segon pla. Els detalls es consulten amb un màxim de quatre
peticions simultànies i un termini global de 12 segons. Un detall que falla
es marca com a no disponible sense ocultar la convocatòria.

Documentació oficial: https://www.subvenciones.gob.es/bdnstrans/doc/swagger

### Variables d'entorn (BORME/Turso)

Per mostrar l'històric d'administradors des de Turso (sense fitxers JSON estàtics), configura:

```bash
TURSO_URL=libsql://<db-name>-<org>.turso.io
TURSO_TOKEN=<db-token>
```

També es suporta `TURSO_AUTH_TOKEN` com a alternativa a `TURSO_TOKEN`.

## Font de dades

Les dades de contractació provenen del conjunt de dades [Contractació pública a Catalunya](https://analisi.transparenciacatalunya.cat/Sector-P-blic/Contractaci-del-sector-p-blic-de-la-Generalitat-d/ybgg-dgi6). El pressupost, els convenis i les actes provenen de les dades obertes de l'AOC. Les convocatòries i concessions de subvencions es consulten directament a l'API pública de la BDNS.

## Desplegament

Desplegat a [Vercel](https://vercel.com). Per desplegar la teva pròpia instància:

```bash
pnpm run build
```

### Entorns Vercel (desenvolupament i oficial)

- **Desenvolupament (Preview):** cada deploy sense `--prod` crea un entorn de proves.
- **Oficial (Production):** deploy amb `--prod` publicat al domini principal.

Comandes útils:

```bash
pnpm run deploy:preview
pnpm run deploy:prod
```

Si uses token no interactiu:

```bash
set VERCEL_TOKEN=<token>
pnpm run deploy:preview -- --token %VERCEL_TOKEN%
pnpm run deploy:prod -- --token %VERCEL_TOKEN%
```

## Comprovacions del portal

Amb Node.js 24 i pnpm 10.30.2:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build:test
pnpm exec playwright install chromium
pnpm test:e2e
```

Les proves de navegació cobreixen ordinador i mòbil, filtres de dates, ordenació,
exportació i errors del cercador. Fan servir dades fictícies de Socrata, AOC i
BDNS, sense credencials. La compilació de proves es desa a `.next-test`; la
compilació habitual continua utilitzant les fonts oficials i `.next`.

El flux de GitHub Actions executa aquestes comprovacions en cada proposta de
canvi. Les proves de dades comproven que les consultes mantenen l'àmbit de Sant
Sadurní i que els adjudicataris amb identificadors anonimitzats no es barregen.

## Llicència

AGPL-3.0. Consulta el fitxer [LICENSE](LICENSE) per a més detalls.
