# Pull Request Template

> Copy block bawah jadi description PR. Ganti placeholder `{{...}}`.

---

## Title format

```
{type}({task_id}): {short title}
```

Contoh:

- `feat(P1-04): Products page dengan 5-tab wizard`
- `feat(P3-07): POS cart UI dengan adaptive layout`
- `fix(P3-07): cart total tidak update saat quantity stepper`
- `docs(P0-04): document API contract conventions`
- `chore(P0-01): set up monorepo workspaces`

`type`: `feat` | `fix` | `docs` | `chore` | `test` | `refactor` | `perf` | `style`

---

## Body template

```markdown
## Task

**Task ID**: {{P{phase}-{nn}}}
**Phase**: {{Phase X — name}}
**Branch**: `devin/{{P{phase}-{nn}-{slug}}}`

## Goal

{{1-2 kalimat goal task; copy dari phase doc}}

## Changes

### Added

- {{list file/feature baru}}

### Modified

- {{list file diubah}}

### Deleted

- {{list file dihapus}}

### Backend (kalau ada)

- New endpoints: {{list}}
- DB migration: {{ada/tidak}}
- Breaking change: {{ada/tidak}}

### Frontend / Mobile (kalau ada)

- New screens: {{list}}
- New components: {{list}}
- New API client functions: {{list}}

## Acceptance Criteria

(copy dari phase doc, mark checkbox sesuai progress)

- [x] Criterion 1
- [x] Criterion 2
- [ ] Criterion 3 (in progress / out of scope)

## Testing

### Manual smoke test

1. {{step 1}}
2. {{step 2}}
3. {{step 3}}

### Automated tests

- Unit test added: {{N tests, M coverage}}
- Integration test added: {{N tests}}
- UI test added: {{N tests, only Android}}

### Screenshots / video

{{tempel screenshot di sini, kalau UI task. Path file: misalnya docs/screenshots/p1-04-products.png}}

## Reference docs

- `docs/v3/workflow/phase_{{X}}_*.md` (section P{{X}}-{{nn}})
- `docs/v2/{{file-spesifik}}` (UI/UX/data spec)
- `docs/v2/{{cross-cutting-doc}}` (cross-reference)

## Deployment notes

- [ ] DB migration required: {{detail kalau ya}}
- [ ] Env var baru: {{list}}
- [ ] Backward compatible: {{ya/tidak}}
- [ ] Feature flag: {{ya/tidak; nama flag}}

## Checklist (sebelum review)

- [ ] Self-reviewed: code clean, no debug log, no commented-out code
- [ ] Lint pass: `npm run lint` (web/backend) atau `./gradlew lint` (Android)
- [ ] Type check pass: `tsc --noEmit` atau `./gradlew :app:compileDebugKotlin`
- [ ] Tests pass: `npm test` atau `./gradlew test`
- [ ] Build pass: `npm run build` atau `./gradlew assembleDebug`
- [ ] CI green
- [ ] Manual smoke test passed
- [ ] Reference docs updated kalau ada perubahan API/schema
- [ ] Phase doc updated: task `{{P{phase}-{nn}}}` mark sebagai `[done]`

## Notes for reviewer

{{kalau ada hal khusus untuk diperhatikan reviewer, tulis di sini}}

## Related issues / dependencies

- Depends on: {{P0-XX}} (merged in #YY)
- Unblocks: {{P3-XX, P4-XX}}
- Related: {{any related PR}}

---

**Devin session**: {{auto-appended by Devin}}
**Requester**: {{auto-appended by Devin}}
```

---

## Quick template (untuk task simple, 1-2 hari)

Kalau task kecil (e.g. bug fix, doc update), pakai template lebih ringkas:

```markdown
## Task

P{{phase}}-{{nn}}: {{judul}}

## Changes

{{1-3 bullet point}}

## Testing

{{1-2 step manual smoke test}}

## Checklist

- [ ] Lint pass
- [ ] Tests pass
- [ ] CI green
- [ ] Phase doc updated
```

---

## Squash merge commit message

Saat squash, format final commit message di main:

```
{type}({task_id}): {title} (#PR_number)

{paragraph singkat goal}

{key changes bullet point}

Closes: P{{phase}}-{{nn}}
PR: #{{N}}
```

Contoh:

```
feat(P1-04): Products page dengan 5-tab wizard (#15)

Refresh halaman Products lengkapi tab Varian, Resep, majoo Order yang sebelumnya locked.

- Tambah component ProductForm/{TabDetail,TabCategory,TabStock,TabVariant,TabRecipe,TabMajooOrder}
- Backend: endpoint /api/v1/product-variant, /api/v1/product-recipe, /api/v1/product-online
- DB migration: tabel product_variants, product_recipe_items
- Image upload max 4 foto dengan drag-reorder
- Bulk import CSV (placeholder)

Closes: P1-04
PR: #15
```
