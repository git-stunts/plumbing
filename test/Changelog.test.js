import fs from 'node:fs';

describe('changelog structure', () => {
  it('has exactly one active Unreleased heading', () => {
    const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const headings = changelog.match(/^## \[Unreleased\].*$/gm) ?? [];

    expect(headings).toEqual(['## [Unreleased]']);
  });
});
