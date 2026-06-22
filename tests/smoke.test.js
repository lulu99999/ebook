const test = require('node:test');
const assert = require('node:assert/strict');
const ReaderMath = require('../scripts/reader-math.js');

test('computeScrollPageInfo at top', () => {
    const info = ReaderMath.computeScrollPageInfo(0, 5000, 500);
    assert.equal(info.current, 1);
    assert.equal(info.total, 10);
});

test('computeScrollPageInfo at bottom', () => {
    const info = ReaderMath.computeScrollPageInfo(4500, 5000, 500);
    assert.equal(info.current, 10);
    assert.equal(info.total, 10);
});

test('computeScrollPageInfo single page', () => {
    const info = ReaderMath.computeScrollPageInfo(0, 400, 500);
    assert.equal(info.current, 1);
    assert.equal(info.total, 1);
});

test('computeScrollProgressPercent', () => {
    assert.equal(ReaderMath.computeScrollProgressPercent(1, 10), 0);
    assert.equal(ReaderMath.computeScrollProgressPercent(10, 10), 100);
    assert.equal(ReaderMath.computeScrollProgressPercent(1, 1), 0);
});

test('escapeHtml escapes dangerous characters', () => {
    assert.equal(
        ReaderMath.escapeHtml('<script>"&</script>'),
        '&lt;script&gt;&quot;&amp;&lt;/script&gt;'
    );
});

test('resolveStartParaIndex prefers explicit index', () => {
    const book = { progress: 50, lastReadPara: 10 };
    assert.equal(ReaderMath.resolveStartParaIndex(book, 3), 3);
});

test('resolveStartParaIndex new book starts at 0', () => {
    const book = { progress: 0, lastReadPara: 0 };
    assert.equal(ReaderMath.resolveStartParaIndex(book, null), 0);
});

test('resolveStartParaIndex resumes last paragraph', () => {
    const book = { progress: 20, lastReadPara: 42 };
    assert.equal(ReaderMath.resolveStartParaIndex(book, null), 42);
});

test('formatReaderImagePara and parseReaderImagePara round-trip', () => {
    const para = ReaderMath.formatReaderImagePara('data:image/jpeg;base64,abc', '封面图');
    assert.ok(ReaderMath.isReaderImagePara(para));
    assert.equal(ReaderMath.parseReaderImagePara(para).src, 'data:image/jpeg;base64,abc');
    assert.equal(ReaderMath.parseReaderImagePara(para).alt, '封面图');
});

test('isReaderImagePara rejects plain text', () => {
    assert.equal(ReaderMath.isReaderImagePara('普通段落'), false);
    assert.equal(ReaderMath.isReaderImagePara('[READER-IMG:incomplete'), false);
});
