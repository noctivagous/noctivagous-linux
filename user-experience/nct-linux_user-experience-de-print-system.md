nct-linux_user-experience-de-print-system



The print system has more layers than it first appears, and there's a critical discovery that simplifies your architecture: **CPDB (Common Print Dialog Backends)** already provides the D-Bus abstraction you need.

**The three protocol layers you must implement:**

| Layer | Protocol | Your role |
|---|---|---|
| **App → DE** (print dialog) | CPDB D-Bus interface (`org.openprinting.Backend`) | You implement the **frontend** (your C# print dialog) and the **backend** (your GDExtension that talks to CUPS) |
| **DE → Sandboxed apps** (Flatpak) | XDG Desktop Portal Print (`org.freedesktop.portal.Print`) | You implement the **portal backend** — your DE *is* the portal for Flatpak apps |
| **DE → Printer** (spooler) | IPP over HTTP (port 631) or `libcups` | You talk to `cupsd` as a client. CUPS handles filters, backends, and device I/O |

**The key insight: you don't replace CUPS. You wrap it.**

CUPS (`cupsd`) is a system daemon that:
- Manages queues (`/var/spool/cups`)
- Runs filter chains (PDF → raster → device format)
- Talks to printers via backends (USB, IPP, AppSocket, LPD)
- Discovers printers via DNS-SD/Avahi
- Handles job lifecycle (pending → processing → completed/failed)

Your GDExtension is a **CUPS client**. The modern workflow (CUPS 3.0 "New Architecture") is:

```
Your app generates a PDF
        │
        ▼  IPP Print-Job (HTTP POST to 127.0.0.1:631)
     cupsd
        │
        ▼  (no filter chain needed for IPP Everywhere printers)
     Printer (receives PDF directly)
```

For legacy printers, CUPS still runs the filter chain internally. Your client doesn't care — it submits a PDF and CUPS handles the rest.

**What your GDExtension (C++) needs to expose to C#:**

```cpp
// C++ side (GDExtension)
class PrintService : public RefCounted {
    // Discovery
    Array get_printers();              // List<PrinterInfo>
    PrinterInfo get_printer_info(String name);
    
    // Job submission
    int submit_job(String printer, PackedByteArray pdf_data, 
                   Dictionary options);  // returns job ID
    int submit_job_fd(String printer, int fd, Dictionary options);
    
    // Job control
    void cancel_job(int job_id);
    void hold_job(int job_id);
    void release_job(int job_id);
    String get_job_state(int job_id);   // "pending", "processing", "completed", "failed"
    
    // Printer admin
    void set_default_printer(String name);
    String get_default_printer();
    void add_printer(String name, String device_uri, String model);
    void remove_printer(String name);
    
    // Capabilities (from IPP Get-Printer-Attributes)
    Dictionary get_printer_options(String name);  // media, duplex, color, etc.
    Array get_supported_media(String name);       // paper sizes
    Array get_supported_resolutions(String name);
    
    // Signals
    // signal printer_added(String name)
    // signal printer_removed(String name)
    // signal printer_state_changed(String name, String state)
    // signal job_state_changed(int job_id, String state)
};
```

**The CPDB D-Bus interface (what your print dialog speaks):**

The [CPDB project](https://github.com/OpenPrinting/cpdb-libs) defines a standard D-Bus interface that any print dialog can use, regardless of the underlying print technology. The methods:

| D-Bus method | Purpose |
|---|---|
| `GetAllPrinters()` | List all available printers (from all backends) |
| `GetPrinterInfo(printer)` | Get capabilities, options, state for one printer |
| `PrintFile(printer, path, options)` | Print a file |
| `PrintFD(printer, fd, options)` | Print from a file descriptor (stream) |
| `PrintSocket(printer, socket, options)` | Print from a socket |
| `SetDefaultPrinter(printer)` | Set the default |
| Signal: `PrinterUpdated(printer, changes)` | Async notification of state changes |

Your architecture:

```
C# Print Dialog (app kit component)
        │
        ▼  D-Bus (session bus)
CPDB Backend (your GDExtension, runs as a user daemon)
        │
        ▼  libcups / IPP (HTTP POST to 127.0.0.1:631)
cupsd (system daemon)
        │
        ▼  filter chain (if needed) → backend
Printer
```

The beauty: your C# print dialog doesn't know or care whether the printer is CUPS, a cloud service, or a file output. It speaks CPDB D-Bus. The backend translates.

**The XDG Desktop Portal Print backend (for Flatpak apps):**

Flatpak apps can't talk to CUPS directly (sandboxed). They call the portal:

```
Flatpak app
    │
    ▼  D-Bus: org.freedesktop.portal.Print
    │
    ├── PreparePrint(parent_window, title, settings, page_setup, options)
    │       → Your DE shows the print dialog
    │       → Returns: settings, page_setup, token
    │
    └── Print(token, fd, options)
            → Your DE submits the job (fd contains the PDF)
```

Your DE implements the **backend** of this portal. When a Flatpak app calls `PreparePrint`, your DE shows its native print dialog (the same one your `.pck` apps use). When the user confirms, the app calls `Print` with the token and a file descriptor containing the PDF. Your DE submits it to CUPS.

This means: **your print dialog serves both native apps AND Flatpak apps.** One dialog, two entry points.

**The print dialog itself (your app kit component):**

This is the UI the user sees. Requirements:

| Feature | Source |
|---|---|
| Printer list (with status: idle, busy, error) | CPDB `GetAllPrinters()` |
| Default printer indicator | CPDB `GetDefaultPrinter()` |
| Page range (all, odd, even, custom) | App provides page count |
| Copies + collate | Standard |
| Orientation (portrait/landscape) | From printer capabilities |
| Paper size (Letter, Legal, A4, custom) | From `get_supported_media()` |
| Duplex (off, long-edge, short-edge) | From printer capabilities |
| Color (auto, color, grayscale) | From printer capabilities |
| Quality/resolution | From `get_supported_resolutions()` |
| Scale (fit to page, shrink to fit, custom %) | App-level |
| Print to file (PDF) | CPDB file backend |
| "Add Printer" wizard | DNS-SD discovery + IPP |
| Job queue view (pending, processing, completed) | CUPS job state polling |
| Cancel / hold / resume job | CUPS job control |

The dialog is a standard MXML form + XForms model. The "Add Printer" wizard is the one non-trivial flow:

```
1. Scan for printers (DNS-SD / Avahi: _ipp._tcp, _ipps._tcp, _pdl._tcp)
2. Show discovered printers (name, IP, model from IPP attributes)
3. User selects → query IPP Get-Printer-Attributes
4. If IPP Everywhere: create queue with `-m everywhere` (no driver needed)
5. If legacy: show PPD selection (from Foomatic database)
6. Test print (send a one-page test PDF)
7. Set as default?
```

**PDF generation from Godot (the app side):**

Your `.pck` apps need to *produce* the PDF that gets submitted. Options:

| Method | Quality | Complexity |
|---|---|---|
| **Godot's built-in PDF export** (4.x has `ResourceSaver` with PDF support for some formats) | Good | Low |
| **Render to images → PDF** (each page is a `Texture2D` → `PackedByteArray` → PDF via a GDExtension wrapping `libqpdf` or `mupdf`) | Good (raster) | Medium |
| **Vector PDF** (render Godot's canvas commands to PDF operators via a custom `RenderingDevice` backend) | Best (text stays selectable) | High |
| **HTML → PDF** (app generates HTML, a GDExtension wraps `wkhtmltopdf` or `weasyprint`) | Good | Medium |

For your "one input → one artifact" utility apps (Label Maker, Sign Maker, Invoice Generator), the output is typically a **vector PDF** (for print shops, vinyl cutters, etc.). The cleanest path:

- Your app's C# logic generates the PDF directly using a C# PDF library (e.g. [PdfSharp](https://github.com/empira-oss/pdfsharp) or [DinkToPdf](https://github.com/GrapeCity/gc-phantomjs) for HTML→PDF)
- The PDF is submitted to CUPS as a `PackedByteArray` via your `PrintService` GDExtension
- No Godot rendering involved — the PDF is generated in C# and sent to the spooler

For "print what you see" (the screenshot/print-preview case), you'd render the Godot viewport to a texture and wrap it in a single-page PDF.

**The full print system architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Your DE (Godot runtime)                                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Print Dialog (MXML + C# app kit component)              │   │
│  │  - Printer list, options, page range, copies            │   │
│  │  - Job queue view                                       │   │
│  │  - Add Printer wizard                                   │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │ D-Bus (CPDB frontend)                  │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │  CPDB Backend (GDExtension, C++)                         │   │
│  │  - Implements org.openprinting.Backend D-Bus interface  │   │
│  │  - Translates to libcups / IPP calls                    │   │
│  │  - Runs as user daemon                                  │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │ HTTP POST (IPP) to 127.0.0.1:631     │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │  XDG Desktop Portal Print Backend (GDExtension, C++)     │   │
│  │  - Implements org.freedesktop.portal.Print              │   │
│  │  - Forwards Flatpak print requests to CPDB backend      │   │
│  │  - Shows the same print dialog                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PrintService (GDExtension, C++)                         │   │
│  │  - C#-facing API: submit_job, get_printers, etc.        │   │
│  │  - Used by .pck apps that print programmatically        │   │
│  │  - Also wraps the CPDB backend for C# callers           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼  IPP (port 631)
┌─────────────────────────────────────────────────────────────────┐
│  cupsd (system daemon)                                          │
│  - Queue management, filter chains, backends                    │
│  - DNS-SD discovery, job lifecycle                              │
│  - Printer Applications (legacy driver support)                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
                    Printer
```

**The "print to file" and "print to PDF" cases:**

CUPS ships a `cups-pdf` backend that creates a virtual printer. When you "print" to it, the output is a PDF file in `~/PDF/`. Your DE should:
- Always have a "Print to PDF" virtual printer available
- The print dialog's "Print to File" option uses this
- The output file is opened in your PDF viewer (or the file manager)

**The one thing Godot doesn't give you:**

Godot has **no print support whatsoever**. There's an [open proposal](https://github.com/godotengine/godot-proposals/issues/10111) (July 2024) to add "Print…" to the editor's File menu, and it notes: "Print Spooler Service on Windows and CUPS on macOS & Linux all take PDF natively as a print spool file." It's been sitting unimplemented. Your GDExtension fills this gap for the entire DE, not just the editor.

**Priority order for building this:**

1. **`PrintService` GDExtension** — wraps `libcups`, exposes `get_printers()`, `submit_job()`, `get_job_state()`. This unblocks *everything*: every app can now print.
2. **Print Dialog** (MXML + C#) — the UI. Uses `PrintService` directly for now.
3. **CPDB D-Bus backend** — so your print dialog can be used by external toolkits (GTK/Qt apps that use CPDB).
4. **XDG Desktop Portal Print backend** — so Flatpak apps can print through your dialog.
5. **Add Printer wizard** — DNS-SD discovery + IPP queue creation.
6. **Job queue monitor** — panel widget showing active jobs, with cancel/hold.
7. **Print preview** — render the PDF pages in your PDF viewer before committing.

Steps 1–2 are a week of work. Steps 3–4 are another week. The whole system is tractable because CUPS already does the hard part (filters, backends, device I/O). You're building the *dialog and the glue*, not the spooler.




**Yes, for most of it.** And for the DE shell specifically, GDScript is actually the *better* choice. Here's the breakdown:

**Where GDScript wins (or ties):**

| Use case | Why GDScript is fine or better |
|---|---|
| DE shell / window manager logic | Event-driven, no tight loops. GDScript is *faster* than C# for engine API calls (no marshalling overhead between .NET and the engine). |
| Utility apps (Label Maker, Color Lab, Calculator, Notepad) | Simple: read form values → compute → call GDExtension. No heavy computation. |
| File manager, terminal, panel, launcher | UI state management, signal routing, node manipulation. All engine-bound. |
| Print dialog UI | Show/hide controls, read user input, call `PrintService` GDExtension. Trivial. |
| Form designer (design-time logic) | Drag-and-drop, property grid sync, live preview. All node manipulation. |
| App lifecycle / session management | Spawn processes, track windows, save/restore state. |

**Where you still want C# (or GDExtension C++):**

| Use case | Why GDScript falls short |
|---|---|
| PDF generation (vector, multi-page, with text) | Need a real PDF library (PdfSharp, DinkToPdf). No NuGet equivalent in GDScript. You'd wrap it in a GDExtension anyway. |
| Formula engine (spreadsheet) | Tight loops, dependency graph traversal, expression parsing. C# is 4–10× faster for pure computation. |
| XForms binding engine | XPath evaluation, data model operations, type coercion at scale. Better in C# or C++. |
| MXML compiler (XML parse → scene tree) | Parsing is I/O-bound (fine in GDScript), but the class resolution + instantiation logic is cleaner in C# with proper types. |
| Anything that needs the .NET ecosystem | `System.Text.Json`, `DocumentFormat.OpenXml`, `MathNet.Numerics`, `SkiaSharp`, etc. |

**The practical architecture:**

```
GDScript (the DE shell + simple utilities)
├── Window manager
├── Panel / taskbar / launcher
├── File manager
├── Terminal
├── Print dialog
├── Notification center
├── Settings UI
├── Label Maker, Color Lab, Calculator, Notepad, Image Viewer
└── Form designer (design-time logic)

C# (the app kit + heavy logic)
├── XForms binding engine
├── MXML compiler
├── PDF generation (PdfSharp / DinkToPdf)
├── Formula engine
├── Document model (word processor)
└── Anything that needs NuGet

GDExtension (C++)
├── PrintService (CUPS / IPP)
├── PangoTextServer
├── SVG renderer (resvg / nanosvg)
├── Wayland compositor backend
├── D-Bus
└── AT-SPI2 (accessibility)
```

**The one gotcha that affects your design:**

You **cannot call GDExtensions directly from C#** in Godot 4.7. C# code must go through a GDScript wrapper or use the `GodotSharp` interop layer. This means your C# app kit classes that need to call `PrintService` or `PangoTextServer` will need thin GDScript shims, or you'll structure it so the GDScript layer makes the GDExtension call and passes results to C#.

The cleanest pattern: **GDScript is the "glue" between the scene tree and everything else.** C# classes are `RefCounted` resources that GDScript nodes call into. GDScript nodes call GDExtensions directly. C# calls GDExtensions via a GDScript bridge (or you avoid the need by keeping GDExtension calls in the GDScript layer).

**The strategic argument for keeping C# in the mix:**

GDScript is "the game scripting language." C# is "the application language." If your DE's app kit is GDScript-only, the signal you send to potential developers is "this is a game engine with a desktop mode." If the app kit is C# + MXML, the signal is "this is a professional application platform." The WPF/Cocoa comparison you've been making only works if the logic language is a "real" application language.

**Bottom line:** Write the DE shell and all the small utility apps in GDScript. Write the app kit infrastructure (binding engine, compiler, document model) in C#. The GDScript layer is where the user-facing logic lives; C# is where the heavy lifting happens. This is the same split as Godot's own editor (C++ core, GDScript for editor UI logic).

