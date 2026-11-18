import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {statisticsChart} from '../src/index.js';

// What the components render, so the suite reads the markup contract as it stands.
const markup = readFileSync(resolve(import.meta.dirname, 'fixtures/line-chart.html'), 'utf8');

const hook = (name) => document.querySelector(`[data-statistics-${name}]`);

const plot = () => hook('plot');

function pointer(type, clientX, pointerType = 'mouse', target = plot()) {
    target.dispatchEvent(new PointerEvent(type, {bubbles: true, clientX, pointerType}));
}

function key(name, modifiers = {}) {
    const event = new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true, ...modifiers});

    plot().dispatchEvent(event);

    return event;
}

const shown = () => !hook('tip').hidden && !hook('guide').hidden && !hook('dot').hidden;

const tip = () => `${hook('tip-day').textContent} ${hook('tip-value').textContent}`;

const value = () => [plot().getAttribute('aria-valuenow'), plot().getAttribute('aria-valuetext')];

/** The fixture on the page, any `data-statistics-*` given in place of its own, not yet bound. */
function render(data = {}) {
    document.body.innerHTML = markup;

    for (const [name, json] of Object.entries(data)) {
        plot().setAttribute(`data-statistics-${name}`, JSON.stringify(json));
    }

    // A 300px plot from x=100: the days sit at 100, 250 and 400.
    plot().getBoundingClientRect = () => new DOMRect(100, 0, 300, 120);
}

function mount(data = {}) {
    render(data);

    return statisticsChart(plot());
}

beforeEach(() => {
    mount();
});

describe('the statistics chart tooltip', () => {
    it('shows the day nearest the pointer and hides it when the mouse leaves', () => {
        pointer('pointermove', 240);

        expect(shown()).toBe(true);
        expect(tip()).toBe('Sun 13 Sep 0.6007');
        expect(hook('dot').style.left).toBe('50%');
        expect(hook('dot').style.top).toBe('24.913%');
        expect(hook('guide').style.left).toBe('50%');
        expect(hook('tip').style.translate).toBe('-50% 0.75rem');

        pointer('pointerleave', 240);
        expect(shown()).toBe(false);
    });

    it('picks the point nearest the pointer, wherever the points sit', () => {
        mount({points: [[0, 50], [90, 50], [100, 50]]});

        pointer('pointermove', 220);
        expect(tip()).toBe('Sat 12 Sep 0.3300');

        pointer('pointermove', 340);
        expect(tip()).toBe('Sun 13 Sep 0.6007');
    });

    it('keeps the tooltip over the plot at either end', () => {
        pointer('pointermove', 90);
        expect(tip()).toBe('Sat 12 Sep 0.3300');
        expect(hook('tip').style.translate).toBe('0 calc(-100% - 0.75rem)');

        pointer('pointermove', 999);
        expect(tip()).toBe('Mon 14 Sep, so far 0.0100');
        expect(hook('tip').style.translate).toBe('-100% calc(-100% - 0.75rem)');
    });

    it('keeps a tapped day after the finger lifts, until a tap elsewhere', () => {
        document.body.insertAdjacentHTML('beforeend', '<p id="elsewhere">Day by day</p>');

        pointer('pointerdown', 100, 'touch');
        pointer('pointerleave', 100, 'touch');
        expect(shown()).toBe(true);
        expect(tip()).toBe('Sat 12 Sep 0.3300');

        pointer('pointerdown', 0, 'touch', document.getElementById('elsewhere'));
        expect(shown()).toBe(false);
    });

    it('makes the plot a slider named for its measure, on the latest day', () => {
        expect(plot().getAttribute('role')).toBe('slider');
        expect(plot().getAttribute('tabindex')).toBe('0');
        expect(plot().getAttribute('aria-label')).toBe('Publisher earnings');
        expect(plot().getAttribute('aria-describedby')).toBe('earnings-summary-1');
        expect(plot().getAttribute('aria-valuemin')).toBe('1');
        expect(plot().getAttribute('aria-valuemax')).toBe('3');
        expect(value()).toEqual(['3', 'Mon 14 Sep, so far: 0.0100']);
        expect(document.querySelector('[data-statistics-live], [role="status"]')).toBeNull();
        // A slider's children are its own: the drawing would repeat the summary the slider already reads.
        expect(plot().querySelector('svg.statistics-chart-svg').getAttribute('aria-hidden')).toBe('true');
    });

    it('walks the days with the arrow keys, Home and End, from the latest', () => {
        plot().focus();
        expect(tip()).toBe('Mon 14 Sep, so far 0.0100');
        expect(value()).toEqual(['3', 'Mon 14 Sep, so far: 0.0100']);

        expect(key('ArrowLeft').defaultPrevented).toBe(true);
        expect(tip()).toBe('Sun 13 Sep 0.6007');
        expect(value()).toEqual(['2', 'Sun 13 Sep: 0.6007']);

        key('ArrowDown');
        expect(value()).toEqual(['1', 'Sat 12 Sep: 0.3300']);

        key('ArrowUp');
        expect(value()).toEqual(['2', 'Sun 13 Sep: 0.6007']);

        key('Home');
        key('ArrowLeft');
        expect(tip()).toBe('Sat 12 Sep 0.3300');
        expect(value()).toEqual(['1', 'Sat 12 Sep: 0.3300']);

        key('End');
        key('ArrowRight');
        expect(tip()).toBe('Mon 14 Sep, so far 0.0100');
        expect(value()).toEqual(['3', 'Mon 14 Sep, so far: 0.0100']);

        expect(key('Tab').defaultPrevented).toBe(false);

        plot().blur();
        expect(shown()).toBe(false);
    });

    it('hides the tooltip on Escape, keeping the focus and the day', () => {
        plot().focus();
        key('ArrowLeft');

        key('Escape');
        expect(shown()).toBe(false);
        expect(document.activeElement).toBe(plot());
        expect(value()).toEqual(['2', 'Sun 13 Sep: 0.6007']);

        key('ArrowLeft');
        expect(shown()).toBe(true);
        expect(value()).toEqual(['1', 'Sat 12 Sep: 0.3300']);
    });

    it('leaves the keys to the browser while Alt, Ctrl or Meta is held', () => {
        plot().focus();

        for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
            expect(key('ArrowLeft', {[modifier]: true}).defaultPrevented, modifier).toBe(false);
            key('Escape', {[modifier]: true});
        }

        expect(shown()).toBe(true);
        expect(value()).toEqual(['3', 'Mon 14 Sep, so far: 0.0100']);
    });

    it('shows the hovered day when the plot takes focus', () => {
        pointer('pointermove', 240);
        plot().focus();

        expect(tip()).toBe('Sun 13 Sep 0.6007');
        expect(value()).toEqual(['2', 'Sun 13 Sep: 0.6007']);
    });

    it('stays on its day when the plot has no width', () => {
        key('ArrowLeft');
        plot().getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

        pointer('pointermove', 240);
        expect(tip()).toBe('Sun 13 Sep 0.6007');
    });

    it('shows a lone day wherever the pointer is', () => {
        mount({points: [[50, 40]], values: ['1'], days: ['Mon 14 Sep, so far'], labels: ['Mon 14 Sep, so far: 1']});

        expect(plot().getAttribute('aria-valuemax')).toBe('1');

        pointer('pointermove', 110);
        expect(tip()).toBe('Mon 14 Sep, so far 1');
        expect(hook('dot').style.left).toBe('50%');

        key('ArrowRight');
        expect(value()).toEqual(['1', 'Mon 14 Sep, so far: 1']);
    });

    it('leaves an empty plot static, and not a tab stop, until it gains points', () => {
        const empty = mount({points: []});

        expect(plot().hasAttribute('tabindex')).toBe(false);
        expect(plot().hasAttribute('role')).toBe(false);
        pointer('pointermove', 240);
        expect(shown()).toBe(false);

        empty.destroy();
        plot().setAttribute('data-statistics-points', '[[0,58.75],[50,24.913],[100,98.75]]');

        expect(statisticsChart(plot())).not.toBe(empty);
        expect(plot().getAttribute('role')).toBe('slider');
        pointer('pointermove', 240);
        expect(shown()).toBe(true);
    });

    it('leaves a plot static when its markup lacks the name or a label per day', () => {
        for (const data of [{labels: ['Sun 1 Nov: 3']}, {name: null}]) {
            render(data);
            if (data.name === null) {
                plot().removeAttribute('data-statistics-name');
            }

            statisticsChart(plot());

            expect(plot().hasAttribute('role')).toBe(false);
            expect(plot().hasAttribute('tabindex')).toBe(false);
        }
    });

    it('binds once however often it is called', () => {
        const first = statisticsChart(plot());
        const add = vi.spyOn(plot(), 'addEventListener');

        expect(statisticsChart(plot())).toBe(first);
        expect(add).not.toHaveBeenCalled();
    });

    it('destroy() takes away its listeners and every attribute it added', () => {
        render();
        document.body.insertAdjacentHTML('beforeend', '<p id="elsewhere">Day by day</p>');

        const attributes = () => [plot(), plot().querySelector('svg'), hook('guide'), hook('dot'), hook('tip')].map((element) => element.getAttributeNames().sort());
        const before = attributes();
        const instance = statisticsChart(plot());

        plot().focus();
        pointer('pointermove', 240);
        instance.destroy();

        expect(shown()).toBe(false);
        expect(attributes()).toEqual(before);

        pointer('pointermove', 240);
        plot().focus();
        expect(shown()).toBe(false);

        hook('tip').hidden = false;
        const blur = vi.spyOn(plot(), 'blur');

        pointer('pointerdown', 0, 'touch', document.getElementById('elsewhere'));
        expect(blur).not.toHaveBeenCalled();
        expect(hook('tip').hidden).toBe(false);

        hook('tip').hidden = true;
        const rebound = statisticsChart(plot());

        expect(rebound).not.toBe(instance);
        pointer('pointermove', 240);
        expect(shown()).toBe(true);
    });
});
