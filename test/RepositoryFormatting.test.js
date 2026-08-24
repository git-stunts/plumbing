import fs from 'node:fs';

describe('repository formatting', () => {
  it('pins Prettier behavior inside the repository', () => {
    const config = JSON.parse(fs.readFileSync(new URL('../.prettierrc', import.meta.url), 'utf8'));

    expect(config).toEqual({
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 100,
    });
  });
});
