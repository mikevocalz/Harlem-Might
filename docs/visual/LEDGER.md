# Image ledger

Every shipped editorial image must resolve to a row here. Do not add an image URL, source claim, creator, license, or attribution string that has not been verified against the source.

## Active images

| id | Role | Image | Canonical source | Creator / date | Rights statement | Required credit | Current use | Takedown path |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `nypl-harlem-newspaper-stand-1939` | `historical` | `https://images.nypl.org/index.php?id=1800868&t=w` | `https://digitalcollections.nypl.org/items/e687af30-c6e8-012f-2a82-3c075448cc4b?canvasIndex=0` | Sid Grossman, 1915–1955; 1939 | “The New York Public Library believes this item is in the public domain under the laws of the United States, but did not make a determination as to its copyright status under the copyright laws of other countries.” | `Sid Grossman`; `From The New York Public Library` | Homepage “What a pin can’t tell you”; Explore/Discover pane; member auth; Press; empty/error notices | Remove `nypl-harlem-newspaper-stand-1939` from `HARLEM_ARCHIVAL_IMAGES` or unset its rendering surfaces, then redeploy. |
| `nypl-seventh-avenue-west-125th-1934` | `historical` | `https://images.nypl.org/index.php?id=5044623&t=w` | `https://digitalcollections.nypl.org/items/45aff4c0-c630-0130-9e95-58d385a7bbd0` | Creator not named on the source page; captured 1934-09-24 | “The New York Public Library believes this item is in the public domain under the laws of the United States, but did not make a determination as to its copyright status under the copyright laws of other countries.” | `Schomburg Center for Research in Black Culture, Photographs and Prints Division`; `From The New York Public Library` | About and legal-page mastheads | Remove `nypl-seventh-avenue-west-125th-1934` from `HARLEM_ARCHIVAL_IMAGES` or unset its rendering surfaces, then redeploy. |

## Interim-use note

The NYPL images are historical Harlem context only. They are not stand-ins for current storefronts, venues, event posters, or place heroes.

## Commissioned-photo gaps

No commissioned place photography is currently in the repository. The canonical preview roster still needs place-specific coverage for:

- Apollo Theater
- Red Rooster Harlem
- Sylvia's Restaurant
- Schomburg Center
- The Studio Museum in Harlem
- National Black Theatre
- Marcus Garvey Park
- Strivers' Row

CMS imagery added outside this repo must be represented in Media and pass `isDisplayableEditorialImage` before it can render.
