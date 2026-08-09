import globals from 'globals';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid';

// The flat/typescript preset ships several rules at warn (notably
// solid/reactivity). Phase gate wants them as hard errors: escalate every
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

// Qwik ratchet: ported code must not import Qwik. The ignores below shrink
// each migration phase; the whole carve-out is deleted at mop-up.
const qwikRatchetRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@builder.io/qwik', '@builder.io/qwik*'],
          message: 'Ported code must not import Qwik (shrink ignores each phase; delete at mop-up).',
        },
      ],
    },
  ],
};

export default [
  {
    // .claude/** holds plain CommonJS Node hook scripts — the TS-flavoured
    // rules (no-require-imports etc.) do not apply to them.
    ignores: ['dist/**', 'server/**', 'node_modules/**', '.claude/**', '*.config.js', '*.config.mjs'],
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
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Solid + Qwik-ratchet gate over the ported graph (everything but the
  // unported Qwik UI tree).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/**', 'src/hooks/**'],
    plugins: solidPreset.plugins,
    rules: {
      ...solidRulesAtError,
      ...qwikRatchetRules,
    },
  },
  // Same gate re-included for ported paths under src/components and src/hooks
  // (a separate block — negated patterns inside the global ignores are a
  // flat-config trap). This array grows in the same commit as the files it
  // covers; per-file entries for mixed dirs that still hold Qwik files.
  {
    files: [
      'src/components/Snackbar/**/*.{ts,tsx}',
      'src/components/views/**/*.{ts,tsx}',
      'src/components/{UpButton,EllipsisButton,NodeTitle,NodeSubtitle,DataCard,TreeNodeDetails,Breadcrumbs}/**/*.{ts,tsx}',
      'src/components/{FieldList,NavigableRow,CreateDataField}/**/*.{ts,tsx}',
      'src/components/DataField/**/*.{ts,tsx}',
      'src/components/{DataFieldDetails,DataFieldHistory}/**/*.{ts,tsx}',
      'src/components/TreeNode/**/*.{ts,tsx}',
      'src/components/CreateNodeButton/**/*.{ts,tsx}',
      'src/components/{NodeHeader,LensRollup,LensCreate,LensCreateButton}/**/*.{ts,tsx}',
      'src/components/FieldComposer/**/*.{ts,tsx}',
      'src/hooks/{useElementChildren,useLensGather,useLensPolicy,useFieldValueSync,useDoubleTap,useAncestorPath,useFieldEdit,useFocusManager,useEditableValue,useDefinitionDraft,usePendingForms,useNodeCreation}.ts',
    ],
    plugins: solidPreset.plugins,
    rules: {
      ...solidRulesAtError,
      ...qwikRatchetRules,
    },
  },
];
