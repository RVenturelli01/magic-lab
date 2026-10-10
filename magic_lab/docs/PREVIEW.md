# Local LaTeX preview implementation

This guide owns compiler setup, preview protocol and resource management. The
public toggle, card layout and download behavior are defined in
[MagicPlot design](design/MAGICPLOT.md#preview-and-export).

## Local compiler setup

Preview requires `pdflatex` with `standalone`, `pgfplots`, `lmodern`, `booktabs`
and `xcolor`. Use TeX Live or MiKTeX. Standard Windows MiKTeX locations are probed
when pdflatex is absent from PATH. `MAGICLAB_LATEX` may select an executable path;
it is not a shell command or argument string. Restart after compiler configuration
changes. Source export remains usable without a compiler.

The server regenerates source from a normalized dataset/view snapshot, never
arbitrary client TeX. Compilation uses an isolated OS temporary directory outside
the module, shell escape disabled, a 30-second timeout and bounded output.
MiKTeX automatic package installation is disabled. Temporary files are removed
on success, failure or cancellation. Compiler options follow the
[Web2c documentation](https://www.tug.org/texinfohtml/web2c.html) and
[MiKTeX pdfTeX documentation](https://docs.miktex.org/manual/miktex-pdftex.html).

## API and saved state

- `view.displayMode`: `interactive` (including migrated views) or `latex`; saved with sessions/portable views. File URLs and controllers are transient.
- `GET /api/preview/capabilities`: reports compiler availability without host data.
- `POST /api/preview/latex`: JSON `{dataset, view}` to `{files: [{name, type, data}]}`, with PDF bytes in base64. Limit: 8 MiB and 32 individual charts. Reject cross-origin requests; concurrent work returns a retryable busy status.

The browser retries briefly after cancelling a previous request. Leaving preview,
changing data/style or disposing the application aborts requests and releases URLs;
late responses cannot replace newer state. Selection, calculations and source
serialization use the existing core/reporting pipeline.

PDFs are cached in memory by exact generated TeX source, up to 64 entries and
32 MiB. Layout-only changes can reuse compiled output; source-changing data/style
edits compile again. Restart clears the cache, which writes no exports to disk.
First-time charts compile sequentially. Embedded PDF fitting/toolbar parameters
are browser-dependent and require [manual checks](verification.md#manual-browser-checks).
