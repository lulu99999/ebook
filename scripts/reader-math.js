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

    return {
        computeScrollPageInfo,
        computeScrollProgressPercent,
        escapeHtml,
        resolveStartParaIndex
    };
}));
