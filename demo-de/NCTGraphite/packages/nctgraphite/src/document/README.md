# NCTGraphite documents

This is the AppKit `NSDocument` analogue: a document owns the model, knows
whether it is edited, reads and writes a file snapshot, and keeps undo. Layer
records are part of that model so drawing apps can composite independently
editable modes. Mode-specific paint data stays in the application.

| AppKit | NCTGraphite |
|---|---|
| `NSDocument` | `NCTGraphiteDocument` |
| `NSDocumentController` | `NCTGraphiteDocumentController` |
| `fileURL` / `displayName` | `fileName` / `displayName` |
| `isDocumentEdited` | `edited` |
| `data(ofType:)` / `read(from:ofType:)` | `toJSON()` / `parse()` |
| `NSUndoManager` | `undo` / `redo` / `recordingUndoFrom` |
| Window controllers | The host app (React stage, Paper.js canvas) |

Instances are immutable. Each edit returns a new document with the same `id`.
That is the React-friendly form of a mutable `NSDocument`.

```ts
const doc = NCTGraphiteDocument.untitled({
  layers: [{ id: 'paint', name: 'Hex Paint', visible: true }],
});
const painted = doc.updatingLayer('paint', (layer) => ({ ...layer, visible: false }));
const json = painted.toJSON();
```

Live hold-to-paint should call `updatingLayer(..., { recordUndo: false })`, then
`recordingUndoFrom(preStrokeDocument)` on key-up so one stroke is one undo step.

The `.nctgdoc.json` snapshot is the runtime file. `*.nctgraphite.xml` remains
the GUI tag language under `src/xml/` and is a different kind of document.
