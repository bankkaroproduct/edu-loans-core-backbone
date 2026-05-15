// Pure helpers over the bundled universities.json dataset.
// Used to power the cascading Country → University → Course filter on
// every Add Lead surface (Partner, Admin, Student wizard).
//
// IMPORTANT: This module DOES NOT drive the Country dropdown options —
// country options continue to come from countries_master. The dataset
// is consulted ONLY when the selected country name matches (case-
// insensitive exact match) one of the country names in this JSON.
// When no match is found, the university/course pickers fall back to
// manual-entry mode by default (no warning, no error).

import data from "@/data/universities.json";

interface RawCourseUniversity {
  name: string;
  city?: string | null;
  courses?: string[];
}
interface RawCountry {
  name: string;
  universities?: RawCourseUniversity[];
}
interface RawDataset {
  countries: RawCountry[];
}

const dataset = data as RawDataset;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function findCountry(countryName: string): RawCountry | null {
  const target = norm(countryName);
  if (!target) return null;
  return dataset.countries.find((c) => norm(c.name) === target) ?? null;
}

function findUniversityRow(countryName: string, universityName: string): RawCourseUniversity | null {
  const country = findCountry(countryName);
  if (!country) return null;
  const target = norm(universityName);
  if (!target) return null;
  return country.universities?.find((u) => norm(u.name) === target) ?? null;
}

/** All country names available in the JSON (26 of them). */
export function getCountries(): string[] {
  return dataset.countries.map((c) => c.name);
}

/** Returns true if the given country name (case-insensitive) is present in the JSON. */
export function hasCountry(countryName: string): boolean {
  return findCountry(countryName) !== null;
}

/** Universities for the given country. Empty array when country isn't in JSON. */
export function getUniversities(countryName: string): { name: string; city: string | null }[] {
  const country = findCountry(countryName);
  if (!country) return [];
  return (country.universities ?? []).map((u) => ({
    name: u.name,
    city: u.city ?? null,
  }));
}

/** Courses for the given country + university. Empty array when no match. */
export function getCourses(countryName: string, universityName: string): string[] {
  const uni = findUniversityRow(countryName, universityName);
  if (!uni) return [];
  return uni.courses ?? [];
}

/** City for the given country + university, or null. Used for optional pre-fill. */
export function findUniversityCity(countryName: string, universityName: string): string | null {
  const uni = findUniversityRow(countryName, universityName);
  return uni?.city ?? null;
}
