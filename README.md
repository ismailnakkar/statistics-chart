# @ismailnakkar/statistics-chart

The stylesheet and the script for the chart component of
[ismailnakkar/laravel-statistics](https://github.com/ismailnakkar/laravel-statistics), `<x-statistics::line-chart>`.

- **The stylesheet** lays the charts out and colours them: the metric tabs, one panel per tab with its context line and
  axes, and the hidden summaries, legend and radios. Every page that draws a chart needs it.
- **The script** makes each line chart's plot a slider over its days. Hover, a tap or the arrow keys move a guide with a
  dot on the line and on the previous month's, and switch the panel's context line to that day: its value, its change
  on the previous month's same day, and that day. The tabs keep the month's figures. Without the script the charts
  show the month, and each point keeps a `<title>` for the browser's tooltip.

Needs laravel-statistics 0.5 or later: an older line chart lacks the markup the script reads.

## Install

```bash
npm i @ismailnakkar/statistics-chart
```

No dependencies. Type declarations are included.

## Usage

Import the stylesheet statically, in your CSS or JS entry, on every page that draws a chart: a chart styled after its
first paint shifts. Then bind the plots:

```js
import '@ismailnakkar/statistics-chart/style.css';
import {statisticsCharts} from '@ismailnakkar/statistics-chart';

statisticsCharts();
```

In CSS, `@import '@ismailnakkar/statistics-chart/style.css';` does the same.

### API

- **`statisticsCharts(root = document)`** binds every `[data-statistics-plot]` under `root` (a document, fragment or
  element) and returns their handles, one per plot in document order. It is the only export: to bind one plot, pass
  the element around it.
- **`handle.destroy()`** removes the listeners and every attribute the script added, hides the guide and the dots, and
  puts the context line back as the page rendered it.

A plot's data is read once, when it is bound. A second call on a bound plot returns its first handle. A plot without
points, a name, a label per point, a guide or a dot is left alone, and a later call binds it once it has them. A plot
outside a `.statistics-chart-panel` has no context line: only its guide and dots move.

### Pages that swap markup

On a page that swaps markup in place (Livewire, Turbo, htmx), destroy the handles before the swap and bind again after
it: a bound plot keeps its first data, and a morph strips the attributes the script added.

```js
// Before the swap.
statisticsCharts(region).forEach((chart) => chart.destroy());

// After it.
statisticsCharts(region);
```

With Turbo Drive, destroy on `turbo:before-cache` and bind on `turbo:load`, over the whole `document`.

Give each chart that a partial response renders (a Livewire update, a Turbo Frame, htmx) an `id` on its component. The
`id` starts every id and radio name inside the chart; without one they number from `statistics-chart-1` again and
collide with a chart already on the page.

## Styling

Override these custom properties on `:root`, or on a `.statistics-chart` for one chart. The defaults sit in
`:where(:root)`, so any rule of yours wins.

The default colours are light; dark mode is your page's. Set the Dark column's colours under your own dark media query
or selector. For a page that follows the visitor's system:

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
    }
}
```

With a theme switch, put the same declarations under its dark selector, such as `:root[data-theme="dark"]` or `.dark`.
The stylesheet uses no `light-dark()`: Lightning CSS (in Vite and Tailwind v4) lowers it to variables it sets only where
the same stylesheet declares `color-scheme`, which leaves every colour invalid in a package's stylesheet.

| Property | Light | Dark | Styles |
| --- | --- | --- | --- |
| `--statistics-line-color` | `#3d5afe` | `#8197ff` | A measure's line, its dashed segment into today, its dot, and its chosen tab's bar and tint |
| `--statistics-line-width` | `2` | | The line's width, and the dashed segment's |
| `--statistics-previous-color` | `#aeb5c6` | `#525b70` | The previous month's dashed line and its dot |
| `--statistics-previous-width` | `1.5` | | The previous month's line's width |
| `--statistics-grid-color` | `#e6e8ef` | `#262c38` | The grid lines, the lines between and under the tabs, and the rule before the daily average |
| `--statistics-guide-color` | `#aeb5c6` | `#525b70` | The vertical line at the day shown |
| `--statistics-text-color` | `#1c2130` | `#e7e9ef` | The tabs' figures and the context line's highlighted words |
| `--statistics-muted-color` | `#687086` | `#98a0b3` | The axes, the context line, the tabs' labels and changes, and a hovered tab's tint |
| `--statistics-background` | `#fff` | `#161a22` | The surface the chart sits on: the ring around the dots and the tabs' tints |
| `--statistics-font-size` | `0.75rem` | | The axes' text size |
| `--statistics-figure-size` | `1.25rem` | | The tabs' figures' size |
| `--statistics-plot-height` | `240px` | | The plot's height, at every width |
| `--statistics-up-color` | `#12795a` | `#4cc38a` | A chip up |
| `--statistics-up-background` | `#e2f3eb` | `rgb(76 195 138 / 0.14)` | Its background |
| `--statistics-down-color` | `#bd3f0b` | `#f08a4b` | A chip down |
| `--statistics-down-background` | `#fcebdf` | `rgb(240 138 75 / 0.14)` | Its background |
| `--statistics-flat-color` | `#5c6479` | `#98a0b3` | A chip at 0% |
| `--statistics-flat-background` | `#eceef3` | `rgb(152 160 179 / 0.14)` | Its background |
| `--statistics-radius` | `0.375rem` | | The chips' corners |
| `--statistics-focus-color` | `#3d5afe` | `#8197ff` | The focus ring of the tabs and the plot |

A measure's tab and panel both carry its `data-measure`, so one rule colours its line, its dot and its chosen tab:

```css
.statistics-chart [data-measure="paid_views"] {
    --statistics-line-color: var(--brand);
}
```

The stylesheet is in no cascade layer, so it beats layered utility classes (Tailwind v4's) on a chart. To let them win,
import it into a layer: `@import '@ismailnakkar/statistics-chart/style.css' layer(components);`.

Older browsers degrade:

- Without `:has()` (Chrome 105, Firefox 121, Safari 15.4) every panel shows, one under another, and no tab is marked.
- Without container queries (Chrome 105, Firefox 110, Safari 16) the tabs stay in one row and every day label and its
  line show.
- Without `color-mix()` (Chrome 111, Firefox 113, Safari 16.2) the chosen tab has its bar and no tint.

## The markup

The names the stylesheet and the script use, each exact, and a few left for your own rules. laravel-statistics renders
them, and its README's [The markup](https://github.com/ismailnakkar/laravel-statistics#the-markup) says what each
holds. `{prefix}` is the component's `id`, else `statistics-chart-{n}` in render order. The plot, its axes and the
chips read left to right in every language; the rest follows the page.

| Name | Use |
|---|---|
| `div.statistics-chart` | A line chart's root, an inline-size container so its tabs follow its own width: in a flex or grid parent, give it a width (`flex: 1`, a column), or it shrinks. |
| `fieldset.statistics-chart-tabs` | The metric tabs with several series, its `legend.statistics-chart-hidden` hidden but read; a `div.statistics-chart-tabs` with one. One row of equal columns, two to a row under 720px (three stay in one row until 480px, then stack) and one under 360px; a lone chart's block stays whole. |
| `label.statistics-chart-tab` | A tab per series, around a radio `input.statistics-chart-hidden` named `{prefix}-measure`, with the measure's `data-measure`; a `div.statistics-chart-tab` without a radio with one series. The chosen one, and a lone block, is topped with its line colour. |
| `span.statistics-chart-tab-label`, `span.statistics-chart-figure`, `span.statistics-chart-tab-change` | The tab's label, figure, and change chip with what it is against. The script never touches the tabs. |
| `span.statistics-chart-chip` | A change chip, `dir="ltr"`, coloured by its `data-trend`: `up`, `flat` (0%) or `down`. |
| `div.statistics-chart-panel` | A panel per series, in tab order, with its `data-measure`. The stylesheet shows the checked tab's, up to four. |
| `p.statistics-chart-context[data-statistics-context]` | The context line, `aria-live="polite"`. While the plot has focus the script sets `aria-live="off"`; while it shows a day, it holds the line's `min-block-size` at the month's height. |
| `[data-statistics-caption]` | The month's caption; while a day shows, that day from `data-statistics-days`. |
| `span.statistics-chart-chip[data-statistics-chip]` | `hidden`, without `data-trend`; while a day shows, its change from `data-statistics-changes` and its trend, hidden where that is null. |
| `[data-statistics-previous-day]` | `hidden`; while a day shows, the previous month's same day from `data-statistics-previous-labels`, hidden where it has none. |
| `span.statistics-chart-average[data-statistics-average]` | The daily average, set off from the caption by a rule; hidden while a day shows. |
| `p.statistics-chart-context strong` | The highlighted words, in the text colour at weight 600. |
| `div.statistics-chart-frame` | The axes and the plot, `dir="ltr"`: the values on the left, the days underneath. |
| `ol.statistics-chart-ticks` | The y axis's values, padded to the drawing's margins so each sits on its line. |
| `div.statistics-chart-plot[data-statistics-plot]` | The plot, `--statistics-plot-height` high, an inline-size container as wide as the days under it. The script makes it the slider. |
| `svg.statistics-chart-svg` | The drawing, `viewBox="0 0 600 240"`, stretched to the plot; its values keep 12 of the 240 over the axis top and 14 under its bottom. The script sets `aria-hidden="true"` on it while the plot is a slider. |
| `g.statistics-chart-grid` | The grid lines; one with `data-minor` hides with its day label. |
| `path.statistics-chart-previous`, `path.statistics-chart-line`, `path.statistics-chart-today` | The previous month's line, the line (`data-lone` on a lone day's, drawn four times as wide), and the dashed segment into a day still counting. |
| `g.statistics-chart-points` | Invisible circles, each with its day's `<title>` for the browser's tooltip. |
| `[data-statistics-guide]`, `[data-statistics-previous-dot]`, `[data-statistics-dot]` | The `div.statistics-chart-guide`, `-previous-dot` and `-dot` in the plot, `hidden`: the script places and shows them, and hides a dot where its day has no value. |
| `ol.statistics-chart-days`, `li.statistics-chart-day` | The x axis's days. `data-edge="start"` and `"end"` align the first and the last inside the axis; one with `data-minor` hides, with its line, on an axis under 35rem. |

The plot's data, JSON arrays indexed by day but for the name:

| Attribute | Holds |
|---|---|
| `data-statistics-name` | The measure's label: the slider's `aria-label`. |
| `data-statistics-points` | `[[x%, y%], ...]`: x 0..100, y down from the top; y `null` on a day without a value. |
| `data-statistics-labels` | Each day's announcement, a string: the slider's value text until it shows a day. |
| `data-statistics-days` | Each day as the caption prints it: a string, or its parts, plain and highlighted in turn from a plain one, `["", "Mon, 2 Nov: 2"]`. The script writes each part as text, a highlighted one in a `<strong>`. |
| `data-statistics-changes` | Each day's change on the previous month's same day, an integer percent, or null for none. |
| `data-statistics-previous-points` | The previous month's same days, as `data-statistics-points`; `[]` without them. |
| `data-statistics-previous-labels` | Each of those days, as `data-statistics-days`: `["2 Oct: ", "57,000"]`. |

The script sets `role="slider"`, `tabindex="0"`, `aria-label`, `aria-valuemin="1"`, `aria-valuemax` (the day count),
`aria-valuenow` and `aria-valuetext` on the plot. The value starts on the last day; its text is the day's label, then
the context line's visible parts once it shows the day, "Mon, 2 Nov: 2, 0%, 2 Oct: 2".

## Accessibility

- Each panel's hidden summary names its SVG (`role="img"`) and describes the plot. The axes are `aria-hidden`.
- The plot is a slider named for its measure, whose value is the day shown. Arrow keys step through the days, Home and
  End jump to the first and last, and Escape puts the month back and keeps the focus. Keys held with Alt, Ctrl or Meta
  are left to the browser.
- Hover, a tap and the keyboard show the same day; a tapped day stays until a tap elsewhere.
- The context line is a polite live region, written only when the day changes. While the plot has focus it is off, as
  the slider's value text reads the same words: each day is read once.
- The metric tabs are real radios in a `fieldset`, so arrow keys, the legend and the checked state come from the
  browser. The focused tab and the focused plot are ringed (`2px solid var(--statistics-focus-color)`).
- The default text and muted colours read at 4.5:1 on the default background, and each chip on its own; so do the Dark
  column's.

## Testing

The script needs a DOM: run your app's tests in happy-dom or jsdom (Vitest: `environment: 'happy-dom'`).

This package's suite: `npm test`.

## Upgrading

### From 0.3

- `statisticsChart(plot)` is gone: bind with `statisticsCharts(root)`, which returns a handle per plot under `root`.
  `statisticsChart(plot)` becomes `statisticsCharts(plot.parentElement)[0]` (the component's plot is alone in its
  `.statistics-chart-frame`), or a call on the region the plots sit in.
- The bar chart's styles are gone, as laravel-statistics 0.9 drops `<x-statistics::bar-chart>`: the `.statistics-bars`
  rules, `--statistics-bar-color` and `--statistics-bar-radius`. Delete any of them your app sets; left in place they
  style nothing. A page that still draws a bar chart (laravel-statistics 0.8 or older) stays on 0.3.

### From 0.2

Require laravel-statistics `^0.5` with it: the script reads the new markup, which 0.4's line chart doesn't have. Then:

- The tooltip is gone: the panel's context line shows the day instead, "Fri 6 Nov: 607", its change on the previous
  month's same day and that day, "6 Oct: 519", while the tabs keep the month's figures. The script no longer reads
  `data-statistics-tip-*` or `data-statistics-values`. `destroy()` hides the guide and both dots and restores the
  context line.
- The script reads `data-statistics-days` and `data-statistics-previous-labels` as each day's parts, plain and
  highlighted in turn, and writes each highlighted part in a `<strong>`, as text. The stylesheet sets
  `.statistics-chart-context strong` in `--statistics-text-color` at weight 600, and hides a minor day's grid line with
  its label: `.statistics-chart-plot` is an inline-size container for that.
- The tabs hold each measure's figure and change, so drop a page's own tiles that repeat them. `.statistics-chart` is
  now an inline-size container: give it a width in a flex or grid parent.
- Custom properties: `--statistics-series-1` to `-4` are one `--statistics-line-color`, set per measure on its
  `data-measure`. `--statistics-minor-text-color` is `--statistics-muted-color`. Gone: `--statistics-area-opacity`,
  `--statistics-baseline-color` (the baseline too), `--statistics-tip-background`, `--statistics-tip-border`,
  `--statistics-tip-shadow`, `--statistics-tab-background`, `--statistics-tab-selected-background` and
  `--statistics-tab-selected-color`. New: `--statistics-previous-color`, `--statistics-previous-width`,
  `--statistics-guide-color`, `--statistics-background`, `--statistics-figure-size`, `--statistics-plot-height`,
  `--statistics-up-color`, `--statistics-up-background`, `--statistics-down-color`, `--statistics-down-background`,
  `--statistics-flat-color` and `--statistics-flat-background`. The default colours are new throughout.
- `--statistics-line-width` defaults to 2 (was 2.5); `--statistics-radius` rounds only the chips, and
  `--statistics-font-size` sizes only the axes and the bars: the tabs and the context line take their own sizes.
- The default colours no longer follow the page's `color-scheme`: a dark page sets the dark ones itself, from the block
  in [Styling](#styling).
- The plot is 240 pixels high at every width (`--statistics-plot-height`), not 600 wide to its height, and its values
  sit inside a margin of 12 pixels at the top and 14 at the bottom.
- A shown panel is `display: block` with its axes in `.statistics-chart-frame`: a rule of yours on
  `.statistics-chart-panel`'s grid moves there.

### From 0.1

Nothing breaks. `statisticsCharts(root = document)` is new: it replaces a `querySelectorAll('[data-statistics-plot]')`
loop over `statisticsChart()`.
