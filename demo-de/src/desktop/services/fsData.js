/* The demo file system, as a JSON-shaped tree.
 *
 * This is data, not code: a realistic home directory for the
 * demo, with real text content in the text files so the shell's
 * cat and the Files preview drawer have something to show.
 * fs.js clones it into the live, mutable tree the session
 * works on (mkdir / touch / rm change the clone, never this).
 *
 * Node shape: { name, kind: "folder" | "file", type?, size?,
 *               content?, children? }
 */

export const FS_DATA = {
  name: "", kind: "folder", children: [
    { name: "home", kind: "folder", children: [
      { name: "noctivagous", kind: "folder", children: [
        { name: "Documents", kind: "folder", children: [
          { name: "report-q3.txt", kind: "file", type: "Text", size: "18 KB",
            content: "Q3 NOTES — NCT DESKTOP\n\nThe desktop stopped being a set of pages and became\na system: one store, one registry, every app a module.\nKey-clicks are the native input now, not an overlay.\n\nOpen threads:\n- the proxy stays unwired until the network story is set\n- freeze needs a permanent key, not a borrowed one\n- the transformer region wants a second mode (grid)\n" },
          { name: "budget.csv", kind: "file", type: "Sheet", size: "44 KB",
            content: "item,estimate,actual\nVercel Hobby,0,0\nDomain renewal,14,14\nFont licences,120,120\nCoffee (studio),60,83\nHardware — trackball,140,132\n" },
          { name: "letter.txt", kind: "file", type: "Text", size: "3 KB",
            content: "Dear M—\n\nYou asked what the machine is for. It is for keeping\neverything reachable from wherever your attention\nalready is. A function with one door is a function\nhalf the room cannot use.\n\nMore when the next round lands.\n— N\n" },
          { name: "reading", kind: "folder", children: [
            { name: "book-notes.txt", kind: "file", type: "Text", size: "9 KB",
              content: "CHINESE BOOK — WORKING NOTES\n\nThesis: give the reader the map, not the phrasebook.\nCharacters come apart into parts; the sound system is\na map, not a list; grammar is order and particles,\nnot endings.\n\nChapter order is one topic at a time. Discuss first,\nbuild second.\n" },
            { name: "sources.txt", kind: "file", type: "Text", size: "2 KB",
              content: "SOURCES\n- Giles, Three Character Classic (alignment)\n- Harris, The Art of Calligraphy\n- George, Speedball Modern Lettering (1927)\n- Dürer, Of the Just Shaping of Letters (1525)\n" },
          ] },
          { name: "archive", kind: "folder", children: [
            { name: "resume-2024.txt", kind: "file", type: "Text", size: "5 KB",
              content: "NOCTIVAGOUS — builder of interfaces and instruments.\nSpatial desktops, parametric UI, classical AI.\n" },
            { name: "taxes-2023.csv", kind: "file", type: "Sheet", size: "11 KB",
              content: "quarter,income,expenses\nQ1,0,412\nQ2,0,388\nQ3,0,401\nQ4,0,377\n" },
          ] },
        ] },
        { name: "Projects", kind: "folder", children: [
          { name: "demo-de", kind: "folder", children: [
            { name: "README.md", kind: "file", type: "Markdown", size: "6 KB",
              content: "# demo-de\n\nThe environment laboratory for noctivagous-linux:\na futuristic spatial desktop, built natively on\nkey-clicks and bimodal control.\n" },
            { name: "DESIGN.md", kind: "file", type: "Markdown", size: "4 KB",
              content: "# Design notes\n\n- Start from the aesthetic and the interaction.\n- Make the experience genuinely work.\n- Gaps in the framework become framework features.\n" },
          ] },
          { name: "nct-ui", kind: "folder", children: [
            { name: "README.md", kind: "file", type: "Markdown", size: "3 KB",
              content: "# nct-ui\n\nFragments of the dark NCT palette and technical\ntype the desktop is skinned with.\n" },
          ] },
          { name: "strokecore", kind: "folder", children: [
            { name: "README.md", kind: "file", type: "Markdown", size: "8 KB",
              content: "# StrokeCore\n\nLetterforms as spine + nib: shape, size and roll\nvarying along the path, so a font file doubles as\na ductus. Fonts store fused outlines; hands make\nstrokes.\n" },
          ] },
          { name: "ansci", kind: "folder", children: [
            { name: "README.md", kind: "file", type: "Markdown", size: "7 KB",
              content: "# AnSci\n\nA classical-AI system: an ancient Chinese knowledge\ngraph, priced derivation, testimony discipline.\nNo neural net at runtime.\n" },
          ] },
          { name: "whirlivector", kind: "folder", children: [
            { name: "notes.txt", kind: "file", type: "Text", size: "2 KB",
              content: "WHIRLIVECTOR — a motion environment.\nGround first, relationships second, elements third.\n" },
          ] },
          { name: "README.md", kind: "file", type: "Markdown", size: "6 KB",
            content: "# Projects\n\ndemo-de · nct-ui · strokecore · ansci · whirlivector\nOne repo each; the desktop is the laboratory.\n" },
        ] },
        { name: "Pictures", kind: "folder", children: [
          { name: "wall-01.png", kind: "file", type: "Image", size: "1.2 MB" },
          { name: "wall-02.png", kind: "file", type: "Image", size: "980 KB" },
          { name: "capture.png", kind: "file", type: "Image", size: "2.4 MB" },
          { name: "sketches", kind: "folder", children: [
            { name: "glyph-study.png", kind: "file", type: "Image", size: "640 KB" },
            { name: "luoshu-draft.png", kind: "file", type: "Image", size: "512 KB" },
          ] },
        ] },
        { name: "Music", kind: "folder", children: [
          { name: "drone-01.flac", kind: "file", type: "Audio", size: "24 MB" },
          { name: "loops", kind: "folder", children: [
            { name: "rain-loop.wav", kind: "file", type: "Audio", size: "8 MB" },
          ] },
        ] },
        { name: "notes.txt", kind: "file", type: "Text", size: "2 KB",
          content: "Scratch notes.\n\n- Every function gets more than one door.\n- Layout claims are measured, not eyeballed.\n- Push only on the word; batch it into one.\n" },
        { name: ".profile", kind: "file", type: "Config", size: "1 KB",
          content: "# nctsh profile\nexport EDITOR=nct-edit\nexport NCT_THEME=dark-gold\nalias ll='ls -l'\n" },
        { name: ".config", kind: "folder", children: [
          { name: "nct", kind: "folder", children: [
            { name: "settings.json", kind: "file", type: "Config", size: "1 KB",
              content: "{\n  \"backdrop\": \"parametric\",\n  \"keyclicks\": true,\n  \"freezeKey\": \"9\",\n  \"configureKey\": \"\\\\\"\n}\n" },
          ] },
        ] },
      ] },
    ] },
  ],
};
