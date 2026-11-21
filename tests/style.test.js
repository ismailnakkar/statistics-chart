import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

// Read from disk: Vitest imports CSS, ?raw included, as an empty string.
const read = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const css = read('../src/style.css');
const readme = read('../README.md');
const pkg = JSON.parse(read('../package.json'));

const COLOURS = /#[0-9a-f]{3,8}\b|rgb\([^()]*\)/gi;
/** The media query of the README's ready block of dark colours, which a page sets itself. */
const DARK_QUERY = '@media (prefers-color-scheme: dark)';
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');

/** Rules by selector, in order. A block's body is parsed again when it holds rules (an at-rule's). */
function parse(source) {
    const rules = [];
    const pattern = /([^{}]+)\{/g;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        let depth = 1;
        let end = pattern.lastIndex;

        while (depth > 0) {
            depth += source[end] === '{' ? 1 : source[end] === '}' ? -1 : 0;
            end++;
        }

        const selector = match[1].trim();
        const body = source.slice(pattern.lastIndex, end - 1);

        if (selector.startsWith('@')) {
            rules.push(...parse(body).map((rule) => ({...rule, at: selector})));
        } else {
            rules.push({
                selector,
                at: null,
                declarations: Object.fromEntries(body.split(';')
                    .map((declaration) => declaration.split(/:(.*)/s).map((part) => part?.trim()))
                    .filter(([name]) => name)),
            });
        }

        pattern.lastIndex = end;
    }

    return rules;
}

const RULES = parse(withoutComments(css));
const README_RULES = parse(withoutComments(Array.from(readme.matchAll(/```css\n([\s\S]*?)```/g), ([, block]) => block).join('\n')));
const rule = (selector, at = null) => RULES.find((candidate) => candidate.selector === selector && candidate.at === at);
const rulesWith = (part) => RULES.filter(({selector}) => selector.includes(part));
const ruleFor = (part, at = null) => RULES.find(({selector, at: within}) => within === at
    && selector.split(',').some((candidate) => candidate.trim() === part));
const coloured = () => Object.entries(rule(':where(:root)').declarations).filter(([, value]) => value.match(COLOURS));
/** Each scheme's colours: the light defaults, and the dark ones the README gives a page to set. */
const SCHEMES = {
    light: rule(':where(:root)').declarations,
    dark: README_RULES.find(({selector, at}) => selector === ':root' && at === DARK_QUERY)?.declarations,
};

/** A value whose colours are plain hex or rgb(), in no light-dark(), var() or other function. */
const plain = (value) => value.match(COLOURS) !== null && !/[()]/.test(value.replace(COLOURS, ''));

/** A #rgb or #rrggbb colour's red, green and blue, 0..255. */
function channels(hex) {
    const digits = hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);

    return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16));
}

/** A colour as it shows on an opaque #rgb or #rrggbb backdrop: an rgb(r g b / a) blended into it, a hex as it is. */
function over(colour, backdrop) {
    const translucent = colour.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);

    if (translucent === null) {
        return colour;
    }

    const [r, g, b, alpha] = translucent.slice(1).map(Number);
    const under = channels(backdrop);

    return `#${[r, g, b].map((channel, at) => Math.round(channel * alpha + under[at] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2's contrast ratio of two #rrggbb or #rgb colours. */
function contrast(...colours) {
    const luminance = (hex) => {
        const [r, g, b] = channels(hex).map((value) => {
            const channel = value / 255;

            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [lighter, darker] = colours.map(luminance).sort((a, b) => b - a);

    return (lighter + 0.05) / (darker + 0.05);
}

describe('style.css', () => {
    it('defaults, and documents, every custom property it reads, and defines no other', () => {
        const defaults = rule(':where(:root)').declarations;
        const used = new Set(Array.from(css.matchAll(/var\((--statistics-[a-z0-9-]+)[,)]/g), ([, name]) => name));
        // Read with a fallback, so left unset: a default at :root would fix the fallback's value there.
        const unset = new Set(Array.from(css.matchAll(/var\((--statistics-[a-z0-9-]+), var\(--statistics-[a-z0-9-]+\)\)/g), ([, name]) => name));

        expect(used.size).toBe(20);
        expect([...unset]).toEqual([]);
        expect(Object.keys(defaults).sort()).toEqual([...used].filter((name) => !unset.has(name)).sort());

        for (const name of used) {
            expect(readme, name).toContain(`\`${name}\``);
        }
    });

    it('defaults to plain light colours, which every build keeps, and leaves dark mode to the page', () => {
        // Lightning CSS (Vite, Tailwind v4) lowers light-dark() to variables a stylesheet without color-scheme never sets.
        expect(withoutComments(css)).not.toContain('light-dark(');
        expect(withoutComments(css)).not.toContain('color-scheme');
        expect(coloured().length).toBeGreaterThan(0);

        for (const [name, value] of coloured()) {
            expect(plain(value), `${name}: ${value}`).toBe(true);
        }
    });

    it('documents a ready dark value for every colour it defaults, and only for those', () => {
        expect(SCHEMES.dark).toBeDefined();
        expect(Object.keys(SCHEMES.dark).sort()).toEqual(coloured().map(([name]) => name).sort());

        for (const [name, value] of Object.entries(SCHEMES.dark)) {
            expect(plain(value), `${name}: ${value}`).toBe(true);
        }
    });

    it('lists each default in the Styling table\'s Light column, and each ready dark value in its Dark column', () => {
        const table = Object.fromEntries(Array.from(readme.matchAll(/^\| `(--statistics-[a-z0-9-]+)` \|([^|]*)\|([^|]*)\|/gm),
            ([, name, light, dark]) => [name, {light: light.trim(), dark: dark.trim()}]));
        const cell = (value) => (value === undefined ? '' : `\`${value}\``);

        expect(Object.keys(table)).toEqual(expect.arrayContaining(Object.keys(SCHEMES.light)));

        for (const [name, {light, dark}] of Object.entries(table)) {
            expect(light, name).toBe(cell(SCHEMES.light[name]));
            expect(dark, name).toBe(cell(SCHEMES.dark[name]));
        }
    });

    it('uses logical properties only', () => {
        const physical = /^(?:(?:margin|padding|border)-(?:left|right|top|bottom)|left|right|top|bottom)$/;

        expect(RULES.length).toBeGreaterThan(0);

        for (const {selector, declarations} of RULES) {
            const inPlot = selector.split(',').every((part) => part.trim().startsWith('.statistics-chart-plot'));

            for (const [name, value] of Object.entries(declarations)) {
                if (!inPlot) {
                    expect(name, selector).not.toMatch(physical);
                }

                expect(`${name}: ${value}`, selector).not.toMatch(/^text-align: (?:left|right)$/);
            }
        }
    });

    it('shows the panel of the checked tab, for up to four tabs', () => {
        for (const n of [1, 2, 3, 4]) {
            const shows = RULES.find(({selector, declarations}) => declarations.display === 'block'
                && selector.includes(`.statistics-chart-tab:nth-of-type(${n}) :checked`)
                && selector.includes(`.statistics-chart-panel:nth-of-type(${n})`));

            expect(shows, `tab ${n}`).toBeDefined();
        }

        // Only with radios: a lone chart's one block switches nothing.
        expect(rule('.statistics-chart:has(fieldset.statistics-chart-tabs) .statistics-chart-panel').declarations.display).toBe('none');
    });

    it('reads each day label in its own text\'s direction inside the left-to-right axis', () => {
        expect(rule('.statistics-chart-day').declarations['unicode-bidi']).toBe('plaintext');
    });

    it('drops the minor day labels and their lines on a narrow axis, whatever the page\'s width', () => {
        // The plot and the days are as wide as each other, in the frame's second column.
        for (const part of ['.statistics-chart-days', '.statistics-chart-plot']) {
            expect(rule(part).declarations, part).toMatchObject({'grid-column': '2', 'container-type': 'inline-size'});
        }

        for (const part of ['.statistics-chart-day[data-minor]', '.statistics-chart-grid [data-minor]']) {
            expect(ruleFor(part, '@container (width < 35rem)')?.declarations.display, part).toBe('none');
        }

        expect(RULES.filter(({at}) => at?.startsWith('@media'))).toEqual([]);
    });

    it('highlights the context line\'s month, dates, values and day in the text colour', () => {
        expect(rule('.statistics-chart-context strong').declarations).toEqual({color: 'var(--statistics-text-color)', 'font-weight': '600'});
    });

    it('sets the axes, the context line and the tabs\' labels in a colour that reads on the background, light and dark', () => {
        for (const [scheme, colours] of Object.entries(SCHEMES)) {
            for (const name of ['--statistics-muted-color', '--statistics-text-color']) {
                expect(contrast(colours[name], colours['--statistics-background']), `${scheme} ${name}`).toBeGreaterThanOrEqual(4.5);
            }
        }

        for (const part of ['.statistics-chart-ticks', '.statistics-chart-days', '.statistics-chart-context', '.statistics-chart-tab-label', '.statistics-chart-tab-change']) {
            expect(rule(part).declarations.color, part).toBe('var(--statistics-muted-color)');
        }
    });

    it('colours a chip by its trend, 0% flat, and reads it on its own background, light and dark', () => {
        for (const trend of ['up', 'down', 'flat']) {
            expect(rule(`.statistics-chart-chip[data-trend='${trend}']`).declarations, trend).toEqual({
                background: `var(--statistics-${trend}-background)`,
                color: `var(--statistics-${trend}-color)`,
            });

            for (const [scheme, colours] of Object.entries(SCHEMES)) {
                // A translucent chip, on the dark background it sits on.
                const background = over(colours[`--statistics-${trend}-background`], colours['--statistics-background']);

                expect(contrast(colours[`--statistics-${trend}-color`], background), `${scheme} ${trend}`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('keeps the plot 240px high at every width, so its lines and text never stretch', () => {
        expect(rule(':where(:root)').declarations['--statistics-plot-height']).toBe('240px');
        expect(rule('.statistics-chart-plot').declarations['block-size']).toBe('var(--statistics-plot-height)');
        expect(css).not.toContain('aspect-ratio');
    });

    it('keeps a context line part the script hides hidden, whatever the page sets', () => {
        expect(ruleFor('.statistics-chart-context [hidden]').declarations.display).toBe('none');
    });

    it('lays the tabs out in one row of equal columns, two on a narrower chart and one on a narrow one', () => {
        expect(rule('.statistics-chart').declarations['container-type']).toBe('inline-size');
        expect(rule('.statistics-chart-tabs').declarations).toMatchObject({display: 'grid', 'grid-auto-flow': 'column', 'grid-auto-columns': 'minmax(0, 1fr)'});
        // Two columns only for the radios: a lone chart's one block keeps the whole width.
        expect(rule('fieldset.statistics-chart-tabs', '@container (width < 720px)').declarations).toEqual({'grid-template-columns': 'repeat(2, minmax(0, 1fr))', 'grid-auto-flow': 'row'});
        expect(rule('.statistics-chart-tabs', '@container (width < 720px)')).toBeUndefined();
        expect(rule('.statistics-chart-tabs', '@container (width < 360px)').declarations).toEqual({'grid-template-columns': 'minmax(0, 1fr)'});
    });

    it('keeps three tabs in one row on a narrower chart, then stacks them, so none sits alone at half width', () => {
        const three = 'fieldset.statistics-chart-tabs:has(> .statistics-chart-tab:nth-of-type(3):last-of-type)';

        expect(rule(three, '@container (width < 720px)').declarations).toEqual({'grid-template-columns': 'repeat(3, minmax(0, 1fr))'});
        expect(rule(`${three} > .statistics-chart-tab:nth-of-type(3)`, '@container (width < 720px)').declarations).toEqual({'border-inline-start': '1px solid var(--statistics-grid-color)', 'box-shadow': 'none'});
        expect(rule(three, '@container (width < 480px)').declarations).toEqual({'grid-template-columns': 'minmax(0, 1fr)'});
    });

    it('marks the chosen tab, and a lone chart\'s block, with its measure\'s colour', () => {
        const chosen = ruleFor('.statistics-chart-tab:has(:checked)');

        expect(chosen.selector).toContain('div.statistics-chart-tab');
        expect(chosen.declarations['border-block-start-color']).toBe('var(--statistics-line-color)');
        expect(rule('.statistics-chart-tab').declarations['border-block-start']).toBe('3px solid transparent');
        // The hover tint is for the other tabs: the chosen one keeps its colour under the pointer.
        expect(rulesWith(':hover').map(({selector}) => selector)).toEqual(['label.statistics-chart-tab:not(:has(:checked)):hover']);
    });

    it('keeps the values and the guide inside the drawing\'s margins, 12 over the top and 14 under the bottom of 240', () => {
        expect(rule('.statistics-chart-ticks').declarations['padding-block']).toBe('calc(var(--statistics-plot-height) * 12 / 240) calc(var(--statistics-plot-height) * 14 / 240)');
        expect(rule('.statistics-chart-plot .statistics-chart-guide').declarations).toMatchObject({top: 'calc(100% * 12 / 240)', bottom: 'calc(100% * 14 / 240)'});
    });

    it('draws the dashed segment into today as wide as the line, and a lone day as a dot', () => {
        for (const part of ['.statistics-chart-line', '.statistics-chart-today']) {
            expect(ruleFor(part).declarations['stroke-width'], part).toBe('var(--statistics-line-width)');
        }

        expect(rule('.statistics-chart-line[data-lone]').declarations['stroke-width']).toBe('calc(var(--statistics-line-width) * 4)');
    });

    it('colours the line at no specificity, and the README colours a measure through its data-measure', () => {
        expect(rule(':where(.statistics-chart-panel)')?.declarations.color).toBe('var(--statistics-line-color)');
        expect(rulesWith('.statistics-chart-panel:nth-of-type').every(({declarations}) => !('color' in declarations))).toBe(true);
        // On the tab and the panel alike, which both carry it.
        expect(README_RULES.find(({selector}) => selector === '.statistics-chart [data-measure="paid_views"]')?.declarations).toEqual({'--statistics-line-color': 'var(--brand)'});
    });

    it('draws the previous month in its own colour, and no average on the plot', () => {
        expect(rule('.statistics-chart-previous').declarations).toEqual({color: 'var(--statistics-previous-color)', 'stroke-width': 'var(--statistics-previous-width)'});
        expect(rule('.statistics-chart-previous-dot').declarations.background).toBe('var(--statistics-previous-color)');
        expect(rulesWith('average-label')).toEqual([]);
        expect(rulesWith('baseline')).toEqual([]);
    });

    it('styles no bar chart', () => {
        expect(rulesWith('statistics-bars')).toEqual([]);
        expect(Object.keys(rule(':where(:root)').declarations).filter((name) => name.startsWith('--statistics-bar'))).toEqual([]);
    });

    it('keeps hidden overlays hidden', () => {
        const hidden = rulesWith('[hidden]');

        for (const overlay of ['guide', 'dot', 'previous-dot']) {
            expect(hidden.find(({selector}) => selector.includes(`.statistics-chart-${overlay}[hidden]`))?.declarations.display, overlay).toBe('none');
        }
    });

    it('rings what has keyboard focus', () => {
        const rings = rulesWith(':focus-visible');

        expect(rings.length).toBeGreaterThan(0);

        for (const {selector, declarations} of rings) {
            expect(declarations.outline, selector).toBe('2px solid var(--statistics-focus-color)');
        }
    });

    it('is exported, with the declaration that lets TypeScript import it', () => {
        expect(pkg.exports['./style.css']).toEqual({types: './src/style.d.css.ts', default: './src/style.css'});
    });
});
