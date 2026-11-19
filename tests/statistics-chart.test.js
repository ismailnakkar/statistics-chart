import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {statisticsChart, statisticsCharts} from '../src/index.js';

// What the component renders (three panels: paid views, publisher earnings, CPM), so the suite reads the markup
// contract as it stands.
const markup = readFileSync(resolve(import.meta.dirname, 'fixtures/line-chart.html'), 'utf8');

const plots = () => [...document.querySelectorAll('[data-statistics-plot]')];

const plot = () => plots()[0];

/** A hook in the first panel, or in the panel of $at. */
const hook = (name, at = plot()) => at.closest('.statistics-chart-panel').querySelector(`[data-statistics-${name}]`);

/** The figure in the tab of $at's panel. */
function figure(at = plot()) {
    const {measure} = at.closest('.statistics-chart-panel').dataset;

    return at.closest('.statistics-chart').querySelector(`.statistics-chart-tab[data-measure="${measure}"] .statistics-chart-figure`);
}

function pointer(type, clientX, pointerType = 'mouse', target = plot()) {
    target.dispatchEvent(new PointerEvent(type, {bubbles: true, clientX, pointerType}));
}

function key(name, modifiers = {}) {
    const event = new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true, ...modifiers});

    plot().dispatchEvent(event);

    return event;
}

const shown = (at = plot()) => !hook('guide', at).hidden && !hook('dot', at).hidden;

/**
 * The tab's figure, which keeps the month's, and the context line as they read: the caption, the chip and its trend, the
 * previous month's day and the daily average; null when hidden or absent.
 */
function context(at = plot()) {
    const text = (element) => (!element || element.hidden ? null : element.textContent.trim());
    const chip = hook('chip', at);

    return [text(figure(at)), text(hook('caption', at)), text(chip), chip.hidden ? null : chip.getAttribute('data-trend'), text(hook('previous-day', at)), text(hook('average', at))];
}

const MONTH = ['7', 'Paid views, November so far', null, null, null, 'Daily average 3'];

/** The highlighted words of the caption, the previous month's day and the daily average. */
const highlights = (at = plot()) => ['caption', 'previous-day', 'average']
    .map((name) => Array.from(hook(name, at)?.querySelectorAll('strong') ?? [], (strong) => strong.textContent));

/** The month's: the month and the daily average's value. */
const MONTH_HIGHLIGHTS = [['November'], [], ['3']];

const value = () => [plot().getAttribute('aria-valuenow'), plot().getAttribute('aria-valuetext')];

/** Each day's value text while it shows: the context line's visible parts, as they read. */
const DAYS = ['Sun 1 Nov: 4, +100%, 1 Oct: 2', 'Mon 2 Nov: 2, 0%, 2 Oct: 2', 'Tue 3 Nov, so far: 1, 3 Oct: 5'];

/** A 300px plot from x=100: the days sit at 100, 250 and 400. */
function measure(element) {
    element.getBoundingClientRect = () => new DOMRect(100, 0, 300, 240);
}

/** The fixture on the page, any `data-statistics-*` given in place of the first plot's own, not yet bound. */
function render(data = {}) {
    document.body.innerHTML = markup;

    for (const [name, json] of Object.entries(data)) {
        plot().setAttribute(`data-statistics-${name}`, JSON.stringify(json));
    }

    plots().forEach(measure);
}

function mount(data = {}) {
    render(data);

    return statisticsChart(plot());
}

beforeEach(() => {
    mount();
});

describe('the statistics chart', () => {
    it('shows the month in the context line until a day is shown', () => {
        expect(context()).toEqual(MONTH);
        expect(shown()).toBe(false);
        expect(hook('previous-dot').hidden).toBe(true);
    });

    it('switches the context line to the day nearest the pointer, with the guide and both dots, and restores it when the mouse leaves', () => {
        pointer('pointermove', 240);

        expect(shown()).toBe(true);
        // The day and its value, its change on the previous month's day, flat at 0%, then that day; the tab keeps the month's.
        expect(context()).toEqual(['7', 'Mon 2 Nov: 2', '0%', 'flat', '2 Oct: 2', null]);
        expect(hook('guide').style.left).toBe('50%');
        expect([hook('dot').style.left, hook('dot').style.top]).toEqual(['50%', '64.444%']);
        expect(hook('previous-dot').hidden).toBe(false);
        expect([hook('previous-dot').style.left, hook('previous-dot').style.top]).toEqual(['50%', '64.444%']);

        pointer('pointermove', 90);
        expect(context()).toEqual(['7', 'Sun 1 Nov: 4', '+100%', 'up', '1 Oct: 2', null]);

        pointer('pointerleave', 90);
        expect(shown()).toBe(false);
        expect(hook('previous-dot').hidden).toBe(true);
        expect(context()).toEqual(MONTH);
    });

    it('highlights the day and its value as one, and the previous month\'s value, while a day shows, and puts the month\'s highlights back', () => {
        expect(highlights()).toEqual(MONTH_HIGHLIGHTS);
        expect(hook('caption').innerHTML).toBe('Paid views, <strong>November</strong> so far');

        pointer('pointermove', 240);
        expect(highlights()).toEqual([['Mon 2 Nov: 2'], ['2'], []]);
        expect(hook('caption').innerHTML).toBe('<strong>Mon 2 Nov: 2</strong>');
        expect(hook('previous-day').innerHTML).toBe('2 Oct: <strong>2</strong>');

        pointer('pointerleave', 240);
        expect(highlights()).toEqual(MONTH_HIGHLIGHTS);
        expect(hook('caption').innerHTML).toBe('Paid views, <strong>November</strong> so far');
    });

    it('writes the words as text, never as markup', () => {
        mount({days: [['', '<img src="x">'], ['<b>', 'Mon 2 Nov', '</b>'], 'Tue 3 Nov']});

        pointer('pointermove', 100);
        expect(hook('caption').querySelector('img')).toBeNull();
        expect(context()[1]).toBe('<img src="x">');

        pointer('pointermove', 240);
        expect([hook('caption').querySelectorAll('b').length, context()[1], highlights()[0]]).toEqual([0, '<b>Mon 2 Nov</b>', ['Mon 2 Nov']]);

        // A string is one plain part.
        pointer('pointermove', 400);
        expect([context()[1], highlights()[0]]).toEqual(['Tue 3 Nov', []]);
    });

    it('never compares the partial day still counting, which keeps its value', () => {
        pointer('pointermove', 999);

        expect(context()).toEqual(['7', 'Tue 3 Nov, so far: 1', null, null, '3 Oct: 5', null]);
        expect([hook('previous-dot').style.left, hook('previous-dot').style.top]).toEqual(['100%', '19.861%']);
    });

    it('marks a fall on the previous month\'s day down, in each panel\'s own context line', () => {
        const earnings = plots()[1];

        statisticsChart(earnings);
        pointer('pointermove', 100, 'mouse', earnings);

        expect(context(earnings)).toEqual(['0.0070', 'Sun 1 Nov: 0.0040', '-33%', 'down', '1 Oct: 0.0060', null]);
        expect(context()).toEqual(MONTH);

        pointer('pointerleave', 100, 'mouse', earnings);
        expect(context(earnings)).toEqual(['0.0070', 'Publisher earnings, November so far', null, null, null, 'Daily average 0.0030']);
    });

    it('picks the point nearest the pointer, wherever the points sit', () => {
        mount({points: [[0, 50], [90, 50], [100, 50]]});

        pointer('pointermove', 220);
        expect(context()[1]).toBe('Sun 1 Nov: 4');

        pointer('pointermove', 340);
        expect(context()[1]).toBe('Mon 2 Nov: 2');
    });

    it('keeps a tapped day after the finger lifts, until a tap elsewhere', () => {
        document.body.insertAdjacentHTML('beforeend', '<p id="elsewhere">Day by day</p>');

        pointer('pointerdown', 100, 'touch');
        pointer('pointerleave', 100, 'touch');
        expect(shown()).toBe(true);
        expect(context()[1]).toBe('Sun 1 Nov: 4');

        pointer('pointerdown', 0, 'touch', document.getElementById('elsewhere'));
        expect(shown()).toBe(false);
        expect(context()).toEqual(MONTH);
    });

    it('makes the plot a slider named for its measure, on the latest day', () => {
        expect(plot().getAttribute('role')).toBe('slider');
        expect(plot().getAttribute('tabindex')).toBe('0');
        expect(plot().getAttribute('aria-label')).toBe('Paid views');
        expect(plot().getAttribute('aria-describedby')).toBe('earnings-summary-1');
        expect(plot().getAttribute('aria-valuemin')).toBe('1');
        expect(plot().getAttribute('aria-valuemax')).toBe('3');
        expect(value()).toEqual(['3', 'Tue 3 Nov, so far: 1']);
        // A slider's children are its own: the drawing would repeat the summary the slider already reads.
        expect(plot().querySelector('svg.statistics-chart-svg').getAttribute('aria-hidden')).toBe('true');
        // The context line announces the day itself.
        expect(hook('context').getAttribute('aria-live')).toBe('polite');
    });

    it('walks the days with the arrow keys, Home and End, from the latest, its value text reading the context line', () => {
        plot().focus();
        expect(context()[1]).toBe('Tue 3 Nov, so far: 1');
        expect(value()).toEqual(['3', DAYS[2]]);

        expect(key('ArrowLeft').defaultPrevented).toBe(true);
        expect(context()).toEqual(['7', 'Mon 2 Nov: 2', '0%', 'flat', '2 Oct: 2', null]);
        expect(value()).toEqual(['2', DAYS[1]]);

        key('ArrowDown');
        expect(value()).toEqual(['1', DAYS[0]]);

        key('ArrowUp');
        expect(value()).toEqual(['2', DAYS[1]]);

        key('Home');
        key('ArrowLeft');
        expect(context()[1]).toBe('Sun 1 Nov: 4');
        expect(value()).toEqual(['1', DAYS[0]]);

        key('End');
        key('ArrowRight');
        expect(context()[1]).toBe('Tue 3 Nov, so far: 1');
        expect(value()).toEqual(['3', DAYS[2]]);

        expect(key('Tab').defaultPrevented).toBe(false);

        plot().blur();
        expect(shown()).toBe(false);
        expect(context()).toEqual(MONTH);
    });

    it('quiets the context line\'s live region while the plot has focus, so a key reads each day once', () => {
        plot().focus();
        expect(hook('context').getAttribute('aria-live')).toBe('off');

        key('ArrowLeft');
        expect(hook('context').getAttribute('aria-live')).toBe('off');

        plot().blur();
        expect(hook('context').getAttribute('aria-live')).toBe('polite');
    });

    it('writes the day only when it changes, and leaves the month alone when nothing shows', () => {
        pointer('pointermove', 240);
        hook('caption').textContent = 'unchanged';

        pointer('pointermove', 250);
        expect(hook('caption').textContent).toBe('unchanged');

        pointer('pointerleave', 250);
        expect(context()).toEqual(MONTH);
        hook('caption').textContent = 'unchanged';

        key('Escape');
        key('Escape');
        expect(hook('caption').textContent).toBe('unchanged');
    });

    it('never touches the tabs: each keeps the month\'s figure and change while the days show', () => {
        const tabs = () => Array.from(document.querySelectorAll('.statistics-chart-tab'), (tab) => tab.outerHTML);
        const before = tabs();

        plot().focus();

        for (const step of ['ArrowLeft', 'ArrowLeft', 'End']) {
            key(step);
            expect(tabs(), step).toEqual(before);
        }

        pointer('pointermove', 240);
        expect(tabs()).toEqual(before);
        expect(figure().textContent).toBe('7');
    });

    it('marks a change of 0% flat, then up or down as the day moves on', () => {
        mount({changes: [0, -5, null]});

        pointer('pointermove', 100);
        expect(context().slice(2, 4)).toEqual(['0%', 'flat']);

        pointer('pointermove', 250);
        expect(context().slice(2, 4)).toEqual(['-5%', 'down']);

        pointer('pointermove', 100);
        expect(context().slice(2, 4)).toEqual(['0%', 'flat']);

        // Without a change the chip hides and loses its trend when the month comes back.
        pointer('pointerleave', 100);
        expect(hook('chip').hidden).toBe(true);
        expect(hook('chip').hasAttribute('data-trend')).toBe(false);
    });

    it('holds the context line at the month\'s height while a day shows', () => {
        Object.defineProperty(hook('context'), 'offsetHeight', {value: 85, configurable: true});

        pointer('pointermove', 240);
        expect(hook('context').style.minBlockSize).toBe('85px');

        pointer('pointermove', 100);
        expect(hook('context').style.minBlockSize).toBe('85px');

        pointer('pointerleave', 100);
        expect(hook('context').hasAttribute('style')).toBe(false);
    });

    it('restores the month on Escape, keeping the focus and the day', () => {
        plot().focus();
        key('ArrowLeft');

        key('Escape');
        expect(shown()).toBe(false);
        expect(context()).toEqual(MONTH);
        expect(document.activeElement).toBe(plot());
        expect(value()).toEqual(['2', DAYS[1]]);

        key('ArrowLeft');
        expect(shown()).toBe(true);
        expect(value()).toEqual(['1', DAYS[0]]);
    });

    it('leaves the keys to the browser while Alt, Ctrl or Meta is held', () => {
        plot().focus();

        for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
            expect(key('ArrowLeft', {[modifier]: true}).defaultPrevented, modifier).toBe(false);
            key('Escape', {[modifier]: true});
        }

        expect(shown()).toBe(true);
        expect(value()).toEqual(['3', DAYS[2]]);
    });

    it('shows the hovered day when the plot takes focus', () => {
        pointer('pointermove', 240);
        plot().focus();

        expect(context()[1]).toBe('Mon 2 Nov: 2');
        expect(value()).toEqual(['2', DAYS[1]]);
    });

    it('stays on its day when the plot has no width', () => {
        key('ArrowLeft');
        plot().getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

        pointer('pointermove', 240);
        expect(context()[1]).toBe('Mon 2 Nov: 2');
    });

    it('shows a lone day wherever the pointer is', () => {
        mount({points: [[50, 40]], days: [['', 'Sun 1 Nov, so far: 1']], labels: ['Sun 1 Nov, so far: 1'], changes: [null], 'previous-points': [[50, 60]], 'previous-labels': [['1 Oct: ', '2']]});

        expect(plot().getAttribute('aria-valuemax')).toBe('1');

        pointer('pointermove', 110);
        expect(context()).toEqual(['7', 'Sun 1 Nov, so far: 1', null, null, '1 Oct: 2', null]);
        expect(hook('dot').style.left).toBe('50%');

        key('ArrowRight');
        expect(value()).toEqual(['1', 'Sun 1 Nov, so far: 1, 1 Oct: 2']);
    });

    it('shows no previous dot, chip or previous figure without a previous month', () => {
        mount({changes: [null, null, null], 'previous-points': [], 'previous-labels': []});

        pointer('pointermove', 240);
        expect(shown()).toBe(true);
        expect(hook('previous-dot').hidden).toBe(true);
        expect(context()).toEqual(['7', 'Mon 2 Nov: 2', null, null, null, null]);

        pointer('pointerleave', 240);
        expect(context()).toEqual(MONTH);
    });

    it('shows a day without a value as a gap: the guide alone, and the day that says so without a value or a chip', () => {
        mount({
            points: [[0, 34.722], [50, null], [100, 79.306]],
            days: [['', 'Sun 1 Nov: 4'], ['', 'Mon 2 Nov', ', no paid views'], ['', 'Tue 3 Nov, so far: 1']],
            changes: [100, null, null],
            'previous-points': [[0, 64.444], [50, null], [100, 19.861]],
            'previous-labels': [['1 Oct: ', '2'], ['2 Oct: no paid views'], ['3 Oct: ', '5']],
        });

        pointer('pointermove', 240);
        expect(hook('guide').hidden).toBe(false);
        expect(hook('guide').style.left).toBe('50%');
        expect([hook('dot').hidden, hook('previous-dot').hidden]).toEqual([true, true]);
        expect(context()).toEqual(['7', 'Mon 2 Nov, no paid views', null, null, '2 Oct: no paid views', null]);
        // The day highlighted, never what says it has no value.
        expect(highlights()).toEqual([['Mon 2 Nov'], [], []]);
        expect(value()).toEqual(['2', 'Mon 2 Nov, no paid views, 2 Oct: no paid views']);

        pointer('pointermove', 100);
        expect([hook('dot').hidden, hook('previous-dot').hidden]).toEqual([false, false]);
        expect([hook('dot').style.left, hook('dot').style.top]).toEqual(['0%', '34.722%']);

        pointer('pointerleave', 100);
        expect(context()).toEqual(MONTH);
    });

    it('scrubs a plot outside a panel, which has no context line', () => {
        const lone = plot().cloneNode(true);

        document.body.replaceChildren(lone);
        measure(lone);
        statisticsChart(lone);

        pointer('pointermove', 250, 'mouse', lone);
        expect(lone.querySelector('[data-statistics-guide]').hidden).toBe(false);
        expect([lone.getAttribute('aria-valuenow'), lone.getAttribute('aria-valuetext')]).toEqual(['2', 'Mon 2 Nov: 2']);
    });

    it('leaves an empty plot static, and not a tab stop, until it gains points', () => {
        const empty = mount({points: []});

        expect(plot().hasAttribute('tabindex')).toBe(false);
        expect(plot().hasAttribute('role')).toBe(false);
        pointer('pointermove', 240);
        expect(shown()).toBe(false);
        expect(context()).toEqual(MONTH);

        empty.destroy();
        plot().setAttribute('data-statistics-points', '[[0,33.333],[50,66.667],[100,83.333]]');

        expect(statisticsChart(plot())).not.toBe(empty);
        expect(plot().getAttribute('role')).toBe('slider');
        pointer('pointermove', 240);
        expect(shown()).toBe(true);
    });

    it('leaves a plot static when its markup lacks the name or a label per day', () => {
        for (const data of [{labels: ['Sun 1 Nov: 4']}, {name: null}]) {
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

    it('destroy() takes away its listeners and everything it added, the context line as the page rendered it', () => {
        render();
        document.body.insertAdjacentHTML('beforeend', '<p id="elsewhere">Day by day</p>');

        const tab = figure().closest('.statistics-chart-tab');
        const attributes = () => [plot(), plot().querySelector('svg'), hook('guide'), hook('dot'), hook('previous-dot'), hook('context'), ...hook('context').querySelectorAll('*'), ...tab.querySelectorAll('*')]
            .map((element) => element.getAttributeNames().sort());
        const before = [attributes(), hook('context').innerHTML, tab.innerHTML];
        const instance = statisticsChart(plot());

        Object.defineProperty(hook('context'), 'offsetHeight', {value: 85, configurable: true});
        plot().focus();
        pointer('pointermove', 240);
        expect(hook('context').getAttribute('aria-live')).toBe('off');
        expect(hook('context').style.minBlockSize).toBe('85px');
        instance.destroy();
        expect(hook('context').getAttribute('aria-live')).toBe('polite');

        expect(shown()).toBe(false);
        expect([attributes(), hook('context').innerHTML, tab.innerHTML]).toEqual(before);

        pointer('pointermove', 240);
        plot().focus();
        expect(shown()).toBe(false);
        expect(context()).toEqual(MONTH);

        hook('guide').hidden = false;
        const blur = vi.spyOn(plot(), 'blur');

        pointer('pointerdown', 0, 'touch', document.getElementById('elsewhere'));
        expect(blur).not.toHaveBeenCalled();
        expect(hook('guide').hidden).toBe(false);

        hook('guide').hidden = true;
        const rebound = statisticsChart(plot());

        expect(rebound).not.toBe(instance);
        pointer('pointermove', 240);
        expect(shown()).toBe(true);
    });
});

describe('statisticsCharts()', () => {
    /** Two charts of three plots on the page, one in each of #first and #second, not yet bound. */
    function renderTwo() {
        document.body.innerHTML = `<section id="first">${markup}</section><section id="second">${markup}</section>`;
        plots().forEach(measure);
    }

    const sliders = () => plots().map((element) => element.getAttribute('role') === 'slider');

    beforeEach(() => {
        renderTwo();
    });

    it('binds every plot on the page and returns their handles in document order', () => {
        const charts = statisticsCharts();

        expect(charts).toHaveLength(6);
        expect(sliders()).toEqual(Array(6).fill(true));
        plots().forEach((element, at) => expect(statisticsChart(element)).toBe(charts[at]));
    });

    it('returns the same handles on a second call, binding nothing again', () => {
        const first = statisticsCharts();
        const adds = plots().map((element) => vi.spyOn(element, 'addEventListener'));
        const second = statisticsCharts();

        expect(second).toHaveLength(6);
        second.forEach((chart, at) => expect(chart).toBe(first[at]));
        adds.forEach((add) => expect(add).not.toHaveBeenCalled());
    });

    it('binds only the plots under the root it is given', () => {
        const charts = statisticsCharts(document.getElementById('second'));

        expect(charts).toHaveLength(3);
        expect(sliders()).toEqual([false, false, false, true, true, true]);
        expect(statisticsChart(plots()[3])).toBe(charts[0]);
    });

    it('returns handles whose destroy() unbinds each plot, so a later call binds them again', () => {
        const attributes = () => plots().map((element) => element.getAttributeNames().sort());
        const before = attributes();
        const charts = statisticsCharts();

        charts.forEach((chart) => chart.destroy());

        expect(attributes()).toEqual(before);
        pointer('pointermove', 240, 'mouse', plots()[3]);
        expect(document.querySelector('#second [data-statistics-guide]').hidden).toBe(true);

        const rebound = statisticsCharts();

        expect(sliders()).toEqual(Array(6).fill(true));
        rebound.forEach((chart, at) => expect(chart).not.toBe(charts[at]));
    });
});
