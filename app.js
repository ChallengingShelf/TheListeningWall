/*

    ░▀█▀░█░█░█▀▀░░░█░░░▀█▀░█▀▀░▀█▀░█▀▀░█▀█░▀█▀░█▀█░█▀▀░░░█░█░█▀█░█░░░█░░
    ░░█░░█▀█░█▀▀░░░█░░░░█░░▀▀█░░█░░█▀▀░█░█░░█░░█░█░█░█░░░█▄█░█▀█░█░░░█░░
    ░░▀░░▀░▀░▀▀▀░░░▀▀▀░▀▀▀░▀▀▀░░▀░░▀▀▀░▀░▀░▀▀▀░▀░▀░▀▀▀░░░▀░▀░▀░▀░▀▀▀░▀▀▀

       ╭──┬────────────────────────────╮
       │▒▒│   THE LISTENING WALL  CD   │
       │▒▒│        .-"""""""-.         │
       │▒▒│      .'  .-----.  '.       │
       │▒▒│     /   /       \   \      │
       │▒▒│    |   |  ( ◎ )  |   |     │
       │▒▒│     \   \       /   /      │
       │▒▒│      '.  '-----'  .'       │
       │▒▒│        '-.......-'         │
       │▒▒│   ▶ 73 CDs                 │
       ╰──┴────────────────────────────╯

*/

/* =====================================================================
   THE LISTENING WALL — app.js
   1. Settings   2. Utilities   3. Album data   4. Textures + layout
   5. Album elements   6. Camera + motion   7. Input   8. Album taps
   9. Album details popup   10. Collection footer   11. Wheel view
   12. View toggle + shuffle   13. Intro + start-up
   Add CDs in albums.js; change behaviour in config.js.
   ===================================================================== */

(function StartListeningWall() {
    "use strict";

    /* ------------------------------------------------------------------ */
    /* 1. Settings (defaults; config.js overrides them)                   */
    /* ------------------------------------------------------------------ */

    const ShelfConfig = Object.assign({
        CdsPerShelf: 3,
        CubbiesAcross: "auto",
        WoodTextureImage: "",
        SortAlbumsBy: "Random",
        PanSmoothing: 0.2,
        PanFriction: 0.93,
        KeyboardPanSpeed: 16,
        MinimumZoom: 0.55,
        MaximumZoom: 2.2,
        StartZoom: 0.65,
        EdgeScrollSpeed: 1,
        SiteTitle: "The Listening Wall",
        FooterText: "",
        WheelPanMultiplier: 1,
        MinimumCdSizePx: 92,
        MaximumCdSizePx: 196,
        LightingColour: "Ember",
        MotionSwing: 1,
        MouseParallax: 1,
        ShowIntro: true,
        ShowHoverCaption: true,
        DefaultView: "Wall",
    }, window.ShelfConfig || {});

    const ListeningRoomElement = document.getElementById("ListeningRoom");
    const ShelfWallElement = document.getElementById("ShelfWall");
    const WallTiltElement = document.getElementById("WallTilt");
    const RootStyle = document.documentElement.style;
    const PrefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const CanHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    /* ------------------------------------------------------------------ */
    /* 2. Utilities                                                       */
    /* ------------------------------------------------------------------ */

    function ClampNumber(Value, Minimum, Maximum) {
        return Math.min(Maximum, Math.max(Minimum, Value));
    }

    function HashTextToNumber(Text) {
        let Hash = 2166136261;
        for (let CharacterIndex = 0; CharacterIndex < Text.length; CharacterIndex++) {
            Hash ^= Text.charCodeAt(CharacterIndex);
            Hash = Math.imul(Hash, 16777619);
        }
        return Hash >>> 0;
    }

    function CreateSeededRandom(Seed) {
        let State = (typeof Seed === "string" ? HashTextToNumber(Seed) : Seed) || 1;
        return function NextRandom() {
            State = (State + 0x6D2B79F5) | 0;
            let Mixed = Math.imul(State ^ (State >>> 15), 1 | State);
            Mixed = (Mixed + Math.imul(Mixed ^ (Mixed >>> 7), 61 | Mixed)) ^ Mixed;
            return ((Mixed ^ (Mixed >>> 14)) >>> 0) / 4294967296;
        };
    }

    function EaseOutCubic(Progress) {
        return 1 - Math.pow(1 - Progress, 3);
    }

    // Letters shuffle, then settle into the real text from left to right
    const SCRAMBLE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+";
    const ScrambleFrameIds = new WeakMap();

    function ScrambleText(TargetElement, FinalText, DurationMs = 520) {
        cancelAnimationFrame(ScrambleFrameIds.get(TargetElement));
        if (PrefersReducedMotion || !FinalText) {
            TargetElement.textContent = FinalText;
            return;
        }
        const StartTime = performance.now();
        const StepScramble = (FrameTime) => {
            const Progress = ClampNumber((FrameTime - StartTime) / DurationMs, 0, 1);
            const SettledCount = Math.floor(FinalText.length * EaseOutCubic(Progress));
            let ShownText = FinalText.slice(0, SettledCount);
            for (let CharacterIndex = SettledCount; CharacterIndex < FinalText.length; CharacterIndex++) {
                ShownText += FinalText[CharacterIndex] === " " ? " " : SCRAMBLE_CHARACTERS[(Math.random() * SCRAMBLE_CHARACTERS.length) | 0];
            }
            TargetElement.textContent = ShownText;
            if (Progress < 1) ScrambleFrameIds.set(TargetElement, requestAnimationFrame(StepScramble));
        };
        ScrambleFrameIds.set(TargetElement, requestAnimationFrame(StepScramble));
    }

    // --- Safety checks for links and paths that come from albums.js / config.js ---
    // Data files are edited by hand, so a typo (or a pasted link from somewhere odd) must never
    // become a script link or break out of a CSS url("…").

    // Spotify links: only real https://open.spotify.com/… addresses are used as they are
    function IsSafeSpotifyUrl(Url) {
        try {
            const ParsedUrl = new URL(String(Url));
            return ParsedUrl.protocol === "https:" && ParsedUrl.hostname === "open.spotify.com";
        } catch {
            return false;
        }
    }

    // Photo paths: a plain relative path (covers/01-front.webp) or an https:// address.
    // No other schemes (javascript:, data:, …), quotes, brackets, backslashes or control characters.
    function IsSafeAssetPath(AssetPath) {
        const PathText = String(AssetPath || "");
        if (!PathText || /["'()\\<>\u0000-\u001f]/.test(PathText) || PathText.startsWith("//")) return false;
        const SchemeMatch = PathText.match(/^([a-z][a-z0-9+.-]*):/i);
        return !SchemeMatch || SchemeMatch[1].toLowerCase() === "https";
    }

    function CreateSvgIcon(PathData, CircleData) {
        const SvgNamespace = "http://www.w3.org/2000/svg";
        const SvgElement = document.createElementNS(SvgNamespace, "svg");
        SvgElement.setAttribute("viewBox", "0 0 24 24");
        const PathElement = document.createElementNS(SvgNamespace, "path");
        PathElement.setAttribute("d", PathData);
        SvgElement.appendChild(PathElement);
        if (CircleData) {
            const CircleElement = document.createElementNS(SvgNamespace, "circle");
            for (const [AttributeName, AttributeValue] of Object.entries(CircleData)) CircleElement.setAttribute(AttributeName, AttributeValue);
            SvgElement.appendChild(CircleElement);
        }
        return SvgElement;
    }

    function CreateElement(TagName, ClassName, Attributes) {
        const NewElement = document.createElement(TagName);
        if (ClassName) NewElement.className = ClassName;
        if (Attributes) {
            for (const AttributeName in Attributes) NewElement.setAttribute(AttributeName, Attributes[AttributeName]);
        }
        return NewElement;
    }

    /* ------------------------------------------------------------------ */
    /* 3. Album data                                                      */
    /* ------------------------------------------------------------------ */

    // Every album gets a number; its photos are found from it (covers/01-front.jpg, covers/01-back.jpg)
    function NormaliseAlbum(RawAlbum, AlbumIndex) {
        const AlbumNumber = Number(RawAlbum.AlbumNumber) || AlbumIndex + 1;
        const AlbumNumberText = String(AlbumNumber).padStart(2, "0");
        const TrackList = Array.isArray(RawAlbum.TrackList) ? RawAlbum.TrackList : [];
        return {
            AlbumId: RawAlbum.AlbumId || `album-${AlbumNumberText}`,
            AlbumNumber,
            AlbumNumberText,
            AlbumName: RawAlbum.AlbumName || "Untitled",
            ArtistName: RawAlbum.ArtistName || "Unknown Artist",
            AlbumDate: RawAlbum.AlbumDate || "",
            AlbumYear: RawAlbum.AlbumYear || RawAlbum.ReleaseYear || "",
            NumberOfTracks: RawAlbum.NumberOfTracks || "",
            AlbumLength: RawAlbum.AlbumLength || "",
            FrontCoverImage: RawAlbum.FrontCoverImage || RawAlbum.CoverImage || `covers/${AlbumNumberText}-front.jpg`,
            BackCoverImage: RawAlbum.BackCoverImage || `covers/${AlbumNumberText}-back.jpg`,
            SpotifyAlbumUrl: RawAlbum.SpotifyAlbumUrl || "",
            SpotifyArtistUrl: RawAlbum.SpotifyArtistUrl || "",
            IsCompilation: RawAlbum.IsCompilation === true,
            TrackList: TrackList.map((Track) => (typeof Track === "string"
                ? { TrackName: Track, TrackLength: "" }
                : { TrackName: Track.TrackName || Track.TrackTitle || "", TrackLength: Track.TrackLength || "" })),
        };
    }

    function GetAlbumYearNumber(Album) {
        return parseInt(Album.AlbumYear, 10) || 0;
    }

    function SortAlbums(AlbumList, SortKey) {
        const SortedAlbums = AlbumList.slice();
        const CompareText = (FirstText, SecondText) => String(FirstText).localeCompare(String(SecondText), undefined, { sensitivity: "base" });
        const StripLeadingThe = (Text) => String(Text).replace(/^the\s+/i, "");
        switch (SortKey) {
            case "ArtistName":
                SortedAlbums.sort((A, B) => CompareText(StripLeadingThe(A.ArtistName), StripLeadingThe(B.ArtistName)) || (GetAlbumYearNumber(A) - GetAlbumYearNumber(B)));
                break;
            case "AlbumName":
                SortedAlbums.sort((A, B) => CompareText(StripLeadingThe(A.AlbumName), StripLeadingThe(B.AlbumName)));
                break;
            case "AlbumYear":
                SortedAlbums.sort((A, B) => (GetAlbumYearNumber(A) - GetAlbumYearNumber(B)) || CompareText(A.ArtistName, B.ArtistName));
                break;
            case "AlbumYearNewestFirst":
                SortedAlbums.sort((A, B) => (GetAlbumYearNumber(B) - GetAlbumYearNumber(A)) || CompareText(A.ArtistName, B.ArtistName));
                break;
            case "AlbumNumber":
                SortedAlbums.sort((A, B) => A.AlbumNumber - B.AlbumNumber);
                break;
            case "Random":
                // Fisher–Yates shuffle: a fresh order every time the page opens
                for (let AlbumIndex = SortedAlbums.length - 1; AlbumIndex > 0; AlbumIndex--) {
                    const SwapIndex = Math.floor(Math.random() * (AlbumIndex + 1));
                    [SortedAlbums[AlbumIndex], SortedAlbums[SwapIndex]] = [SortedAlbums[SwapIndex], SortedAlbums[AlbumIndex]];
                }
                break;
            default:
                break;
        }
        return SortedAlbums;
    }

    function GetSpotifyAlbumUrl(Album) {
        if (IsSafeSpotifyUrl(Album.SpotifyAlbumUrl)) return Album.SpotifyAlbumUrl;
        return `https://open.spotify.com/search/${encodeURIComponent(`${Album.AlbumName} ${Album.ArtistName}`)}/albums`;
    }

    function IsVariousArtists(Album) {
        return /^various artists$/i.test(String(Album.ArtistName).trim());
    }

    function GetSpotifyArtistUrl(Album) {
        if (IsSafeSpotifyUrl(Album.SpotifyArtistUrl)) return Album.SpotifyArtistUrl;
        return `https://open.spotify.com/search/${encodeURIComponent(Album.ArtistName)}/artists`;
    }

    function ConvertTrackLengthToSeconds(TrackLength) {
        if (!TrackLength) return 0;
        return String(TrackLength).split(":").reduce((TotalSeconds, Part) => TotalSeconds * 60 + (parseInt(Part, 10) || 0), 0);
    }

    // "12 tracks": NumberOfTracks if filled in, otherwise the TrackList is counted
    function GetTrackCountText(Album) {
        const TrackCount = Album.NumberOfTracks || Album.TrackList.length;
        if (!TrackCount) return "";
        if (Number.isNaN(Number(TrackCount))) return String(TrackCount); // template placeholder text
        return `${TrackCount} ${String(TrackCount) === "1" ? "track" : "tracks"}`;
    }

    // "47:32": AlbumLength if filled in, otherwise added up from the track lengths
    function GetAlbumLengthText(Album) {
        if (Album.AlbumLength) return String(Album.AlbumLength);
        const TotalSeconds = Album.TrackList.reduce((Sum, Track) => Sum + ConvertTrackLengthToSeconds(Track.TrackLength), 0);
        return TotalSeconds ? `${Math.round(TotalSeconds / 60)} min` : "";
    }

    // --- Photo slots: find an uploaded photo, whatever its file type ---

    const PHOTO_FILE_TYPES = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"];
    const ResolvedPhotoCache = new Map(); // photo path -> Promise of the working URL (or null)

    function TryLoadPhoto(PhotoUrl) {
        return new Promise((Resolve) => {
            const ProbeImage = new Image();
            ProbeImage.onload = () => Resolve(true);
            ProbeImage.onerror = () => Resolve(false);
            ProbeImage.src = PhotoUrl;
        });
    }

    // Tries the path as written, then the same name with other common photo file types
    function ResolvePhoto(PhotoPath) {
        if (!PhotoPath) return Promise.resolve(null);
        if (!IsSafeAssetPath(PhotoPath)) {
            console.warn(`[ListeningWall] Skipped an unusable photo path in albums.js: ${JSON.stringify(PhotoPath)}`);
            return Promise.resolve(null);
        }
        if (!ResolvedPhotoCache.has(PhotoPath)) {
            const PathWithoutType = PhotoPath.replace(/\.[a-z0-9]+$/i, "");
            const Candidates = [PhotoPath, ...PHOTO_FILE_TYPES.map((FileType) => PathWithoutType + FileType).filter((Candidate) => Candidate !== PhotoPath)];
            ResolvedPhotoCache.set(PhotoPath, (async () => {
                for (const Candidate of Candidates) {
                    if (await TryLoadPhoto(Candidate)) return Candidate;
                }
                return null;
            })());
        }
        return ResolvedPhotoCache.get(PhotoPath);
    }

    // Show the photo in an <img>, or mark the holder as an empty slot waiting for a photo
    function FillPhotoSlot(ImageElement, HolderElement, PhotoPath) {
        HolderElement.classList.remove("is-empty-slot");
        ResolvePhoto(PhotoPath).then((PhotoUrl) => {
            if (PhotoUrl) ImageElement.src = PhotoUrl;
            else HolderElement.classList.add("is-empty-slot");
        });
    }

    function CreateEmptySlotElement(Album) {
        const EmptySlotElement = CreateElement("span", "photo-slot", { "aria-hidden": "true" });
        EmptySlotElement.appendChild(CreateSvgIcon("M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z", { cx: "12", cy: "13.2", r: "3.4" }));
        const SlotNumberElement = CreateElement("span", "photo-slot__number");
        SlotNumberElement.textContent = Album.AlbumNumberText;
        EmptySlotElement.appendChild(SlotNumberElement);
        return EmptySlotElement;
    }

    const AlbumCollection = SortAlbums((window.CdCollection || []).map(NormaliseAlbum), ShelfConfig.SortAlbumsBy);
    const AlbumById = new Map(AlbumCollection.map((Album) => [Album.AlbumId, Album]));

    /* ------------------------------------------------------------------ */
    /* 4a. Textures (an optional wood photo in place of the built-in grain) */
    /* ------------------------------------------------------------------ */

    function RotateCanvasQuarterTurn(SourceCanvas) {
        const RotatedCanvas = document.createElement("canvas");
        RotatedCanvas.width = SourceCanvas.height;
        RotatedCanvas.height = SourceCanvas.width;
        const RotatedContext = RotatedCanvas.getContext("2d");
        RotatedContext.translate(RotatedCanvas.width, 0);
        RotatedContext.rotate(Math.PI / 2);
        RotatedContext.drawImage(SourceCanvas, 0, 0);
        return RotatedCanvas;
    }

    // Textures are handed to CSS as short blob: links. (A long data: URL inside a CSS variable
    // makes every style change on a cubby slow, and the curve restyles cubbies every frame.)
    function SetCanvasAsCssImage(PropertyName, SourceCanvas) {
        SourceCanvas.toBlob((ImageBlob) => {
            if (ImageBlob) RootStyle.setProperty(PropertyName, `url("${URL.createObjectURL(ImageBlob)}")`);
        }, "image/jpeg", 0.9);
    }

    // Optional: a real wood photo (ShelfConfig.WoodTextureImage) replaces the built-in grain
    // (textures/wood-grain.jpg, set in styles.css)
    function ApplyWoodPhotoTexture() {
        if (!ShelfConfig.WoodTextureImage) return;
        if (!IsSafeAssetPath(ShelfConfig.WoodTextureImage)) {
            console.warn("[ListeningWall] WoodTextureImage must be a plain path such as \"textures/walnut.jpg\" (or an https:// address).");
            return;
        }
        const WoodPhoto = new Image();
        WoodPhoto.onload = () => {
            try {
                const HorizontalCanvas = document.createElement("canvas");
                HorizontalCanvas.width = WoodPhoto.naturalWidth;
                HorizontalCanvas.height = WoodPhoto.naturalHeight;
                HorizontalCanvas.getContext("2d").drawImage(WoodPhoto, 0, 0);
                RootStyle.setProperty("--wood-grain-horizontal", `url("${ShelfConfig.WoodTextureImage}")`);
                SetCanvasAsCssImage("--wood-grain-vertical", RotateCanvasQuarterTurn(HorizontalCanvas));
            } catch {
                RootStyle.setProperty("--wood-grain-horizontal", `url("${ShelfConfig.WoodTextureImage}")`);
                RootStyle.setProperty("--wood-grain-vertical", `url("${ShelfConfig.WoodTextureImage}")`);
            }
        };
        WoodPhoto.onerror = () => console.warn(`[ListeningWall] Could not load WoodTextureImage "${ShelfConfig.WoodTextureImage}".`);
        WoodPhoto.src = ShelfConfig.WoodTextureImage;
    }

    /* ------------------------------------------------------------------ */
    /* 4b. Layout: the collection forms one tile of cubbies; tiles repeat */
    /* ------------------------------------------------------------------ */
    // in every direction and off-screen copies are recycled, so the wall never ends.

    // Sizes in CD-cover units; keep in step with the geometry tokens in styles.css
    const CUBBY_FRAME_IN_CD_UNITS = 0.12;
    const SLOT_GAP_IN_CD_UNITS = 0.14;
    const CASE_WIDTH_IN_CD_UNITS = 1.09;
    const CUBBY_HEIGHT_IN_CD_UNITS = 0.2 + 1.02 + 0.1;

    let CurrentLayoutMetrics = null;

    function ComputeLayoutMetrics() {
        const ViewportWidth = window.innerWidth;
        const ViewportHeight = window.innerHeight;
        const CdSizePx = Math.round(ClampNumber(
            Math.min(ViewportHeight * 0.17, ViewportWidth * 0.26),
            ShelfConfig.MinimumCdSizePx,
            ShelfConfig.MaximumCdSizePx
        ));
        const CdsPerShelf = Math.max(1, Math.round(ShelfConfig.CdsPerShelf));
        const CubbyCount = Math.max(1, Math.ceil(AlbumCollection.length / CdsPerShelf));

        let CubbiesAcross = Number(ShelfConfig.CubbiesAcross);
        if (!CubbiesAcross || ShelfConfig.CubbiesAcross === "auto") {
            // Shape the tile roughly like a landscape screen so repeats are far apart
            const CubbyWidthUnits = CUBBY_FRAME_IN_CD_UNITS + SLOT_GAP_IN_CD_UNITS + CdsPerShelf * (CASE_WIDTH_IN_CD_UNITS + SLOT_GAP_IN_CD_UNITS);
            const TargetTileAspect = Math.max(ViewportWidth / ViewportHeight, 1.3) * 1.15;
            const IdealAcross = Math.sqrt((CubbyCount * TargetTileAspect * CUBBY_HEIGHT_IN_CD_UNITS) / CubbyWidthUnits);
            // Prefer a width that fills the last row, so few CDs have to be repeated to fill it
            let BestScore = Infinity;
            for (let Candidate = Math.max(1, Math.floor(IdealAcross * 0.7)); Candidate <= Math.ceil(IdealAcross * 1.4); Candidate++) {
                const EmptyCubbies = Math.ceil(CubbyCount / Candidate) * Candidate - CubbyCount;
                const Score = EmptyCubbies * 1.5 + Math.abs(Candidate - IdealAcross);
                if (Score < BestScore) { BestScore = Score; CubbiesAcross = Candidate; }
            }
        }
        CubbiesAcross = ClampNumber(Math.round(CubbiesAcross), 1, CubbyCount);
        const CubbiesDown = Math.ceil(CubbyCount / CubbiesAcross);

        return {
            ViewportWidth,
            ViewportHeight,
            CdSizePx,
            CdsPerShelf,
            CubbiesAcross,
            CubbiesDown,
        };
    }

    function ApplyLayoutSizes(LayoutMetrics) {
        RootStyle.setProperty("--cd", `${LayoutMetrics.CdSizePx}px`);
        RootStyle.setProperty("--tile-columns", String(LayoutMetrics.CubbiesAcross));
        // The wall is seen through a lens about as far away as the screen is wide
        RootStyle.setProperty("--wall-perspective", `${Math.round(Math.max(LayoutMetrics.ViewportWidth, LayoutMetrics.ViewportHeight * 1.4) * 1.1)}px`);
        ScreenGeometry.CentreX = ScreenGeometry.HalfWidth = LayoutMetrics.ViewportWidth / 2;
        ScreenGeometry.CentreY = ScreenGeometry.HalfHeight = LayoutMetrics.ViewportHeight / 2;
    }

    function CreateShelfTileElement(LayoutMetrics) {
        const ShelfTileElement = CreateElement("div", "shelf-tile");
        for (let RowIndex = 0; RowIndex < LayoutMetrics.CubbiesDown; RowIndex++) {
            for (let ColumnIndex = 0; ColumnIndex < LayoutMetrics.CubbiesAcross; ColumnIndex++) {
                const CubbyIndex = RowIndex * LayoutMetrics.CubbiesAcross + ColumnIndex;
                ShelfTileElement.appendChild(CreateCubbyElement(CubbyIndex, LayoutMetrics));
            }
        }
        return ShelfTileElement;
    }

    function CreateCubbyElement(CubbyIndex, LayoutMetrics) {
        const NextRandom = CreateSeededRandom(`cubby-${CubbyIndex}`);
        const CubbyElement = CreateElement("div", "cubby");
        // Each board is cut from a different part of the plank, and some cubbies sit a touch darker
        CubbyElement.style.setProperty("--grain-x", `${Math.round(NextRandom() * -900)}px`);
        CubbyElement.style.setProperty("--grain-y", `${Math.round(NextRandom() * -400)}px`);
        CubbyElement.style.setProperty("--cubby-shade", (NextRandom() * 0.16).toFixed(3));
        CubbyElement.appendChild(CreateElement("span", "cubby-light", { "aria-hidden": "true" }));

        for (let SlotIndex = 0; SlotIndex < LayoutMetrics.CdsPerShelf; SlotIndex++) {
            // Every slot holds a CD face-up. Leftover slots at the end borrow CDs from the middle of the
            // collection: the start of the collection sits just below them, in the next copy of the tile.
            const SlotNumber = CubbyIndex * LayoutMetrics.CdsPerShelf + SlotIndex;
            const AlbumIndex = SlotNumber < AlbumCollection.length
                ? SlotNumber
                : (SlotNumber + Math.floor(AlbumCollection.length / 2)) % AlbumCollection.length;
            const Album = AlbumCollection[AlbumIndex];
            if (Album) CubbyElement.appendChild(CreateAlbumElement(Album));
        }
        CubbyElement.appendChild(CreateElement("span", "cubby-dim", { "aria-hidden": "true" }));
        return CubbyElement;
    }

    const TilePool = {
        Tiles: [],            // { TileElement, TileIndexX, TileIndexY }
        TileByElement: new WeakMap(),
        TileWidth: 1,
        TileHeight: 1,
        CopiesAcross: 1,
        CopiesDown: 1,
        FirstVisibleIndexX: null,
        FirstVisibleIndexY: null,
    };

    function AddTileToPool(TileElement) {
        const Tile = { TileElement, TileIndexX: null, TileIndexY: null };
        TilePool.Tiles.push(Tile);
        TilePool.TileByElement.set(TileElement, Tile);
    }

    function BuildTilePool(LayoutMetrics) {
        const FirstTileElement = CreateShelfTileElement(LayoutMetrics);
        ShelfWallElement.classList.remove("has-tile-size"); // measure a fully drawn tile
        ShelfWallElement.replaceChildren(FirstTileElement);
        // Exact (fractional) size, so copies butt together without hairline gaps
        const TileStyle = getComputedStyle(FirstTileElement);
        TilePool.TileWidth = Math.max(1, parseFloat(TileStyle.width));
        TilePool.TileHeight = Math.max(1, parseFloat(TileStyle.height));
        // Copies off the screen skip drawing (content-visibility in styles.css); this is the space they hold
        ShelfWallElement.style.setProperty("--tile-size", `${TilePool.TileWidth}px ${TilePool.TileHeight}px`);
        ShelfWallElement.classList.add("has-tile-size");
        // Enough copies to cover the screen when zoomed all the way out, plus a spare row and
        // column on every side for when the wall tilts and leans back
        TilePool.CopiesAcross = Math.ceil(LayoutMetrics.ViewportWidth / (TilePool.TileWidth * ShelfConfig.MinimumZoom)) + 2;
        TilePool.CopiesDown = Math.ceil(LayoutMetrics.ViewportHeight / (TilePool.TileHeight * ShelfConfig.MinimumZoom)) + 2;
        TilePool.Tiles = [];
        AddTileToPool(FirstTileElement);

        const TileCount = TilePool.CopiesAcross * TilePool.CopiesDown;
        for (let TileNumber = 1; TileNumber < TileCount; TileNumber++) {
            const TileCopyElement = CreateShelfTileElement(LayoutMetrics);
            ShelfWallElement.appendChild(TileCopyElement);
            AddTileToPool(TileCopyElement);
        }
        TilePool.FirstVisibleIndexX = TilePool.FirstVisibleIndexY = null;
    }

    function PlaceTile(Tile, TileIndexX, TileIndexY) {
        Tile.TileIndexX = TileIndexX;
        Tile.TileIndexY = TileIndexY;
        Tile.TileElement.style.transform = `translate3d(${TileIndexX * TilePool.TileWidth}px, ${TileIndexY * TilePool.TileHeight}px, 0)`;
    }

    // Make sure every tile position the screen can see has a tile in it
    function UpdateVisibleTiles() {
        const FirstVisibleIndexX = Math.floor(-CameraState.CurrentX / CameraState.CurrentScale / TilePool.TileWidth) - 1;
        const FirstVisibleIndexY = Math.floor(-CameraState.CurrentY / CameraState.CurrentScale / TilePool.TileHeight) - 1;
        if (FirstVisibleIndexX === TilePool.FirstVisibleIndexX && FirstVisibleIndexY === TilePool.FirstVisibleIndexY) return;
        TilePool.FirstVisibleIndexX = FirstVisibleIndexX;
        TilePool.FirstVisibleIndexY = FirstVisibleIndexY;

        const IsInView = (TileIndexX, TileIndexY) =>
            TileIndexX !== null &&
            TileIndexX >= FirstVisibleIndexX && TileIndexX < FirstVisibleIndexX + TilePool.CopiesAcross &&
            TileIndexY >= FirstVisibleIndexY && TileIndexY < FirstVisibleIndexY + TilePool.CopiesDown;

        const OccupiedPositions = new Set();
        const FreeTiles = [];
        TilePool.Tiles.forEach((Tile) => {
            if (IsInView(Tile.TileIndexX, Tile.TileIndexY)) OccupiedPositions.add(`${Tile.TileIndexX},${Tile.TileIndexY}`);
            else FreeTiles.push(Tile);
        });

        for (let OffsetY = 0; OffsetY < TilePool.CopiesDown; OffsetY++) {
            for (let OffsetX = 0; OffsetX < TilePool.CopiesAcross; OffsetX++) {
                const TileIndexX = FirstVisibleIndexX + OffsetX;
                const TileIndexY = FirstVisibleIndexY + OffsetY;
                if (OccupiedPositions.has(`${TileIndexX},${TileIndexY}`)) continue;
                const FreeTile = FreeTiles.pop();
                if (FreeTile) PlaceTile(FreeTile, TileIndexX, TileIndexY);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* 5. Album elements (wall CD, popup tray card)                       */
    /* ------------------------------------------------------------------ */

    function CreateAlbumElement(Album) {
        const NextRandom = CreateSeededRandom(Album.AlbumId);
        const AlbumElement = CreateElement("div", "cd", {
            tabindex: "0",
            role: "button",
            "aria-label": `${Album.AlbumName} by ${Album.ArtistName}`,
            "data-album-id": Album.AlbumId,
        });
        // Small, stable imperfections so the shelf looks hand-placed
        AlbumElement.style.setProperty("--lean", (0.975 + NextRandom() * 0.02).toFixed(3)); // leaning back a touch
        AlbumElement.style.setProperty("--tilt", `${((NextRandom() - 0.5) * 1.4).toFixed(2)}deg`);

        AlbumElement.appendChild(CreateElement("span", "cd-contact-shadow", { "aria-hidden": "true" }));
        AlbumElement.appendChild(CreateAlbumFrontElement(Album));
        return AlbumElement;
    }

    function CreateAlbumFrontElement(Album) {
        const AlbumFrontElement = CreateElement("div", "cd-face cd-front");
        const CoverImageElement = CreateElement("img", "cd-cover", {
            alt: "",
            draggable: "false",
            decoding: "async",
            loading: "lazy",
        });
        FillPhotoSlot(CoverImageElement, AlbumFrontElement, Album.FrontCoverImage);
        AlbumFrontElement.append(
            CoverImageElement,
            CreateEmptySlotElement(Album),
            CreateElement("span", "cd-hinge", { "aria-hidden": "true" }),
            CreateElement("span", "cd-gloss", { "aria-hidden": "true" }),
            CreateElement("span", "cd-uplight", { "aria-hidden": "true" })
        );
        return AlbumFrontElement;
    }

    // Back of the case: a tracklist tray card made from the album details
    function CreateAlbumBackElement(Album) {
        const AlbumBackElement = CreateElement("div", "cd-face cd-back");
        const SpineText = `${Album.ArtistName}  ·  ${Album.AlbumName}`;
        const LeftSpineElement = CreateElement("div", "cd-back__spine");
        LeftSpineElement.textContent = SpineText;
        const RightSpineElement = CreateElement("div", "cd-back__spine");
        RightSpineElement.textContent = SpineText;

        const BackBodyElement = CreateElement("div", "cd-back__body");
        const BackHeadingElement = CreateElement("p", "cd-back__heading");
        BackHeadingElement.textContent = Album.AlbumName;

        const TrackListElement = CreateElement("ol", "cd-back__tracks");
        const TrackCount = Album.TrackList.length;
        if (TrackCount > 14) {
            TrackListElement.classList.add("is-two-column");
            TrackListElement.style.gridTemplateRows = `repeat(${Math.ceil(TrackCount / 2)}, auto)`;
        } else if (TrackCount > 10) {
            TrackListElement.classList.add("is-compact");
        }

        Album.TrackList.forEach((Track, TrackIndex) => {
            const TrackElement = CreateElement("li", "cd-back__track");
            const TrackNumberElement = CreateElement("span", "cd-back__track-number");
            TrackNumberElement.textContent = String(TrackIndex + 1).padStart(2, "0");
            const TrackTitleElement = CreateElement("span", "cd-back__track-title");
            TrackTitleElement.textContent = Track.TrackName;
            const TrackLengthElement = CreateElement("span", "cd-back__track-length");
            TrackLengthElement.textContent = Track.TrackLength || "";
            TrackElement.append(TrackNumberElement, TrackTitleElement, TrackLengthElement);
            TrackListElement.appendChild(TrackElement);
        });

        const BackFooterElement = CreateElement("div", "cd-back__footer");
        const FooterTextElement = CreateElement("span", "");
        FooterTextElement.textContent = `${Album.ArtistName}${Album.AlbumYear ? ` · ${Album.AlbumYear}` : ""}`;
        BackFooterElement.append(FooterTextElement, CreateElement("span", "cd-back__barcode", { "aria-hidden": "true" }));

        BackBodyElement.append(BackHeadingElement, TrackListElement, BackFooterElement);
        AlbumBackElement.append(LeftSpineElement, BackBodyElement, RightSpineElement, CreateElement("span", "cd-gloss", { "aria-hidden": "true" }));
        return AlbumBackElement;
    }

    // The photo of the real back replaces the tray card once it is found
    function CreateAlbumBackPhotoElement(PhotoUrl) {
        const AlbumBackPhotoElement = CreateElement("div", "cd-face cd-back cd-back--photo");
        AlbumBackPhotoElement.appendChild(CreateElement("img", "", { src: PhotoUrl, alt: "", draggable: "false" }));
        AlbumBackPhotoElement.appendChild(CreateElement("span", "cd-gloss", { "aria-hidden": "true" }));
        return AlbumBackPhotoElement;
    }

    // Tint the popup's tray card with the cover's average colour
    const SharedTintCanvas = document.createElement("canvas");
    SharedTintCanvas.width = SharedTintCanvas.height = 8;
    const SharedTintContext = SharedTintCanvas.getContext("2d", { willReadFrequently: true });

    const AlbumTintCache = new Map(); // AlbumId -> colour

    function ApplyAlbumTintFromCover(CoverImageElement, AlbumElement) {
        const AlbumId = AlbumElement.dataset.albumId;
        if (AlbumTintCache.has(AlbumId)) {
            AlbumElement.style.setProperty("--album-tint", AlbumTintCache.get(AlbumId));
            return;
        }
        try {
            SharedTintContext.clearRect(0, 0, 8, 8);
            SharedTintContext.drawImage(CoverImageElement, 0, 0, 8, 8);
            const TintPixels = SharedTintContext.getImageData(0, 0, 8, 8).data;
            let Red = 0, Green = 0, Blue = 0;
            for (let PixelOffset = 0; PixelOffset < TintPixels.length; PixelOffset += 4) {
                Red += TintPixels[PixelOffset];
                Green += TintPixels[PixelOffset + 1];
                Blue += TintPixels[PixelOffset + 2];
            }
            const PixelCount = TintPixels.length / 4;
            const AlbumTint = `rgb(${Math.round(Red / PixelCount)}, ${Math.round(Green / PixelCount)}, ${Math.round(Blue / PixelCount)})`;
            AlbumTintCache.set(AlbumId, AlbumTint);
            AlbumElement.style.setProperty("--album-tint", AlbumTint);
        } catch {
            /* Cross-origin cover images cannot be sampled; the default tint is used. */
        }
    }

    /* ------------------------------------------------------------------ */
    /* 6. Camera + motion                                                 */
    /* ------------------------------------------------------------------ */
    // One animation loop moves the camera, swings the whole wall in 3D as it moves (it leans
    // into the motion and drifts back a little when flung, then springs home) and carries
    // the hover caption. The wall is tilted as one
    // GPU layer, so none of this redraws the shelves. The loop stops once all has settled.

    const CameraState = {
        CurrentX: 0, CurrentY: 0,
        TargetX: 0, TargetY: 0,
        VelocityX: 0, VelocityY: 0,
        PreviousX: 0, PreviousY: 0, // where the wall was drawn last frame (gives its speed)
        CurrentScale: 1,            // zoom level of the wall
        IsDragging: false,
    };

    const MotionState = {
        Depth: 0,                        // px the wall drifts back while moving fast (springs to 0)
        SwingX: 0, SwingY: 0,            // degrees the wall leans into the motion
        IsRunning: false,
        LastFrameTime: 0,
    };

    // Middle of the screen; refreshed by ApplyLayoutSizes
    const ScreenGeometry = { CentreX: 0, CentreY: 0, HalfWidth: 1, HalfHeight: 1 };

    const KEYBOARD_DIRECTIONS = {
        ArrowLeft: [1, 0], KeyA: [1, 0],
        ArrowRight: [-1, 0], KeyD: [-1, 0],
        ArrowUp: [0, 1], KeyW: [0, 1],
        ArrowDown: [0, -1], KeyS: [0, -1],
    };
    const HeldPanKeys = new Set();

    function WriteCameraTransform() {
        ShelfWallElement.style.transform = `translate3d(${CameraState.CurrentX.toFixed(2)}px, ${CameraState.CurrentY.toFixed(2)}px, 0) scale(${CameraState.CurrentScale.toFixed(4)})`;
        UpdateVisibleTiles();
    }

    // Lean and drift, applied to the wall as a whole around the middle of the screen
    function WriteWallTilt() {
        const TurnY = MotionState.SwingY;
        const TurnX = MotionState.SwingX;
        const IsLevel = Math.abs(TurnX) < 0.005 && Math.abs(TurnY) < 0.005 && Math.abs(MotionState.Depth) < 0.05;
        WallTiltElement.style.transform = IsLevel ? "" :
            `translate3d(0, 0, ${(-MotionState.Depth).toFixed(1)}px) rotateY(${TurnY.toFixed(3)}deg) rotateX(${TurnX.toFixed(3)}deg)`;
    }

    // While the wall moves it is kept on its own GPU layer (smooth); once it rests for a moment the
    // layer hint is dropped so the browser redraws it sharply at the current zoom.
    let RestingLayerTimeoutId = null;
    function MarkWallMoving() {
        clearTimeout(RestingLayerTimeoutId);
        if (ShelfWallElement.style.willChange !== "transform") ShelfWallElement.style.willChange = "transform";
    }
    function MarkWallResting() {
        clearTimeout(RestingLayerTimeoutId);
        RestingLayerTimeoutId = setTimeout(() => { ShelfWallElement.style.willChange = ""; }, 300);
    }

    function RequestMotionFrame() {
        MarkWallMoving();
        if (MotionState.IsRunning) return;
        MotionState.IsRunning = true;
        MotionState.LastFrameTime = performance.now();
        requestAnimationFrame(RunMotionFrame);
    }

    // Move the camera one frame; returns true once it has come to rest
    // --- Edge scrolling (mouse only) ---
    // Resting the mouse near the left, right, top or bottom edge (the top of the footer) moves the
    // view that way: the wall pans, the wheel turns (left / right). The closer to the edge, the faster.
    const EDGE_SCROLL_ZONE_PX = 70;
    const EdgeScrollState = { X: 0, Y: 0 }; // -1 … 1 each: how far into the left / right and top zones

    function GetEdgeScrollAmount() {
        if (IsAlbumDetailsOpen() || !(ShelfConfig.EdgeScrollSpeed > 0)) return { X: 0, Y: 0 };
        return EdgeScrollState;
    }

    function HandleEdgeScrollPointerMove(PointerEvent) {
        let AmountX = 0, AmountY = 0;
        const IsOverControls = PointerEvent.target && PointerEvent.target.closest &&
            PointerEvent.target.closest(".view-controls, .collection-footer, .album-details");
        if (PointerEvent.pointerType === "mouse" && !PointerEvent.buttons && !IsOverControls) {
            const Zone = Math.min(EDGE_SCROLL_ZONE_PX, window.innerWidth * 0.08);
            const Depth = (Distance) => { const Inside = ClampNumber(1 - Distance / Zone, 0, 1); return Inside * Inside; };
            AmountX = Depth(PointerEvent.clientX) - Depth(window.innerWidth - 1 - PointerEvent.clientX); // + = left edge
            // The bottom edge is the top of the footer (the bottom of the screen when it's tucked away)
            const FooterTop = CollectionFooterElements.Footer ? CollectionFooterElements.Footer.getBoundingClientRect().top : window.innerHeight;
            const BottomEdge = Math.min(window.innerHeight, FooterTop);
            AmountY = Depth(PointerEvent.clientY) - Depth(BottomEdge - 1 - PointerEvent.clientY);     // + = top edge, - = bottom
        }
        SetEdgeScroll(AmountX, AmountY);
    }

    function SetEdgeScroll(AmountX, AmountY) {
        const WasScrolling = EdgeScrollState.X || EdgeScrollState.Y;
        EdgeScrollState.X = AmountX;
        EdgeScrollState.Y = AmountY;
        if (!WasScrolling && (AmountX || AmountY)) {
            if (IsWheelViewActive()) RequestWheelFrame();
            else RequestMotionFrame();
        }
    }

    function StepCamera(FrameScale) {
        const EdgeScroll = CameraState.IsDragging || IsWheelViewActive() ? { X: 0, Y: 0 } : GetEdgeScrollAmount();
        const IsEdgeScrolling = !!(EdgeScroll.X || EdgeScroll.Y);
        if (IsEdgeScrolling) {
            const EdgeSpeed = ShelfConfig.KeyboardPanSpeed * 0.4 * ShelfConfig.EdgeScrollSpeed; // an unhurried drift
            CameraState.VelocityX += (EdgeScroll.X * EdgeSpeed - CameraState.VelocityX) * 0.18 * FrameScale;
            CameraState.VelocityY += (EdgeScroll.Y * EdgeSpeed - CameraState.VelocityY) * 0.18 * FrameScale;
        } else if (HeldPanKeys.size && !IsAlbumDetailsOpen()) {
            let DirectionX = 0, DirectionY = 0;
            HeldPanKeys.forEach((KeyCode) => {
                DirectionX += KEYBOARD_DIRECTIONS[KeyCode][0];
                DirectionY += KEYBOARD_DIRECTIONS[KeyCode][1];
            });
            const DesiredVelocityX = ClampNumber(DirectionX, -1, 1) * ShelfConfig.KeyboardPanSpeed;
            const DesiredVelocityY = ClampNumber(DirectionY, -1, 1) * ShelfConfig.KeyboardPanSpeed;
            CameraState.VelocityX += (DesiredVelocityX - CameraState.VelocityX) * 0.18 * FrameScale;
            CameraState.VelocityY += (DesiredVelocityY - CameraState.VelocityY) * 0.18 * FrameScale;
        }

        if (!CameraState.IsDragging) {
            CameraState.TargetX += CameraState.VelocityX * FrameScale;
            CameraState.TargetY += CameraState.VelocityY * FrameScale;
            if (!HeldPanKeys.size && !IsEdgeScrolling) {
                const FrictionThisFrame = Math.pow(ShelfConfig.PanFriction, FrameScale);
                CameraState.VelocityX *= FrictionThisFrame;
                CameraState.VelocityY *= FrictionThisFrame;
            }
        }

        const Smoothing = CameraState.IsDragging ? 0.5 : ShelfConfig.PanSmoothing;
        const FollowAmount = PrefersReducedMotion ? 1 : 1 - Math.pow(1 - Smoothing, FrameScale);
        CameraState.CurrentX += (CameraState.TargetX - CameraState.CurrentX) * FollowAmount;
        CameraState.CurrentY += (CameraState.TargetY - CameraState.CurrentY) * FollowAmount;

        const IsSettled =
            !CameraState.IsDragging && !HeldPanKeys.size && !IsEdgeScrolling &&
            Math.abs(CameraState.TargetX - CameraState.CurrentX) < 0.1 &&
            Math.abs(CameraState.TargetY - CameraState.CurrentY) < 0.1 &&
            Math.abs(CameraState.VelocityX) < 0.05 && Math.abs(CameraState.VelocityY) < 0.05;
        if (IsSettled) {
            CameraState.CurrentX = CameraState.TargetX = Math.round(CameraState.TargetX);
            CameraState.CurrentY = CameraState.TargetY = Math.round(CameraState.TargetY);
            CameraState.VelocityX = CameraState.VelocityY = 0;
        }
        return IsSettled;
    }

    // Springs for the lean and the drift; returns true once they have settled
    function StepMotion(FrameScale) {
        const SpeedX = (CameraState.CurrentX - CameraState.PreviousX) / FrameScale;
        const SpeedY = (CameraState.CurrentY - CameraState.PreviousY) / FrameScale;
        CameraState.PreviousX = CameraState.CurrentX;
        CameraState.PreviousY = CameraState.CurrentY;
        if (PrefersReducedMotion) return true;

        const Ease = (Amount) => 1 - Math.pow(1 - Amount, FrameScale);
        const Swing = Math.max(0, ShelfConfig.MotionSwing);
        // Fast movement pushes the wall back a little and leans it into the motion
        const DepthTarget = Swing * ClampNumber(Math.hypot(SpeedX, SpeedY) * 2.2, 0, 110);
        MotionState.Depth += (DepthTarget - MotionState.Depth) * Ease(DepthTarget > MotionState.Depth ? 0.1 : 0.06);
        MotionState.SwingY += (ClampNumber(SpeedX * 0.12 * Swing, -6, 6) - MotionState.SwingY) * Ease(0.1);
        MotionState.SwingX += (ClampNumber(-SpeedY * 0.12 * Swing, -6, 6) - MotionState.SwingX) * Ease(0.1);
        StepHoverCaption(FrameScale);

        return Math.abs(DepthTarget - MotionState.Depth) < 0.05 &&
            Math.abs(MotionState.SwingX) < 0.02 && Math.abs(MotionState.SwingY) < 0.02 &&
            IsHoverCaptionSettled();
    }

    function RunMotionFrame(FrameTime) {
        const FrameScale = ClampNumber((FrameTime - MotionState.LastFrameTime) / 16.667, 0.25, 4);
        MotionState.LastFrameTime = FrameTime;
        const IsCameraSettled = StepCamera(FrameScale);
        const IsMotionSettled = StepMotion(FrameScale);
        WriteCameraTransform();
        WriteWallTilt();

        if (IsCameraSettled && IsMotionSettled) {
            MotionState.IsRunning = false;
            MarkWallResting();
            return;
        }
        requestAnimationFrame(RunMotionFrame);
    }


    // --- Zoom (pinch, trackpad, Ctrl / Cmd + scroll) ---

    // Change the zoom while keeping the point under (FocusX, FocusY) on the screen still
    function ZoomCameraAboutPoint(NewScale, FocusX, FocusY) {
        const ClampedScale = ClampNumber(NewScale, ShelfConfig.MinimumZoom, ShelfConfig.MaximumZoom);
        const ScaleRatio = ClampedScale / CameraState.CurrentScale;
        if (ScaleRatio === 1) return;
        CameraState.CurrentX = FocusX - (FocusX - CameraState.CurrentX) * ScaleRatio;
        CameraState.CurrentY = FocusY - (FocusY - CameraState.CurrentY) * ScaleRatio;
        CameraState.TargetX = FocusX - (FocusX - CameraState.TargetX) * ScaleRatio;
        CameraState.TargetY = FocusY - (FocusY - CameraState.TargetY) * ScaleRatio;
        CameraState.PreviousX = FocusX - (FocusX - CameraState.PreviousX) * ScaleRatio; // zooming is not a swing
        CameraState.PreviousY = FocusY - (FocusY - CameraState.PreviousY) * ScaleRatio;
        CameraState.CurrentScale = ClampedScale;
        WriteCameraTransform();
        RequestMotionFrame();
    }

    // Middle of the part of the screen the footer does not cover
    function GetVisibleWallCentre() {
        return { CentreX: window.innerWidth / 2, CentreY: (window.innerHeight - GetFooterHeight()) / 2 };
    }

    // Two-finger pinch on touch screens
    const ActiveTouchPoints = new Map(); // pointerId -> { X, Y }
    let PinchState = null;               // { StartDistance, StartScale, LastMidX, LastMidY }

    function GetPinchGeometry() {
        const [FirstPoint, SecondPoint] = Array.from(ActiveTouchPoints.values());
        return {
            Distance: Math.max(1, Math.hypot(SecondPoint.X - FirstPoint.X, SecondPoint.Y - FirstPoint.Y)),
            MidX: (FirstPoint.X + SecondPoint.X) / 2,
            MidY: (FirstPoint.Y + SecondPoint.Y) / 2,
        };
    }

    function StartPinch() {
        const { Distance, MidX, MidY } = GetPinchGeometry();
        PinchState = { StartDistance: Distance, StartScale: CameraState.CurrentScale, LastMidX: MidX, LastMidY: MidY };
        // A pinch is never a tap or a drag
        PointerState.PressedAlbumElement = null;
        PointerState.HasMovedBeyondTapThreshold = true;
        CameraState.IsDragging = false;
        CameraState.VelocityX = CameraState.VelocityY = 0;
        CameraState.TargetX = CameraState.CurrentX;
        CameraState.TargetY = CameraState.CurrentY;
    }

    function UpdatePinch() {
        const { Distance, MidX, MidY } = GetPinchGeometry();
        // Move with the fingers, then zoom around the point between them
        CameraState.CurrentX += MidX - PinchState.LastMidX;
        CameraState.CurrentY += MidY - PinchState.LastMidY;
        CameraState.TargetX = CameraState.CurrentX;
        CameraState.TargetY = CameraState.CurrentY;
        PinchState.LastMidX = MidX;
        PinchState.LastMidY = MidY;
        ZoomCameraAboutPoint(PinchState.StartScale * (Distance / PinchState.StartDistance), MidX, MidY);
        WriteCameraTransform();
        RequestMotionFrame();
    }

    // Safari on Mac sends trackpad pinches as gesture events
    let GestureStartScale = 1;
    function HandleGestureStart(GestureEvent) {
        GestureEvent.preventDefault();
        GestureStartScale = CameraState.CurrentScale;
    }
    function HandleGestureChange(GestureEvent) {
        GestureEvent.preventDefault();
        if (IsAlbumDetailsOpen() || IsWheelViewActive()) return;
        ZoomCameraAboutPoint(GestureStartScale * GestureEvent.scale, GestureEvent.clientX, GestureEvent.clientY);
    }

    function PanCameraBy(DeltaX, DeltaY) {
        CameraState.TargetX += DeltaX;
        CameraState.TargetY += DeltaY;
        RequestMotionFrame();
    }

    // Where an album would sit on screen if the wall were flat (the curve only bends the view)
    function GetFlatAlbumCentre(AlbumElement) {
        const CubbyElement = AlbumElement.parentElement;
        const Tile = TilePool.TileByElement.get(CubbyElement.parentElement);
        const Scale = CameraState.CurrentScale;
        return {
            X: CameraState.CurrentX + Scale * (Tile.TileIndexX * TilePool.TileWidth + CubbyElement.offsetLeft + AlbumElement.offsetLeft + AlbumElement.offsetWidth / 2),
            Y: CameraState.CurrentY + Scale * (Tile.TileIndexY * TilePool.TileHeight + CubbyElement.offsetTop + AlbumElement.offsetTop + AlbumElement.offsetHeight / 2),
        };
    }

    // Glide the wall so an album sits in the middle of the screen
    function CentreAlbumOnScreen(AlbumElement) {
        const AlbumCentre = GetFlatAlbumCentre(AlbumElement);
        const { CentreX, CentreY } = GetVisibleWallCentre();
        const ShiftX = CentreX - AlbumCentre.X;
        const ShiftY = CentreY - AlbumCentre.Y;
        CameraState.VelocityX = CameraState.VelocityY = 0;
        CameraState.TargetX = CameraState.CurrentX; // measure from where the wall is drawn now
        CameraState.TargetY = CameraState.CurrentY;
        PanCameraBy(ShiftX, ShiftY);
    }

    // Bring an element fully into view (keyboard focus)
    function PanElementIntoView(TargetElement, MarginPx = 24) {
        const ElementRect = TargetElement.getBoundingClientRect();
        let ShiftX = 0, ShiftY = 0;
        if (ElementRect.left < MarginPx) ShiftX = MarginPx - ElementRect.left;
        else if (ElementRect.right > window.innerWidth - MarginPx) ShiftX = window.innerWidth - MarginPx - ElementRect.right;
        if (ElementRect.top < MarginPx) ShiftY = MarginPx - ElementRect.top;
        else if (ElementRect.bottom > window.innerHeight - GetFooterHeight() - MarginPx) ShiftY = window.innerHeight - GetFooterHeight() - MarginPx - ElementRect.bottom;
        if (ShiftX || ShiftY) {
            CameraState.VelocityX = CameraState.VelocityY = 0;
            PanCameraBy(ShiftX, ShiftY);
        }
    }

    /* ------------------------------------------------------------------ */
    /* 7. Input: pointer drag / tap, wheel, keyboard                      */
    /* ------------------------------------------------------------------ */

    const PointerState = {
        ActivePointerId: null,
        StartX: 0, StartY: 0,
        LastX: 0, LastY: 0,
        LastMoveTime: 0,
        HasMovedBeyondTapThreshold: false,
        PressedAlbumElement: null,
    };
    const TAP_MOVEMENT_THRESHOLD_PX = 8;

    function HandlePointerDown(PointerEvent) {
        CancelWallShuffle(); // taking hold of the wall stops a shuffle in progress
        if (PointerEvent.pointerType === "touch") {
            ActiveTouchPoints.set(PointerEvent.pointerId, { X: PointerEvent.clientX, Y: PointerEvent.clientY });
            if (ActiveTouchPoints.size === 2) {
                try { ListeningRoomElement.setPointerCapture(PointerEvent.pointerId); } catch { /* ignore */ }
                StartPinch();
                return;
            }
        }
        if (PointerState.ActivePointerId !== null) return;
        if (PointerEvent.pointerType === "mouse" && PointerEvent.button !== 0) return;
        if (PointerEvent.pointerType === "mouse") PointerEvent.preventDefault();

        PointerState.ActivePointerId = PointerEvent.pointerId;
        PointerState.StartX = PointerState.LastX = PointerEvent.clientX;
        PointerState.StartY = PointerState.LastY = PointerEvent.clientY;
        PointerState.LastMoveTime = performance.now();
        PointerState.HasMovedBeyondTapThreshold = false;
        PointerState.PressedAlbumElement = PointerEvent.target.closest ? PointerEvent.target.closest(".cd") : null;

        CameraState.VelocityX = CameraState.VelocityY = 0;
        CameraState.TargetX = CameraState.CurrentX; // catch the wall where it is
        CameraState.TargetY = CameraState.CurrentY;
        try { ListeningRoomElement.setPointerCapture(PointerEvent.pointerId); } catch { /* ignore */ }
    }

    function HandlePointerMove(PointerEvent) {
        if (ActiveTouchPoints.has(PointerEvent.pointerId)) {
            ActiveTouchPoints.set(PointerEvent.pointerId, { X: PointerEvent.clientX, Y: PointerEvent.clientY });
            if (PinchState) {
                if (ActiveTouchPoints.size >= 2) UpdatePinch();
                return;
            }
        }
        if (PointerEvent.pointerId !== PointerState.ActivePointerId) return;
        const DeltaX = PointerEvent.clientX - PointerState.LastX;
        const DeltaY = PointerEvent.clientY - PointerState.LastY;

        if (!PointerState.HasMovedBeyondTapThreshold) {
            const DistanceFromStart = Math.hypot(PointerEvent.clientX - PointerState.StartX, PointerEvent.clientY - PointerState.StartY);
            if (DistanceFromStart < TAP_MOVEMENT_THRESHOLD_PX) return;
            PointerState.HasMovedBeyondTapThreshold = true;
            CameraState.IsDragging = true;
            ListeningRoomElement.classList.add("is-dragging");
            HideHoverCaption();
        }

        const Now = performance.now();
        const ElapsedMs = Math.max(1, Now - PointerState.LastMoveTime);
        PointerState.LastX = PointerEvent.clientX;
        PointerState.LastY = PointerEvent.clientY;
        PointerState.LastMoveTime = Now;

        CameraState.TargetX += DeltaX;
        CameraState.TargetY += DeltaY;

        const InstantVelocityX = (DeltaX / ElapsedMs) * 16.667;
        const InstantVelocityY = (DeltaY / ElapsedMs) * 16.667;
        CameraState.VelocityX = CameraState.VelocityX * 0.6 + InstantVelocityX * 0.4;
        CameraState.VelocityY = CameraState.VelocityY * 0.6 + InstantVelocityY * 0.4;
        RequestMotionFrame();
    }

    function HandlePointerUp(PointerEvent) {
        ActiveTouchPoints.delete(PointerEvent.pointerId);
        if (PinchState) {
            // The pinch ends when a finger lifts; the other finger is ignored until it lifts too
            if (ActiveTouchPoints.size < 2) {
                PinchState = null;
                PointerState.ActivePointerId = null;
                ListeningRoomElement.classList.remove("is-dragging");
            }
            return;
        }
        if (PointerEvent.pointerId !== PointerState.ActivePointerId) return;
        PointerState.ActivePointerId = null;
        ListeningRoomElement.classList.remove("is-dragging");

        if (PointerState.HasMovedBeyondTapThreshold) {
            CameraState.IsDragging = false;
            if (performance.now() - PointerState.LastMoveTime > 90 || PointerEvent.type === "pointercancel") {
                CameraState.VelocityX = CameraState.VelocityY = 0;
            }
            CameraState.VelocityX = ClampNumber(CameraState.VelocityX, -90, 90);
            CameraState.VelocityY = ClampNumber(CameraState.VelocityY, -90, 90);
            RequestMotionFrame();
        } else if (PointerEvent.type === "pointerup") {
            HandleAlbumTap(PointerState.PressedAlbumElement);
        }
        PointerState.PressedAlbumElement = null;
    }

    function HandleWheel(WheelEvent) {
        CancelWallShuffle();
        if (IsAlbumDetailsOpen()) return;
        WheelEvent.preventDefault();
        HideHoverCaption(); // the CD under the mouse is about to change
        const DeltaModeScale = WheelEvent.deltaMode === 1 ? 16 : WheelEvent.deltaMode === 2 ? window.innerHeight : 1;
        let DeltaX = WheelEvent.deltaX * DeltaModeScale;
        let DeltaY = WheelEvent.deltaY * DeltaModeScale;
        // Trackpad pinches arrive as wheel events with ctrlKey; Ctrl / Cmd + scroll zooms with a mouse
        if (WheelEvent.ctrlKey || WheelEvent.metaKey) {
            ZoomCameraAboutPoint(CameraState.CurrentScale * Math.exp(-ClampNumber(DeltaY, -60, 60) * 0.01), WheelEvent.clientX, WheelEvent.clientY);
            return;
        }
        if (WheelEvent.shiftKey && !DeltaX) { DeltaX = DeltaY; DeltaY = 0; }
        CameraState.VelocityX = CameraState.VelocityY = 0;
        PanCameraBy(-DeltaX * ShelfConfig.WheelPanMultiplier, -DeltaY * ShelfConfig.WheelPanMultiplier);
    }

    function HandleKeyDown(KeyboardEvent) {
        if (KeyboardEvent.metaKey || KeyboardEvent.ctrlKey || KeyboardEvent.altKey) return;

        if (KeyboardEvent.key === "Escape") {
            if (IsAlbumDetailsOpen()) CloseAlbumDetails();
            return;
        }
        if (IsAlbumDetailsOpen()) {
            if (KeyboardEvent.key === "ArrowLeft" || KeyboardEvent.key === "ArrowRight") {
                KeyboardEvent.preventDefault();
                StepAlbumDetails(KeyboardEvent.key === "ArrowRight" ? 1 : -1);
            }
            return;
        }
        if (CollectionFooterElements.Footer && CollectionFooterElements.Footer.contains(document.activeElement)) return;
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".view-controls")) return;
        if (IsWheelViewActive()) {
            HandleWheelKeyDown(KeyboardEvent);
            return;
        }

        if (KEYBOARD_DIRECTIONS[KeyboardEvent.code]) {
            KeyboardEvent.preventDefault();
            HeldPanKeys.add(KeyboardEvent.code);
            RequestMotionFrame();
            return;
        }

        const FocusedAlbumElement = document.activeElement && document.activeElement.closest && document.activeElement.closest(".cd");
        if (!FocusedAlbumElement) return;
        if (KeyboardEvent.key === "Enter" || KeyboardEvent.key === " ") {
            KeyboardEvent.preventDefault();
            OpenAlbumDetails(FocusedAlbumElement, true);
        }
    }

    function HandleKeyUp(KeyboardEvent) {
        HeldPanKeys.delete(KeyboardEvent.code);
    }

    /* ------------------------------------------------------------------ */
    /* 8. Album taps + hover caption                                      */
    /* ------------------------------------------------------------------ */

    // One click / tap: glide the CD to the middle of the wall and open its details
    function HandleAlbumTap(AlbumElement) {
        if (!AlbumElement) return;
        CentreAlbumOnScreen(AlbumElement);
        OpenAlbumDetails(AlbumElement);
    }

    // --- Hover caption: album + artist trail the mouse over a CD (mouse only) ---

    const HoverCaptionElements = {
        Caption: document.getElementById("HoverCaption"),
        Album: document.getElementById("HoverCaptionAlbum"),
        Artist: document.getElementById("HoverCaptionArtist"),
    };
    const HoverCaptionState = { AlbumId: null, IsVisible: false, TargetX: 0, TargetY: 0, X: 0, Y: 0, Width: 0 };
    const IsHoverCaptionEnabled = CanHover && ShelfConfig.ShowHoverCaption && !!HoverCaptionElements.Caption;

    function ShowHoverCaption(AlbumElement) {
        const Album = AlbumById.get(AlbumElement.dataset.albumId);
        if (!Album) return;
        if (HoverCaptionState.AlbumId !== Album.AlbumId) {
            HoverCaptionState.AlbumId = Album.AlbumId;
            HoverCaptionElements.Album.textContent = Album.AlbumName;
            HoverCaptionState.Width = HoverCaptionElements.Caption.offsetWidth; // measured with the real name
            ScrambleText(HoverCaptionElements.Album, Album.AlbumName, 420);
            ScrambleText(HoverCaptionElements.Artist, Album.ArtistName, 520);
        }
        if (!HoverCaptionState.IsVisible) {
            HoverCaptionState.IsVisible = true;
            HoverCaptionState.X = HoverCaptionState.TargetX;
            HoverCaptionState.Y = HoverCaptionState.TargetY;
            HoverCaptionElements.Caption.classList.add("is-visible");
        }
        RequestMotionFrame();
    }

    function HideHoverCaption() {
        if (!HoverCaptionState.IsVisible) return;
        HoverCaptionState.IsVisible = false;
        HoverCaptionElements.Caption.classList.remove("is-visible");
    }

    function HandleHoverPointerMove(PointerEvent) {
        if (!IsHoverCaptionEnabled || PointerEvent.pointerType !== "mouse") return;
        // Sit below-right of the pointer, or below-left near the right edge of the screen
        const FitsOnRight = PointerEvent.clientX + 22 + HoverCaptionState.Width < window.innerWidth - 12;
        HoverCaptionState.TargetX = FitsOnRight ? PointerEvent.clientX + 22 : PointerEvent.clientX - 22 - HoverCaptionState.Width;
        HoverCaptionState.TargetY = Math.min(PointerEvent.clientY + 26, window.innerHeight - 80);
        const HoveredAlbumElement = !CameraState.IsDragging && !IsAlbumDetailsOpen() && PointerEvent.target.closest && PointerEvent.target.closest("#ShelfWall .cd");
        if (HoveredAlbumElement) ShowHoverCaption(HoveredAlbumElement);
        else HideHoverCaption();
        if (HoverCaptionState.IsVisible) RequestMotionFrame();
    }

    function StepHoverCaption(FrameScale) {
        if (!IsHoverCaptionEnabled) return;
        const FollowAmount = 1 - Math.pow(1 - 0.2, FrameScale);
        HoverCaptionState.X += (HoverCaptionState.TargetX - HoverCaptionState.X) * FollowAmount;
        HoverCaptionState.Y += (HoverCaptionState.TargetY - HoverCaptionState.Y) * FollowAmount;
        HoverCaptionElements.Caption.style.transform = `translate3d(${HoverCaptionState.X.toFixed(1)}px, ${HoverCaptionState.Y.toFixed(1)}px, 0)`;
    }

    function IsHoverCaptionSettled() {
        return !IsHoverCaptionEnabled || (Math.abs(HoverCaptionState.TargetX - HoverCaptionState.X) < 0.3 && Math.abs(HoverCaptionState.TargetY - HoverCaptionState.Y) < 0.3);
    }

    function HandleAlbumFocus(FocusEvent) {
        const AlbumElement = FocusEvent.target.closest && FocusEvent.target.closest(".cd");
        if (!AlbumElement) return;
        let IsKeyboardFocus = true;
        try { IsKeyboardFocus = AlbumElement.matches(":focus-visible"); } catch { /* old browser */ }
        if (IsKeyboardFocus) PanElementIntoView(AlbumElement, 48);
    }

    /* ------------------------------------------------------------------ */
    /* 9. Album details popup (click the case to flip it)                 */
    /* ------------------------------------------------------------------ */

    const AlbumDetailsElements = {
        Popup: document.getElementById("AlbumDetailsPopup"),
        Cover: document.getElementById("AlbumDetailsCover"),
        Meta: document.getElementById("AlbumDetailsMeta"),
        Title: document.getElementById("AlbumDetailsTitle"),
        Artist: document.getElementById("AlbumDetailsArtist"),
        Spotify: document.getElementById("AlbumDetailsSpotify"),
        CloseButton: document.querySelector("#AlbumDetailsPopup .album-details__close"),
        PreviousButton: document.querySelector('#AlbumDetailsPopup [data-album-step="-1"]'),
        NextButton: document.querySelector('#AlbumDetailsPopup [data-album-step="1"]'),
        Case: document.getElementById("AlbumDetailsCase"),
        Front: document.getElementById("AlbumDetailsFront"),
        FrontSlotNumber: document.getElementById("AlbumDetailsSlotNumber"),
        Scroll: document.getElementById("AlbumDetailsScroll"),
        Tracks: document.getElementById("AlbumDetailsTracks"),
        Runtime: document.getElementById("AlbumDetailsRuntime"),
        Back: document.getElementById("AlbumDetailsBack"),
    };
    let AlbumDetailsReturnFocusElement = null; // the CD on the wall the popup was opened from
    let AlbumDetailsHideTimeoutId = null;
    let AlbumDetailsShowFrameId = null;        // the frame that fades the popup in
    let IsAlbumDetailsClosing = false;
    let CoverFlyerElement = null;              // copy of the cover flying between wall and popup
    const COVER_FLIGHT_MS = 720;

    function IsAlbumDetailsOpen() {
        return !AlbumDetailsElements.Popup.hidden;
    }

    function OpenAlbumDetails(AlbumElement, OpenedWithKeyboard = false) {
        const Album = AlbumById.get(AlbumElement.dataset.albumId);
        if (!Album) return;
        const StartRect = AlbumElement.getBoundingClientRect(); // before the wall glides
        HideHoverCaption();
        FillAlbumDetails(Album);

        clearTimeout(AlbumDetailsHideTimeoutId);
        if (AlbumDetailsReturnFocusElement) AlbumDetailsReturnFocusElement.classList.remove("is-lifted");
        AlbumDetailsReturnFocusElement = AlbumElement;
        HeldPanKeys.clear();
        AlbumDetailsElements.Popup.hidden = false;
        // The cover lifts off the shelf and flies into the popup
        AlbumElement.classList.add("is-lifted");
        FlyCover(Album, StartRect, AlbumDetailsElements.Case.getBoundingClientRect(), false);
        IsAlbumDetailsClosing = false;
        cancelAnimationFrame(AlbumDetailsShowFrameId);
        AlbumDetailsShowFrameId = requestAnimationFrame(() => {
            AlbumDetailsShowFrameId = requestAnimationFrame(() => AlbumDetailsElements.Popup.classList.add("is-open"));
        });
        if (OpenedWithKeyboard) AlbumDetailsElements.CloseButton.focus({ preventScroll: true });
        else AlbumDetailsElements.Popup.querySelector(".album-details__panel").focus({ preventScroll: true });
    }

    // Put one album's cover, back, details and tracklist into the popup
    function FillAlbumDetails(Album) {
        const MetaParts = [Album.AlbumYear, GetTrackCountText(Album), GetAlbumLengthText(Album)].filter(Boolean);

        // Front: the uploaded photo, or an empty slot showing the album number
        AlbumDetailsElements.Case.dataset.albumId = Album.AlbumId;
        AlbumDetailsElements.Cover.removeAttribute("src");
        AlbumDetailsElements.Cover.alt = `${Album.AlbumName} cover`;
        AlbumDetailsElements.FrontSlotNumber.textContent = Album.AlbumNumberText;
        FillPhotoSlot(AlbumDetailsElements.Cover, AlbumDetailsElements.Front, Album.FrontCoverImage);
        // Back: the tracklist tray card, swapped for the photo of the real back if one is uploaded
        SetAlbumDetailsBack(CreateAlbumBackElement(Album));
        ResolvePhoto(Album.BackCoverImage).then((PhotoUrl) => {
            if (PhotoUrl && AlbumDetailsElements.Case.dataset.albumId === Album.AlbumId) SetAlbumDetailsBack(CreateAlbumBackPhotoElement(PhotoUrl));
        });
        AlbumDetailsElements.Case.style.setProperty("--album-tint", AlbumTintCache.get(Album.AlbumId) || "#6d4a33");
        if (!AlbumTintCache.has(Album.AlbumId)) {
            AlbumDetailsElements.Cover.addEventListener("load", () => ApplyAlbumTintFromCover(AlbumDetailsElements.Cover, AlbumDetailsElements.Case), { once: true });
        }
        SetAlbumDetailsCaseFlipped(false);
        RenderAlbumDetailsTracklist(Album);
        AlbumDetailsElements.Scroll.scrollTop = 0;
        ScrambleText(AlbumDetailsElements.Meta, MetaParts.join("  ·  "), 640);
        AlbumDetailsElements.Title.textContent = Album.AlbumName;
        // A long single word (e.g. "Understatement") gets a smaller size so it isn't split mid-word
        const LongestWordLength = Math.max(...String(Album.AlbumName || "").split(/\s+/).map((Word) => Word.length));
        AlbumDetailsElements.Title.classList.toggle("has-long-word", LongestWordLength > 11);
        AlbumDetailsElements.Artist.textContent = Album.ArtistName;
        // "Various Artists" isn't one artist, so it's plain text rather than a Spotify link
        if (IsVariousArtists(Album)) {
            AlbumDetailsElements.Artist.removeAttribute("href");
            AlbumDetailsElements.Artist.removeAttribute("aria-label");
        } else {
            AlbumDetailsElements.Artist.href = GetSpotifyArtistUrl(Album);
            AlbumDetailsElements.Artist.setAttribute("aria-label", `${Album.ArtistName} on Spotify (opens in a new tab)`);
        }
        // Greatest hits and compilations have no "Open album in Spotify" button
        AlbumDetailsElements.Spotify.hidden = Album.IsCompilation;
        if (!Album.IsCompilation) AlbumDetailsElements.Spotify.href = GetSpotifyAlbumUrl(Album);
    }

    // --- Browse the collection inside the popup: side arrows, swipe, sideways scroll, ← → keys ---
    // Albums go in the same order as on the wall. Behind the popup the wall glides along to the
    // album shown, so closing the popup sends the cover back to the right shelf.

    const SWIPE_DISTANCE_PX = 50;
    const SIDEWAYS_SCROLL_DISTANCE_PX = 70;
    let IsAlbumDetailsSliding = false;
    let PopupSwipe = null;               // { PointerId, StartX, StartY, StartTime }
    let ShouldIgnoreNextPopupClick = false;
    let SidewaysScrollTotal = 0;
    let SidewaysScrollQuietTimeoutId = null;
    let IsSidewaysScrollSpent = false;   // one album per sideways scroll gesture

    // Remove the slide animations (but not the stylesheet's rise-in animation)
    function CancelSlideAnimations(SlidingElements) {
        SlidingElements.forEach((SlidingElement) => SlidingElement.getAnimations().forEach((Animation) => {
            if (!Animation.animationName) Animation.cancel();
        }));
    }

    // +1 = next album, -1 = previous
    function StepAlbumDetails(StepDirection) {
        if (!IsAlbumDetailsOpen() || IsAlbumDetailsClosing || IsAlbumDetailsSliding || AlbumCollection.length < 2) return;
        if (AlbumDetailsElements.Popup.classList.contains("is-cover-flying")) return;
        const CurrentIndex = AlbumCollection.findIndex((Album) => Album.AlbumId === AlbumDetailsElements.Case.dataset.albumId);
        const NextAlbum = AlbumCollection[(CurrentIndex + StepDirection + AlbumCollection.length) % AlbumCollection.length];

        // Behind the popup, the wall glides (or the wheel turns) to the album shown
        const NextAlbumElement = BringAlbumIntoView(NextAlbum);
        if (AlbumDetailsReturnFocusElement) AlbumDetailsReturnFocusElement.classList.remove("is-lifted");
        AlbumDetailsReturnFocusElement = NextAlbumElement;
        if (NextAlbumElement) NextAlbumElement.classList.add("is-lifted");

        if (PrefersReducedMotion || !Element.prototype.animate) {
            FillAlbumDetails(NextAlbum);
            return;
        }
        // The current album slides out one way and the next slides in from the other; the
        // case leads and the details follow a moment behind. (Clipped by the popup's edges.)
        IsAlbumDetailsSliding = true;
        const SlideDistance = 80 * StepDirection;
        const SlidingElements = Array.from(AlbumDetailsElements.Scroll.children);
        const SlideAll = (Keyframes, Timing) => Promise.all(SlidingElements.map((SlidingElement, ElementIndex) =>
            SlidingElement.animate(Keyframes, { ...Timing, delay: ElementIndex * 40, fill: "both" }).finished));
        SlideAll(
            [{ transform: "none", opacity: 1 }, { transform: `translateX(${-SlideDistance}px)`, opacity: 0 }],
            { duration: 170, easing: "cubic-bezier(0.5, 0, 0.75, 0)" }
        )
            .then(() => {
                CancelSlideAnimations(SlidingElements);
                FillAlbumDetails(NextAlbum);
                return SlideAll(
                    [{ transform: `translateX(${SlideDistance}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
                    { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
                );
            })
            .catch(() => {})
            .then(() => {
                CancelSlideAnimations(SlidingElements);
                IsAlbumDetailsSliding = false;
            });
    }

    function HandlePopupPointerDown(PointerEvent) {
        ShouldIgnoreNextPopupClick = false;
        if (PointerEvent.pointerType === "mouse" && PointerEvent.button !== 0) return;
        if (!PointerEvent.target.closest(".album-details__panel") || PointerEvent.target.closest("button, a")) return;
        PopupSwipe = { PointerId: PointerEvent.pointerId, StartX: PointerEvent.clientX, StartY: PointerEvent.clientY, StartTime: performance.now() };
    }

    function HandlePopupPointerUp(PointerEvent) {
        if (!PopupSwipe || PointerEvent.pointerId !== PopupSwipe.PointerId) return;
        const DistanceX = PointerEvent.clientX - PopupSwipe.StartX;
        const DistanceY = PointerEvent.clientY - PopupSwipe.StartY;
        const IsQuickEnough = performance.now() - PopupSwipe.StartTime < 800;
        PopupSwipe = null;
        const HasSelectedText = String(window.getSelection ? window.getSelection() : "").length > 0;
        if (PointerEvent.type !== "pointerup" || !IsQuickEnough || HasSelectedText) return;
        if (Math.abs(DistanceX) < SWIPE_DISTANCE_PX || Math.abs(DistanceX) < Math.abs(DistanceY) * 1.5) return;
        ShouldIgnoreNextPopupClick = true; // the swipe should not also flip the case
        StepAlbumDetails(DistanceX < 0 ? 1 : -1);
    }

    // A sideways trackpad scroll (or Shift + mouse wheel) moves one album per gesture;
    // up / down scrolling still scrolls the tracklist
    function HandlePopupWheel(WheelEvent) {
        let SidewaysDelta = WheelEvent.deltaX;
        if (WheelEvent.shiftKey && !SidewaysDelta) SidewaysDelta = WheelEvent.deltaY;
        if (Math.abs(SidewaysDelta) <= Math.abs(WheelEvent.shiftKey ? 0 : WheelEvent.deltaY)) return;
        WheelEvent.preventDefault();
        clearTimeout(SidewaysScrollQuietTimeoutId);
        SidewaysScrollQuietTimeoutId = setTimeout(() => {
            SidewaysScrollTotal = 0;
            IsSidewaysScrollSpent = false;
        }, 220);
        if (IsSidewaysScrollSpent) return;
        SidewaysScrollTotal += SidewaysDelta * (WheelEvent.deltaMode === 1 ? 16 : 1);
        if (Math.abs(SidewaysScrollTotal) < SIDEWAYS_SCROLL_DISTANCE_PX) return;
        IsSidewaysScrollSpent = true;
        StepAlbumDetails(SidewaysScrollTotal > 0 ? 1 : -1);
    }

    // Animate a copy of the cover from one screen rectangle to another (the real case stays
    // hidden until it lands). Returns to the wall when IsReturning is true.
    function FlyCover(Album, FromRect, ToRect, IsReturning) {
        if (CoverFlyerElement) CoverFlyerElement.remove();
        CoverFlyerElement = null;
        AlbumDetailsElements.Popup.classList.remove("is-cover-flying");
        const IsOnScreen = FromRect.width > 0 && ToRect.width > 0 &&
            FromRect.bottom > 0 && FromRect.top < window.innerHeight && FromRect.right > 0 && FromRect.left < window.innerWidth;
        if (PrefersReducedMotion || !IsOnScreen || !Element.prototype.animate) return Promise.resolve();

        // Fly a square the size of the popup case, starting over the CD on the wall
        const FlyerElement = CreateElement("div", "cover-flyer", { "aria-hidden": "true" });
        const FlyerImage = CreateElement("img", "", { alt: "", draggable: "false" });
        FlyerElement.append(FlyerImage, CreateEmptySlotElement(Album), CreateElement("span", "cd-gloss"));
        const LargeRect = IsReturning ? FromRect : ToRect;
        const SmallRect = IsReturning ? ToRect : FromRect;
        Object.assign(FlyerElement.style, { left: `${LargeRect.left}px`, top: `${LargeRect.top}px`, width: `${LargeRect.width}px`, height: `${LargeRect.height}px` });
        FlyerElement.style.setProperty("--cd", `${LargeRect.width * 0.917}px`); // sizes the empty-slot number
        ResolvePhoto(Album.FrontCoverImage).then((PhotoUrl) => {
            if (PhotoUrl) FlyerImage.src = PhotoUrl;
            else FlyerElement.classList.add("is-empty-slot");
        });
        document.body.appendChild(FlyerElement);
        CoverFlyerElement = FlyerElement;
        AlbumDetailsElements.Popup.classList.add("is-cover-flying");

        const SmallTransform =
            `translate(${SmallRect.left - LargeRect.left}px, ${SmallRect.top - LargeRect.top}px) ` +
            `scale(${SmallRect.width / LargeRect.width}, ${SmallRect.height / LargeRect.height})`;
        const Keyframes = [
            { transform: SmallTransform, boxShadow: "0 4px 10px rgba(0, 0, 0, 0.5)" },
            { transform: "translate(0, 0) scale(1)", boxShadow: "0 40px 90px rgba(0, 0, 0, 0.7)" },
        ];
        const Flight = FlyerElement.animate(IsReturning ? Keyframes.reverse() : Keyframes, {
            duration: IsReturning ? COVER_FLIGHT_MS * 0.8 : COVER_FLIGHT_MS,
            easing: "cubic-bezier(0.65, 0, 0.2, 1)",
            fill: "forwards",
        });
        return Flight.finished.catch(() => {}).then(() => {
            if (CoverFlyerElement !== FlyerElement) return;
            FlyerElement.remove();
            CoverFlyerElement = null;
            AlbumDetailsElements.Popup.classList.remove("is-cover-flying");
        });
    }

    function SetAlbumDetailsBack(NewBackElement) {
        NewBackElement.id = "AlbumDetailsBack";
        AlbumDetailsElements.Back.replaceWith(NewBackElement);
        AlbumDetailsElements.Back = NewBackElement;
    }

    function CloseAlbumDetails() {
        if (!IsAlbumDetailsOpen() || IsAlbumDetailsClosing) return;
        IsAlbumDetailsClosing = true;
        cancelAnimationFrame(AlbumDetailsShowFrameId); // closed before it had finished fading in
        const ReturnAlbumElement = AlbumDetailsReturnFocusElement;
        const Album = AlbumById.get(AlbumDetailsElements.Case.dataset.albumId);
        AlbumDetailsElements.Popup.classList.remove("is-open");
        // The cover flies back to its place on the shelf (only from the front: a flipped case just fades)
        const ShouldFlyBack = ReturnAlbumElement && Album && !AlbumDetailsElements.Case.classList.contains("is-flipped");
        const Landing = ShouldFlyBack
            ? FlyCover(Album, AlbumDetailsElements.Case.getBoundingClientRect(), ReturnAlbumElement.getBoundingClientRect(), true)
            : Promise.resolve();
        Landing.then(() => { if (IsAlbumDetailsClosing && ReturnAlbumElement) ReturnAlbumElement.classList.remove("is-lifted"); });
        AlbumDetailsHideTimeoutId = setTimeout(() => {
            AlbumDetailsElements.Popup.hidden = true;
            if (IsWheelViewActive()) RequestWheelFrame(); // the wheel puts its CD back and carries on turning
        }, PrefersReducedMotion ? 0 : 420);
        if (ReturnAlbumElement) ReturnAlbumElement.focus({ preventScroll: true });
    }

    // Full tracklist under the album details (scroll down inside the popup to read it)
    function RenderAlbumDetailsTracklist(Album) {
        const TrackFragment = document.createDocumentFragment();
        Album.TrackList.forEach((Track, TrackIndex) => {
            const TrackElement = CreateElement("li", "album-details__track");
            const TrackNumberElement = CreateElement("span", "album-details__track-number");
            TrackNumberElement.textContent = String(TrackIndex + 1).padStart(2, "0");
            const TrackTitleElement = CreateElement("span", "album-details__track-title");
            TrackTitleElement.textContent = Track.TrackName;
            const TrackLengthElement = CreateElement("span", "album-details__track-length");
            TrackLengthElement.textContent = Track.TrackLength || "";
            TrackElement.append(TrackNumberElement, TrackTitleElement, TrackLengthElement);
            TrackFragment.appendChild(TrackElement);
        });
        AlbumDetailsElements.Tracks.replaceChildren(TrackFragment);
        AlbumDetailsElements.Tracks.parentElement.hidden = Album.TrackList.length === 0;
        AlbumDetailsElements.Runtime.textContent = [
            Album.AlbumDate ? `Released ${Album.AlbumDate}` : "",
            GetTrackCountText(Album),
            GetAlbumLengthText(Album),
        ].filter(Boolean).join(" · ");
    }

    function SetAlbumDetailsCaseFlipped(ShouldBeFlipped) {
        AlbumDetailsElements.Case.classList.toggle("is-flipped", ShouldBeFlipped);
        AlbumDetailsElements.Case.setAttribute("aria-pressed", String(ShouldBeFlipped));
        AlbumDetailsElements.Case.setAttribute("aria-label", ShouldBeFlipped ? "Flip the case back to the cover" : "Flip the case to see the tracklist");
    }

    function ToggleAlbumDetailsCase() {
        SetAlbumDetailsCaseFlipped(!AlbumDetailsElements.Case.classList.contains("is-flipped"));
    }

    function HandleAlbumDetailsClick(ClickEvent) {
        if (ShouldIgnoreNextPopupClick) {
            ShouldIgnoreNextPopupClick = false;
            return;
        }
        const StepButton = ClickEvent.target.closest("[data-album-step]");
        if (StepButton) StepAlbumDetails(Number(StepButton.dataset.albumStep));
        else if (ClickEvent.target.closest("[data-close-popup]")) CloseAlbumDetails();
        else if (ClickEvent.target.closest("#AlbumDetailsCase")) ToggleAlbumDetailsCase();
    }

    function HandleAlbumDetailsKeyDown(KeyboardEvent) {
        if (document.activeElement === AlbumDetailsElements.Case && (KeyboardEvent.key === "Enter" || KeyboardEvent.key === " ")) {
            KeyboardEvent.preventDefault();
            ToggleAlbumDetailsCase();
        }
    }

    // Keep keyboard focus inside the popup while it is open
    function TrapAlbumDetailsFocus(KeyboardEvent) {
        if (KeyboardEvent.key !== "Tab" || !IsAlbumDetailsOpen()) return;
        const FocusableElements = [AlbumDetailsElements.CloseButton, AlbumDetailsElements.PreviousButton, AlbumDetailsElements.NextButton, AlbumDetailsElements.Case, AlbumDetailsElements.Artist, AlbumDetailsElements.Spotify];
        const CurrentIndex = FocusableElements.indexOf(document.activeElement);
        KeyboardEvent.preventDefault();
        const NextIndex = (CurrentIndex + (KeyboardEvent.shiftKey ? -1 : 1) + FocusableElements.length) % FocusableElements.length;
        FocusableElements[NextIndex].focus();
    }

    /* ------------------------------------------------------------------ */
    /* 10. Collection footer: A–Z / Z–A list; tab, hover to open, expand */
    /* ------------------------------------------------------------------ */

    const CollectionFooterElements = {
        Footer: document.getElementById("CollectionFooter"),
        Text: document.getElementById("CollectionFooterText"),
        Count: document.getElementById("CollectionFooterCount"),
        List: document.getElementById("CollectionFooterList"),
        Inner: document.getElementById("CollectionFooterInner"),
        RaiseButton: document.querySelector('#CollectionFooter [data-footer-step="up"]'),
        LowerButton: document.querySelector('#CollectionFooter [data-footer-step="down"]'),
        SortButtons: Array.from(document.querySelectorAll("#CollectionFooter [data-sort-order]")),
        Search: document.getElementById("CollectionSearch"),
        NoResults: document.getElementById("CollectionNoResults"),
    };
    let CollectionListSortOrder = "NameAscending"; // NameAscending, NameDescending, YearOldestFirst or YearNewestFirst

    // The footer has three heights; the arrows / swipes step between them. It starts as just
    // the ^ tab. With a mouse, moving to the bottom of the screen brings it up, and it then
    // stays up until it is tucked away again with the down arrow (or a swipe down).
    const FOOTER_STATES = ["Minimised", "Resting", "Expanded"];
    const FOOTER_SWIPE_THRESHOLD_PX = 28;
    let CollectionFooterState = "Minimised";
    let IsFooterHoverPaused = false;     // after tucking it away, wait until the mouse leaves the bottom
    let FooterSwipe = null;              // { PointerId, StartY, HasStepped }
    let ShouldIgnoreNextFooterClick = false;

    function GetFooterHeight() {
        if (!CollectionFooterElements.Footer || CollectionFooterState === "Minimised") return 0;
        return CollectionFooterElements.Footer.offsetHeight;
    }

    function SetCollectionFooterState(NewFooterState) {
        CollectionFooterState = NewFooterState;
        if (typeof CentreWheelOnScreen === "function") {
            requestAnimationFrame(() => CentreWheelOnScreen(false));
            setTimeout(() => CentreWheelOnScreen(false), 520);
        }
        if (NewFooterState === "Minimised") IsFooterHoverPaused = true;
        const FooterElement = CollectionFooterElements.Footer;
        FooterElement.classList.toggle("is-minimised", NewFooterState === "Minimised");
        FooterElement.classList.toggle("is-expanded", NewFooterState === "Expanded");
        if (NewFooterState === "Minimised") {
            if (CollectionFooterElements.Inner.contains(document.activeElement)) CollectionFooterElements.RaiseButton.focus({ preventScroll: true });
            CollectionFooterElements.Inner.setAttribute("inert", "");
        } else {
            CollectionFooterElements.Inner.removeAttribute("inert");
        }
        CollectionFooterElements.RaiseButton.disabled = NewFooterState === "Expanded";
        CollectionFooterElements.LowerButton.disabled = NewFooterState === "Minimised";
        CollectionFooterElements.RaiseButton.setAttribute("aria-label", NewFooterState === "Minimised" ? "Show the collection footer" : "Show the full collection list");
        CollectionFooterElements.LowerButton.setAttribute("aria-label", NewFooterState === "Expanded" ? "Show less of the collection list" : "Minimise the collection footer");
    }

    // +1 = raise, -1 = lower
    function StepCollectionFooter(StepDirection) {
        const CurrentIndex = FOOTER_STATES.indexOf(CollectionFooterState);
        const NextIndex = ClampNumber(CurrentIndex + StepDirection, 0, FOOTER_STATES.length - 1);
        if (NextIndex !== CurrentIndex) SetCollectionFooterState(FOOTER_STATES[NextIndex]);
    }

    // The bottom of the screen that wakes the footer: the lowest eighth, at least 90px
    function HandleFooterHoverPointerMove(PointerEvent) {
        if (PointerEvent.pointerType !== "mouse" || !CanHover) return;
        const IsInZone = PointerEvent.clientY >= window.innerHeight - Math.max(90, window.innerHeight * 0.125);
        if (!IsInZone) {
            IsFooterHoverPaused = false;
            return;
        }
        if (CollectionFooterState === "Minimised" && !IsFooterHoverPaused && !CameraState.IsDragging && !IsAlbumDetailsOpen()) {
            SetCollectionFooterState("Resting");
        }
    }

    // Swipe (touch) or drag (mouse) up / down on the tab or heading area
    function HandleFooterPointerDown(PointerEvent) {
        ShouldIgnoreNextFooterClick = false;
        if (!PointerEvent.target.closest(".collection-footer__tab, .collection-footer__header")) return;
        if (PointerEvent.target.closest("input")) return; // typing in the search box is not a swipe
        FooterSwipe = { PointerId: PointerEvent.pointerId, StartY: PointerEvent.clientY, HasStepped: false };
    }

    function HandleFooterPointerMove(PointerEvent) {
        if (!FooterSwipe || PointerEvent.pointerId !== FooterSwipe.PointerId || FooterSwipe.HasStepped) return;
        const DistanceY = PointerEvent.clientY - FooterSwipe.StartY;
        if (Math.abs(DistanceY) < FOOTER_SWIPE_THRESHOLD_PX) return;
        FooterSwipe.HasStepped = true;
        ShouldIgnoreNextFooterClick = true; // the swipe should not also count as a tap on a button
        StepCollectionFooter(DistanceY < 0 ? 1 : -1);
    }

    function HandleFooterPointerEnd(PointerEvent) {
        if (FooterSwipe && PointerEvent.pointerId === FooterSwipe.PointerId) FooterSwipe = null;
    }

    function SortAlbumsForList(AlbumList, SortOrder) {
        const StripLeadingThe = (Text) => String(Text).replace(/^the\s+/i, "");
        const CompareNames = (A, B) =>
            StripLeadingThe(A.AlbumName).localeCompare(StripLeadingThe(B.AlbumName), undefined, { sensitivity: "base" }) ||
            StripLeadingThe(A.ArtistName).localeCompare(StripLeadingThe(B.ArtistName), undefined, { sensitivity: "base" });
        if (SortOrder === "YearOldestFirst" || SortOrder === "YearNewestFirst") {
            const Direction = SortOrder === "YearOldestFirst" ? 1 : -1;
            const YearOf = (Album) => Number(Album.AlbumYear) || null;
            return AlbumList.slice().sort((A, B) => {
                const YearA = YearOf(A), YearB = YearOf(B);
                if (YearA === null || YearB === null) return (YearA === null) - (YearB === null) || CompareNames(A, B); // no year: at the end
                return (YearA - YearB) * Direction || CompareNames(A, B); // same year: A–Z
            });
        }
        const SortedAlbums = AlbumList.slice().sort(CompareNames);
        return SortOrder === "NameDescending" ? SortedAlbums.reverse() : SortedAlbums;
    }

    // Search matches album, artist or year; every word typed must match somewhere
    function DoesAlbumMatchSearch(Album, SearchText) {
        const SearchWords = SearchText.toLowerCase().split(/\s+/).filter(Boolean);
        if (!SearchWords.length) return true;
        const AlbumText = `${Album.AlbumName} ${Album.ArtistName} ${Album.AlbumYear} ${Album.AlbumDate}`.toLowerCase();
        return SearchWords.every((SearchWord) => AlbumText.includes(SearchWord));
    }

    function RenderCollectionList() {
        const ListFragment = document.createDocumentFragment();
        const SearchText = CollectionFooterElements.Search ? CollectionFooterElements.Search.value.trim() : "";
        const MatchingAlbums = SortAlbumsForList(AlbumCollection, CollectionListSortOrder).filter((Album) => DoesAlbumMatchSearch(Album, SearchText));
        CollectionFooterElements.NoResults.hidden = MatchingAlbums.length > 0;
        CollectionFooterElements.Count.textContent = SearchText
            ? `${MatchingAlbums.length} of ${AlbumCollection.length}`
            : `${AlbumCollection.length} ${AlbumCollection.length === 1 ? "CD" : "CDs"}`;
        MatchingAlbums.forEach((Album) => {
            const ListItemElement = CreateElement("li", "collection-list__item");
            const AlbumButtonElement = CreateElement("button", "collection-list__button", {
                type: "button",
                "data-album-id": Album.AlbumId,
                "aria-label": `Find ${Album.AlbumName} by ${Album.ArtistName} on the wall`,
            });
            const ThumbnailElement = CreateElement("img", "collection-list__cover", { alt: "", loading: "lazy", decoding: "async", draggable: "false" });
            FillPhotoSlot(ThumbnailElement, ThumbnailElement, Album.FrontCoverImage);
            const TextWrapElement = CreateElement("span", "collection-list__text");
            const AlbumNameElement = CreateElement("span", "collection-list__album");
            AlbumNameElement.textContent = Album.AlbumName;
            const ArtistLineElement = CreateElement("span", "collection-list__artist");
            ArtistLineElement.textContent = Album.AlbumYear ? `${Album.ArtistName} · ${Album.AlbumYear}` : Album.ArtistName;
            TextWrapElement.append(AlbumNameElement, ArtistLineElement);
            AlbumButtonElement.append(ThumbnailElement, TextWrapElement);
            ListItemElement.appendChild(AlbumButtonElement);
            ListFragment.appendChild(ListItemElement);
        });
        CollectionFooterElements.List.replaceChildren(ListFragment);
        CollectionFooterElements.SortButtons.forEach((SortButton) => {
            SortButton.setAttribute("aria-pressed", String(SortButton.dataset.sortOrder === CollectionListSortOrder));
        });
    }

    // The copy of an album nearest the middle of the screen
    function FindNearestAlbumElement(AlbumId) {
        const { CentreX: ScreenCentreX, CentreY: ScreenCentreY } = GetVisibleWallCentre();
        let NearestAlbumElement = null, NearestDistance = Infinity;
        ShelfWallElement.querySelectorAll(`.cd[data-album-id="${CSS.escape(AlbumId)}"]`).forEach((AlbumElement) => {
            if (TilePool.TileByElement.get(AlbumElement.parentElement.parentElement).TileIndexX === null) return;
            const AlbumCentre = GetFlatAlbumCentre(AlbumElement);
            const Distance = Math.hypot(AlbumCentre.X - ScreenCentreX, AlbumCentre.Y - ScreenCentreY);
            if (Distance < NearestDistance) { NearestDistance = Distance; NearestAlbumElement = AlbumElement; }
        });
        return NearestAlbumElement;
    }

    // Centre the nearest copy of an album and open its details
    function FindAlbumOnWall(AlbumId) {
        const NearestAlbumElement = FindNearestAlbumElement(AlbumId);
        if (!NearestAlbumElement) return;
        CentreAlbumOnScreen(NearestAlbumElement);
        OpenAlbumDetails(NearestAlbumElement);
    }

    function HandleCollectionFooterClick(ClickEvent) {
        if (ShouldIgnoreNextFooterClick) {
            ShouldIgnoreNextFooterClick = false;
            return;
        }
        const StepButton = ClickEvent.target.closest("[data-footer-step]");
        if (StepButton) {
            StepCollectionFooter(StepButton.dataset.footerStep === "up" ? 1 : -1);
            return;
        }
        const SortButton = ClickEvent.target.closest("[data-sort-order]");
        if (SortButton) {
            CollectionListSortOrder = SortButton.dataset.sortOrder;
            RenderCollectionList();
            CollectionFooterElements.List.scrollTop = 0;
            return;
        }
        const AlbumButton = ClickEvent.target.closest(".collection-list__button");
        if (AlbumButton) {
            if (CollectionFooterState === "Expanded") SetCollectionFooterState("Resting");
            ShowAlbumInView(AlbumButton.dataset.albumId);
        }
    }

    function SetUpCollectionFooter() {
        if (!CollectionFooterElements.Footer) return;
        CollectionFooterElements.Text.textContent = ShelfConfig.FooterText;
        CollectionFooterElements.Text.hidden = !ShelfConfig.FooterText;
        RenderCollectionList();
        CollectionFooterElements.Search.addEventListener("input", () => {
            RenderCollectionList();
            CollectionFooterElements.List.scrollTop = 0;
        });
        CollectionFooterElements.Search.addEventListener("keydown", (KeyboardEvent) => {
            if (KeyboardEvent.key === "Escape" && CollectionFooterElements.Search.value) {
                KeyboardEvent.stopPropagation();
                CollectionFooterElements.Search.value = "";
                RenderCollectionList();
            }
        });
        CollectionFooterElements.Footer.addEventListener("click", HandleCollectionFooterClick);
        CollectionFooterElements.Footer.addEventListener("pointerdown", HandleFooterPointerDown);
        CollectionFooterElements.Footer.addEventListener("pointermove", HandleFooterPointerMove);
        CollectionFooterElements.Footer.addEventListener("pointerup", HandleFooterPointerEnd);
        CollectionFooterElements.Footer.addEventListener("pointercancel", HandleFooterPointerEnd);
        window.addEventListener("pointermove", HandleFooterHoverPointerMove, { passive: true });
        SetCollectionFooterState("Minimised");
        IsFooterHoverPaused = false;
    }

    /* ------------------------------------------------------------------ */
    /* 11. Wheel view: the collection on a spinning ring                  */
    /* ------------------------------------------------------------------ */
    // Every CD stands on its edge round a big ring, like the spokes of a wheel (a cover on
    // both sides), seen from a little above so the whole ring shows, back as well as front.
    // It drifts round slowly; scrolling, dragging, swiping or the arrow keys spin it, with a
    // glide. Hovering a CD shows it large in the corner. Only the ring itself moves, as one
    // GPU layer, so spinning stays smooth.

    const WheelElements = {
        View: document.getElementById("WheelView"),
        Ring: document.getElementById("WheelRing"),
        Preview: document.getElementById("WheelPreview"),
        PreviewImage: document.getElementById("WheelPreviewImage"),
        PreviewAlbum: document.getElementById("WheelPreviewAlbum"),
        PreviewArtist: document.getElementById("WheelPreviewArtist"),
    };

    const WHEEL_SHOW_ANGLE = 0;            // shuffle brings its pick round to the very front, in the middle
    const WHEEL_DRIFT_DEGREES = 0.035;     // the ring keeps turning slowly, this much per frame
    const WHEEL_PULL_MS = 650;             // time for a CD to come out of the ring and turn to face the viewer
    const WHEEL_HOVER_BRING_MS = 1000;     // hover a CD this long and the ring brings it round to the front
    const WHEEL_EDGE_SPIN_DEGREES = 0.25;   // fastest turn per frame with the mouse right at the left / right edge

    const WheelState = {
        IsBuilt: false,
        AlbumElements: [],      // one .cd per album, in collection order
        StepDegrees: 1,         // angle between neighbouring CDs
        Angle: 0,               // where the ring is turned to now (degrees)
        TargetAngle: 0,         // where it is heading
        Velocity: 0,            // degrees per frame while flung
        Follow: 0.08,           // how quickly Angle catches up with TargetAngle
        PendingOpenIndex: -1,   // shuffle: open this album once the ring arrives
        HoveredIndex: -1,
        PulledIndex: -1,        // the CD out of the ring, facing the viewer (hovered, or shuffle's pick)
        PullAnchor: { X: 0, Y: 0 }, // where the mouse was when it came out
        LastPointer: { X: 0, Y: 0 },
        PendingPullIndex: -1,   // hovered long enough: comes out once the ring has brought it to the front
        BringTimeoutId: 0,
        PullTimeoutId: 0,
        PointerTiltX: 0, PointerTiltY: 0, TiltX: 0, TiltY: 0,
        CentreY: 0, TargetCentreY: 0, // screen height of the ring's middle (kept centred above the footer)
        Scale: 1, TargetScale: 1,     // shrinks the ring when the footer takes up room
        Drag: null,             // { PointerId, StartX, LastX, LastTime, HasMoved }
        IsRunning: false,
        LastFrameTime: 0,
    };

    // Sizes come from the screen: the ring fills most of it, the CDs are about a quarter of its radius
    function ApplyWheelSizes() {
        const ViewportWidth = window.innerWidth, ViewportHeight = window.innerHeight;
        const RadiusPx = Math.round(Math.min(ViewportWidth * (ViewportWidth < 700 ? 0.44 : 0.3), ViewportHeight * 0.55));
        const CdSizePx = Math.round(ClampNumber(RadiusPx * 0.25, 46, 170));
        WheelState.StepDegrees = 360 / Math.max(1, WheelState.AlbumElements.length);
        WheelElements.Ring.style.setProperty("--cd", `${CdSizePx}px`);
        WheelElements.Ring.style.setProperty("--wheel-radius", `${RadiusPx}px`);
        WheelElements.View.style.setProperty("--wheel-perspective", `${Math.round(Math.max(RadiusPx * 3.4, 1200))}px`);
        WheelState.AlbumElements.forEach((AlbumElement, AlbumIndex) => {
            AlbumElement.parentElement.style.setProperty("--card-angle", `${(AlbumIndex * WheelState.StepDegrees).toFixed(3)}deg`);
        });
        if (!WheelState.CentreY) WheelState.CentreY = WheelState.TargetCentreY = ViewportHeight * 0.47;
        WriteWheelPlacement();
        CentreWheelOnScreen(true);
    }

    // Keep the whole ring in the middle of the space above the footer (and small enough to fit it).
    // The ring is measured as it looks on screen, since leaning back makes its near side larger.
    function CentreWheelOnScreen(IsImmediate) {
        if (!WheelState.IsBuilt || !IsWheelViewActive()) return;
        const FooterHeight = GetFooterHeight();
        const SpaceTop = 70; // clear of the buttons, top right
        const SpaceBottom = window.innerHeight - FooterHeight - (FooterHeight ? 16 : 40);
        WriteWheelTransform(); // measure the ring as it is drawn now (tilted back), not as last written
        let RingTop = Infinity, RingBottom = -Infinity;
        WheelState.AlbumElements.forEach((AlbumElement) => {
            const CardRect = AlbumElement.parentElement.getBoundingClientRect();
            RingTop = Math.min(RingTop, CardRect.top);
            RingBottom = Math.max(RingBottom, CardRect.bottom);
        });
        const RingHeight = RingBottom - RingTop;
        if (!(RingHeight > 0)) return;
        // Measured at the current size and place; work out the size and place that fit the space
        const NewScale = ClampNumber(WheelState.Scale * ((SpaceBottom - SpaceTop) * 0.94) / RingHeight, 0.35, 1);
        const SizeRatio = NewScale / WheelState.Scale;
        const OffsetFromCentre = ((RingTop + RingBottom) / 2 - WheelState.CentreY) * SizeRatio;
        WheelState.TargetScale = NewScale;
        WheelState.TargetCentreY = (SpaceTop + SpaceBottom) / 2 - OffsetFromCentre;
        // The hover preview sits in the corner above the footer
        WheelElements.Preview.style.bottom = `calc(${FooterHeight ? FooterHeight + 16 : 24}px + env(safe-area-inset-bottom, 0px))`;
        if (IsImmediate) {
            WheelState.Scale = WheelState.TargetScale;
            WheelState.CentreY = WheelState.TargetCentreY;
            WriteWheelPlacement();
            WriteWheelTransform();
        }
        RequestWheelFrame();
    }

    function WriteWheelPlacement() {
        const CentreText = `${WheelState.CentreY.toFixed(1)}px`;
        WheelElements.Ring.style.top = CentreText;
        WheelElements.View.style.perspectiveOrigin = `50% ${CentreText}`;
    }

    function BuildWheel() {
        if (WheelState.IsBuilt || !WheelElements.Ring) return;
        const RingFragment = document.createDocumentFragment();
        WheelState.AlbumElements = AlbumCollection.map((Album, AlbumIndex) => {
            const CardElement = CreateElement("div", "wheel-card", { "data-wheel-index": String(AlbumIndex) });
            const AlbumElement = CreateAlbumElement(Album);
            // The other side of the CD shows the cover too (not a mirror image of it)
            const BackElement = CreateElement("div", "wheel-card__back", { "aria-hidden": "true" });
            const BackImage = CreateElement("img", "", { alt: "", draggable: "false", decoding: "async" });
            ResolvePhoto(Album.FrontCoverImage).then((PhotoUrl) => { if (PhotoUrl) BackImage.src = PhotoUrl; });
            BackElement.appendChild(BackImage);
            CardElement.append(AlbumElement, BackElement);
            RingFragment.appendChild(CardElement);
            return AlbumElement;
        });
        WheelElements.Ring.appendChild(RingFragment);
        WheelState.IsBuilt = true;
        ApplyWheelSizes();
    }

    function WriteWheelTransform() {
        WheelElements.Ring.style.transform =
            `scale3d(${WheelState.Scale.toFixed(4)}, ${WheelState.Scale.toFixed(4)}, ${WheelState.Scale.toFixed(4)}) ` +
            `rotateX(${(-20 + WheelState.TiltX).toFixed(2)}deg) rotateZ(${WheelState.TiltY.toFixed(2)}deg) ` +
            `rotateY(${(-WheelState.Angle).toFixed(3)}deg)`;
    }

    function RequestWheelFrame() {
        if (WheelState.IsRunning || !IsWheelViewActive() || document.hidden) return;
        WheelState.IsRunning = true;
        WheelState.LastFrameTime = performance.now();
        requestAnimationFrame(RunWheelFrame);
    }

    function IsWheelDrifting() {
        return !PrefersReducedMotion && ShelfConfig.MotionSwing > 0 && !WheelState.Drag &&
            WheelState.HoveredIndex < 0 && WheelState.PendingOpenIndex < 0 && !IsAlbumDetailsOpen();
    }

    function RunWheelFrame(FrameTime) {
        const FrameScale = ClampNumber((FrameTime - WheelState.LastFrameTime) / 16.667, 0.25, 4);
        WheelState.LastFrameTime = FrameTime;
        const Ease = (Amount) => (PrefersReducedMotion ? 1 : 1 - Math.pow(1 - Amount, FrameScale));

        if (IsWheelDrifting()) WheelState.TargetAngle += WHEEL_DRIFT_DEGREES * FrameScale;
        const EdgeSpin = WheelState.HoveredIndex < 0 && !WheelState.Drag ? GetEdgeScrollAmount().X : 0;
        if (EdgeSpin) WheelState.TargetAngle -= EdgeSpin * WHEEL_EDGE_SPIN_DEGREES * FrameScale;
        if (!WheelState.Drag) WheelState.Angle += (WheelState.TargetAngle - WheelState.Angle) * Ease(WheelState.Follow);
        const TiltStrength = PrefersReducedMotion ? 0 : ShelfConfig.MouseParallax;
        WheelState.TiltX += (WheelState.PointerTiltX * 6 * TiltStrength - WheelState.TiltX) * Ease(0.05);
        WheelState.TiltY += (WheelState.PointerTiltY * 3 * TiltStrength - WheelState.TiltY) * Ease(0.05);
        const IsPlacementMoving = Math.abs(WheelState.TargetCentreY - WheelState.CentreY) > 0.2 || Math.abs(WheelState.TargetScale - WheelState.Scale) > 0.001;
        if (IsPlacementMoving) {
            WheelState.CentreY += (WheelState.TargetCentreY - WheelState.CentreY) * Ease(0.12);
            WheelState.Scale += (WheelState.TargetScale - WheelState.Scale) * Ease(0.12);
            WriteWheelPlacement();
        }
        WriteWheelTransform();

        const Remaining = Math.abs(WheelState.TargetAngle - WheelState.Angle);
        // Shuffle: once the ring has brought the pick to the front, it comes out to face the viewer, then opens
        if (!WheelState.Drag && WheelState.PendingOpenIndex >= 0 && Remaining < 0.35 && WheelState.PulledIndex !== WheelState.PendingOpenIndex) {
            const OpenIndex = WheelState.PendingOpenIndex;
            PullCardOut(OpenIndex);
            clearTimeout(WheelState.PullTimeoutId);
            WheelState.PullTimeoutId = setTimeout(() => {
                if (WheelState.PendingOpenIndex !== OpenIndex) return;
                WheelState.PendingOpenIndex = -1;
                WheelState.Follow = 0.08;
                OpenAlbumDetails(WheelState.AlbumElements[OpenIndex]);
            }, PrefersReducedMotion ? 0 : WHEEL_PULL_MS + 120);
        }
        // Hovered long enough: once the ring has brought it to the front, it comes out to face the viewer
        if (!WheelState.Drag && WheelState.PendingPullIndex >= 0 && Remaining < 0.35) {
            WheelState.PullAnchor = { ...WheelState.LastPointer };
            PullCardOut(WheelState.PendingPullIndex);
            WheelState.PendingPullIndex = -1;
            WheelState.Follow = 0.08;
        }
        // A CD left out of the ring (no longer hovered, no popup, no shuffle waiting) goes back in
        if (WheelState.PulledIndex >= 0 && WheelState.PulledIndex !== WheelState.HoveredIndex &&
            WheelState.PulledIndex !== WheelState.PendingOpenIndex && !IsAlbumDetailsOpen()) ReturnPulledCard();

        const IsSettled = !IsWheelDrifting() && !WheelState.Drag && !EdgeSpin && Remaining < 0.02 && !IsPlacementMoving &&
            Math.abs(WheelState.PointerTiltX * 6 * TiltStrength - WheelState.TiltX) < 0.01 &&
            Math.abs(WheelState.PointerTiltY * 3 * TiltStrength - WheelState.TiltY) < 0.01;
        if (IsSettled || !IsWheelViewActive() || document.hidden) {
            WheelState.IsRunning = false;
            return;
        }
        requestAnimationFrame(RunWheelFrame);
    }

    // The CDs stand edge-on like spokes. Only the CD at the very front comes out of the ring, turning
    // to face the viewer: when it's hovered, or once the ring has brought a hovered (or shuffled) CD
    // round to the front. The CDs either side step aside so none cut across it.
    function IsCardAtFront(AlbumIndex) {
        const AngleFromFront = ((AlbumIndex * WheelState.StepDegrees - WheelState.Angle) % 360 + 540) % 360 - 180;
        return Math.abs(AngleFromFront) < WheelState.StepDegrees * 0.6;
    }

    function PullCardOut(AlbumIndex) {
        if (WheelState.PulledIndex === AlbumIndex) return;
        ReturnPulledCard();
        const CardElement = WheelState.AlbumElements[AlbumIndex] && WheelState.AlbumElements[AlbumIndex].parentElement;
        if (!CardElement) return;
        // The ring eases to a stop just ahead, so the CD faces the viewer squarely once out
        WheelState.TargetAngle = WheelState.Angle + (WheelState.TargetAngle - WheelState.Angle) * 0.15;
        // Where it will stand round the ring (0 = the very front); it turns by the same amount the other way
        const AngleFromFront = ((AlbumIndex * WheelState.StepDegrees - WheelState.TargetAngle) % 360 + 540) % 360 - 180;
        CardElement.style.setProperty("--turn", `${(-AngleFromFront).toFixed(2)}deg`);
        CardElement.classList.add("is-pulled");
        MarkCardsBesideFront(AlbumIndex);
        WheelState.PulledIndex = AlbumIndex;
    }

    function ReturnPulledCard() {
        if (WheelState.PulledIndex < 0) return;
        WheelState.AlbumElements[WheelState.PulledIndex].parentElement.classList.remove("is-pulled");
        MarkCardsBesideFront(-1);
        WheelState.PulledIndex = -1;
    }

    function IsPointerNearPulledCard(PointerEvent) {
        const CardRect = WheelState.AlbumElements[WheelState.PulledIndex].parentElement.getBoundingClientRect();
        const Anchor = WheelState.PullAnchor;
        const Margin = 24;
        const Left = Math.min(CardRect.left, Anchor.X) - Margin, Right = Math.max(CardRect.right, Anchor.X) + Margin;
        const Top = Math.min(CardRect.top, Anchor.Y) - Margin, Bottom = Math.max(CardRect.bottom, Anchor.Y) + Margin;
        return PointerEvent.clientX > Left && PointerEvent.clientX < Right && PointerEvent.clientY > Top && PointerEvent.clientY < Bottom;
    }

    const WHEEL_PULL_GAP = 2; // CDs each side that step aside
    function MarkCardsBesideFront(AlbumIndex) {
        const Count = WheelState.AlbumElements.length;
        WheelState.AlbumElements.forEach((AlbumElement, Index) => {
            const Distance = Math.min(Math.abs(Index - AlbumIndex), Count - Math.abs(Index - AlbumIndex));
            AlbumElement.parentElement.classList.toggle("is-beside-pulled", AlbumIndex >= 0 && Distance > 0 && Distance <= WHEEL_PULL_GAP);
        });
    }

    // Coming into view: the ring swings round into place
    function StartWheelSwingIn() {
        WheelState.Angle = WheelState.TargetAngle - (PrefersReducedMotion ? 0 : 50);
        RequestWheelFrame();
    }

    // Turn the ring (the short way round, or with extra full turns) so an album faces the viewer
    function SpinWheelToIndex(AlbumIndex, ExtraTurns = 0) {
        if (AlbumIndex < 0) return;
        const CurrentAngle = WheelState.TargetAngle;
        const GoalAngle = AlbumIndex * WheelState.StepDegrees - WHEEL_SHOW_ANGLE;
        let Difference = ((GoalAngle - CurrentAngle) % 360 + 540) % 360 - 180;
        if (ExtraTurns) Difference = (Difference < 0 ? Difference + 360 : Difference) + 360 * ExtraTurns;
        WheelState.TargetAngle = CurrentAngle + Difference;
        RequestWheelFrame();
    }

    // The album facing the viewer now (at the front, in the middle)
    function GetWheelShownIndex() {
        const Count = WheelState.AlbumElements.length;
        const Index = Math.round((WheelState.TargetAngle + WHEEL_SHOW_ANGLE) / WheelState.StepDegrees);
        return ((Index % Count) + Count) % Count;
    }

    // Degrees for each pixel of scroll or drag
    function GetWheelDegreesPerPixel() {
        return 140 / Math.max(320, window.innerWidth);
    }

    function HandleWheelViewWheel(WheelEvent) {
        if (IsAlbumDetailsOpen()) return;
        WheelEvent.preventDefault();
        const DeltaModeScale = WheelEvent.deltaMode === 1 ? 16 : WheelEvent.deltaMode === 2 ? window.innerHeight : 1;
        const Delta = (Math.abs(WheelEvent.deltaX) > Math.abs(WheelEvent.deltaY) ? WheelEvent.deltaX : WheelEvent.deltaY) * DeltaModeScale;
        WheelState.PendingOpenIndex = -1;
        WheelState.Follow = 0.08;
        WheelState.TargetAngle += ClampNumber(Delta, -240, 240) * GetWheelDegreesPerPixel() * 0.45 * ShelfConfig.WheelPanMultiplier;
        RequestWheelFrame();
    }

    function HandleWheelPointerDown(PointerEvent) {
        if (PointerEvent.pointerType === "mouse" && PointerEvent.button !== 0) return;
        WheelState.Drag = { PointerId: PointerEvent.pointerId, StartX: PointerEvent.clientX, LastX: PointerEvent.clientX, LastTime: performance.now(), HasMoved: false };
        WheelState.Velocity = 0;
        WheelState.PendingOpenIndex = -1;
        WheelState.Follow = 0.08;
        WheelState.TargetAngle = WheelState.Angle;
    }

    function HandleWheelPointerMove(PointerEvent) {
        if (PointerEvent.pointerType === "mouse") {
            WheelState.PointerTiltX = ClampNumber((PointerEvent.clientY / window.innerHeight - 0.5) * 2, -1, 1);
            WheelState.PointerTiltY = ClampNumber((PointerEvent.clientX / window.innerWidth - 0.5) * 2, -1, 1);
            WheelState.LastPointer = { X: PointerEvent.clientX, Y: PointerEvent.clientY };
            UpdateWheelPreview(WheelState.Drag && WheelState.Drag.HasMoved ? null : PointerEvent.target, PointerEvent);
            RequestWheelFrame();
        }
        const Drag = WheelState.Drag;
        if (!Drag || PointerEvent.pointerId !== Drag.PointerId) return;
        if (!Drag.HasMoved && Math.abs(PointerEvent.clientX - Drag.StartX) > 8) {
            Drag.HasMoved = true;
            WheelElements.View.setPointerCapture(PointerEvent.pointerId);
            WheelElements.View.classList.add("is-dragging");
            UpdateWheelPreview(null);
        }
        if (!Drag.HasMoved) return;
        const Now = performance.now();
        const DeltaDegrees = -(PointerEvent.clientX - Drag.LastX) * GetWheelDegreesPerPixel();
        WheelState.Angle += DeltaDegrees;
        WheelState.TargetAngle = WheelState.Angle;
        WheelState.Velocity = DeltaDegrees / Math.max(1, (Now - Drag.LastTime) / 16.667);
        Drag.LastX = PointerEvent.clientX;
        Drag.LastTime = Now;
        RequestWheelFrame();
    }

    function HandleWheelPointerUp(PointerEvent) {
        const Drag = WheelState.Drag;
        if (!Drag || PointerEvent.pointerId !== Drag.PointerId) return;
        WheelState.Drag = null;
        WheelElements.View.classList.remove("is-dragging");
        if (Drag.HasMoved) {
            // Fling: keep gliding the way it was thrown
            const IsStale = performance.now() - Drag.LastTime > 80;
            WheelState.TargetAngle = WheelState.Angle + (IsStale ? 0 : WheelState.Velocity * 22);
            RequestWheelFrame();
            return;
        }
        if (PointerEvent.type !== "pointerup") return;
        // A tap on a CD opens it, and the ring turns it to face the front behind the popup
        const CardElement = PointerEvent.target.closest && PointerEvent.target.closest(".wheel-card");
        if (!CardElement) return;
        const AlbumIndex = Number(CardElement.dataset.wheelIndex);
        WheelElements.Preview.classList.remove("is-visible");
        OpenAlbumDetails(WheelState.AlbumElements[AlbumIndex]);
        // Already out and facing the viewer (mouse)? It stays put. Otherwise (touch) the ring turns it to the front.
        if (WheelState.PulledIndex !== AlbumIndex) SpinWheelToIndex(AlbumIndex);
    }

    // Hover: the CD comes out of the ring to face the viewer, and shows large in the bottom-right
    // corner with its name (mouse only)
    function UpdateWheelPreview(HoveredTarget, PointerEvent = null) {
        if (IsAlbumDetailsOpen()) return; // the popup is up: leave the CD where it is until the mouse moves again
        const CardElement = HoveredTarget && HoveredTarget.closest ? HoveredTarget.closest(".wheel-card") : null;
        const HoveredIndex = CardElement ? Number(CardElement.dataset.wheelIndex) : -1;
        if (HoveredIndex === WheelState.HoveredIndex) return;
        // The CD moved out from under the mouse as it came forward: keep it out while the mouse is still
        // between where it was and where it is now (otherwise it would bob in and out)
        if (HoveredIndex < 0 && PointerEvent && WheelState.PulledIndex >= 0 && WheelState.PulledIndex === WheelState.HoveredIndex &&
            IsPointerNearPulledCard(PointerEvent)) return;
        if (WheelState.HoveredIndex >= 0) WheelState.AlbumElements[WheelState.HoveredIndex].parentElement.classList.remove("is-hovered");
        WheelState.HoveredIndex = HoveredIndex;
        clearTimeout(WheelState.BringTimeoutId);
        WheelState.PendingPullIndex = -1;
        if (HoveredIndex < 0) {
            WheelElements.Preview.classList.remove("is-visible");
            RequestWheelFrame(); // drifting resumes
            return;
        }
        const Album = AlbumCollection[HoveredIndex];
        CardElement.classList.add("is-hovered");
        if (WheelState.PendingOpenIndex < 0) {
            if (IsCardAtFront(HoveredIndex)) {
                // Already at the front: it comes straight out
                if (PointerEvent) WheelState.PullAnchor = { X: PointerEvent.clientX, Y: PointerEvent.clientY };
                PullCardOut(HoveredIndex);
            } else {
                // Elsewhere on the ring: after a couple of seconds, the ring brings it round to the front
                WheelState.BringTimeoutId = setTimeout(() => {
                    if (WheelState.HoveredIndex !== HoveredIndex || WheelState.PendingOpenIndex >= 0 || IsAlbumDetailsOpen()) return;
                    WheelState.PendingPullIndex = HoveredIndex;
                    WheelState.Follow = 0.05; // an unhurried turn
                    SpinWheelToIndex(HoveredIndex);
                }, WHEEL_HOVER_BRING_MS);
            }
        }
        WheelElements.PreviewImage.removeAttribute("src");
        ResolvePhoto(Album.FrontCoverImage).then((PhotoUrl) => {
            if (WheelState.HoveredIndex === HoveredIndex && PhotoUrl) WheelElements.PreviewImage.src = PhotoUrl;
        });
        ScrambleText(WheelElements.PreviewAlbum, Album.AlbumName, 380);
        ScrambleText(WheelElements.PreviewArtist, Album.ArtistName, 460);
        WheelElements.Preview.classList.add("is-visible");
    }

    function HandleWheelKeyDown(KeyboardEvent) {
        const StepDirection = { ArrowLeft: -1, KeyA: -1, ArrowUp: -1, KeyW: -1, ArrowRight: 1, KeyD: 1, ArrowDown: 1, KeyS: 1 }[KeyboardEvent.code];
        if (StepDirection) {
            KeyboardEvent.preventDefault();
            WheelState.PendingOpenIndex = -1;
            WheelState.Follow = 0.08;
            SpinWheelToIndex(GetWheelShownIndex() + StepDirection < 0 ? WheelState.AlbumElements.length - 1 : (GetWheelShownIndex() + StepDirection) % WheelState.AlbumElements.length);
            return;
        }
        if (KeyboardEvent.key === "Enter" || KeyboardEvent.key === " ") {
            KeyboardEvent.preventDefault();
            const FocusedAlbumElement = document.activeElement && document.activeElement.closest && document.activeElement.closest(".wheel-card .cd");
            OpenAlbumDetails(FocusedAlbumElement || WheelState.AlbumElements[GetWheelShownIndex()], true);
        }
    }

    // Tabbing to a CD turns it to face the front
    function HandleWheelFocus(FocusEvent) {
        const AlbumElement = FocusEvent.target.closest && FocusEvent.target.closest(".wheel-card .cd");
        if (AlbumElement && !WheelState.Drag && !IsAlbumDetailsOpen()) SpinWheelToIndex(WheelState.AlbumElements.indexOf(AlbumElement));
    }

    /* ------------------------------------------------------------------ */
    /* 12. View toggle (Wall / Wheel) + shuffle                            */
    /* ------------------------------------------------------------------ */
    // The wheel is its own page at #wheel, so it can be linked to and the toggle remembers it.

    const ViewToggleElement = document.getElementById("ViewToggle");
    const ShuffleButtonElement = document.getElementById("ShuffleButton");
    let CurrentView = "Wall";

    function IsWheelViewActive() {
        return CurrentView === "Wheel";
    }

    function SetView(NewView) {
        if (!WheelElements.View || NewView === CurrentView) return;
        if (IsAlbumDetailsOpen()) CloseAlbumDetails();
        HideHoverCaption();
        HeldPanKeys.clear();
        CancelWallShuffle();
        CurrentView = NewView;
        const IsWheel = NewView === "Wheel";
        if (IsWheel) BuildWheel();
        ViewToggleElement.setAttribute("aria-checked", String(IsWheel));
        document.documentElement.dataset.view = NewView;
        WheelElements.View.hidden = !IsWheel;
        if (!IsWheel) UpdateWheelPreview(null);
        ListeningRoomElement.hidden = IsWheel;
        if (!IsWheel && IsWallLayoutStale) RenderWall(true); // the screen changed size while the wall was hidden
        if (IsWheel) {
            // Swing in: the ring turns the last few CDs into place
            ApplyWheelSizes();
            StartWheelSwingIn();
        } else {
            RequestMotionFrame();
        }
        const NewHash = IsWheel ? "#wheel" : "";
        if (location.hash !== NewHash) history.replaceState(null, "", NewHash || location.pathname + location.search);
    }

    function HandleViewHashChange() {
        SetView(location.hash === "#wheel" ? "Wheel" : "Wall");
    }

    // Open an album wherever it sits in the current view (footer list, shuffle)
    function ShowAlbumInView(AlbumId) {
        if (!IsWheelViewActive()) {
            FindAlbumOnWall(AlbumId);
            return;
        }
        const AlbumIndex = AlbumCollection.findIndex((Album) => Album.AlbumId === AlbumId);
        if (AlbumIndex < 0) return;
        OpenAlbumDetails(WheelState.AlbumElements[AlbumIndex]);
        SpinWheelToIndex(AlbumIndex);
    }

    // The CD to show (and lift) for an album when the popup moves to it; the view follows along
    function BringAlbumIntoView(Album) {
        if (IsWheelViewActive()) {
            const AlbumIndex = AlbumCollection.indexOf(Album);
            SpinWheelToIndex(AlbumIndex);
            return WheelState.AlbumElements[AlbumIndex] || null;
        }
        const AlbumElement = FindNearestAlbumElement(Album.AlbumId);
        if (AlbumElement) CentreAlbumOnScreen(AlbumElement);
        return AlbumElement;
    }

    // Shuffle: any album but the one in front. The wheel spins right round to it, like a
    // prize wheel; the wall glides over to it. Either way its details open when it arrives.
    function ShuffleAlbum() {
        if (AlbumCollection.length < 2 || IsAlbumDetailsOpen()) return;
        const CurrentIndex = IsWheelViewActive() ? GetWheelShownIndex() : -1;
        let RandomIndex = Math.floor(Math.random() * (AlbumCollection.length - 1));
        if (RandomIndex >= CurrentIndex && CurrentIndex >= 0) RandomIndex += 1;
        if (!IsWheelViewActive()) {
            ShuffleOnWall(AlbumCollection[RandomIndex].AlbumId);
            return;
        }
        WheelState.Follow = 0.05;
        WheelState.PendingOpenIndex = RandomIndex;
        SpinWheelToIndex(RandomIndex, PrefersReducedMotion ? 0 : 1);
    }

    // Shuffle on the wall, done slowly enough to watch: a highlight hops between CDs on screen
    // (slowing down like a roulette ball), settles on the pick, the wall glides it to the middle,
    // it waits a moment lit up, then its details open.
    const WALL_SHUFFLE_HOP_DELAYS_MS = [70, 80, 90, 105, 125, 150, 185, 230, 290];
    const WALL_SHUFFLE_HOLD_MS = 650;
    const WallShuffleState = { IsRunning: false, TimeoutIds: [], FrameId: 0, LitElement: null };

    function LightShufflePick(AlbumElement) {
        if (WallShuffleState.LitElement) WallShuffleState.LitElement.classList.remove("is-shuffle-pick");
        WallShuffleState.LitElement = AlbumElement;
        if (AlbumElement) AlbumElement.classList.add("is-shuffle-pick");
    }

    function CancelWallShuffle() {
        if (!WallShuffleState.IsRunning) return;
        WallShuffleState.IsRunning = false;
        WallShuffleState.TimeoutIds.forEach(clearTimeout);
        WallShuffleState.TimeoutIds = [];
        cancelAnimationFrame(WallShuffleState.FrameId);
        LightShufflePick(null);
    }

    function GetCdsOnScreen() {
        const VisibleBottom = window.innerHeight - GetFooterHeight();
        return [...ShelfWallElement.querySelectorAll(".cd[data-album-id]")].filter((AlbumElement) => {
            const AlbumRect = AlbumElement.getBoundingClientRect();
            return AlbumRect.left > 0 && AlbumRect.right < window.innerWidth && AlbumRect.top > 0 && AlbumRect.bottom < VisibleBottom;
        });
    }

    function ShuffleOnWall(AlbumId) {
        CancelWallShuffle();
        if (PrefersReducedMotion) {
            FindAlbumOnWall(AlbumId);
            return;
        }
        WallShuffleState.IsRunning = true;
        const CdsOnScreen = GetCdsOnScreen();
        let ElapsedMs = 0;
        WALL_SHUFFLE_HOP_DELAYS_MS.forEach((HopDelayMs) => {
            ElapsedMs += HopDelayMs;
            WallShuffleState.TimeoutIds.push(setTimeout(() => {
                const Choices = CdsOnScreen.filter((AlbumElement) => AlbumElement !== WallShuffleState.LitElement);
                if (Choices.length) LightShufflePick(Choices[Math.floor(Math.random() * Choices.length)]);
            }, ElapsedMs));
        });
        WallShuffleState.TimeoutIds.push(setTimeout(() => GlideToShufflePick(AlbumId), ElapsedMs + 320));
    }

    function GlideToShufflePick(AlbumId) {
        const PickedElement = FindNearestAlbumElement(AlbumId);
        if (!PickedElement) { CancelWallShuffle(); return; }
        LightShufflePick(PickedElement);
        const AlbumCentre = GetFlatAlbumCentre(PickedElement);
        const { CentreX, CentreY } = GetVisibleWallCentre();
        const ShiftX = CentreX - AlbumCentre.X, ShiftY = CentreY - AlbumCentre.Y;
        const StartX = CameraState.CurrentX, StartY = CameraState.CurrentY;
        // Longer trips take a little longer, but every glide is slow enough to follow
        const GlideMs = ClampNumber(700 + Math.hypot(ShiftX, ShiftY) * 0.9, 900, 1700);
        const GlideStartTime = performance.now();
        const StepGlide = (FrameTime) => {
            if (!WallShuffleState.IsRunning) return;
            const Progress = ClampNumber((FrameTime - GlideStartTime) / GlideMs, 0, 1);
            const Eased = Progress < 0.5 ? 4 * Progress ** 3 : 1 - (-2 * Progress + 2) ** 3 / 2; // ease in and out
            CameraState.VelocityX = CameraState.VelocityY = 0;
            CameraState.TargetX = StartX + ShiftX * Eased;
            CameraState.TargetY = StartY + ShiftY * Eased;
            RequestMotionFrame();
            if (Progress < 1) {
                WallShuffleState.FrameId = requestAnimationFrame(StepGlide);
                return;
            }
            WallShuffleState.TimeoutIds.push(setTimeout(() => {
                if (!WallShuffleState.IsRunning) return;
                CancelWallShuffle();
                OpenAlbumDetails(PickedElement);
            }, WALL_SHUFFLE_HOLD_MS));
        };
        WallShuffleState.FrameId = requestAnimationFrame(StepGlide);
    }

    function SetUpViews() {
        if (!WheelElements.View || !ViewToggleElement) return;
        ViewToggleElement.addEventListener("click", () => SetView(IsWheelViewActive() ? "Wall" : "Wheel"));
        ShuffleButtonElement.addEventListener("click", ShuffleAlbum);
        WheelElements.View.addEventListener("wheel", HandleWheelViewWheel, { passive: false });
        WheelElements.View.addEventListener("pointerdown", HandleWheelPointerDown);
        WheelElements.View.addEventListener("pointermove", HandleWheelPointerMove);
        WheelElements.View.addEventListener("pointerup", HandleWheelPointerUp);
        WheelElements.View.addEventListener("pointercancel", HandleWheelPointerUp);
        WheelElements.View.addEventListener("focusin", HandleWheelFocus);
        WheelElements.View.addEventListener("contextmenu", (ContextEvent) => ContextEvent.preventDefault());
        WheelElements.View.addEventListener("dragstart", (DragEvent) => DragEvent.preventDefault());
        WheelElements.View.addEventListener("pointerleave", () => UpdateWheelPreview(null));
        document.addEventListener("visibilitychange", RequestWheelFrame);
        window.addEventListener("hashchange", HandleViewHashChange);
        const StartView = location.hash === "#wheel" ? "Wheel" : location.hash === "#wall" ? "Wall" : ShelfConfig.DefaultView;
        if (StartView === "Wheel") SetView("Wheel");
        else document.documentElement.dataset.view = "Wall";
    }

    /* ------------------------------------------------------------------ */
    /* 13. Intro, start-up + resize                                       */
    /* ------------------------------------------------------------------ */

    function RenderWall(PreserveCameraPosition) {
        // Remember where we are as a fraction of a tile so a resize keeps the same CDs on screen
        const PreviousTileProgressX = CameraState.CurrentX / CameraState.CurrentScale / TilePool.TileWidth;
        const PreviousTileProgressY = CameraState.CurrentY / CameraState.CurrentScale / TilePool.TileHeight;

        CurrentLayoutMetrics = ComputeLayoutMetrics();
        ApplyLayoutSizes(CurrentLayoutMetrics);
        BuildTilePool(CurrentLayoutMetrics);
        IsWallLayoutStale = false;

        if (PreserveCameraPosition) {
            CameraState.TargetX = CameraState.CurrentX = PreviousTileProgressX * TilePool.TileWidth * CameraState.CurrentScale;
            CameraState.TargetY = CameraState.CurrentY = PreviousTileProgressY * TilePool.TileHeight * CameraState.CurrentScale;
            CameraState.VelocityX = CameraState.VelocityY = 0;
            CameraState.PreviousX = CameraState.CurrentX;
            CameraState.PreviousY = CameraState.CurrentY;
        }
        WriteCameraTransform();
    }

    // Frame the start of the collection, then glide in from the right, set back and turned,
    // so the wall swings round and settles into place
    function StartIntroCameraMove() {
        const ViewportWidth = window.innerWidth;
        const ViewportHeight = window.innerHeight;
        // Opens zoomed out (StartZoom), so more of the collection is on screen at first
        const StartScale = ClampNumber(Number(ShelfConfig.StartZoom) || 1, ShelfConfig.MinimumZoom, ShelfConfig.MaximumZoom);
        CameraState.CurrentScale = StartScale;
        const ShownTileWidth = TilePool.TileWidth * StartScale;
        const ShownTileHeight = TilePool.TileHeight * StartScale;
        const ShownCdSize = CurrentLayoutMetrics.CdSizePx * StartScale;
        CameraState.TargetX = ShownTileWidth < ViewportWidth ? Math.round((ViewportWidth - ShownTileWidth) / 2) : Math.round(ShownCdSize * 0.25);
        CameraState.TargetY = ShownTileHeight < ViewportHeight ? Math.round((ViewportHeight - ShownTileHeight) / 2) : Math.round(ShownCdSize * 0.2);
        CameraState.CurrentX = CameraState.TargetX + (PrefersReducedMotion ? 0 : Math.min(320, ViewportWidth * 0.24));
        CameraState.CurrentY = CameraState.TargetY;
        CameraState.PreviousX = CameraState.CurrentX;
        CameraState.PreviousY = CameraState.CurrentY;
        if (!PrefersReducedMotion && ShelfConfig.MotionSwing) {
            MotionState.Depth = 240;  // starts far back and turned away, then swings into place
            MotionState.SwingY = 9;
        }
        WriteCameraTransform();
        WriteWallTilt();
    }

    // Loading counter (bottom-right, like a record shop's till): counts up while fonts and the
    // first covers arrive, never longer than about a second, then lifts away to reveal the wall
    function RunPreloader() {
        const PreloaderElement = document.getElementById("Preloader");
        const CountElement = document.getElementById("PreloaderCount");
        const RevealWall = () => {
            ListeningRoomElement.classList.add("is-ready");
            if (IsWheelViewActive()) StartWheelSwingIn();
            else RequestMotionFrame();
        };
        if (!PreloaderElement || !ShelfConfig.ShowIntro || PrefersReducedMotion) {
            if (PreloaderElement) PreloaderElement.remove();
            RevealWall();
            return;
        }
        const MINIMUM_MS = 650, MAXIMUM_MS = 1100;
        const StartTime = performance.now();
        let IsLoaded = false;
        const FirstCovers = AlbumCollection.slice(0, 12).map((Album) => ResolvePhoto(Album.FrontCoverImage));
        Promise.all([document.fonts ? document.fonts.ready : null, ...FirstCovers]).then(() => { IsLoaded = true; });

        const StepCount = (FrameTime) => {
            const Elapsed = FrameTime - StartTime;
            const IsDone = (IsLoaded && Elapsed >= MINIMUM_MS) || Elapsed >= MAXIMUM_MS;
            const Progress = IsDone ? 1 : EaseOutCubic(Math.min(Elapsed / MAXIMUM_MS, 1)) * 0.96;
            CountElement.textContent = String(Math.round(Progress * 100));
            if (!IsDone) {
                requestAnimationFrame(StepCount);
                return;
            }
            PreloaderElement.classList.add("is-done");
            RevealWall();
            setTimeout(() => PreloaderElement.remove(), 900);
        };
        requestAnimationFrame(StepCount);
    }

    // The hidden view is laid out again when it is next shown (a hidden wall cannot be measured)
    let ResizeTimeoutId = null;
    let IsWallLayoutStale = false;
    function HandleResize() {
        clearTimeout(ResizeTimeoutId);
        ResizeTimeoutId = setTimeout(() => {
            if (IsWheelViewActive()) {
                IsWallLayoutStale = true;
                ApplyWheelSizes();
                RequestWheelFrame();
            } else {
                RenderWall(true);
            }
        }, 120);
    }

    function ShowSiteTitle() {
        const SiteTitleElement = document.getElementById("SiteTitle");
        const SiteTitle = String(ShelfConfig.SiteTitle || "").trim();
        if (SiteTitle) document.title = SiteTitle;
        if (!SiteTitleElement) return;
        SiteTitleElement.textContent = SiteTitle;
        SiteTitleElement.parentElement.hidden = !SiteTitle;
        // Home: reload this page fresh on the wall (drops #wheel). Works the same opened from a file.
        SiteTitleElement.addEventListener("click", (ClickEvent) => {
            if (ClickEvent.metaKey || ClickEvent.ctrlKey || ClickEvent.shiftKey || ClickEvent.button !== 0) return; // new tab etc.
            ClickEvent.preventDefault();
            window.location.href = window.location.pathname + window.location.search;
        });
    }

    function BootListeningWall() {
        ShowSiteTitle();
        if (ShelfConfig.LightingColour) document.documentElement.dataset.lighting = ShelfConfig.LightingColour;
        ApplyWoodPhotoTexture();
        RenderWall(false);
        StartIntroCameraMove();
        SetUpCollectionFooter();
        SetUpViews();
        RunPreloader();

        ListeningRoomElement.addEventListener("pointerdown", HandlePointerDown);
        ListeningRoomElement.addEventListener("pointermove", HandlePointerMove);
        ListeningRoomElement.addEventListener("pointerup", HandlePointerUp);
        ListeningRoomElement.addEventListener("pointercancel", HandlePointerUp);
        ListeningRoomElement.addEventListener("lostpointercapture", HandlePointerUp);
        ListeningRoomElement.addEventListener("wheel", HandleWheel, { passive: false });
        ListeningRoomElement.addEventListener("focusin", HandleAlbumFocus);
        ListeningRoomElement.addEventListener("pointermove", HandleHoverPointerMove);
        ListeningRoomElement.addEventListener("pointerleave", HideHoverCaption);
        ListeningRoomElement.addEventListener("contextmenu", (ContextEvent) => ContextEvent.preventDefault());
        ListeningRoomElement.addEventListener("dragstart", (DragEvent) => DragEvent.preventDefault());

        window.addEventListener("keydown", HandleKeyDown);
        window.addEventListener("keydown", TrapAlbumDetailsFocus);
        window.addEventListener("keyup", HandleKeyUp);
        window.addEventListener("blur", () => { HeldPanKeys.clear(); SetEdgeScroll(0, 0); });
        window.addEventListener("pointermove", HandleEdgeScrollPointerMove, { passive: true });
        document.addEventListener("pointerout", (PointerEvent) => { if (!PointerEvent.relatedTarget) SetEdgeScroll(0, 0); }); // mouse left the window
        window.addEventListener("resize", HandleResize);
        window.addEventListener("orientationchange", HandleResize);

        AlbumDetailsElements.Popup.addEventListener("click", HandleAlbumDetailsClick);
        AlbumDetailsElements.Popup.addEventListener("keydown", HandleAlbumDetailsKeyDown);
        AlbumDetailsElements.Popup.addEventListener("pointerdown", HandlePopupPointerDown);
        AlbumDetailsElements.Popup.addEventListener("pointerup", HandlePopupPointerUp);
        AlbumDetailsElements.Popup.addEventListener("pointercancel", HandlePopupPointerUp);
        AlbumDetailsElements.Popup.addEventListener("wheel", HandlePopupWheel, { passive: false });

        // Safari pinch gestures zoom the wall rather than the page
        document.addEventListener("gesturestart", HandleGestureStart);
        document.addEventListener("gesturechange", HandleGestureChange);

        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!IsWheelViewActive() && TilePool.Tiles[0] && parseFloat(getComputedStyle(TilePool.Tiles[0].TileElement).width) !== TilePool.TileWidth) RenderWall(true); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", BootListeningWall);
    else BootListeningWall();
})();
