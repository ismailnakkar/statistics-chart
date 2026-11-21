export interface StatisticsChart {
    /** Removes the listeners and every attribute the script added, hides the guide and restores the context line. */
    destroy(): void;
}

/**
 * Makes every `[data-statistics-plot]` under `root` a slider over its days, its guide and context line following the
 * day shown, and returns their handles, one per plot in document order. A second call returns the first handle of a
 * plot already bound; a plot missing its data, guide or dot is left alone until a later call.
 */
export function statisticsCharts(root?: ParentNode): StatisticsChart[];
