# Third-party notices

## Bundled in the extension

### qrcode-generator

`extension/src/vendor/qrcode.js` (QR code for the Support box; the Pix code itself is built locally in `src/apoio.js`). Used unchanged.

- Project: <https://github.com/kazuhikoarase/qrcode-generator>
- Author: Kazuhiko Arase
- License: MIT

```
The MIT License (MIT)

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Data read at run time (not bundled)

### SponsorBlock

The *Skip segments* feature reads segment data from the SponsorBlock API (<https://sponsor.ajay.app>) with a 4-character hash prefix, read-only. Sintonia does not submit, store long-term (6-hour cache) or redistribute that data.

SponsorBlock's data and API are licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) (see <https://wiki.sponsor.ajay.app/w/API_Docs>). Attribution: segment data © SponsorBlock contributors, <https://sponsor.ajay.app>.

## Test tooling (not shipped in the zip)

- [Playwright](https://github.com/microsoft/playwright) 1.63.0, Apache-2.0.
