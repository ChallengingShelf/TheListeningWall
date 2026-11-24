# The Listening Wall

An endless, softly lit wall of wooden shelves for showing off a CD collection.
Drag around the shelves, open a CD to see its details and tracklist, flip the case
to see the back, and jump to Spotify. Plain HTML, CSS and JavaScript: no build step,
no frameworks, no server.

![The wall](docs/preview-wall.jpg)
![An album](docs/preview-album.jpg)
![The wheel](docs/preview-wheel.jpg)


## Make your own

1. Click **Use this template → Create a new repository** at the top of this page.
2. Add your CDs (below).
3. Publish it: in your new repository go to **Settings → Pages**, set *Source* to
   **Deploy from a branch**, pick `main` and `/ (root)`, and save. After a minute your wall is live at
   `https://<your-username>.github.io/<repository-name>/`.

You can also just download the code and open `index.html` in a browser.

## Adding your CDs

`albums.js` holds one entry per CD, numbered from 1 (AlbumNumber). This copy comes filled with an
example collection of 73 CDs and their cover photos: replace them with your own.

1. Photograph each CD front and back, and name the photos by AlbumNumber:
   `covers/01-front.jpg`, `covers/01-back.jpg`, `covers/02-front.jpg` …
   (.jpg, .jpeg, .png or .webp; iPhone HEIC photos need exporting as JPG first).
2. In `albums.js`, fill in the details for that number: `AlbumName`, `ArtistName`, `AlbumDate`,
   `AlbumYear`, `NumberOfTracks`, `AlbumLength` and the track names (add or delete track lines as needed).
3. Optional: paste Spotify links into `SpotifyAlbumUrl` / `SpotifyArtistUrl` (blank = Spotify search).
   For a greatest hits or compilation, add `IsCompilation: true` to hide the "Open album in Spotify" button
   (an artist of "Various Artists" is shown without a link).

Until a front photo is added, the wall shows an empty slot with the album number. Without a back photo,
the back of the case is made from the tracklist. To add a CD, copy the last entry and give it the next
AlbumNumber; to remove one, delete its entry and its photos. Photos around 640–1000px across keep the site fast.

## Make it yours

Everything adjustable lives in `config.js`:

- `SiteTitle`: the name shown at the top left and in the browser tab
- `FooterText`: the intro shown in the footer
- `SortAlbumsBy`: `"Random"` (new order every visit), `"Manual"`, `"AlbumNumber"`, `"ArtistName"`, `"AlbumName"`, `"AlbumYear"`
- `CdsPerShelf`, `CubbiesAcross`: shelf layout
- `WoodTextureImage`: use a real wood photo for the shelves (e.g. `"textures/walnut.jpg"`)
- `LightingColour`: `"Ember"` (red-lit record room), `"Red"` (deep red) or `"Amber"` (warm orange lamps)
- Motion: `MotionSwing` (the wall leans and drifts back as it moves), `MouseParallax` (the wheel tips towards the mouse),
  `ShowIntro` (loading counter, then the wall swings in) and `ShowHoverCaption` (album and artist follow the mouse).
  Set any of them to `0` / `false` to turn it off. Visitors who ask their device for reduced motion get a still wall.
- `DefaultView`: open on the `"Wall"` (shelves) or the `"Wheel"` (spinning ring)
- `StartZoom`: how zoomed out the wall opens (`1` = full size)
- Movement and zoom feel, and CD size limits

Colours, the lighting presets and fonts are at the top of `styles.css`. The page title is in `index.html`.

## Controls

Two views, switched with the toggle at the top right: the **wall** of shelves, and the **wheel**, a ring of
CDs that spins (link straight to it with `#wheel` on the end of the address). The shuffle button next to the
toggle opens a random album: the wall glides over to it, the wheel spins round to it.

- Move: drag, swipe, scroll wheel / trackpad, arrow keys or W A S D (on the wheel these spin the ring),
  or rest the mouse near the left, right or top edge of the screen (`EdgeScrollSpeed` in `config.js`; `0` turns it off)
- Zoom: pinch, or Ctrl / Cmd + scroll
- Click a CD: details, tracklist and Spotify links. Click the cover to flip the case.
  Browse to the next or previous album with the side arrows, a swipe, a sideways scroll or the ← → keys
- Footer: full list with search, sorted A–Z, Z–A, or by year (oldest or newest first). It waits as a small ^ tab; move the mouse to the bottom of the
  screen (or click / tap the tab) to bring it up. It stays up until you tuck it away with the down arrow
- Keyboard: Tab to a CD, Enter opens it, Enter on the cover flips it, Esc closes

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | The look: wood, lighting, cases, popup, footer |
| `app.js` | Layout, movement, zoom, popup and footer logic |
| `config.js` | Settings |
| `albums.js` | Your collection |
| `covers/` | Your front and back photos |
| `textures/` | The wood grain for the shelves |
| `docs/` | Preview images for this README (safe to delete) |

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE): free to use, change and share for any **non-commercial** purpose,
including your own personal collection site. Selling it, or using it for commercial purposes, is not allowed.
No credit is needed.
