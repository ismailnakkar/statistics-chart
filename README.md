# @ismailnakkar/statistics-chart

The stylesheet and the script for the chart components of
[ismailnakkar/laravel-statistics](https://github.com/ismailnakkar/laravel-statistics) (`<x-statistics::line-chart>` and
`<x-statistics::bar-chart>`). The stylesheet lays the charts out (one panel per tab, the axes, and the hidden summaries,
legend and radios) and colours them, so every page that draws a chart needs it. The script adds the hover, tap and
keyboard tooltip and makes each plot a slider over its days; without it, each point keeps a `<title>` for the
browser's tooltip.

Works with laravel-statistics ^0.3.

## Install

```bash
npm i @ismailnakkar/statistics-chart
```

No dependencies. Type declarations are included.

## Usage

Import the stylesheet statically, in your CSS or JS entry, on every page: the bar charts need it too, and a chart
styled after its first paint shifts. Bind the script to each plot:

```js
import '@ismailnakkar/statistics-chart/style.css';
import {statisticsChart} from '@ismailnakkar/statistics-chart';

document.querySelectorAll('[data-statistics-plot]').forEach((plot) => statisticsChart(plot));
```

In CSS, `@import '@ismailnakkar/statistics-chart/style.css';` does the same.

`statisticsChart(plot)` takes one `[data-statistics-plot]` element and returns `{destroy}`. It reads the plot's data
once, when it binds it. A second call on a bound plot returns its first handle. A plot with no points is left alone,
and a later call binds it once it has some. `destroy()` removes the listeners and every attribute the script added, and
hides the tooltip.

## Lifecycle

On a page that swaps markup in place (Livewire, Turbo, htmx), destroy each plot's handle before the swap and bind the
plots again after it. A plot still bound keeps its first handle and its first data, and a morph strips the attributes
the script added, so a plot the swap changes needs both. As a call on a bound plot returns its handle,
`statisticsChart(plot).destroy()` unbinds it:

```js
const plots = (region) => region.querySelectorAll('[data-statistics-plot]');

// Before the swap.
plots(region).forEach((plot) => statisticsChart(plot).destroy());

// After it.
plots(region).forEach((plot) => statisticsChart(plot));
```

With Turbo Drive, destroy on `turbo:before-cache` and bind on `turbo:load`, over the whole `document`. Give each chart
that a partial response renders (a Livewire update, a Turbo Frame, htmx) an `id` on its component: the `id` starts every
id and radio name inside the chart, which otherwise numbers from `statistics-chart-1` again and collides with a chart
already on the page.

## The markup

The contract the npm package reads, so both READMEs state it; every name is exact. `{prefix}` starts every `id` and
radio `name` inside a line chart: the `id` you pass the component, else `statistics-chart-{n}`, numbered in render
order. A root has no `dir`, and no `id` unless you pass one: the tabs and panels follow the page. The plot and its axes
read left to right in every language, and each tooltip line reads in its own text's direction.

| Name | Holds |
|---|---|
| `div.statistics-chart` | A line chart's root, one per component. |
| `fieldset.statistics-chart-tabs` | The measure switch, only with more than one series. |
| `legend.statistics-chart-hidden` | The switch's legend, hidden but read. |
| `label.statistics-chart-tab` | A tab per series, around a radio `input.statistics-chart-hidden` named `{prefix}-measure`. |
| `div.statistics-chart-panel` | A panel per series, in tab order, up to four (`Chart::MAX_SERIES`): the stylesheet styles four. `data-measure` holds its measure's value: `paid_views`, `publisher_earnings`, `cpm`, `referral_earnings` or `rows`. |
| `p#{prefix}-summary-{n}[hidden]` | The panel's summary: the measure, its days, its total or average and its best day. `hidden`, so never shown or read on its own: it names the svg and describes the plot. `{n}` counts the panels from 1. |
| `div.statistics-chart-plot[data-statistics-plot]` | The plot, `dir="ltr"`, shaped by its own `style="aspect-ratio: 600 / {height}"`, with `aria-describedby` its summary. |
| `data-statistics-name` | The plot's measure label. |
| `data-statistics-points` | The plot's points, JSON `[[x%, y%], ...]`: x 0..100, y 0..100 from the top. |
| `data-statistics-values` | The plot's formatted values, a JSON array of strings. |
| `data-statistics-days` | The plot's tooltip day labels, a JSON array of strings. |
| `data-statistics-labels` | Each day's announcement, a JSON array of strings such as "Sun 1 Nov: 0.0045" (`chart.announcement`). |
| `role="slider"`, `tabindex="0"` | Set on the plot by the script, with `aria-label` (`data-statistics-name`), `aria-valuemin="1"`, `aria-valuemax` (the day count), and `aria-valuenow` and `aria-valuetext` (the day shown, from `data-statistics-labels`, starting on the last); `destroy()` removes them all. |
| `svg.statistics-chart-svg` | The drawing, `role="img"` with `aria-labelledby` its summary, `viewBox="0 0 600 {height}"`, 240 high by default. The script sets `aria-hidden="true"` on it while the plot is a slider, which reads the summary itself. |
| `g.statistics-chart-grid` | The grid lines. |
| `line.statistics-chart-baseline` | The baseline. |
| `path.statistics-chart-area` | The shaded area, with the `area` option. |
| `path.statistics-chart-line` | The line. |
| `path.statistics-chart-today` | The dashed segment into a day still counting. |
| `g.statistics-chart-dots` | A dot per day, with the `dots` option. |
| `g.statistics-chart-points` | Invisible circles, each with its day's announcement as a `<title>` for the browser's tooltip. |
| `circle.statistics-chart-best` | The best day's mark. |
| `div.statistics-chart-guide[data-statistics-guide]` | The tooltip's vertical guide, `aria-hidden` and hidden until the script shows it. |
| `div.statistics-chart-dot[data-statistics-dot]` | The tooltip's dot, likewise. |
| `div.statistics-chart-tip[data-statistics-tip]` | The tooltip, likewise, holding `p[data-statistics-tip-day]` and `p[data-statistics-tip-value]`, each `dir="auto"`. |
| `ol.statistics-chart-ticks` | The y axis's values, `dir="ltr"` and `aria-hidden`. |
| `ol.statistics-chart-days` | The x axis's days, `dir="ltr"` and `aria-hidden`. |
| `li.statistics-chart-day` | A named day. `data-edge="start"` or `"end"` marks the first and last; `data-minor` one the stylesheet hides on an axis under 35rem. |
| `div.statistics-bars` | A bar chart's root. |
| `svg.statistics-bars-svg` | The drawing, 100% wide and 40 pixels a bar, with no viewBox. |
| `g.statistics-bars-bar` | A bar. |
| `text.statistics-bars-label` | The label, cut to 32 characters by default (the component's `label-limit`). |
| `text.statistics-bars-value` | The value, at the other edge. |
| `rect.statistics-bars-fill` | The bar's fill, under the line of text. |

## Styling

Import `@ismailnakkar/statistics-chart/style.css` once, then override these on `:root`, or on a `.statistics-chart` or
`.statistics-bars` for one chart. They are defaulted in `:where(:root)`, so any rule of yours wins.

The default colours follow the page's own `color-scheme`, not the visitor's system: each is one `light-dark()` pair. A
page that declares `color-scheme: light dark` gets the dark colours when it shows dark; a page that declares none, or
`light`, stays light. A dark-only page declares `color-scheme: dark`. `light-dark()` needs Chrome 123, Firefox 120 or
Safari 17.5; older browsers get the light colours.

| Property | Light | Dark | Styles |
| --- | --- | --- | --- |
| `--statistics-series-1` | `#2563eb` | `#60a5fa` | The first series: line, area, dot |
| `--statistics-series-2` | `#d97706` | `#fbbf24` | The second series |
| `--statistics-series-3` | `#059669` | `#34d399` | The third series |
| `--statistics-series-4` | `#7c3aed` | `#a78bfa` | The fourth series |
| `--statistics-area-opacity` | `0.2` | | The area's fill opacity |
| `--statistics-line-width` | `2.5` | | The line's width, and the dashed segment's |
| `--statistics-grid-color` | `#e5e7eb` | `#374151` | The grid lines |
| `--statistics-baseline-color` | `#9ca3af` | `#6b7280` | The baseline and the tooltip's guide |
| `--statistics-text-color` | `#374151` | `#e5e7eb` | The axes', tabs' and bars' text |
| `--statistics-minor-text-color` | `#6b7280` | `#9ca3af` | The x axis's minor days (`data-minor`) |
| `--statistics-font-size` | `0.75rem` | | The axes', tabs' and bars' text size |
| `--statistics-tab-background` | `#f3f4f6` | `#1f2937` | The measure tabs |
| `--statistics-tab-selected-background` | `#dbeafe` | `#1e3a8a` | The selected tab |
| `--statistics-tab-selected-color` | `currentColor` | | The selected tab's text, the other tabs' colour by default |
| `--statistics-tip-background` | `#fff` | `#111827` | The tooltip |
| `--statistics-tip-border` | `1px solid #e5e7eb` | `1px solid #374151` | The tooltip's border |
| `--statistics-tip-shadow` | `0 4px 12px rgb(0 0 0 / 0.12)` | `0 4px 12px rgb(0 0 0 / 0.5)` | The tooltip's shadow |
| `--statistics-radius` | `0.375rem` | | The tabs' and tooltip's corners |
| `--statistics-focus-color` | `#2563eb` | `#60a5fa` | The focus ring of the tabs and the plot |
| `--statistics-bar-color` | `#2563eb` | `#60a5fa` | The bars' fill |
| `--statistics-bar-radius` | `3px` | | The bars' corners |

The series colours go by tab position. To give a measure one colour on every chart, select its panel's `data-measure`:

```css
.statistics-chart-panel[data-measure="paid_views"] {
    color: var(--brand);
}
```

The stylesheet is in no cascade layer, so it beats layered utility classes (Tailwind v4's) on a chart: import it into
one, `@import '@ismailnakkar/statistics-chart/style.css' layer(components);`, or set these properties.

Without `:has()` (Chrome 105, Firefox 121, Safari 15.4) every panel shows, one under another. Without container queries
(Chrome 105, Firefox 110, Safari 16) every day label shows. Without `:dir()` (Chrome 120, Firefox 49, Safari 16.4) a
right-to-left page's y ticks sit away from the plot.

## Accessibility

- Each panel's summary, a hidden `p`, names its SVG (`role="img"`) and describes its plot: the measure, its days, its
  total or average and its best day. The axes are `aria-hidden`.
- The script makes each plot a slider (`role="slider"`) named for its measure. Its value is the day shown, and its
  `aria-valuetext` that day's line from `data-statistics-labels`, which a screen reader reads as the day changes. Arrow
  keys step through the days, Home and End jump to the first and last, and Escape hides the tooltip and keeps the
  focus. Keys held with Alt, Ctrl or Meta are left to the browser. Tap, hover and keyboard all show the same tooltip.
- The measure tabs are real radio buttons in a `fieldset`, so arrow keys, the legend and the checked state come from the
  browser. The focused tab and the focused plot are ringed (`2px solid var(--statistics-focus-color)`).
- Without the script every point still has a `<title>`, which the browser shows as a tooltip.

## Testing

The script needs a DOM, so run your app's tests in happy-dom or jsdom (Vitest: `environment: 'happy-dom'`).

Run this package's suite with `npm test`.

## Upgrading

Nothing yet: 0.1.0 is the first release.
