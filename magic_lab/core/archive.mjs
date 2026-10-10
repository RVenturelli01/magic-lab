export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(entries) {
  // ZIP STORE: no compression, no dependency; deterministic headers, UTF-8 file names.
  const chunks = [],
    central = [];
  let offset = 0;
  const encoder = new TextEncoder();
  const make = (n) => {
    const a = new Uint8Array(n);
    return [a, new DataView(a.buffer)];
  };
  for (const [name, value] of entries) {
    const filename = encoder.encode(name),
      data = typeof value === "string" ? encoder.encode(value) : value,
      crc = crc32(data);
    const [local, l] = make(30);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(12, 33, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, filename.length, true);
    const [cent, c] = make(46);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, filename.length, true);
    c.setUint32(42, offset, true);
    chunks.push(local, filename, data);
    central.push(cent, filename);
    offset += local.length + filename.length + data.length;
  }
  const [end, e] = make(22);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(
    12,
    central.reduce((n, a) => n + a.length, 0),
    true,
  );
  e.setUint32(16, offset, true);
  const all = [...chunks, ...central, end],
    out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of all) {
    out.set(a, i);
    i += a.length;
  }
  return out;
}
