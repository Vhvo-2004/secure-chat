module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:security/recommended',
    'prettier'
  ],
  settings: { 'import/resolver': { typescript: true } },
  rules: {
    'import/no-unresolved': 'off'
  }
};
