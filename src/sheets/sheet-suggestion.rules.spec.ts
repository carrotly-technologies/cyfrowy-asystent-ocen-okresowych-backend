import { suggestSheet } from './sheet-suggestion.rules.js';

describe('suggestSheet', () => {
  it('suggests A for the head of the office, even when managing people', () => {
    expect(
      suggestSheet({ officeHead: true, managesPeople: true }).sheetId,
    ).toBe('A');
  });
  it('suggests B for a position directly managing employees', () => {
    const s = suggestSheet({ officeHead: false, managesPeople: true });
    expect(s.sheetId).toBe('B');
    expect(s.legalBasis).toContain('§3 ust. 3');
  });
  it('suggests C otherwise, always as a suggestion', () => {
    const s = suggestSheet({ officeHead: false, managesPeople: false });
    expect(s).toMatchObject({ sheetId: 'C', isSuggestionOnly: true });
  });
});
