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
   SHELF SETTINGS — config.js
   Tweak how the wall is laid out, lit, and how it feels to move around.
   ===================================================================== */

window.ShelfConfig = {
    // The name shown at the top left (and in the browser tab). "" = none.
    SiteTitle: "DH Listening Wall",

    // How many CDs stand side by side in one cubby.
    CdsPerShelf: 3,

    // How many cubbies wide your collection is before the wall repeats.
    // "auto" picks a landscape-ish block. The wall is endless: the whole
    // collection repeats seamlessly in every direction.
    CubbiesAcross: "auto",

    // Optional: path to a real wood photo (e.g. "textures/walnut.jpg") to use
    // for the shelves instead of the built-in grain. A wide shot of
    // horizontal grain, at least 1000px across, works best.
    WoodTextureImage: "",

    // Order of CDs on the wall: "Random" (new order every visit), "Manual"
    // (order in albums.js), "AlbumNumber", "ArtistName", "AlbumName",
    // "AlbumYear" or "AlbumYearNewestFirst".
    SortAlbumsBy: "Random",

    // Room lighting: "Ember" (red-lit record room), "Red" (deep red darkroom)
    // or "Amber" (warm orange evening lamps).
    LightingColour: "Ember",

    // Footer (intro text + the full list): starts as a small ^ tab. It comes up when the mouse moves to the
    // bottom of the screen (or the tab is clicked / tapped) and stays up until
    // it is tucked away again with the down arrow.

    FooterText: "DH Personal Click Through CD Collection",

    // Movement feel.
    PanSmoothing: 0.12,       // 0–1, higher = snappier follow
    PanFriction: 0.95,        // 0–1, higher = longer glide after a flick
    KeyboardPanSpeed: 16,     // pixels per frame while an arrow / WASD key is held
    EdgeScrollSpeed: 1,       // 0 = off; mouse near the left / right / top edge moves the wall (turns the wheel)
    WheelPanMultiplier: 1,

    // Motion.
    MotionSwing: 1,           // 0 = off; how much the wall leans and drifts back as it moves
    MouseParallax: 1,         // 0 = off; how much the wheel tips towards the mouse
    ShowIntro: true,          // short loading counter, then the wall swings into place
    ShowHoverCaption: true,   // album + artist follow the mouse over a CD (mouse only)

    // Which view opens first: "Wall" (the shelves) or "Wheel" (the spinning ring).
    // Visitors switch with the toggle at the top right; the wheel also opens at page#wheel.
    DefaultView: "Wall",

    // Zoom (pinch on touch / trackpad, or Ctrl / Cmd + scroll).
    StartZoom: 0.65,          // how zoomed in the wall opens: below 1 = zoomed out, 1 = full size
    MinimumZoom: 0.55,
    MaximumZoom: 2.2,

    // Size of a CD cover in pixels, chosen from the screen size within these limits.
    MinimumCdSizePx: 92,
    MaximumCdSizePx: 196,
};
