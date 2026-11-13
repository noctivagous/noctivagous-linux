# NCTGraphite theme

Future canonical NCTGraphite design tokens, themes, density modes, and
typography utilities belong here.

Token names and values must converge the existing application themes rather
than preserve three parallel vocabularies.

## Density contract (`NCTGraphiteDensity.css`)

Compact is the default (`:root`); hosts opt a subtree into comfortable
spacing with `data-nct-density="comfortable"`. Tokens:

| Token | Compact | Comfortable |
| --- | --- | --- |
| `--nct-content-gap` | 8px | 20px |
| `--nct-content-padding` | 24px | 36px |
| `--nct-panel-padding` | 0.625rem | 1rem |
| `--nct-panel-radius` | 8px | 10px |

The sheet carries no color or font rules, so importing it never imposes one
app's appearance on another. Components resolve these tokens with fallbacks
matching the compact values, so apps that skip the sheet render compact.
