import { transitionMath, createAnimationHelperFromContainer } from "./mathjax-morph.js";

// Test code

let resolveFirst = undefined;
const firstProm = new Promise(resolve => resolveFirst = resolve);

let resolveSecond = undefined;
const secondProm = new Promise(resolve => resolveSecond = resolve);

const mut = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.target === document.head) continue;
        for (const addedNode of mutation.addedNodes) {
            if (addedNode.tagName !== 'MJX-CONTAINER') continue;

            if (addedNode.parentElement.id === 'first') resolveFirst(addedNode);
            if (addedNode.parentElement.id === 'second') resolveSecond(addedNode);
        }
    }
});
mut.observe(document.getRootNode(), { subtree: true, childList: true });

(async () => {

    // https://dr-nick-nagel.github.io/blog/svg-transform-matrix.html
    // https://www.w3.org/TR/SVG2/coords.html#TermViewportCoordinateSystem

    /** @type {HTMLElement} */
    const first = await firstProm;

    /** @type {HTMLElement} */
    const second = await secondProm;

    first.parentElement.style.pointerEvents = 'none';
    second.parentElement.style.pointerEvents = 'none';

    const div = first.parentElement.parentElement;
    const rect = second.parentElement.getBoundingClientRect();
    div.style.width = `${rect.width}px`;
    div.style.height = `${rect.height}px`;
    div.style.transition = 'width 1.5s, height 1.5s';
    first.classList.add('math-hidden');
    second.classList.add('math-hidden');

    /** @type {HTMLButtonElement} */
    const goButton = document.getElementById('go-button');

    const dir0 = () => {
        transitionMath(null, first);
        goButton.onclick = dir1;
    };

    const dir1 = () => {
        transitionMath(first, second);
        goButton.onclick = dir2;
    };

    const dir2 = () => {
        transitionMath(second, first);
        goButton.onclick = dir3;
    };
    
    const dir3 = () => {
        transitionMath(first, null);
        goButton.onclick = dir0;
    }

    goButton.onclick = dir0;

    goButton.disabled = false;
})();

const anim = createAnimationHelperFromContainer(document.querySelector('#cool-math'));
/** @type {HTMLButtonElement} */
const btn = document.querySelector('#go-button2');
let forward = true;
btn.onclick = () => {
    if (forward) {
        if (!anim.next()) forward = false;
    } else {
        if (!anim.previous()) forward = true;
    }
}
btn.disabled = false;
