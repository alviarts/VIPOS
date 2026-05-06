// VIPOS lint-staged config — jalankan ESLint + Prettier hanya untuk file yang
// kena `git add`, supaya pre-commit cepat dan tidak ganggu file unrelated.
//
// Sejak lint+format bersih (PR #103-#109), pre-commit gate `--max-warnings=0`
// supaya warning baru tidak masuk ke main. Jalankan `npm run lint:fix` /
// `npm run format` lokal kalau hook nge-block.

export default {
  '*.{js,jsx,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
};
