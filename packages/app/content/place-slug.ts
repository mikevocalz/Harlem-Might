const GENERATED_PLACE_SLUG = /^(?:osm-(?:node|way|relation)|lpc|mon)-\d+$/;

/** Public place URLs are name-led; source ids stay in `locationSource`, not the path. */
export const placeNameSlug = (name: string): string | undefined => {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || undefined;
};

export const isGeneratedPlaceSlug = (slug: string): boolean => GENERATED_PLACE_SLUG.test(slug);

export const uniquePlaceSlug = (name: string, used: ReadonlySet<string>, fallback = 'place'): string => {
  const base = placeNameSlug(name) ?? fallback;
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
};
