(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ReaderMath = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function computeScrollPageInfo(scrollTop, scrollHeight, pageHeight) {
        const pageH = Math.max(1, pageHeight);
        const scrollH = Math.max(pageH, scrollHeight);
        const total = Math.max(1, Math.ceil(scrollH / pageH));
        const maxScrollTop = Math.max(0, scrollH - pageH);
        const current = maxScrollTop <= 0
            ? 1
            : Math.min(total, Math.max(1, Math.floor((scrollTop / maxScrollTop) * (total - 1)) + 1));
        return { current, total };
    }

    function computeScrollProgressPercent(current, total) {
        return total <= 1 ? 0 : ((current - 1) / (total - 1)) * 100;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveStartParaIndex(book, startParaIndex, historyParaIndex) {
        if (startParaIndex != null) return startParaIndex;
        const neverRead = (book.progress == null || book.progress <= 0)
            && (book.lastReadPara == null || book.lastReadPara <= 0);
        if (neverRead) return 0;
        if (book.lastReadPara != null && book.lastReadPara >= 0) return book.lastReadPara;
        if (historyParaIndex != null && historyParaIndex >= 0) return historyParaIndex;
        return 0;
    }

    const READER_IMAGE_MARK = '[READER-IMG:';

    function isReaderImagePara(para) {
        return typeof para === 'string' && para.startsWith(READER_IMAGE_MARK);
    }

    function formatReaderImagePara(dataUrl, alt = '') {
        const safeAlt = String(alt || '').replace(/\|/g, ' ').replace(/\]/g, '');
        return `${READER_IMAGE_MARK}${dataUrl}|${safeAlt}]`;
    }

    function parseReaderImagePara(para) {
        if (!isReaderImagePara(para)) return null;
        const inner = para.slice(READER_IMAGE_MARK.length, -1);
        const pipe = inner.indexOf('|');
        if (pipe === -1) return { src: inner, alt: '' };
        return { src: inner.slice(0, pipe), alt: inner.slice(pipe + 1) };
    }

    function toDateKey(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function parseDateKey(key) {
        const parts = String(key).split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function getWeekId(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + mondayOffset);
        return toDateKey(d);
    }

    function getWeekDates(weekId) {
        const monday = parseDateKey(weekId);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return toDateKey(d);
        });
    }

    function getMonthDates(year, month) {
        const days = new Date(year, month, 0).getDate();
        return Array.from({ length: days }, (_, i) => toDateKey(new Date(year, month - 1, i + 1)));
    }

    function getMinutesForDate(dailyHistory, dateKey) {
        return Math.max(0, Number(dailyHistory?.[dateKey]) || 0);
    }

    function sumMinutesForDates(dailyHistory, dateKeys, todayKey, todayMinutes) {
        return dateKeys.reduce((sum, key) => {
            const val = key === todayKey
                ? Math.max(getMinutesForDate(dailyHistory, key), todayMinutes || 0)
                : getMinutesForDate(dailyHistory, key);
            return sum + val;
        }, 0);
    }

    function formatWeekRangeTitle(weekId) {
        const dates = getWeekDates(weekId);
        const start = parseDateKey(dates[0]);
        const end = parseDateKey(dates[6]);
        return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    }

    function buildStatsChartSeries(period, anchorDate, dailyHistory, todayMinutes, todayKey) {
        const anchor = new Date(anchorDate);
        anchor.setHours(0, 0, 0, 0);
        const today = todayKey || toDateKey(new Date());
        const getVal = (key) => (key === today
            ? Math.max(getMinutesForDate(dailyHistory, key), todayMinutes || 0)
            : getMinutesForDate(dailyHistory, key));

        if (period === 'day') {
            const labels = [];
            const values = [];
            const dateKeys = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date(anchor);
                d.setDate(d.getDate() - i);
                const key = toDateKey(d);
                dateKeys.push(key);
                labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
                values.push(getVal(key));
            }
            const start = parseDateKey(dateKeys[0]);
            const end = parseDateKey(dateKeys[dateKeys.length - 1]);
            const title = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
            return { labels, values, total: values.reduce((a, b) => a + b, 0), title, mode: 'line' };
        }

        if (period === 'week') {
            const weekId = getWeekId(anchor);
            const dates = getWeekDates(weekId);
            const values = dates.map(getVal);
            return {
                labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                values,
                total: values.reduce((a, b) => a + b, 0),
                title: formatWeekRangeTitle(weekId),
                mode: 'line'
            };
        }

        if (period === 'month') {
            const year = anchor.getFullYear();
            const month = anchor.getMonth() + 1;
            const dates = getMonthDates(year, month);
            const values = dates.map(getVal);
            const labels = dates.map((_, i) => {
                const day = i + 1;
                if (day === 1 || day % 5 === 0 || day === dates.length) return String(day);
                return '';
            });
            return {
                labels,
                values,
                total: values.reduce((a, b) => a + b, 0),
                title: `${year}年${month}月`,
                mode: 'bar'
            };
        }

        if (period === 'year') {
            const year = anchor.getFullYear();
            const values = [];
            const labels = [];
            for (let m = 1; m <= 12; m++) {
                labels.push(`${m}月`);
                values.push(sumMinutesForDates(dailyHistory, getMonthDates(year, m), today, todayMinutes));
            }
            return {
                labels,
                values,
                total: values.reduce((a, b) => a + b, 0),
                title: `${year}年`,
                mode: 'bar'
            };
        }

        return { labels: [], values: [], total: 0, title: '', mode: 'line' };
    }

    function shiftStatsAnchor(period, anchorDate, direction) {
        const d = new Date(anchorDate);
        d.setHours(0, 0, 0, 0);
        const delta = direction === 'next' ? 1 : -1;
        if (period === 'day') d.setDate(d.getDate() + delta * 14);
        else if (period === 'week') d.setDate(d.getDate() + delta * 7);
        else if (period === 'month') d.setMonth(d.getMonth() + delta);
        else if (period === 'year') d.setFullYear(d.getFullYear() + delta);
        return d;
    }

    function normalizeHeadingTitle(title) {
        return String(title || '')
            .replace(/[\s\u3000]+/g, '')
            .replace(/^第[0-9零一二三四五六七八九十百千]+[章节篇部卷集][：:.\s-]*/u, '')
            .replace(/^chapter\s*\d+[-.:]?\s*/i, '')
            .toLowerCase();
    }

    function headingTitleMatch(a, b) {
        const na = normalizeHeadingTitle(a);
        const nb = normalizeHeadingTitle(b);
        return !!na && !!nb && na === nb;
    }

    function isChapterPara(para) {
        return typeof para === 'string' && /^第\[章节(?:·\d+)?(?:#[^\]]+)?\]/.test(para);
    }

    function formatChapterMarker(title, depth = 1, fragment = '') {
        const safeDepth = Number.isFinite(depth) && depth > 1 ? Math.min(depth, 6) : 1;
        const depthPart = safeDepth > 1 ? `·${safeDepth}` : '';
        const frag = String(fragment || '').trim().replace(/\]/g, '');
        const fragPart = frag ? `#${frag}` : '';
        return `第[章节${depthPart}${fragPart}] ${title}`;
    }

    function getChapterMarkerMeta(para) {
        if (typeof para !== 'string' || !/^第\[章节(?:·\d+)?(?:#[^\]]+)?\]/.test(para)) return null;
        const match = para.match(/^第\[章节(?:·(\d+))?(?:#([^\]]+))?\]\s*(.*)$/);
        if (!match) return null;
        const depth = match[1] ? parseInt(match[1], 10) : 1;
        const title = (match[3] || '').trim();
        if (!title) return null;
        return {
            depth: Number.isFinite(depth) ? depth : 1,
            fragment: match[2] || '',
            title
        };
    }

    function fragmentKeysMatch(a, b) {
        if (!a || !b) return false;
        const sa = String(a);
        const sb = String(b);
        if (sa === sb) return true;
        try {
            if (decodeURIComponent(sa) === sb || sa === decodeURIComponent(sb)) return true;
        } catch (err) {
            /* ignore malformed URI */
        }
        return sa.toLowerCase() === sb.toLowerCase();
    }

    function getNextSpineStartPara(spineStarts, afterIdx, totalLength) {
        if (!spineStarts) return totalLength;
        let next = totalLength;
        Object.values(spineStarts).forEach((start) => {
            if (start > afterIdx && start < next) next = start;
        });
        return next;
    }

    function isLikelyHeadingPara(para, maxLen = 80) {
        const t = String(para || '').trim();
        return t.length > 0
            && t.length <= maxLen
            && !isChapterPara(t)
            && !t.startsWith(READER_IMAGE_MARK);
    }

    function findParaByExactChapterTitle(paragraphs, title, start, end) {
        for (let i = start; i < end; i++) {
            if (!isChapterPara(paragraphs[i])) continue;
            const meta = getChapterMarkerMeta(paragraphs[i]);
            if (meta?.title && headingTitleMatch(meta.title, title)) return i;
        }
        return null;
    }

    function resolveEpubTocParaIndex(entry, paragraphs, spineStarts, tocSpinePaths) {
        if (!entry || !Array.isArray(paragraphs)) return 0;

        const path = (entry.href || '').split('#')[0];
        const fragment = entry.fragment
            || (entry.href && entry.href.includes('#') ? entry.href.split('#').slice(1).join('#') : '');

        if (path && Array.isArray(tocSpinePaths) && tocSpinePaths.includes(path)) return null;

        if (Number.isFinite(entry.paraIndex) && entry.paraIndex >= 0 && entry.paraIndex < paragraphs.length) {
            const cached = entry.paraIndex;
            if (fragment) {
                const meta = getChapterMarkerMeta(paragraphs[cached]);
                if (meta?.fragment && fragmentKeysMatch(meta.fragment, fragment)) return cached;
            } else if (isChapterPara(paragraphs[cached])) {
                const meta = getChapterMarkerMeta(paragraphs[cached]);
                if (meta?.title && headingTitleMatch(meta.title, entry.title)) return cached;
            }
        }

        if (!spineStarts) {
            return findParaByExactChapterTitle(paragraphs, entry.title, 0, paragraphs.length) ?? 0;
        }

        const spineStart = path ? spineStarts[path] : null;
        const spineEnd = spineStart != null
            ? getNextSpineStartPara(spineStarts, spineStart, paragraphs.length)
            : paragraphs.length;
        const searchStart = spineStart != null ? spineStart : 0;
        const searchEnd = spineStart != null ? spineEnd : paragraphs.length;

        if (fragment) {
            for (let i = searchStart; i < searchEnd; i++) {
                if (!isChapterPara(paragraphs[i])) continue;
                const meta = getChapterMarkerMeta(paragraphs[i]);
                if (meta?.fragment && fragmentKeysMatch(meta.fragment, fragment)) return i;
            }
        }

        for (let i = searchStart; i < searchEnd; i++) {
            if (!isChapterPara(paragraphs[i])) continue;
            const meta = getChapterMarkerMeta(paragraphs[i]);
            if (meta?.title && headingTitleMatch(meta.title, entry.title)) return i;
        }

        if (fragment || (entry.depth || 1) > 1) {
            for (let i = searchStart; i < searchEnd; i++) {
                if (!isLikelyHeadingPara(paragraphs[i])) continue;
                if (headingTitleMatch(paragraphs[i], entry.title)) return i;
            }
        }

        if (spineStart != null) return spineStart;

        return findParaByExactChapterTitle(paragraphs, entry.title, 0, paragraphs.length) ?? 0;
    }

    function refreshEpubTocParaIndices(epubToc, paragraphs, spineStarts, tocSpinePaths) {
        if (!Array.isArray(epubToc) || !epubToc.length) return { toc: epubToc, changed: false };
        let changed = false;
        const toc = epubToc.map((entry) => {
            const idx = resolveEpubTocParaIndex(entry, paragraphs, spineStarts, tocSpinePaths);
            if (idx == null) return entry;
            if (entry.paraIndex !== idx) {
                changed = true;
                return { ...entry, paraIndex: idx };
            }
            return entry;
        });
        return { toc, changed };
    }

    function migrateStatsDailyHistory(stats) {
        if (!stats) return stats;
        if (!stats.dailyHistory || typeof stats.dailyHistory !== 'object') {
            stats.dailyHistory = {};
        }
        const todayKey = toDateKey(new Date());
        if (stats.weekId && Array.isArray(stats.weekly) && stats.weekly.length === 7) {
            getWeekDates(stats.weekId).forEach((key, i) => {
                const v = Number(stats.weekly[i]) || 0;
                if (v > 0) {
                    stats.dailyHistory[key] = Math.max(stats.dailyHistory[key] || 0, v);
                }
            });
        }
        if (Number(stats.today) > 0) {
            stats.dailyHistory[todayKey] = Math.max(stats.dailyHistory[todayKey] || 0, stats.today);
        }
        return stats;
    }

    return {
        computeScrollPageInfo,
        computeScrollProgressPercent,
        escapeHtml,
        resolveStartParaIndex,
        READER_IMAGE_MARK,
        isReaderImagePara,
        formatReaderImagePara,
        parseReaderImagePara,
        toDateKey,
        parseDateKey,
        getWeekId,
        getWeekDates,
        getMonthDates,
        getMinutesForDate,
        sumMinutesForDates,
        formatWeekRangeTitle,
        buildStatsChartSeries,
        shiftStatsAnchor,
        migrateStatsDailyHistory,
        normalizeHeadingTitle,
        headingTitleMatch,
        isChapterPara,
        formatChapterMarker,
        getChapterMarkerMeta,
        fragmentKeysMatch,
        resolveEpubTocParaIndex,
        refreshEpubTocParaIndices
    };
}));
