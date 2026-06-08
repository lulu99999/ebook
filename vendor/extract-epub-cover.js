import { EPUB } from './foliate-epub.js';

function normalizeZipPath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function findZipEntry(zip, uri) {
    if (!uri) return null;
    const tried = new Set();
    const candidates = [uri, normalizeZipPath(uri)];
    try { candidates.push(normalizeZipPath(decodeURIComponent(uri))); } catch {}
    for (const path of candidates) {
        if (!path || tried.has(path)) continue;
        tried.add(path);
        const entry = zip.file(path);
        if (entry && !entry.dir) return entry;
    }
    const base = normalizeZipPath(uri).split('/').pop()?.toLowerCase();
    if (!base) return null;
    let match = null;
    Object.keys(zip.files).forEach((name) => {
        const entry = zip.files[name];
        if (entry.dir) return;
        const lower = name.toLowerCase();
        if (lower === base || lower.endsWith(`/${base}`)) {
            if (!match || name.length < match.name.length) match = entry;
        }
    });
    return match;
}

function createJsZipLoader(zip) {
    return {
        loadText: async (uri) => {
            const entry = findZipEntry(zip, uri);
            return entry ? entry.async('text') : null;
        },
        loadBlob: async (uri) => {
            const entry = findZipEntry(zip, uri);
            return entry ? entry.async('uint8array') : null;
        },
        getSize: async (uri) => {
            const entry = findZipEntry(zip, uri);
            if (!entry) return 0;
            return (await entry.async('uint8array')).byteLength;
        }
    };
}

export async function extractEpubCoverBlob(file) {
    const JSZip = globalThis.JSZip;
    if (!JSZip) throw new Error('JSZip 未加载');
    const zip = await JSZip.loadAsync(file);
    const loader = createJsZipLoader(zip);
    const epub = new EPUB(loader);
    await epub.init();
    try {
        return await epub.getCover();
    } finally {
        epub.destroy?.();
    }
}
