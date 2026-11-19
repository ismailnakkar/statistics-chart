const GAP = '0.75rem';
/** Below this x (percent of the plot's width) the tooltip starts at the point; above its mirror it ends there. */
const LEFT_EDGE = 20;
const RIGHT_EDGE = 80;
/** Below this y (percent from the top) the tooltip hangs under the point, else it sits above. */
const TOP_EDGE = 35;

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
    const points = JSON.parse(root.dataset.statisticsPoints ?? '[]');
    const values = JSON.parse(root.dataset.statisticsValues ?? '[]');
    const days = JSON.parse(root.dataset.statisticsDays ?? '[]');
    const labels = JSON.parse(root.dataset.statisticsLabels ?? '[]');
    const guide = root.querySelector('[data-statistics-guide]');
    const dot = root.querySelector('[data-statistics-dot]');
    const tip = root.querySelector('[data-statistics-tip]');
    const tipDay = tip?.querySelector('[data-statistics-tip-day]');
    const tipValue = tip?.querySelector('[data-statistics-tip-value]');
    const svg = root.querySelector('svg.statistics-chart-svg');

    if (points.length === 0 || labels.length !== points.length || !root.dataset.statisticsName || !guide || !dot || !tip || !tipDay || !tipValue) {
        return null;
    }

    const last = points.length - 1;

    return {root, points, values, days, labels, guide, dot, tip, tipDay, tipValue, svg, last, day: last};
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
        if (!state.tip.hidden && !(target instanceof Node && root.contains(target))) {
            root.blur();
            hide(state);
        }
    }, options);

    root.addEventListener('focus', () => show(state, state.day), options);
    root.addEventListener('blur', () => hide(state), options);

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

            for (const name of [...Object.keys(slider), ...Object.keys(value(state))]) {
                root.removeAttribute(name);
            }

            for (const overlay of [state.guide, state.dot, state.tip]) {
                overlay.removeAttribute('style');
            }

            state.svg?.removeAttribute('aria-hidden');

            bound.delete(root);
        },
    };
}

/** The slider's value: the day shown, or the one focus shows. */
function value({day, labels}) {
    return {'aria-valuenow': String(day + 1), 'aria-valuetext': labels[day]};
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
    const {guide, dot, tip} = state;
    const day = Math.max(0, Math.min(state.last, index));
    const [x, y] = state.points[day];

    select(state, day);

    state.tipDay.textContent = state.days[day];
    state.tipValue.textContent = state.values[day];
    guide.style.left = dot.style.left = tip.style.left = `${x}%`;
    dot.style.top = tip.style.top = `${y}%`;
    tip.style.translate = placement(x, y);
    guide.hidden = dot.hidden = tip.hidden = false;
}

function hide(state) {
    state.guide.hidden = state.dot.hidden = state.tip.hidden = true;
}

/** The tooltip's translate from its point: inside the plot at either end, under a point near the top. */
function placement(x, y) {
    const down = y < TOP_EDGE ? GAP : `calc(-100% - ${GAP})`;

    if (x < LEFT_EDGE) {
        return `0 ${down}`;
    }

    if (x > RIGHT_EDGE) {
        return `-100% ${down}`;
    }

    return `-50% ${down}`;
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
