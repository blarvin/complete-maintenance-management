import globals from 'globals';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid';

// The flat/typescript preset ships several rules at warn (notably
// solid/reactivity). This project wants them as hard errors: escalate every
// enabled rule to 'error', preserving options; leave disabled rules off.
const solidPreset = solid.configs['flat/typescript'];
const solidRulesAtError = Object.fromEntries(
  Object.entries(solidPreset.rules).map(([name, setting]) => {
    if (Array.isArray(setting)) {
      return [name, setting[0] === 0 || setting[0] === 'off' ? setting : ['error', ...setting.slice(1)]];
    }
    return [name, setting === 0 || setting === 'off' ? setting : 'error'];
  }),
);

export default [
  {
    // .claude/** holds plain CommonJS Node hook scripts — the TS-flavoured
    // rules (no-require-imports etc.) do not apply to them.
    ignores: ['dist/**', 'node_modules/**', '.claude/**', '*.config.js', '*.config.mjs'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // A leading underscore is this repo's "deliberately unused" marker —
      // signature placeholders for a parameter the body does not need yet
      // (`effectiveChildren(canonical, _viewer)`, `getTreeNodeState(…,
      // _nodeParentId)`). Without this the marker and the linter disagree, and
      // the only way to quiet it is to delete the parameter the signature owes.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Solid gate over the whole source tree.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: solidPreset.plugins,
    rules: solidRulesAtError,
  },
];
