import { create } from 'zustand';

export type HarlemPlaceCategory =
  | 'Food'
  | 'Music'
  | 'Culture'
  | 'Books'
  | 'History'
  | 'Outdoors';

export interface HarlemPlacePreview {
  id: string;
  name: string;
  category: HarlemPlaceCategory;
  area: string;
  shortDescription: string;
  whyItMatters: string;
  tags: string[];
  previewPoint: {
    x: number;
    y: number;
  };
  menuAvailable?: boolean;
  arCandidate?: boolean;
}

export const HARLEM_PLACE_PREVIEWS: readonly HarlemPlacePreview[] = [
  {
    id: 'apollo-theater',
    name: 'Apollo Theater',
    category: 'Culture',
    area: '125th Street',
    shortDescription: 'A Harlem performing-arts landmark with a global cultural reach.',
    whyItMatters:
      'The Apollo belongs in the experience as both a current destination and a gateway into Harlem music, performance, and neighborhood history.',
    tags: ['performing arts', 'music', 'history'],
    previewPoint: { x: 52, y: 38 },
    arCandidate: true,
  },
  {
    id: 'red-rooster-harlem',
    name: 'Red Rooster Harlem',
    category: 'Food',
    area: 'Central Harlem',
    shortDescription: 'Food, music, and neighborhood energy in the heart of Harlem.',
    whyItMatters:
      'Harlem Mights can connect a meal here to nearby culture, nightlife, public art, and a walk along the surrounding blocks.',
    tags: ['restaurant', 'food', 'music'],
    previewPoint: { x: 61, y: 54 },
    menuAvailable: true,
    arCandidate: true,
  },
  {
    id: 'sylvias-restaurant',
    name: "Sylvia's Restaurant",
    category: 'Food',
    area: 'Central Harlem',
    shortDescription: 'A longstanding Harlem restaurant and neighborhood institution.',
    whyItMatters:
      'A place detail can pair the present-day restaurant with its history, menus, nearby landmarks, and the story of the block.',
    tags: ['restaurant', 'soul food', 'history'],
    previewPoint: { x: 68, y: 48 },
    menuAvailable: true,
    arCandidate: true,
  },
  {
    id: 'schomburg-center',
    name: 'Schomburg Center',
    category: 'Books',
    area: 'Central Harlem',
    shortDescription: 'A research and cultural institution centered on Black history and culture.',
    whyItMatters:
      'It gives Harlem Mights a natural bridge between physical navigation, archival material, exhibitions, books, and deeper research.',
    tags: ['library', 'archives', 'research'],
    previewPoint: { x: 73, y: 31 },
    arCandidate: true,
  },
  {
    id: 'studio-museum-harlem',
    name: 'The Studio Museum in Harlem',
    category: 'Culture',
    area: '125th Street',
    shortDescription: 'A museum focused on artists of African descent and the cultural life of Harlem.',
    whyItMatters:
      'The museum can anchor contemporary art discovery while connecting users to public art, artists, archives, and nearby cultural spaces.',
    tags: ['museum', 'art', 'culture'],
    previewPoint: { x: 46, y: 46 },
    arCandidate: true,
  },
  {
    id: 'national-black-theatre',
    name: 'National Black Theatre',
    category: 'Culture',
    area: 'Central Harlem',
    shortDescription: 'A Harlem arts institution centered on Black theater and cultural expression.',
    whyItMatters:
      'It is a strong example of a place where events, institution history, people, and a current destination should all share one canonical record.',
    tags: ['theater', 'performance', 'culture'],
    previewPoint: { x: 77, y: 58 },
    arCandidate: true,
  },
  {
    id: 'marcus-garvey-park',
    name: 'Marcus Garvey Park',
    category: 'Outdoors',
    area: 'Mount Morris Park',
    shortDescription: 'A major neighborhood park and gathering place in Central Harlem.',
    whyItMatters:
      'The park makes the map useful beyond businesses: monuments, landscape, recreation, events, and neighborhood history can all appear spatially.',
    tags: ['park', 'outdoors', 'monuments'],
    previewPoint: { x: 71, y: 69 },
    arCandidate: true,
  },
  {
    id: 'strivers-row',
    name: "Strivers' Row",
    category: 'History',
    area: 'Central Harlem',
    shortDescription: 'A distinctive historic residential streetscape in Harlem.',
    whyItMatters:
      'This is where entrance-aware navigation matters less than viewpoint-aware storytelling: the experience should guide people to a respectful public vantage point.',
    tags: ['architecture', 'history', 'streetscape'],
    previewPoint: { x: 36, y: 27 },
    arCandidate: true,
  },
] as const;

export const HARLEM_CATEGORIES = [
  'All',
  'Food',
  'Music',
  'Culture',
  'Books',
  'History',
  'Outdoors',
] as const;

export type HarlemCategoryFilter = (typeof HARLEM_CATEGORIES)[number];

interface ExploreState {
  query: string;
  category: HarlemCategoryFilter;
  selectedPlaceId: string | null;
  savedPreviewIds: string[];
  setQuery: (query: string) => void;
  setCategory: (category: HarlemCategoryFilter) => void;
  selectPlace: (placeId: string | null) => void;
  toggleSavedPreview: (placeId: string) => void;
}

export const useExplore = create<ExploreState>((set) => ({
  query: '',
  category: 'All',
  selectedPlaceId: null,
  savedPreviewIds: [],
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  toggleSavedPreview: (placeId) =>
    set((state) => ({
      savedPreviewIds: state.savedPreviewIds.includes(placeId)
        ? state.savedPreviewIds.filter((id) => id !== placeId)
        : [...state.savedPreviewIds, placeId],
    })),
}));

export function getHarlemPlacePreview(placeId?: string | null) {
  return HARLEM_PLACE_PREVIEWS.find((place) => place.id === placeId) ?? null;
}

export function filterHarlemPlacePreviews(
  query: string,
  category: HarlemCategoryFilter,
) {
  const normalized = query.trim().toLowerCase();

  return HARLEM_PLACE_PREVIEWS.filter((place) => {
    const matchesCategory = category === 'All' || place.category === category;
    if (!matchesCategory) return false;
    if (!normalized) return true;

    return [
      place.name,
      place.area,
      place.category,
      place.shortDescription,
      ...place.tags,
    ].some((value) => value.toLowerCase().includes(normalized));
  });
}
