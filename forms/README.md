# Forms registry

The Trade Ops workbench reads a printed or scanned application from its QR code. The code holds only the answers plus
the form code and version (`{"form": "LC-02", "version": "1.0", ...}`), so the workbench needs that form's description
to show the answers with their questions and checks. It looks here first.

One file per form version, named `<form>@<version>.json`, e.g. `LC-02@1.0.json`. Never delete an old version:
customers may still send it.

To add a form:
1. In the workbench, press **Forms**, choose the form's blank PDF (made by the studio or lc-form), then **Download for registry**.
2. Upload that file to this folder on GitHub (Add file > Upload files), and commit to `main`.
3. The site deploys in about two minutes; every ops user then has the form.

The LC (`LC-01@1.0`) is built into the workbench (`src/lc.ts`) and doesn't need a file here.
