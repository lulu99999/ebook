const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ReaderMath = require('../scripts/reader-math.js');

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        console.error(`not ok - ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

test('computeScrollPageInfo at top', () => {
    const info = ReaderMath.computeScrollPageInfo(0, 5000, 500);
    assert.strictEqual(info.current, 1);
    assert.strictEqual(info.total, 10);
});

test('computeScrollPageInfo at bottom', () => {
    const info = ReaderMath.computeScrollPageInfo(4500, 5000, 500);
    assert.strictEqual(info.current, 10);
    assert.strictEqual(info.total, 10);
});

test('computeScrollPageInfo single page', () => {
    const info = ReaderMath.computeScrollPageInfo(0, 400, 500);
    assert.strictEqual(info.current, 1);
    assert.strictEqual(info.total, 1);
});

test('computeScrollProgressPercent', () => {
    assert.strictEqual(ReaderMath.computeScrollProgressPercent(1, 10), 0);
    assert.strictEqual(ReaderMath.computeScrollProgressPercent(10, 10), 100);
    assert.strictEqual(ReaderMath.computeScrollProgressPercent(1, 1), 0);
});

test('escapeHtml escapes dangerous characters', () => {
    assert.strictEqual(
        ReaderMath.escapeHtml('<script>"&</script>'),
        '&lt;script&gt;&quot;&amp;&lt;/script&gt;'
    );
});

test('resolveStartParaIndex prefers explicit index', () => {
    const book = { progress: 50, lastReadPara: 10 };
    assert.strictEqual(ReaderMath.resolveStartParaIndex(book, 3), 3);
});

test('resolveStartParaIndex new book starts at 0', () => {
    const book = { progress: 0, lastReadPara: 0 };
    assert.strictEqual(ReaderMath.resolveStartParaIndex(book, null), 0);
});

test('resolveStartParaIndex resumes last paragraph', () => {
    const book = { progress: 20, lastReadPara: 42 };
    assert.strictEqual(ReaderMath.resolveStartParaIndex(book, null), 42);
});

test('formatReaderImagePara and parseReaderImagePara round-trip', () => {
    const para = ReaderMath.formatReaderImagePara('data:image/jpeg;base64,abc', '封面图');
    assert.ok(ReaderMath.isReaderImagePara(para));
    assert.strictEqual(ReaderMath.parseReaderImagePara(para).src, 'data:image/jpeg;base64,abc');
    assert.strictEqual(ReaderMath.parseReaderImagePara(para).alt, '封面图');
});

test('isReaderImagePara rejects plain text', () => {
    assert.strictEqual(ReaderMath.isReaderImagePara('普通段落'), false);
    assert.strictEqual(ReaderMath.isReaderImagePara('[READER-IMG:incomplete'), true);
});

test('pdf.js vendor assets exist', () => {
    const root = path.join(__dirname, '..');
    const pdfJs = path.join(root, 'vendor', 'pdf.min.js');
    const pdfWorker = path.join(root, 'vendor', 'pdf.worker.min.js');
    assert.ok(fs.existsSync(pdfJs), 'vendor/pdf.min.js missing');
    assert.ok(fs.existsSync(pdfWorker), 'vendor/pdf.worker.min.js missing');
    assert.ok(fs.statSync(pdfJs).size > 100000, 'pdf.min.js looks too small');
    assert.ok(fs.statSync(pdfWorker).size > 100000, 'pdf.worker.min.js looks too small');
});

test('buildStatsChartSeries week totals from dailyHistory', () => {
    const anchor = new Date(2026, 5, 21);
    const weekId = ReaderMath.getWeekId(anchor);
    const dates = ReaderMath.getWeekDates(weekId);
    const history = {};
    dates.forEach((key, i) => {
        history[key] = [10, 20, 5, 0, 15, 8, 12][i];
    });
    const series = ReaderMath.buildStatsChartSeries('week', anchor, history, 0, '2099-01-01');
    assert.strictEqual(series.values.length, 7);
    assert.strictEqual(series.total, 70);
    assert.strictEqual(series.values[6], 12);
});

test('buildStatsChartSeries year aggregates months', () => {
    const history = { '2026-01-15': 30, '2026-02-10': 20, '2026-03-05': 10 };
    const series = ReaderMath.buildStatsChartSeries('year', new Date(2026, 5, 1), history, 0, '2026-06-22');
    assert.strictEqual(series.values.length, 12);
    assert.strictEqual(series.values[0], 30);
    assert.strictEqual(series.values[1], 20);
    assert.strictEqual(series.values[2], 10);
    assert.strictEqual(series.mode, 'bar');
});

test('migrateStatsDailyHistory backfills weekly and today', () => {
    const stats = {
        today: 5,
        weekly: [1, 2, 3, 0, 0, 0, 5],
        weekId: '2026-06-16',
        dailyHistory: {}
    };
    ReaderMath.migrateStatsDailyHistory(stats);
    assert.strictEqual(stats.dailyHistory['2026-06-16'], 1);
    assert.ok(stats.dailyHistory[ReaderMath.toDateKey(new Date())] >= 5);
});

test('code references parsePdfBook and appendEpubChapterContent', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    assert.ok(html.includes('async function parsePdfBook'), 'parsePdfBook missing');
    assert.ok(html.includes('async function appendEpubChapterContent'), 'appendEpubChapterContent missing');
    assert.ok(html.includes('createReaderImageBlock'), 'createReaderImageBlock missing');
    assert.ok(html.includes('isReaderImagePara(para)'), 'image paragraph rendering missing');
});

test('resolveEpubTocParaIndex matches subsection by fragment within spine', () => {
    const paragraphs = [
        'intro',
        '第[章节] 第三章',
        'content',
        '第[章节·2#vision-power] 愿景的力量',
        'section body',
        '第[章节] 第五章',
    ];
    const spineStarts = { 'ch3.xhtml': 1, 'ch5.xhtml': 5 };
    const entry = {
        title: '愿景的力量',
        depth: 2,
        href: 'ch3.xhtml#vision-power',
        fragment: 'vision-power'
    };
    const idx = ReaderMath.resolveEpubTocParaIndex(entry, paragraphs, spineStarts, []);
    assert.strictEqual(idx, 3);
});

test('resolveEpubTocParaIndex stays in spine and ignores earlier duplicate title', () => {
    const paragraphs = [
        '第[章节·2] 愿景的力量',
        'other',
        '第[章节] 第四章愿景定位',
        'body',
        '第[章节·2] 愿景的力量',
        'section body',
    ];
    const spineStarts = { 'ch4.xhtml': 2 };
    const entry = {
        title: '愿景的力量',
        depth: 2,
        href: 'ch4.xhtml#vision',
        fragment: 'vision'
    };
    const idx = ReaderMath.resolveEpubTocParaIndex(entry, paragraphs, spineStarts, []);
    assert.strictEqual(idx, 4);
});

test('resolveEpubTocParaIndex matches plain heading for old imports', () => {
    const paragraphs = [
        '第[章节] 第四章愿景定位',
        'intro text',
        '愿景的力量',
        'section body',
    ];
    const spineStarts = { 'ch4.xhtml': 0 };
    const entry = {
        title: '愿景的力量',
        depth: 2,
        href: 'ch4.xhtml#vision',
        fragment: 'vision'
    };
    const idx = ReaderMath.resolveEpubTocParaIndex(entry, paragraphs, spineStarts, []);
    assert.strictEqual(idx, 2);
});

test('formatChapterMarker stores fragment for subsection anchors', () => {
    const para = ReaderMath.formatChapterMarker('愿景的力量', 2, 'vision-power');
    const meta = ReaderMath.getChapterMarkerMeta(para);
    assert.strictEqual(meta.title, '愿景的力量');
    assert.strictEqual(meta.depth, 2);
    assert.strictEqual(meta.fragment, 'vision-power');
});

test('code references stats period chart functions', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    assert.ok(html.includes('function setStatsChartPeriod'), 'setStatsChartPeriod missing');
    assert.ok(html.includes('function drawStatsTrendChart'), 'drawStatsTrendChart missing');
    assert.ok(html.includes('dailyHistory'), 'dailyHistory missing');
});

function assertHtmlIncludes(html, needle, label) {
    assert.ok(html.includes(needle), `${label}: missing "${needle}"`);
}

test('feature audit: display and reader chrome', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    assertHtmlIncludes(html, 'id="reader-view"', 'reader shell');
    assertHtmlIncludes(html, 'reader-chrome-hidden', 'immersive chrome toggle');
    assertHtmlIncludes(html, 'function toggleReaderChrome', 'chrome toggle fn');
    assertHtmlIncludes(html, 'function applyReaderConfig', 'reader config apply');
    assertHtmlIncludes(html, 'function applyViewportTheme', 'viewport theme');
    assertHtmlIncludes(html, 'function applyReaderChromeTheme', 'chrome theme sync');
    assertHtmlIncludes(html, "changeReaderTheme('light')", 'light theme');
    assertHtmlIncludes(html, "changeReaderTheme('sepia')", 'sepia theme');
    assertHtmlIncludes(html, "changeReaderTheme('eye')", 'eye theme');
    assertHtmlIncludes(html, "changeReaderTheme('slate')", 'slate theme');
    assertHtmlIncludes(html, "changeReaderTheme('midnight')", 'midnight theme');
    assertHtmlIncludes(html, "changeReaderTheme('dark')", 'dark theme');
    assertHtmlIncludes(html, 'function createReaderImageBlock', 'inline image render');
    assertHtmlIncludes(html, 'reader-inline-image', 'image CSS class');
    assertHtmlIncludes(html, '100dvh', 'mobile viewport height');
    assertHtmlIncludes(html, 'viewport-fit=cover', 'safe area viewport');
});

test('feature audit: paging and progress', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    assertHtmlIncludes(html, 'function buildPagedLayoutAsync', 'async paged layout');
    assertHtmlIncludes(html, 'function renderPagedContentAsync', 'paged render');
    assertHtmlIncludes(html, 'function restorePagedPosition', 'restore page position');
    assertHtmlIncludes(html, 'scroll-snap-type: x mandatory', 'horizontal scroll snap');
    assertHtmlIncludes(html, 'id="reader-page-label"', 'page label element');
    assertHtmlIncludes(html, '第 ${current} / ${total} 页', 'page label format');
    assertHtmlIncludes(html, 'function scrollToPageIndex', 'page jump');
    assertHtmlIncludes(html, 'function navigatePage', 'page navigation');
    assertHtmlIncludes(html, 'function handleReaderTapNavigation', 'tap page turn');
    assertHtmlIncludes(html, 'readerJumpLockUntil', 'tap/swipe dedup lock');
    assertHtmlIncludes(html, "mode: 'paged'", 'default paged mode');
    assertHtmlIncludes(html, 'function changeReadingMode', 'mode switch');
    assertHtmlIncludes(html, 'ReaderMath.computeScrollPageInfo', 'scroll virtual paging');
    assert.strictEqual(ReaderMath.resolveStartParaIndex({ progress: 0, lastReadPara: 0 }, null), 0);
});

test('feature audit: TTS and speech follow', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    assertHtmlIncludes(html, 'id="tts-panel"', 'TTS panel');
    assertHtmlIncludes(html, 'id="tts-fab"', 'TTS floating button');
    assertHtmlIncludes(html, 'id="silent-player"', 'silent audio keepalive');
    assertHtmlIncludes(html, 'function speakParagraph', 'speak paragraph');
    assertHtmlIncludes(html, 'function buildTtsChunk', 'TTS chunking');
    assertHtmlIncludes(html, 'function followTtsReadingPosition', 'TTS follow scroll/page');
    assertHtmlIncludes(html, 'function updateTtsSpeechHighlight', 'TTS word highlight');
    assertHtmlIncludes(html, 'function ensureTtsKeepAlive', 'TTS background keepalive');
    assertHtmlIncludes(html, 'function resumeSpeechFromPosition', 'resume after jump');
    assertHtmlIncludes(html, 'function getNextSpeakableParaIndex', 'skip non-speakable paras');
    assertHtmlIncludes(html, 'if (isReaderImagePara(raw)) return', 'skip image paras in TTS');
    assertHtmlIncludes(html, "::highlight(speech-word)", 'speech word CSS highlight');
    assertHtmlIncludes(html, 'speech-highlight', 'speech paragraph highlight');
    assertHtmlIncludes(html, 'speechUtterance.onboundary', 'boundary driven follow');
    assertHtmlIncludes(html, 'mediaSession.setActionHandler', 'lock screen controls');
    assertHtmlIncludes(html, 'z-40', 'TTS panel above footer');
});

test('feature audit: notes and highlighting', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    assertHtmlIncludes(html, 'id="notes-drawer"', 'notes drawer');
    assertHtmlIncludes(html, 'id="note-modal"', 'note editor modal');
    assertHtmlIncludes(html, 'id="selection-marking-backdrop"', 'selection backdrop');
    assertHtmlIncludes(html, '::highlight(marking-preview)', 'marking preview highlight');
    assertHtmlIncludes(html, 'function applyHighlight', 'apply highlight');
    assertHtmlIncludes(html, 'function getParagraphTextOffset', 'paged offset calc');
    assertHtmlIncludes(html, 'function scheduleSelectionCheck', 'selection scheduling');
    assertHtmlIncludes(html, 'function saveNote', 'save note');
    assertHtmlIncludes(html, 'function exportNotes', 'export notes');
    assertHtmlIncludes(html, 'function applyReaderAnnotationChange', 'incremental annotation refresh');
    assertHtmlIncludes(html, 'refreshParagraphMarkupInDom', 'DOM-only highlight update');
    assertHtmlIncludes(html, 'reapplyChapterStylesInDom', 'chapter style restore after mark');
    assertHtmlIncludes(html, 'selectionGestureActive', 'long drag selection guard');
    assertHtmlIncludes(html, 'db.notes[bookId]', 'notes data model');
});

test('feature audit: catalog and PWA assets', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'code_artifact.html'), 'utf8');
    const root = path.join(__dirname, '..');
    assertHtmlIncludes(html, 'id="catalog-panel"', 'catalog panel');
    assertHtmlIncludes(html, 'function buildCatalog', 'build catalog');
    assertHtmlIncludes(html, 'function jumpToChapterFromCatalog', 'catalog jump');
    assertHtmlIncludes(html, 'function refreshEpubTocParaIndices', 'toc index refresh');
    assert.ok(fs.existsSync(path.join(root, 'manifest.webmanifest')), 'manifest missing');
    assert.ok(fs.existsSync(path.join(root, 'sw.js')), 'sw.js missing');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(sw.includes('cognito-reader-v'), 'service worker cache name');
});

if (process.exitCode) {
    process.exit(process.exitCode);
}
