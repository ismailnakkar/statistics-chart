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
const CONTEXT = {
    caption: '[data-statistics-caption]',
    chip: '[data-statistics-chip]',
    previousDay: '[data-statistics-previous-day]',
    average: '[data-statistics-average]',
};

/** The context line's parts the slider's value text reads, in order, while they show. */
const READ = ['caption', 'chip', 'previousDay'];

const TREND = 'data-trend';

const LIVE = 'aria-live';

const bound = new WeakMap();

export function statisticsCharts(root = document) {
    return Array.from(root.querySelectorAll(PLOT), (plot) => statisticsChart(plot));
}

export function statisticsChart(plot) {
    const existing = bound.get(plot);

    if (existing) {
        return existing;
    }

    const state = resolve(plot);

    // Not kept, so a later call binds the plot once it has points.
    if (state === null) {
        return {destroy() {}};
    }

    const instance = listen(state);

    bound.set(plot, instance);

    return instance;
}

function resolve(root) {
    const read = (name) => JSON.parse(root.dataset[name] ?? '[]');
    const points = read('statisticsPoints');
    const labels = read('statisticsLabels');
    const guide = root.querySelector('[data-statistics-guide]');
    const dot = root.querySelector('[data-statistics-dot]');

    if (points.length === 0 || labels.length !== points.length || !root.dataset.statisticsName || !guide || !dot) {
        return null;
    }

    const panel = root.closest('.statistics-chart-panel');
    const context = panel?.querySelector('[data-statistics-context]');
    const last = points.length - 1;

    return {
        root,
        points,
        labels,
        days: read('statisticsDays'),
        changes: read('statisticsChanges'),
        previous: read('statisticsPreviousPoints'),
        previousLabels: read('statisticsPreviousLabels'),
        guide,
        dot,
        previousDot: root.querySelector('[data-statistics-previous-dot]'),
        context: context ? {...parts(context), element: context, live: context.getAttribute(LIVE)} : null,
        svg: root.querySelector('svg.statistics-chart-svg'),
        last,
        day: last,
    };
}

/** The context line's parts, and what each holds for the month, to restore when the guide hides. */
function parts(context) {
    const found = Object.fromEntries(Object.entries(CONTEXT).map(([name, selector]) => [name, context.querySelector(selector)]));
    const month = Object.values(found).filter(Boolean).map((element) => ({
        element,
        // Its text and its highlights, as the page rendered them.
        nodes: Array.from(element.childNodes),
        hidden: element.hidden,
        trend: element.getAttribute(TREND),
    }));

    return {...found, month};
}

function listen(state) {
    const {root} = state;
    const abort = new AbortController();
    const options = {signal: abort.signal};
    const slider = {
        role: 'slider',
        tabindex: '0',
        'aria-label': root.dataset.statisticsName,
        'aria-valuemin': '1',
        'aria-valuemax': String(state.points.length),
    };

    assign(root, slider);
    // A slider's children are its own: the drawing would repeat the summary the slider reads as its description.
    state.svg?.setAttribute('aria-hidden', 'true');
    select(state, state.day);

    root.addEventListener('pointermove', ({clientX}) => show(state, dayAt(state, clientX)), options);
    root.addEventListener('pointerdown', ({clientX}) => show(state, dayAt(state, clientX)), options);

    // Only a mouse leave hides it: a finger always "leaves" as it lifts.
    root.addEventListener('pointerleave', ({pointerType}) => {
        if (pointerType === 'mouse') {
            hide(state);
        }
    }, options);
    document.addEventListener('pointerdown', ({target}) => {
        if (!state.guide.hidden && !(target instanceof Node && root.contains(target))) {
            root.blur();
            hide(state);
        }
    }, options);

    // While focused, the slider's value text reads the context line, so the live region would say each day twice.
    root.addEventListener('focus', () => {
        state.context?.element.setAttribute(LIVE, 'off');
        show(state, state.day);
    }, options);
    root.addEventListener('blur', () => {
        hide(state);
        restoreLive(state);
    }, options);

    root.addEventListener('keydown', (event) => {
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
                root.removeAttribute(name);
            }

            for (const overlay of [state.guide, state.dot, state.previousDot]) {
                overlay?.removeAttribute('style');
            }

            state.svg?.removeAttribute('aria-hidden');

            bound.delete(root);
        },
    };
}

/** The slider's value: the day shown, or the one focus shows, read as the context line reads it then. */
function value({day, labels, context, guide}) {
    const parts = context && !guide.hidden ? READ.map((name) => context[name]).filter((part) => part && !part.hidden) : [];
    const text = parts.length > 0 ? parts.map((part) => part.textContent.trim()).join(', ') : labels[day];

    return {'aria-valuenow': String(day + 1), 'aria-valuetext': text};
}

function restoreLive({context}) {
    if (context) {
        context.live === null ? context.element.removeAttribute(LIVE) : context.element.setAttribute(LIVE, context.live);
    }
}

function select(state, day) {
    state.day = day;
    assign(state.root, value(state));
}

function assign(element, attributes) {
    for (const [name, text] of Object.entries(attributes)) {
        element.setAttribute(name, text);
    }
}

function show(state, index) {
    const {guide, dot, previousDot, context} = state;
    const day = Math.max(0, Math.min(state.last, index));

    // Every pointermove lands here: rewriting the same day would make the live region speak again.
    if (day === state.day && !guide.hidden) {
        return;
    }

    const [x, y] = state.points[day];
    const before = state.previous[day];

    // Held at the month's height while a day shows, so a shorter day line never moves the plot.
    if (context && guide.hidden) {
        context.element.style.minBlockSize = `${context.element.offsetHeight}px`;
    }

    guide.style.left = `${x}%`;
    guide.hidden = false;
    // A day without a value is a gap in the line: no dot on it.
    mark(dot, x, y);
    mark(previousDot, ...(before ?? [x, null]));

    if (context) {
        scrub(state, day);
    }

    select(state, day);
}

function hide(state) {
    // The context line already reads the month whenever nothing shows.
    if (state.guide.hidden) {
        return;
    }

    for (const overlay of [state.guide, state.dot, state.previousDot]) {
        if (overlay) {
            overlay.hidden = true;
        }
    }

    for (const {element, nodes, hidden, trend} of state.context?.month ?? []) {
        element.replaceChildren(...nodes);
        element.hidden = hidden;
        trend === null ? element.removeAttribute(TREND) : element.setAttribute(TREND, trend);
    }

    if (state.context) {
        const {element} = state.context;

        element.style.removeProperty('min-block-size');

        if (element.getAttribute('style') === '') {
            element.removeAttribute('style');
        }
    }
}

/** Shows the dot at the point, or hides it where the day has no value. */
function mark(element, x, y) {
    if (!element) {
        return;
    }

    element.hidden = y === null;

    if (y !== null) {
        place(element, x, y);
    }
}

function place(element, x, y) {
    element.style.left = `${x}%`;
    element.style.top = `${y}%`;
}

/** The day as it reads: its name and value, its change on the previous month's day, and that day's figure. */
function scrub(state, day) {
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
 * Shows the words in the element, or hides the element without any: a string, or the parts of a line, plain and
 * highlighted in turn from a plain one, each highlighted part in a <strong>.
 */
function write(element, words) {
    if (!element) {
        return;
    }

    element.replaceChildren(...[words ?? []].flat().map((part, at) => (at % 2 === 1 ? highlight(element, part) : part)));
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
    const {left, width} = state.root.getBoundingClientRect();

    if (width <= 0) {
        return state.day;
    }

    const x = ((clientX - left) / width) * 100;
    const distance = (day) => Math.abs(state.points[day][0] - x);

    return state.points.reduce((nearest, _point, day) => (distance(day) < distance(nearest) ? day : nearest), 0);
}
