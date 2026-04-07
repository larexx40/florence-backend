module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    // General rules
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // Ignore unused variables and parameters
    'no-unused-vars': 'off', // Disables the base ESLint rule
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        vars: 'all', // Warn for all unused variables
        args: 'after-used', // Ignore unused function parameters if they appear before used ones
        argsIgnorePattern: '^_', // Ignore parameters prefixed with an underscore (e.g., _param)
        varsIgnorePattern: '^_', // Ignore variables prefixed with an underscore
      },
    ],

    // Prettier integration
    'prettier/prettier': 'warn', // Show prettier formatting warnings
  },
};