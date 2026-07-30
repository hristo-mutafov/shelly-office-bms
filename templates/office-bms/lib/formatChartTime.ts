// Chart bucket labels come back as raw ISO strings (e.g.
// "2026-07-30T02:00:00.000Z") from the history RPCs — format them for
// display instead of dumping the ISO string straight into the axis.
export function formatChartBuckets(buckets: (string | null | undefined)[]): string[] {
    const dates = buckets.map((b) => (b ? new Date(b) : null));
    const valid = dates.filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
    const spanMs =
        valid.length > 1
            ? Math.max(...valid.map((d) => d.getTime())) - Math.min(...valid.map((d) => d.getTime()))
            : 0;
    // Wide spans (week/month ranges) come back as daily buckets, where the
    // date matters more than the time of day; the default 24h/day view is
    // hourly, where the clock is what's useful.
    const showDateOnly = spanMs > 36 * 60 * 60 * 1000;
    return dates.map((d) => {
        if (!d || Number.isNaN(d.getTime())) return '';
        return showDateOnly
            ? d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
            : d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
    });
}
