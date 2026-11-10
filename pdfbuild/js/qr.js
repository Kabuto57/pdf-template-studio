// QR code (version 40, error correction M, byte mode, mask 0) drawn without Acrobat's barcode feature:
// one comb text field per row ("__qr_0" ... "__qr_176"), dark modules as ZapfDingbats "n" (a black square).
function lcQrMatrix(text) {
  var N = 177, i, j, x, y, m = [], f = [], bytes = [], s = unescape(encodeURIComponent(text));
  for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
  for (y = 0; y < N; y++) { m.push([]); f.push([]); for (x = 0; x < N; x++) { m[y].push(false); f[y].push(false); } }
  function set(x, y, dark) { m[y][x] = dark; f[y][x] = true; }
  function mul(a, b) { var z = 0; for (var k = 7; k >= 0; k--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((b >>> k) & 1) * a; } return z; }
  // Function patterns: timing, finders, alignment, format area, version, dark module.
  for (i = 0; i < N; i++) { set(6, i, i % 2 == 0); set(i, 6, i % 2 == 0); }
  function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
    var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
    if (xx >= 0 && xx < N && yy >= 0 && yy < N) set(xx, yy, d != 2 && d != 4); } }
  finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
  var A = [6, 30, 58, 86, 114, 142, 170];
  for (i = 0; i < A.length; i++) for (j = 0; j < A.length; j++) {
    if ((i == 0 && j == 0) || (i == 0 && j == A.length - 1) || (i == A.length - 1 && j == 0)) continue;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(A[i] + dx, A[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
  }
  var rem = 0, fmt; for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  fmt = ((0 << 10) | rem) ^ 0x5412; // error correction M (00), mask 0
  function bit(v, k) { return ((v >>> k) & 1) != 0; }
  for (i = 0; i <= 5; i++) set(8, i, bit(fmt, i));
  set(8, 7, bit(fmt, 6)); set(8, 8, bit(fmt, 7)); set(7, 8, bit(fmt, 8));
  for (i = 9; i < 15; i++) set(14 - i, 8, bit(fmt, i));
  for (i = 0; i < 8; i++) set(N - 1 - i, 8, bit(fmt, i));
  for (i = 8; i < 15; i++) set(8, N - 15 + i, bit(fmt, i));
  set(8, N - 8, true);
  rem = 40; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  var ver = (40 << 12) | rem;
  for (i = 0; i < 18; i++) { var a = N - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit(ver, i)); set(b, a, bit(ver, i)); }
  // Data: mode 0100, 16-bit length, the bytes, terminator, padding to 2,334 data codewords.
  var bits = [], cap = 2334 * 8;
  function put(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >>> k) & 1); }
  put(4, 4); put(bytes.length, 16); for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  var data = []; for (i = 0; i < bits.length; i += 8) { var v = 0; for (j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }
  for (i = 0; data.length < 2334; i++) data.push(i % 2 ? 0x11 : 0xEC);
  // Reed-Solomon: 49 blocks (18 of 47 + 31 of 48 data codewords), 28 error-correction codewords each.
  var div = [], root = 1; for (i = 0; i < 27; i++) div.push(0); div.push(1);
  for (i = 0; i < 28; i++) { for (j = 0; j < 28; j++) { div[j] = mul(div[j], root); if (j + 1 < 28) div[j] ^= div[j + 1]; } root = mul(root, 2); }
  var blocks = [], k = 0;
  for (i = 0; i < 49; i++) {
    var len = i < 18 ? 47 : 48, dat = data.slice(k, k + len), ecc = []; k += len;
    for (j = 0; j < 28; j++) ecc.push(0);
    for (j = 0; j < dat.length; j++) { var fct = dat[j] ^ ecc.shift(); ecc.push(0); for (var t = 0; t < 28; t++) ecc[t] ^= mul(div[t], fct); }
    if (i < 18) dat.push(-1);
    blocks.push(dat.concat(ecc));
  }
  var all = [];
  for (i = 0; i < blocks[0].length; i++) for (j = 0; j < 49; j++) if (blocks[j][i] != -1) all.push(blocks[j][i]);
  // Place the codewords in the zigzag, then mask 0 ((x + y) even flips).
  var n = 0;
  for (var right = N - 1; right >= 1; right -= 2) {
    if (right == 6) right = 5;
    for (var vert = 0; vert < N; vert++) for (j = 0; j < 2; j++) {
      x = right - j; var up = ((right + 1) & 2) == 0; y = up ? N - 1 - vert : vert;
      if (!f[y][x] && n < all.length * 8) { m[y][x] = ((all[n >>> 3] >>> (7 - (n & 7))) & 1) != 0; n++; }
    }
  }
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (!f[y][x] && (x + y) % 2 == 0) m[y][x] = !m[y][x];
  return m;
}
function lcDrawQr(d, text) {
  var m = lcQrMatrix(text), y, x, s, calc = d.calculate;
  d.calculate = false; // 177 rows: don't re-run the checks after each one
  try { for (y = 0; y < m.length; y++) { s = ""; for (x = 0; x < m.length; x++) s += m[y][x] ? "n" : " "; d.getField("__qr_" + y).value = s; } }
  finally { d.calculate = calc; }
}