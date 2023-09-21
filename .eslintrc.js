module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ['plugin:vue/essential', '@vue/airbnb'],
  parserOptions: {
    parser: 'babel-eslint',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'comma-dangle': 'off',
    'arrow-parens': 'off',
    'class-methods-use-this': 'off',
    'no-plusplus': 'off',
    'max-len': [2, 200],
    'no-param-reassign': 'off',
    'guard-for-in': 'off',
    'no-restricted-syntax': 'off',
    'no-restricted-globals': 'off',
    'no-lonely-if': 'off',
    'object-curly-newline': 'off',
    'no-underscore-dangle': 'off',
    'import/prefer-default-export': 'off',
    'linebreak-style': 'off',
    'prefer-destructuring': 'off',
    'operator-linebreak': [2, 'after', { overrides: { '?': 'before', ':': 'before' } }],
    'dot-notation': 'off',
    'no-await-in-loop': 'off',
    'no-ex-assign': 'off',
    'implicit-arrow-linebreak': 'off',
    // 新增无关紧要
    'import/extensions': 'off',
    'no-fallthrough': 'off',
    'consistent-return': 'off',
    'no-use-before-define': 'off',
    'no-nested-ternary': 'off',
    'no-bitwise': 'off',
    'no-shadow': 'off',
    'default-case': 'off',
    'no-multi-assign': 'off',
    'no-var': 'off',
    'vars-on-top': 'off',
    'no-unused-expressions': 'off',
    'no-continue': 'off',
    'camelcase': 'off',
    'no-case-declarations': 'off',
    'no-mixed-operators': 'off',
    'brace-style': 'off',
    'no-return-assign': 'off',
    'no-cond-assign': 'off',
    'no-restricted-properties': 'off',
  },
};
