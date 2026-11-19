# @ismailnakkar/statistics-chart

The stylesheet and the script for the chart components of
[ismailnakkar/laravel-statistics](https://github.com/ismailnakkar/laravel-statistics) (`<x-statistics::line-chart>` and
`<x-statistics::bar-chart>`). The stylesheet lays the charts out (the metric tabs, one panel per tab with its context
line and axes, and the hidden summaries, legend and radios) and colours them, so every page that draws a chart needs
it. The script makes each plot a slider over its days: hover, a tap or the arrow keys move a guide with a dot on the
line and on the previous month's, and switch the panel's context line to that day, its value and its change on the
previous month's same day; the tabs keep the month's figures. Without it they show the month, and each point keeps a
`<title>` for the browser's tooltip.

Works with laravel-statistics ^0.5.

## Install

```bash
npm i @ismailnakkar/statistics-chart
```

No dependencies. Type declarations are included.

## Usage

Import the stylesheet statically, in your CSS or JS entry, on every page: the bar charts need it too, and a chart
styled after its first paint shifts. Bind the script to the plots:

```js
import '@ismailnakkar/statistics-chart/style.css';
import {statisticsCharts} from '@ismailnakkar/statistics-chart';

statisticsCharts();
```

In CSS, `@import '@ismailnakkar/statistics-chart/style.css';` does the same.

`statisticsCharts(root = document)` binds every `[data-statistics-plot]` under `root` (a document, fragment or element)
and returns their handles, one per plot in document order. `statisticsChart(plot)` binds one plot the same way and
returns its handle, `{destroy}`. Either reads a plot's data once, when it binds it, and what it switches: the
`[data-statistics-context]` in the plot's `.statistics-chart-panel` (a plot outside a panel moves only its guide). A
second call on a bound plot returns its first handle. A plot with no points is left alone, and a later call binds it
once it has some. `destroy()` removes the listeners and every attribute the script added, hides the guide and dots, and
puts the context line back as the page rendered it.

## Lifecycle

On a page that swaps markup in place (Livewire, Turbo, htmx), destroy each plot's handle before the swap and bind the
plots again after it. A plot still bound keeps its first handle and its first data, and a morph strips the attributes
the script added, so a plot the swap changes needs both. As a call on a bound plot returns its handle,
destroying what `statisticsCharts(region)` returns unbinds the region's plots:

```js
// Before the swap.
statisticsCharts(region).forEach((chart) => chart.destroy());

// After it.
statisticsCharts(region);
```

With Turbo Drive, destroy on `turbo:before-cache` and bind on `turbo:load`, over the whole `document` (no argument).
Give each chart that a partial response renders (a Livewire update, a Turbo Frame, htmx) an `id` on its component: the
`id` starts every id and radio name inside the chart, which otherwise numbers from `statistics-chart-1` again and
collides with a chart already on the page.

## The markup

The contract the npm package reads, so both READMEs state it; every name is exact. `{prefix}` starts every `id` and
radio `name` inside a line chart: the `id` you pass the component, else `statistics-chart-{n}`, numbered in render
order. A root has no `dir`, and no `id` unless you pass one: the tabs, panels and context lines follow the page. The plot
and its axes read left to right in every language, and so do the chips.

| Name | Holds |
|---|---|
| `div.statistics-chart` | A line chart's root, one per component. It is an inline-size container, so its tabs follow its own width: in a flex or grid parent, give it a width (`flex: 1`, a column), or it shrinks. |
| `fieldset.statistics-chart-tabs` | The metric tabs, with more than one series; a `div.statistics-chart-tabs` with one. |
| `legend.statistics-chart-hidden` | The fieldset's legend, hidden but read. |
| `label.statistics-chart-tab` | A tab per series, around a radio `input.statistics-chart-hidden` named `{prefix}-measure`; with one series, a `div.statistics-chart-tab` without one. `data-measure` holds its measure's value, as its panel's does. |
| `span.statistics-chart-tab-label` | The measure's label. |
| `span.statistics-chart-figure` | The measure over the month or the report's days, as the dashboard prints it. The script leaves the tabs alone: each keeps its figure and change while a day shows. |
| `span.statistics-chart-tab-change` | The change chip, a `span.statistics-chart-chip` with `dir="ltr"` (`Month::signedChange()`, `data-trend="up"` above zero, `"flat"` at 0%, else `"down"`), then what it is against: the previous month, short, "vs Oct" (`chart.tabs.versus`). None on a report's chart or without a comparison. |
| `div.statistics-chart-panel` | A panel per series, in tab order, up to four (`Chart::MAX_SERIES`): the stylesheet styles four. `data-measure` holds its measure's value: `paid_views`, `publisher_earnings`, `cpm`, `referral_earnings` or `rows`. |
| `p#{prefix}-summary-{n}[hidden]` | The panel's summary: the measure, its days, its total or average, its best day and its daily average. `hidden`, so never shown or read on its own: it names the svg and describes the plot. `{n}` counts the panels from 1. |
| `p.statistics-chart-context[data-statistics-context]` | The line under the tabs, `aria-live="polite"`: the month and its daily average, or the day the script shows. The script sets its `aria-live` to `off` while the plot has focus (the slider's value text reads it then) and holds its `min-block-size` at the month's height while it shows a day; `destroy()` restores both. |
| `span[data-statistics-caption]` | "Paid views, November so far" (`chart.context.running`), "Paid views, October 2026" (`context.finished`) or a report's "Views, 1 Nov–14 Nov" (`context.period`), "Views, 14 Nov" for one day (`context.day`), the month or the dates in a `<strong>`; while the script shows a day, that day from `data-statistics-days`: its name and value in one `<strong>`, "Fri 6 Nov: 607" (`context.shown`), or a day without a value's name, in a `<strong>` but for ", no paid views". |
| `span.statistics-chart-chip[data-statistics-chip]` | `dir="ltr"`, `hidden` and without `data-trend` until the script shows a day: then the day's change from `data-statistics-changes` with its `data-trend` (`"up"`, `"flat"` at 0, `"down"`), hidden where that is null. |
| `span[data-statistics-previous-day]` | `hidden` until the script shows a day: then the previous month's same day from `data-statistics-previous-labels`, its value in a `<strong>` but for "no paid views", hidden on a day it lacks. |
| `span.statistics-chart-average[data-statistics-average]` | "Daily average 61,234" (`chart.average.daily`), the value in a `<strong>`, set off from the caption by a rule; none without a complete day or at zero. The script hides it while it shows a day. |
| `p.statistics-chart-context strong` | The context line's highlighted words: what these placeholders put in, wherever a locale's line puts them, so a reworded line keeps them: `context`'s `:month`, `:first`, `:last` and `:day` (`context.shown`'s `:day` and `:value` as one part, with what the line puts between them), `average.daily`'s `:value`, `no_views.day`'s `:day` and `announcement`'s `:value` (never its `:day`, nor "no paid views"). A day's own name is highlighted whole, a day still counting's ", so far" (`so_far.day`) too. The script writes each part as text, never as markup, and puts the month's back as the page rendered them. |
| `div.statistics-chart-frame` | The axes and the plot, `dir="ltr"`: the values on the left, the days underneath. |
| `ol.statistics-chart-ticks` | The y axis's values, `aria-hidden`: two to four from zero, a CPM's two to six around its days. |
| `div.statistics-chart-plot[data-statistics-plot]` | The plot, 240 pixels high at every width (`--statistics-plot-height`), with `aria-describedby` its summary. It is an inline-size container as wide as the days under it, so a minor day's line hides with its label. |
| `data-statistics-name` | The plot's measure label. |
| `data-statistics-points` | The plot's points, JSON `[[x%, y%], ...]`: x 0..100, y down from the top, inside the drawing's margins (5% to 94.167%); y is `null` on a CPM's day without paid views. |
| `data-statistics-days` | Each day as the context line prints it while the script shows it, a JSON array of its parts, plain and highlighted in turn from a plain one: the day and its value, `["", "Mon 2 Nov: 2"]`, `["", "Tue 3 Nov, so far: 1"]` (`chart.context.shown`), or a day without a value's name alone, `["", "Wed 4 Nov", ", no paid views"]` (`chart.no_views.day`). |
| `data-statistics-labels` | Each day's announcement, a JSON array of strings such as "Sun 1 Nov: 0.0045" (`chart.announcement`), or the day's name alone without a value. |
| `data-statistics-changes` | Each day's change on the previous month's same day, in percent, a JSON array of integers and nulls: null for a day still counting, a day the previous month lacks or had at zero, and a day without a value in either month. |
| `data-statistics-previous-points` | The previous month's same days as `[[x%, y%], ...]` on the plot's axis, up to the shorter month, y `null` on a day without a value; `[]` on a report's chart and without a previous month. |
| `data-statistics-previous-labels` | Each of those days and its value, a JSON array of their parts as `data-statistics-days`: `["2 Oct: ", "57,000"]` (`chart.announcement`), `["3 Oct: no paid views"]` (`chart.no_views.value`). |
| `role="slider"`, `tabindex="0"` | Set on the plot by the script, with `aria-label` (`data-statistics-name`), `aria-valuemin="1"`, `aria-valuemax` (the day count), and `aria-valuenow` and `aria-valuetext` (the day shown, starting on the last: its line from `data-statistics-labels`, then the context line's visible parts once they show it, "Mon 2 Nov: 2, 0%, 2 Oct: 2"); `destroy()` removes them all. |
| `svg.statistics-chart-svg` | The drawing, `role="img"` with `aria-labelledby` its summary, `viewBox="0 0 600 240"` and `preserveAspectRatio="none"`: stretched to the plot, every stroke `vector-effect="non-scaling-stroke"`, no text. Its values keep 12 of the 240 over the axis top and 14 under its bottom (`LineChart::MARGIN_TOP`, `MARGIN_BOTTOM`), so a line at zero clears the day labels. The script sets `aria-hidden="true"` on it while the plot is a slider, which reads the summary itself. |
| `g.statistics-chart-grid` | A dashed line at each tick, the bottom one too, then one at each named day (`li.statistics-chart-day`, the first and the last too) from the axis top to its bottom, behind the lines. A minor day's has `data-minor`, which the stylesheet hides with its label. |
| `path.statistics-chart-previous` | The previous month's same days, dashed with butt caps, with at least two of them; broken where a day has no value. A day alone between breaks is a zero-length stroke ending ` h0` that draws nothing (the guide's dot shows it); `stroke-linecap: round` would draw it as a dot and lengthen the dashes. |
| `path.statistics-chart-line` | The line, up to the day before one still counting, broken where a day has no value: a day alone between breaks is a zero-length stroke ending ` h0`, which its round cap draws as a dot. A lone day's chart has `data-lone`, which the stylesheet draws four times the line's width. |
| `path.statistics-chart-today` | The dashed segment into a day still counting, when it and the day before have values. |
| `g.statistics-chart-points` | Invisible circles, one per day with a value, each with its day's announcement as a `<title>` for the browser's tooltip. |
| `div.statistics-chart-guide[data-statistics-guide]` | The vertical line at the day shown, from the axis top to its bottom, `aria-hidden` and `hidden` until the script shows a day. |
| `div.statistics-chart-previous-dot[data-statistics-previous-dot]` | The dot on the previous month's line, likewise, and hidden on a day it lacks or without a value. |
| `div.statistics-chart-dot[data-statistics-dot]` | The dot on the line, likewise, and hidden on a day without a value. |
| `ol.statistics-chart-days` | The x axis's days, `aria-hidden`. |
| `li.statistics-chart-day` | A named day: the first, every fourth (every eighth past 32 days, and so on) and the last, "Today" while it still counts; one less than three quarters of a step (three days in a month) before the last is left out. `data-edge="start"` or `"end"` marks the first and last; `data-minor` every other one, and one less than two steps (eight days) before the last, which the stylesheet hides on an axis under 35rem, with its line. |
| `div.statistics-bars` | A bar chart's root. |
| `svg.statistics-bars-svg` | The drawing, 100% wide and 40 pixels a bar, with no viewBox. |
| `g.statistics-bars-bar` | A bar. |
| `text.statistics-bars-label` | The label, cut to 32 characters by default (the component's `label-limit`). |
| `text.statistics-bars-value` | The value, at the other edge. |
| `rect.statistics-bars-fill` | The bar's fill, under the line of text. |

## Styling

Import `@ismailnakkar/statistics-chart/style.css` once, then override these on `:root`, or on a `.statistics-chart` or
`.statistics-bars` for one chart. They are defaulted in `:where(:root)`, so any rule of yours wins.

The default colours are light, and dark mode is your page's: set the Dark column's colours under your own dark media
query or selector. The stylesheet uses no `light-dark()`, because Lightning CSS (in Vite and Tailwind v4) lowers it to
variables it sets only where the same stylesheet declares `color-scheme`, which leaves every colour invalid in a
package's stylesheet. For a page that follows the visitor's system:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --statistics-line-color: #8197ff;
        --statistics-previous-color: #525b70;
        --statistics-grid-color: #262c38;
        --statistics-guide-color: #525b70;
        --statistics-text-color: #e7e9ef;
        --statistics-muted-color: #98a0b3;
        --statistics-background: #161a22;
        --statistics-up-color: #4cc38a;
        --statistics-up-background: rgb(76 195 138 / 0.14);
        --statistics-down-color: #f08a4b;
        --statistics-down-background: rgb(240 138 75 / 0.14);
        --statistics-flat-color: #98a0b3;
        --statistics-flat-background: rgb(152 160 179 / 0.14);
        --statistics-focus-color: #8197ff;
        --statistics-bar-color: #60a5fa;
    }
}
```

With a theme switch, put the same declarations under its dark selector instead, such as `:root[data-theme="dark"]` or
`.dark`.

| Property | Light | Dark | Styles |
| --- | --- | --- | --- |
| `--statistics-line-color` | `#3d5afe` | `#8197ff` | A measure's line, its dashed segment into today and its dot, and its chosen tab's bar and tint: the panel's `color` |
| `--statistics-line-width` | `2` | | The line's width, and the dashed segment's |
| `--statistics-previous-color` | `#aeb5c6` | `#525b70` | The previous month's dashed line and its dot |
| `--statistics-previous-width` | `1.5` | | The previous month's line's width |
| `--statistics-grid-color` | `#e6e8ef` | `#262c38` | The grid lines at the ticks and the named days, the lines between and under the tabs, and the rule before the daily average |
| `--statistics-guide-color` | `#aeb5c6` | `#525b70` | The vertical line at the day shown |
| `--statistics-text-color` | `#1c2130` | `#e7e9ef` | The tabs' figures, the context line's highlighted words and the bars' text |
| `--statistics-muted-color` | `#687086` | `#98a0b3` | The axes, the context line, the tabs' labels and changes, and a hovered tab's tint |
| `--statistics-background` | `#fff` | `#161a22` | The ring around the dots and the tabs' tints: the surface the chart sits on |
| `--statistics-font-size` | `0.75rem` | | The axes' and the bars' text size |
| `--statistics-figure-size` | `1.25rem` | | The tabs' figures' size |
| `--statistics-plot-height` | `240px` | | The plot's height, at every width |
| `--statistics-up-color` | `#12795a` | `#4cc38a` | A chip up |
| `--statistics-up-background` | `#e2f3eb` | `rgb(76 195 138 / 0.14)` | Its background |
| `--statistics-down-color` | `#bd3f0b` | `#f08a4b` | A chip down |
| `--statistics-down-background` | `#fcebdf` | `rgb(240 138 75 / 0.14)` | Its background |
| `--statistics-flat-color` | `#5c6479` | `#98a0b3` | A chip at 0%, neither up nor down: a grey near the muted colour |
| `--statistics-flat-background` | `#eceef3` | `rgb(152 160 179 / 0.14)` | Its background |
| `--statistics-radius` | `0.375rem` | | The chips' corners |
| `--statistics-focus-color` | `#3d5afe` | `#8197ff` | The focus ring of the tabs and the plot |
| `--statistics-bar-color` | `#2563eb` | `#60a5fa` | The bars' fill |
| `--statistics-bar-radius` | `3px` | | The bars' corners |

The tab and the panel of a measure both carry its `data-measure`, so one rule gives a measure its colour on the line,
the dot and the chosen tab:

```css
.statistics-chart [data-measure="paid_views"] {
    --statistics-line-color: var(--brand);
}
```

The stylesheet is in no cascade layer, so it beats layered utility classes (Tailwind v4's) on a chart: import it into
one, `@import '@ismailnakkar/statistics-chart/style.css' layer(components);`, or set these properties.

Without `:has()` (Chrome 105, Firefox 121, Safari 15.4) every panel shows, one under another, and no tab is marked.
Without container queries (Chrome 105, Firefox 110, Safari 16) the tabs stay in one row and every day label and its
line show.
Without `color-mix()` (Chrome 111, Firefox 113, Safari 16.2) the chosen tab has its bar and no tint.

## Accessibility

- Each panel's summary, a hidden `p`, names its SVG (`role="img"`) and describes its plot: the measure, its days, its
  total or average, its best day and its daily average. The axes are `aria-hidden`.
- The context line is a polite live region: as the day under the pointer changes, a screen reader reads its name and
  value, its change and the previous month's day. It is written only when the day changes.
- The script makes each plot a slider (`role="slider"`) named for its measure. Its value is the day shown, and its
  `aria-valuetext` the context line as it reads that day (before any day shows, its line from
  `data-statistics-labels`). While the plot has focus the context line's live region is off, so a key reads each day
  once. Arrow keys step through the days, Home and End jump to the first and last, and Escape puts the month back and
  keeps the focus. Keys held with Alt, Ctrl or
  Meta are left to the browser. Hover, a tap and the keyboard all show the same day; a tapped day stays until a tap
  elsewhere.
- A day still counting is never compared with the previous month's: its chip stays hidden. Neither is a CPM's day
  without paid views, which says "no paid views" instead of a value.
- The metric tabs are real radio buttons in a `fieldset`, each named by its label, its figure and its change, so arrow
  keys, the legend and the checked state come from the browser. The focused tab and the focused plot are ringed (`2px solid var(--statistics-focus-color)`).
- Without the script every point still has a `<title>`, which the browser shows as a tooltip.
- The default text and muted colours read at 4.5:1 on the default background, and each chip on its own; so do the Dark
  column's on its background.

## Testing

The script needs a DOM, so run your app's tests in happy-dom or jsdom (Vitest: `environment: 'happy-dom'`).

Run this package's suite with `npm test`.

## Upgrading

### From 0.2

Require laravel-statistics `^0.5` with it: the script reads the new markup, which 0.4's line chart doesn't have. Then:

- The tooltip is gone: the panel's context line shows the day instead, "Fri 6 Nov: 607", its change on the previous
  month's same day and that day, "6 Oct: 519", while the tabs keep the month's figures. The script no longer reads
  `data-statistics-tip-*` or `data-statistics-values`. `destroy()` hides the guide and both dots and restores the
  context line.
- The script reads `data-statistics-days` and `data-statistics-previous-labels` as each day's parts, plain and
  highlighted in turn, and writes each highlighted part in a `<strong>`, as text; it puts the month's words back with
  their highlights. The stylesheet sets `.statistics-chart-context strong` in `--statistics-text-color` at weight 600,
  and hides a minor day's grid line with its label: `.statistics-chart-plot` is an inline-size container for that.
- The tabs hold each measure's figure and change: a page's own tiles repeat them, so drop the tiles. They are one row of
  equal columns, two to a row on a chart under 720px wide (three stay in one row until 480px, then stack; a lone
  chart's block keeps the width) and one under 360px,
  the chosen one topped with its measure's colour; `.statistics-chart` is now an inline-size container, so give it a
  width in a flex or grid parent.
- The custom properties: `--statistics-series-1` to `-4` are now one `--statistics-line-color`: set it on a measure's
  `data-measure`, which its tab and panel both carry, for one colour per measure. `--statistics-minor-text-color` is
  `--statistics-muted-color`. Gone: `--statistics-area-opacity`, `--statistics-baseline-color` (the baseline is gone
  too), `--statistics-tip-background`, `--statistics-tip-border`, `--statistics-tip-shadow`,
  `--statistics-tab-background`, `--statistics-tab-selected-background` and `--statistics-tab-selected-color` (the
  tabs take their tints from the line, muted and background colours). New: `--statistics-line-color`,
  `--statistics-previous-color`, `--statistics-previous-width`, `--statistics-guide-color`, `--statistics-muted-color`,
  `--statistics-background`, `--statistics-figure-size`, `--statistics-plot-height`, `--statistics-up-color`,
  `--statistics-up-background`, `--statistics-down-color`, `--statistics-down-background`, and
  `--statistics-flat-color` and `--statistics-flat-background` for a chip at 0% (`data-trend="flat"`). The default
  colours are new throughout.
- `--statistics-line-width` defaults to 2 (was 2.5); `--statistics-radius` now rounds only the chips, and
  `--statistics-font-size` sizes only the axes and the bars: the tabs and the context line take their own sizes.
- The default colours no longer follow the page's `color-scheme`: they are the light ones everywhere. A dark page
  sets the dark ones itself, under its own media query or selector, from the block in [Styling](#styling).
- The plot is 240 pixels high at every width (`--statistics-plot-height`), not 600 wide to its height, and its values
  sit inside a margin of 12 pixels at the top and 14 at the bottom.
- A shown panel is `display: block` with its axes in `.statistics-chart-frame`: a rule of yours on
  `.statistics-chart-panel`'s grid moves there.

### From 0.1

Nothing breaks. `statisticsCharts(root = document)` is new: it binds every plot under `root`, so it replaces a
`querySelectorAll('[data-statistics-plot]')` loop over `statisticsChart()`, which stays.
