// VIPOS commitlint config — enforce Conventional Commits dengan task-ID scope
// per konvensi `docs/v3/workflow/01_HOW_TO_USE.md`:
//
//   {type}(P{X}-{nn}): {message}
//
// Contoh valid:
//   feat(P1-04): Products page dengan 5-tab wizard
//   wip(P0-02): tambah workflow CI build
//   docs(P0-03): readme update untuk lint hooks
//
// Type yang diterima diambil dari config-conventional plus `wip` (untuk
// commit incremental) dan `release` (kalau-kalau).

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'chore',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'revert',
        'wip',
        'release',
      ],
    ],
    // Body panjang OK — tidak limit baris.
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
    // Subject case dibuat lebih longgar (boleh sentence-case Indonesia).
    'subject-case': [0],
  },
};
