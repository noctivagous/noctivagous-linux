# NCTGraphite components

Future `NCTGraphite…` React layout primitives, controls, windows, menus, data
components, and logic components belong here.

Each component is expected to ship with:

- Typed React props
- `NCTGraphite…Meta` metadata
- Generated catalog and XML validation entries
- Tests
- At least one functional-application call site

## Print page recipe (Grid Systems Lab evaluation)

Evaluated against `apps/NCTGraphiteStudio/web-artifacts/Grid+Systems+Lab+Print`.
Columns/gutters as *layout* are `NCTGraphiteGrid`; as *guides* they are
`NCTGraphiteColumnGuides` mirroring the content grid's `columns`/`gap`, with
the gutter bed showing through the gaps. Baseline rules are
`NCTGraphiteBaseline`. Layer all three in `NCTGraphiteOverlay` so guides span
the content without affecting layout:

```tsx
<NCTGraphiteOverlay>
  <NCTGraphiteGrid columns="repeat(6, 1fr)" gap={24}>{content}</NCTGraphiteGrid>
  <NCTGraphiteColumnGuides columns="repeat(6, 1fr)" gap={24} count={6} />
  <NCTGraphiteBaseline line={16} />
</NCTGraphiteOverlay>
```

Margins, the marginalia rail, and the page size stay host-owned: margins are
padding (or outer grid tracks), the marginalia rail is one more grid track,
and pagination needs dedicated design (not a guide) — still open.
