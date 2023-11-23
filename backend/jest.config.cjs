/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: [
    '<rootDir>/dist/'
  ],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'node'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'json-summary',
    'text',
    'lcov'
  ]
};
