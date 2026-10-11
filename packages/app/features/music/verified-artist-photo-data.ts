export type CuratedArtistProfile = { url: string; credit: string };
export type DirectArtistPhoto = { url: string; sourceUrl: string; credit: string };

export const VERIFIED_MISSING_ARTIST_NAMES = [
  "A$AP Ant",
  "A$AP Twelvyy",
  "Bessie Smith",
  "Big L",
  "Black Rob",
  "Bloodshed",
  "Cameo",
  "Charles Hamilton",
  "Charlie Palmieri",
  "Chick Webb",
  "DJ Hollywood",
  "Dani Stevenson",
  "Frankie Lymon & the Teenagers",
  "Freekey Zekey",
  "Harlem Quartet",
  "Hazel Scott",
  "Herb McGruff",
  "J.R. Writer",
  "James P. Johnson",
  "James Weldon Johnson",
  "Johnny Kemp",
  "Kenny Drew",
  "Kool Moe Dee",
  "Kurtis Blow",
  "Leroy Burgess",
  "Lil Mama",
  "Louis Armstrong",
  "Ma$e",
  "Mary Lou Williams",
  "Noble Sissle",
  "Paul Robeson",
  "Rob Base",
  "Sarah Vaughan",
  "Sheck Wes",
  "Smoke DZA",
  "Spoonie Gee",
  "Stuart Bascombe",
  "Sugarhill Ddot",
  "T-Rex",
  "Teddy Riley",
  "Teyana Taylor",
  "The Main Ingredient",
  "Tito Puente",
  "Tupac Shakur",
  "Vado",
  "Willie The Lion Smith"
] as const;

export const VERIFIED_WIKIPEDIA_TITLES: Readonly<Record<string, string>> =
  {
  "asap twelvyy": "ASAP Twelvyy",
  "hazel scott": "Hazel Scott",
  "james weldon johnson": "James Weldon Johnson",
  "kurtis blow": "Kurtis Blow",
  "leroy burgess": "Leroy Burgess",
  "lil mama": "Lil Mama",
  "louis armstrong": "Louis Armstrong",
  "mase": "Mase",
  "mary lou williams": "Mary Lou Williams",
  "noble sissle": "Noble Sissle",
  "paul robeson": "Paul Robeson",
  "sarah vaughan": "Sarah Vaughan",
  "sheck wes": "Sheck Wes",
  "smoke dza": "Smoke DZA",
  "sugarhill ddot": "Sugarhill Ddot",
  "teddy riley": "Teddy Riley",
  "teyana taylor": "Teyana Taylor",
  "the main ingredient": "The Main Ingredient",
  "tito puente": "Tito Puente",
  "tupac shakur": "Tupac Shakur",
  "willie the lion smith": "Willie \"the Lion\" Smith"
};

export const CURATED_COMMONS_FILES: Readonly<Record<string, string>> =
  {
  "bessie smith": "File:BessieSmith.jpg",
  "charles hamilton": "File:Charles Hamilton (rapper).jpg",
  "frankie lymon and the teenagers": "File:Frankie Lymon and the Teenagers.jpg",
  "james p johnson": "File:(Portrait of James P. (James Price) Johnson and Marty Marsala, Riverboat on the Hudson, N.Y., ca. July 1947) (LOC) (5436424030).jpg",
  "rob base": "File:Houston Dash 90s Bash, 2023-10-08 (53256190414) (cropped).jpg",
  "stuart bascombe": "File:Black Ivory In Harlem, N.Y..jpg"
};

export const CURATED_PROFILE_PAGES: Readonly<Record<string, CuratedArtistProfile>> =
  {
  "asap ant": {
    "url": "https://www.last.fm/music/A%24AP%2BANT",
    "credit": "Last.fm A$AP Ant artist profile"
  },
  "big l": {
    "url": "https://www.last.fm/music/Big%2BL",
    "credit": "Last.fm Big L artist profile"
  },
  "black rob": {
    "url": "https://www.last.fm/music/Black%2BRob",
    "credit": "Last.fm Black Rob artist profile"
  },
  "cameo": {
    "url": "https://www.cameonation.com/",
    "credit": "Official CAMEO / Larry Blackmon site"
  },
  "charlie palmieri": {
    "url": "https://fania.com/artist/charlie-palmieri/",
    "credit": "Fania artist profile"
  },
  "chick webb": {
    "url": "https://www.last.fm/music/Chick%2BWebb",
    "credit": "Last.fm Chick Webb artist profile"
  },
  "dj hollywood": {
    "url": "https://mrbellersneighborhood.com/2023/03/harlem-superstar-dj-hollywood",
    "credit": "Mr. Beller's Neighborhood · photo by Dianne Washington"
  },
  "dani stevenson": {
    "url": "https://www.last.fm/music/Dani%2BStevenson",
    "credit": "Last.fm artist profile"
  },
  "freekey zekey": {
    "url": "https://www.last.fm/music/Freekey%2BZekey",
    "credit": "Last.fm Freekey Zekey artist profile"
  },
  "harlem quartet": {
    "url": "https://www.harlemquartet.com/",
    "credit": "Official Harlem Quartet site"
  },
  "herb mcgruff": {
    "url": "https://www.last.fm/music/Herb%20McGruff",
    "credit": "Last.fm Herb McGruff artist profile"
  },
  "j r writer": {
    "url": "https://www.last.fm/music/J.R.+Writer",
    "credit": "Last.fm artist profile"
  },
  "johnny kemp": {
    "url": "https://www.last.fm/music/Johnny%2BKemp",
    "credit": "Last.fm Johnny Kemp artist profile"
  },
  "kenny drew": {
    "url": "https://www.last.fm/music/Kenny%2BDrew",
    "credit": "Last.fm Kenny Drew artist profile"
  },
  "kool moe dee": {
    "url": "https://www.last.fm/music/Kool%2BMoe%2BDee",
    "credit": "Last.fm Kool Moe Dee artist profile"
  },
  "spoonie gee": {
    "url": "https://www.last.fm/music/Spoonie%2BGee",
    "credit": "Last.fm Spoonie Gee artist profile"
  },
  "vado": {
    "url": "https://www.last.fm/music/Vado",
    "credit": "Last.fm Vado artist profile"
  }
};

export const CURATED_DIRECT_PHOTOS: Readonly<Record<string, DirectArtistPhoto>> =
  {
  "bloodshed": {
    "url": "https://townsquare.media/site/812/files/2015/03/bloodshed.jpg?q=75&w=980",
    "sourceUrl": "https://www.xxlmag.com/today-hip-hop-rip-bloodshed-july-31-1975-march-2-1997/",
    "credit": "XXL artist memorial"
  },
  "t rex": {
    "url": "https://battlerapstats.wordpress.com/wp-content/uploads/2012/04/dhfzg.png?h=300&w=210",
    "sourceUrl": "https://battlerapstats.wordpress.com/2012/04/24/harlem-bettle-rapper-t-rex/",
    "credit": "BattleRapStats artist profile"
  }
};
