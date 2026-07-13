import { PreferencesSchema, UpdatePreferencesSchema } from './preferences';

describe('preferences schemas', () => {
  it('PreferencesSchema принимает пустую строку', () => {
    const input = { interestsDescription: '' };
    expect(PreferencesSchema.parse(input)).toEqual(input);
  });

  it('PreferencesSchema принимает null', () => {
    const input = { interestsDescription: null };
    expect(PreferencesSchema.parse(input)).toEqual(input);
  });

  it('PreferencesSchema принимает обычный текст', () => {
    const input = { interestsDescription: 'Люблю технологии и науку' };
    expect(PreferencesSchema.parse(input)).toEqual(input);
  });

  it('UpdatePreferencesSchema принимает пустую строку', () => {
    const input = { interestsDescription: '' };
    expect(UpdatePreferencesSchema.parse(input)).toEqual(input);
  });

  it('UpdatePreferencesSchema принимает null', () => {
    const input = { interestsDescription: null };
    expect(UpdatePreferencesSchema.parse(input)).toEqual(input);
  });

  it('UpdatePreferencesSchema принимает обычный текст', () => {
    const input = { interestsDescription: 'Люблю технологии и науку' };
    expect(UpdatePreferencesSchema.parse(input)).toEqual(input);
  });

  it('UpdatePreferencesSchema принимает отсутствие поля (optional)', () => {
    expect(UpdatePreferencesSchema.parse({})).toEqual({});
  });

  it('UpdatePreferencesSchema принимает текст ровно 1000 символов', () => {
    const input = { interestsDescription: 'a'.repeat(1000) };
    expect(UpdatePreferencesSchema.parse(input)).toEqual(input);
  });

  it('UpdatePreferencesSchema падает на тексте длиннее 1000 символов', () => {
    const input = { interestsDescription: 'a'.repeat(1001) };
    expect(() => UpdatePreferencesSchema.parse(input)).toThrow();
  });
});
