export interface StatisticsChart {
    /** Removes the listeners and every attribute the script added, and hides the tooltip. */
    destroy(): void;
}

/**
 * Makes one `[data-statistics-plot]` element a slider over its days, with the tooltip. A second call on a bound plot
 * returns its first handle; a plot with no points is left alone, and a later call binds it once it has some.
 */
export function statisticsChart(plot: Element): StatisticsChart;

/**
 * Binds every `[data-statistics-plot]` under `root` with `statisticsChart()` and returns their handles, one per plot in
 * document order. A second call returns the same handles for the plots already bound.
 */
export function statisticsCharts(root?: ParentNode): StatisticsChart[];
