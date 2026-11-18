import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

// Read from disk: Vitest imports CSS, ?raw included, as an empty string.
const read = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const css = read('../src/style.css');
const readme = read('../README.md');
const pkg = JSON.parse(read('../package.json'));

const COLOUR = /#[0-9a-f]{3,8}\b|rgb\(/i;
const LIGHT_DARK = /light-dark\((?:[^()]|\([^()]*\))*\)/g;
/** A light-dark() pair, its light half captured. */
const LIGHT_HALF = /light-dark\(((?:[^(),]|\([^()]*\))*),(?:[^()]|\([^()]*\))*\)/g;
const BEFORE_LIGHT_DARK = '@supports not (color: light-dark(#000, #fff))';

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

const RULES = parse(css.replace(/\/\*[\s\S]*?\*\//g, ''));
const rule = (selector, at = null) => RULES.find((candidate) => candidate.selector === selector && candidate.at === at);
const rulesWith = (part) => RULES.filter(({selector}) => selector.includes(part));
const ruleFor = (part, at = null) => RULES.find(({selector, at: within}) => within === at
    && selector.split(',').some((candidate) => candidate.trim() === part));
const coloured = () => Object.entries(rule(':where(:root)').declarations).filter(([, value]) => COLOUR.test(value));

/** WCAG 2's contrast ratio of two #rrggbb or #rgb colours. */
function contrast(...colours) {
    const luminance = (hex) => {
        const digits = hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);
        const [r, g, b] = [0, 2, 4].map((at) => {
            const channel = parseInt(digits.slice(at, at + 2), 16) / 255;

            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [lighter, darker] = colours.map(luminance).sort((a, b) => b - a);

    return (lighter + 0.05) / (darker + 0.05);
}

const halves = (value) => value.match(/^light-dark\((#[0-9a-f]+), (#[0-9a-f]+)\)$/i).slice(1);

describe('style.css', () => {
    it('defaults, and documents, every custom property it reads, and defines no other', () => {
        const defaults = rule(':where(:root)').declarations;
        const used = new Set(Array.from(css.matchAll(/var\((--statistics-[a-z0-9-]+)\)/g), ([, name]) => name));

        expect(used.size).toBe(21);
        expect(Object.keys(defaults).sort()).toEqual([...used].sort());

        for (const name of used) {
            expect(readme, name).toContain(`\`${name}\``);
        }
    });

    it('follows the page\'s color-scheme, not the visitor\'s system: a light-only page stays light', () => {
        expect(css).not.toContain('prefers-color-scheme');
        expect(coloured().length).toBeGreaterThan(0);

        for (const [name, value] of coloured()) {
            expect(value, name).toContain('light-dark(');
            expect(value.replace(LIGHT_DARK, ''), name).not.toMatch(COLOUR);
        }
    });

    it('gives a browser without light-dark() the light colours', () => {
        const light = Object.fromEntries(coloured().map(([name, value]) => [name, value.replace(LIGHT_HALF, '$1')]));

        expect(rule(':where(:root)', BEFORE_LIGHT_DARK).declarations).toEqual(light);
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
            const shows = RULES.find(({selector, declarations}) => declarations.display === 'grid'
                && selector.includes(`.statistics-chart-tab:nth-of-type(${n}) :checked`)
                && selector.includes(`.statistics-chart-panel:nth-of-type(${n})`));

            expect(shows, `tab ${n}`).toBeDefined();
        }

        expect(rule('.statistics-chart:has(.statistics-chart-tabs) .statistics-chart-panel').declarations.display).toBe('none');
    });

    it('reads each day label in its own text\'s direction inside the left-to-right axis', () => {
        expect(rule('.statistics-chart-day').declarations['unicode-bidi']).toBe('plaintext');
    });

    it('drops the minor day labels on a narrow axis, whatever the page\'s width', () => {
        expect(rule('.statistics-chart-days').declarations['container-type']).toBe('inline-size');
        expect(rule('.statistics-chart-day[data-minor]', '@container (width < 35rem)').declarations.display).toBe('none');
        expect(RULES.filter(({at}) => at?.startsWith('@media'))).toEqual([]);
    });

    it('sets the minor day labels in a colour that reads on the default backgrounds', () => {
        const minor = rule('.statistics-chart-day[data-minor]').declarations;
        const defaults = rule(':where(:root)').declarations;
        const text = halves(defaults['--statistics-minor-text-color']);
        const backgrounds = halves(defaults['--statistics-tip-background']);

        expect(minor).toEqual({color: 'var(--statistics-minor-text-color)'});

        text.forEach((colour, scheme) => {
            expect(contrast(colour, backgrounds[scheme]), colour).toBeGreaterThanOrEqual(4.5);
        });
    });

    it('draws the dashed segment into today as wide as the line', () => {
        for (const part of ['.statistics-chart-line', '.statistics-chart-today']) {
            expect(ruleFor(part).declarations['stroke-width'], part).toBe('var(--statistics-line-width)');
        }
    });

    it('colours a panel by its position at no specificity, so a rule on its data-measure wins', () => {
        for (const n of [1, 2, 3, 4]) {
            expect(rule(`:where(.statistics-chart-panel:nth-of-type(${n}))`)?.declarations.color, `panel ${n}`).toBe(`var(--statistics-series-${n})`);
        }
    });

    it('lets the app set the selected tab\'s text and the bars\' corners', () => {
        expect(ruleFor('.statistics-chart-tab:has(:checked)').declarations.color).toBe('var(--statistics-tab-selected-color)');
        expect(rule(':where(:root)').declarations['--statistics-tab-selected-color']).toBe('currentColor');
        expect(ruleFor('.statistics-bars-fill').declarations.rx).toBe('var(--statistics-bar-radius)');
    });

    it('keeps hidden overlays hidden', () => {
        const hidden = rulesWith('[hidden]');

        for (const overlay of ['guide', 'dot', 'tip']) {
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

    it('sizes the bars\' text from the font size and leaves their height to the markup', () => {
        expect(rule('.statistics-bars').declarations['font-size']).toBe('var(--statistics-font-size)');
        // A CSS height overrides the svg's height attribute, and the bars have no viewBox to keep a ratio.
        expect(Object.keys(rule('.statistics-bars-svg').declarations)).not.toContain('block-size');
    });

    it('is exported, with the declaration that lets TypeScript import it', () => {
        expect(pkg.exports['./style.css']).toEqual({types: './src/style.d.css.ts', default: './src/style.css'});
    });
});
