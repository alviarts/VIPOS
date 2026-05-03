// VIPOS lint-staged config — jalankan ESLint + Prettier hanya untuk file yang
// kena `git add`, supaya pre-commit cepat dan tidak ganggu file unrelated.
//
// Catatan: tidak pakai `--max-warnings=0` dulu karena codebase existing masih
// punya ~30 warnings (unused imports, missing useEffect deps). Akan ditightenin
// jadi `--max-warnings=0` setelah teknikal debt itu dibersihin secara bertahap
// di task feature berikutnya.

export default {
  '*.{js,jsx,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
};
