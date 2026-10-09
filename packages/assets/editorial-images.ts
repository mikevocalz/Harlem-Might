export type EditorialImageRole = 'hero' | 'gallery' | 'historical' | 'thumbnail' | 'map_pin';

export type EditorialImageSource =
  | 'commissioned'
  | 'nypl'
  | 'loc'
  | 'wikimedia_commons'
  | 'google_places'
  | 'unsplash'
  | 'pexels'
  | 'venue_supplied'
  | 'other';

export interface EditorialImage {
  id: string | number;
  role: EditorialImageRole;
  url: string;
  altText: string;
  source: EditorialImageSource;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  creator?: string;
  credit: string;
  attributionText: string;
  capturedAt?: string;
  ingestedAt?: string;
  width?: number;
  height?: number;
  aspect?: number;
  placeholderHash?: string;
  dominantColor?: string;
  shareAlike: boolean;
  noDerivatives: boolean;
  caption?: string;
}

const IMAGE_ROLES: readonly EditorialImageRole[] = ['hero', 'gallery', 'historical', 'thumbnail', 'map_pin'];
const IMAGE_SOURCES: readonly EditorialImageSource[] = [
  'commissioned',
  'nypl',
  'loc',
  'wikimedia_commons',
  'google_places',
  'unsplash',
  'pexels',
  'venue_supplied',
  'other',
];

const isHttpUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\/\S+$/i.test(value);

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function isDisplayableEditorialImage(image: Partial<EditorialImage> | null | undefined): image is EditorialImage {
  return Boolean(
    image &&
      (typeof image.id === 'string' || typeof image.id === 'number') &&
      IMAGE_ROLES.includes(image.role as EditorialImageRole) &&
      IMAGE_SOURCES.includes(image.source as EditorialImageSource) &&
      isHttpUrl(image.url) &&
      hasText(image.altText) &&
      isHttpUrl(image.sourceUrl) &&
      hasText(image.license) &&
      isHttpUrl(image.licenseUrl) &&
      hasText(image.credit) &&
      hasText(image.attributionText) &&
      typeof image.shareAlike === 'boolean' &&
      typeof image.noDerivatives === 'boolean',
  );
}

export function imageAspect(width: number | null | undefined, height: number | null | undefined): number | undefined {
  return width && height && width > 0 && height > 0 ? width / height : undefined;
}

export function editorialImageContentFit(image: Pick<EditorialImage, 'aspect' | 'noDerivatives'>): 'contain' | 'cover' {
  return image.noDerivatives || !image.aspect ? 'contain' : 'cover';
}

const nyplItemUrl = 'https://digitalcollections.nypl.org/items/e687af30-c6e8-012f-2a82-3c075448cc4b?canvasIndex=0';
const seventhAvenueItemUrl = 'https://digitalcollections.nypl.org/items/45aff4c0-c630-0130-9e95-58d385a7bbd0';
const lenoxAvenueItemUrl = 'https://digitalcollections.nypl.org/items/9d99d6a4-668b-eaae-e040-e00a18063ce3';
const storefrontsItemUrl = 'https://digitalcollections.nypl.org/items/87848ee0-1992-59ed-e040-e00a18066dee';
const pushcartItemUrl = 'https://digitalcollections.nypl.org/items/7b07ea5c-6229-6b59-e040-e00a18065a4d';
const shoeshinersItemUrl = 'https://digitalcollections.nypl.org/items/8e3a3160-461d-0134-89d9-00505686a51c';
const marketItemUrl = 'https://digitalcollections.nypl.org/items/bcdf3fbe-a587-88d6-e040-e00a1806445a';
const tenementItemUrl = 'https://digitalcollections.nypl.org/items/81f397c0-461d-0134-90b2-00505686a51c';
const lenoxMarketItemUrl = 'https://digitalcollections.nypl.org/items/8b490f20-461d-0134-cd6e-00505686a51c';
const ninthAvenueVendorsItemUrl = 'https://digitalcollections.nypl.org/items/bcdf3fbe-a585-88d6-e040-e00a1806445a';
const NYPL_RIGHTS =
  'The New York Public Library believes this item is in the public domain under the laws of the United States, but did not make a determination as to its copyright status under the copyright laws of other countries.';
const NYPL_CREDIT = 'From The New York Public Library';

export const HARLEM_ARCHIVAL_IMAGES = [
  {
    id: 'nypl-harlem-newspaper-stand-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=1800868&t=w',
    altText: 'Newspaper stand on a Harlem street in 1939.',
    source: 'nypl',
    sourceUrl: nyplItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: nyplItemUrl,
    creator: 'Sid Grossman, 1915–1955',
    credit: 'Sid Grossman',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939',
    width: 760,
    height: 619,
    aspect: imageAspect(760, 619),
    shareAlike: false,
    noDerivatives: false,
    caption: 'Harlem newspaper stand, 1939.',
  },
  {
    id: 'nypl-seventh-avenue-west-125th-1934',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=5044623&t=w',
    altText: 'Seventh Avenue looking north from West 125th Street in Harlem in 1934.',
    source: 'nypl',
    sourceUrl: seventhAvenueItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: seventhAvenueItemUrl,
    credit: 'Schomburg Center for Research in Black Culture, Photographs and Prints Division',
    attributionText: NYPL_CREDIT,
    capturedAt: '1934-09-24',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Seventh Avenue from West 125th Street, 1934.',
  },
  {
    id: 'nypl-lenox-avenue-135th-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=2014188&t=w',
    altText: 'Businesses, pedestrians and a shoe-shine stand on Lenox Avenue at 135th Street in Harlem in 1939.',
    source: 'nypl',
    sourceUrl: lenoxAvenueItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: lenoxAvenueItemUrl,
    creator: 'Federal Art Project (New York, N.Y.)',
    credit: 'Schomburg Center for Research in Black Culture, Photographs and Prints Division',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939-03-23',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Lenox Avenue at 135th Street, 1939.',
  },
  {
    id: 'nypl-harlem-storefronts-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=1713216&t=w',
    altText: 'A row of Harlem storefronts photographed in 1939.',
    source: 'nypl',
    sourceUrl: storefrontsItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: storefrontsItemUrl,
    creator: 'Sid Grossman, 1915–1955',
    credit: 'Sid Grossman',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Harlem storefronts, 1939.',
  },
  {
    id: 'nypl-pushcart-vendors-eighth-avenue-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=1811327&t=w',
    altText: 'Pushcart vendors beneath the elevated train at Eighth Avenue and West 145th Street in Harlem in 1939.',
    source: 'nypl',
    sourceUrl: pushcartItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: pushcartItemUrl,
    creator: 'Aubrey Pollard',
    credit: 'Aubrey Pollard',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939-05-08',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Pushcart vendors at West 145th Street, 1939.',
  },
  {
    id: 'nypl-shoeshiners-lenox-avenue-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=56806336&t=w',
    altText: 'Shoeshiners working at 135th Street and Lenox Avenue in Harlem in 1939.',
    source: 'nypl',
    sourceUrl: shoeshinersItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: shoeshinersItemUrl,
    creator: 'United States. Works Progress Administration',
    credit: 'Schomburg Center for Research in Black Culture, Photographs and Prints Division',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Shoeshiners at Lenox Avenue, 1939.',
  },
  {
    id: 'nypl-lenox-market-picket-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=4018409&t=w',
    altText: 'A labor union supporter picketing outside the Lenox Fruit and Vegetable Market in Harlem in 1939.',
    source: 'nypl',
    sourceUrl: marketItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: marketItemUrl,
    creator: 'Sid Grossman, 1915–1955',
    credit: 'Sid Grossman',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Lenox Fruit and Vegetable Market, 1939.',
  },
  {
    id: 'nypl-harlem-tenement-summer-1930s',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=56806322&t=w',
    altText: 'Harlem residents gathered outside a residential building in summer during the late 1930s.',
    source: 'nypl',
    sourceUrl: tenementItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: tenementItemUrl,
    creator: 'United States. Works Progress Administration',
    credit: 'Schomburg Center for Research in Black Culture, Photographs and Prints Division',
    attributionText: NYPL_CREDIT,
    capturedAt: '1935–1939',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Harlem tenement in summer, 1935–1939.',
  },
  {
    id: 'nypl-lenox-market-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=56806332&t=w',
    altText: 'Produce displayed outside the Lenox Fruit and Vegetable Market in Harlem in 1939.',
    source: 'nypl',
    sourceUrl: lenoxMarketItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: lenoxMarketItemUrl,
    creator: 'Grossman',
    credit: 'United States. Works Progress Administration',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939-06-06',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Lenox Fruit and Vegetable Market, June 6, 1939.',
  },
  {
    id: 'nypl-ninth-avenue-vendors-1939',
    role: 'historical',
    url: 'https://images.nypl.org/index.php?id=4018407&t=w',
    altText: 'Street vendors underneath the elevated train near West 145th Street and Ninth Avenue in Harlem in 1939.',
    source: 'nypl',
    sourceUrl: ninthAvenueVendorsItemUrl,
    license: NYPL_RIGHTS,
    licenseUrl: ninthAvenueVendorsItemUrl,
    creator: 'Aubrey Pollard',
    credit: 'Federal Art Project (New York, N.Y.)',
    attributionText: NYPL_CREDIT,
    capturedAt: '1939',
    shareAlike: false,
    noDerivatives: false,
    caption: 'Street vendors near West 145th Street and Ninth Avenue, 1939.',
  },
] satisfies readonly EditorialImage[];

export const getHarlemArchivalImage = (id: string): EditorialImage | undefined =>
  HARLEM_ARCHIVAL_IMAGES.find((image) => image.id === id);
