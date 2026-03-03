# transaprenciasantsadurn.cat

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

### Variables d'entorn (BORME/Turso)

Per mostrar l'històric d'administradors des de Turso (sense fitxers JSON estàtics), configura:

```bash
TURSO_URL=libsql://<db-name>-<org>.turso.io
TURSO_TOKEN=<db-token>
```

També es suporta `TURSO_AUTH_TOKEN` com a alternativa a `TURSO_TOKEN`.

## Font de dades

Totes les dades provenen del conjunt de dades [Contractació pública a Catalunya](https://analisi.transparenciacatalunya.cat/Sector-P-blic/Contractaci-del-sector-p-blic-de-la-Generalitat-d/ybgg-dgi6) publicat pel Departament d'Economia i Hisenda de la Generalitat de Catalunya.

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

## Llicència

AGPL-3.0. Consulta el fitxer [LICENSE](LICENSE) per a més detalls.
