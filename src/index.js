/** The day each key steps to, from the slider's day. */
const KEYS = {
    ArrowLeft: (day) => day - 1,
    ArrowDown: (day) => day - 1,
    ArrowRight: (day) => day + 1,
    ArrowUp: (day) => day + 1,
    Home: () => 0,
    End: (_day, last) => last,
};

const PLOT = '[data-statistics-plot]';

/** The context line's parts the script switches to the day shown, each optional. */
const CONTEXT_PARTS = {
    caption: '[data-statistics-caption]',
    chip: '[data-statistics-chip]',
    previousDay: '[data-statistics-previous-day]',
    average: '[data-statistics-average]',
};

/** The parts the slider's value text reads, in order, while they show. */
const VALUE_TEXT_PARTS = ['caption', 'chip', 'previousDay'];

const TREND = 'data-trend';

const LIVE = 'aria-live';

const bound = new WeakMap();

export function statisticsCharts(root = document) {
    return Array.from(root.querySelectorAll(PLOT), (plot) => statisticsChart(plot));
}

/** Binds one plot, once: a second call returns its first handle. */
function statisticsChart(plot) {
    const existing = bound.get(plot);

    if (existing) {
        return existing;
    }

    const state = readPlot(plot);

    // Not kept, so a later call binds the plot once it has its data.
    if (state === null) {
        return {destroy() {}};
    }

    const handle = bind(state);

    bound.set(plot, handle);

    return handle;
}

function readPlot(plot) {
    const read = (name) => JSON.parse(plot.dataset[name] ?? '[]');
    const points = read('statisticsPoints');
    const labels = read('statisticsLabels');
    const guide = plot.querySelector('[data-statistics-guide]');
    const dot = plot.querySelector('[data-statistics-dot]');

    if (points.length === 0 || labels.length !== points.length || !plot.dataset.statisticsName || !guide || !dot) {
        return null;
    }

    const context = plot.closest('.statistics-chart-panel')?.querySelector('[data-statistics-context]');
    const last = points.length - 1;

    return {
        plot,
        points,
        labels,
        days: read('statisticsDays'),
        changes: read('statisticsChanges'),
        previous: read('statisticsPreviousPoints'),
        previousLabels: read('statisticsPreviousLabels'),
        guide,
        dot,
        previousDot: plot.querySelector('[data-statistics-previous-dot]'),
        context: context ? readContext(context) : null,
        svg: plot.querySelector('svg.statistics-chart-svg'),
        last,
        day: last,
    };
}

/** The context line's parts, and what each holds for the month, to restore when the guide hides. */
function readContext(element) {
    const found = Object.fromEntries(
        Object.entries(CONTEXT_PARTS).map(([name, selector]) => [name, element.querySelector(selector)]),
    );
    const month = Object.values(found).filter(Boolean).map((part) => ({
        element: part,
        // Nodes, not text, so the month's highlights come back.
        nodes: Array.from(part.childNodes),
        hidden: part.hidden,
        trend: part.getAttribute(TREND),
    }));

    return {...found, element, month, live: element.getAttribute(LIVE)};
}

function bind(state) {
    const {plot} = state;
    const abort = new AbortController();
    const options = {signal: abort.signal};
    const slider = {
        role: 'slider',
        tabindex: '0',
        'aria-label': plot.dataset.statisticsName,
        'aria-valuemin': '1',
        'aria-valuemax': String(state.points.length),
    };
    const follow = ({clientX}) => show(state, dayAt(state, clientX));

    assign(plot, slider);
    // The slider reads the summary as its description: the drawing would repeat it.
    state.svg?.setAttribute('aria-hidden', 'true');
    select(state, state.day);

    plot.addEventListener('pointermove', follow, options);
    plot.addEventListener('pointerdown', follow, options);

    // Only a mouse leave hides it: a finger always "leaves" as it lifts.
    plot.addEventListener('pointerleave', ({pointerType}) => {
        if (pointerType === 'mouse') {
            hide(state);
        }
    }, options);
    document.addEventListener('pointerdown', ({target}) => {
        if (!state.guide.hidden && !(target instanceof Node && plot.contains(target))) {
            plot.blur();
            hide(state);
        }
    }, options);

    // While focused, the slider's value text reads the context line, so the live region would say each day twice.
    plot.addEventListener('focus', () => {
        state.context?.element.setAttribute(LIVE, 'off');
        show(state, state.day);
    }, options);
    plot.addEventListener('blur', () => {
        hide(state);
        restoreLive(state);
    }, options);

    plot.addEventListener('keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        if (event.key === 'Escape') {
            hide(state);

            return;
        }

        const step = KEYS[event.key];

        if (step) {
            event.preventDefault();
            show(state, step(state.day, state.last));
        }
    }, options);

    return {
        destroy() {
            abort.abort();
            hide(state);
            restoreLive(state);

            for (const name of [...Object.keys(slider), ...Object.keys(value(state))]) {
                plot.removeAttribute(name);
            }

            for (const overlay of overlays(state)) {
                overlay.removeAttribute('style');
            }

            state.svg?.removeAttribute('aria-hidden');

            bound.delete(plot);
        },
    };
}

/** The slider's value: the day shown, or the one focus shows, read as the context line reads it then. */
function value({day, labels, context, guide}) {
    const parts = context && !guide.hidden
        ? VALUE_TEXT_PARTS.map((name) => context[name]).filter((part) => part && !part.hidden)
        : [];
    const text = parts.length > 0 ? parts.map((part) => part.textContent.trim()).join(', ') : labels[day];

    return {'aria-valuenow': String(day + 1), 'aria-valuetext': text};
}

function select(state, day) {
    state.day = day;
    assign(state.plot, value(state));
}

function assign(element, attributes) {
    for (const [name, text] of Object.entries(attributes)) {
        element.setAttribute(name, text);
    }
}

/** Sets the attribute, or removes it where the page had none. */
function restoreAttribute(element, name, text) {
    if (text === null) {
        element.removeAttribute(name);
    } else {
        element.setAttribute(name, text);
    }
}

function restoreLive({context}) {
    if (context) {
        restoreAttribute(context.element, LIVE, context.live);
    }
}

/** The guide and the dots the plot has. */
function overlays({guide, dot, previousDot}) {
    return [guide, dot, previousDot].filter(Boolean);
}

function show(state, index) {
    const {guide, context} = state;
    const day = Math.max(0, Math.min(state.last, index));

    // Every pointermove lands here: rewriting the same day would make the live region speak again.
    if (day === state.day && !guide.hidden) {
        return;
    }

    // Held at the month's height while a day shows, so a shorter day line never moves the plot.
    if (context && guide.hidden) {
        context.element.style.minBlockSize = `${context.element.offsetHeight}px`;
    }

    guide.style.left = `${state.points[day][0]}%`;
    guide.hidden = false;
    moveDot(state.dot, state.points[day]);
    moveDot(state.previousDot, state.previous[day]);

    if (context) {
        writeContext(state, day);
    }

    select(state, day);
}

function hide(state) {
    const {guide, context} = state;

    // The context line already reads the month whenever nothing shows.
    if (guide.hidden) {
        return;
    }

    for (const overlay of overlays(state)) {
        overlay.hidden = true;
    }

    if (!context) {
        return;
    }

    for (const {element, nodes, hidden, trend} of context.month) {
        element.replaceChildren(...nodes);
        element.hidden = hidden;
        restoreAttribute(element, TREND, trend);
    }

    context.element.style.removeProperty('min-block-size');

    if (context.element.getAttribute('style') === '') {
        context.element.removeAttribute('style');
    }
}

/** Puts the dot on the point, or hides it on a day without a value, a gap in the line. */
function moveDot(dot, point) {
    if (!dot) {
        return;
    }

    const [x, y] = point ?? [null, null];

    dot.hidden = y === null;

    if (y !== null) {
        dot.style.left = `${x}%`;
        dot.style.top = `${y}%`;
    }
}

/** The day as it reads: its name and value, its change on the previous month's day, and that day's figure. */
function writeContext(state, day) {
    const {caption, chip, previousDay, average} = state.context;
    const change = state.changes[day] ?? null;

    write(caption, state.days[day]);
    write(chip, change === null ? null : signed(change));
    write(previousDay, state.previousLabels[day]);
    write(average, null);

    if (chip && change !== null) {
        chip.setAttribute(TREND, trend(change));
    }
}

/**
 * Writes the words into the element as text, or hides it without any. Words are a string, or a line's parts, plain and
 * highlighted in turn from a plain one, each highlighted part in a <strong>.
 */
function write(element, words) {
    if (!element) {
        return;
    }

    const parts = [words ?? []].flat();

    element.replaceChildren(...parts.map((part, at) => (at % 2 === 1 ? highlight(element, part) : part)));
    element.hidden = words === null || words === undefined;
}

function highlight(element, text) {
    const strong = element.ownerDocument.createElement('strong');

    strong.textContent = text;

    return strong;
}

/** A change's data-trend, as LineChart::trend() sets a tab's chip: "flat" at 0%. */
function trend(change) {
    if (change === 0) {
        return 'flat';
    }

    return change < 0 ? 'down' : 'up';
}

/** A change as Month::signedChange() prints it: "+12%", "-19%", "0%". */
function signed(change) {
    return `${change > 0 ? '+' : ''}${change}%`;
}

/** The day whose point is nearest the pointer; the slider's own day when the plot has no width. */
function dayAt(state, clientX) {
    const {left, width} = state.plot.getBoundingClientRect();

    if (width <= 0) {
        return state.day;
    }

    const x = ((clientX - left) / width) * 100;
    const distance = (day) => Math.abs(state.points[day][0] - x);

    return state.points.reduce((nearest, _point, day) => (distance(day) < distance(nearest) ? day : nearest), 0);
}
