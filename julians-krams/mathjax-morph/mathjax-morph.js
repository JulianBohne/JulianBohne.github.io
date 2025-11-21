
// Styles
const styleElem = document.createElement('style');
const hiddenClass = 'math-hidden';
const visibleClass = 'math-visible';
const mathContainerClass = 'math-container';
const mathInlineContainerClass = 'math-inline-container';
const mathElementClass = 'math-element';
styleElem.textContent = `
.${hiddenClass} {
    visibility: hidden;
}

.${visibleClass} {
    visibility: visible;
}

.${mathContainerClass}, .${mathInlineContainerClass} {
    position: relative;
}

.${mathContainerClass} {
    display: block;
}

.${mathInlineContainerClass} {
    display: inline-block;
    vertical-align: top;
}

.${mathElementClass} {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
}
`;
document.head.appendChild(styleElem);

// Animation handle stuff
/**
 * @typedef {string} AnimHandle
 * @typedef {{ handle: AnimHandle, cancel: () => void }} MorphAnim
 */

/**
 * @type {{
 *     registerAnimation: (anim: { cancel: () => void }) => ({ handle: AnimHandle, onfinish: () => void }),
 *     cancelAnimation: (handle: AnimHandle) => void,
 * }}
 */
const { registerAnimation, cancelAnimation } = (() => {
    let currentHandle = 1;
    /** @type {Map<AnimHandle, MorphAnim>} */
    let animationMap = new Map();

    return {
        registerAnimation: ({ cancel }) => {
            const handle = (currentHandle++).toString();
            /** @type {MorphAnim} */
            const anim = {
                cancel,
                handle,
            };
            animationMap.set(anim.handle, anim);
            return {
                handle,
                onfinish: () => animationMap.delete(handle),
            };
        },
        cancelAnimation: handle => {
            if (animationMap.has(handle)) {
                animationMap.get(handle).cancel();
                animationMap.delete(handle);
            }
        },
    };
})();

// Utilities

/**
 * @param {SVGElement} e 
 */
function cancelAnimationsRecursive(e) {
    const anims = e.getAnimations();
    for (const anim of anims) {
        anim.cancel();
    }
    for (const c of e.children) cancelAnimationsRecursive(c);
}

/**
 * @param {SVGElement} e
 */
function removeVisibilityClassesRecursive(e) {
    e.classList.remove(hiddenClass);
    e.classList.remove(visibleClass);
    for (const c of e.children) removeVisibilityClassesRecursive(c);
}

/**
 * @param {SVGElement} g
 * @param {string[]} arr
 * @param {boolean} isFrom
 * @returns {string[]}
 */
function preOrderMMLNodes(g, arr, isFrom) {
    if (g.dataset.marker) arr.push(`marker(${g.dataset.marker})`);
    if (isFrom && g.dataset.markerFrom) {
        arr.push(`marker(${g.dataset.markerFrom})`);
    }
    if (!isFrom && g.dataset.markerTo) {
        arr.push(`marker(${g.dataset.markerTo})`);
    }
    if (g instanceof SVGGElement) {
        arr.push(g.dataset.mmlNode);
        arr.push('>');
        for (const c of g.children) {
            const childTransform = c.getAttribute('transform');
            if (childTransform) arr.push(`transform(${childTransform})`);
            preOrderMMLNodes(c, arr, isFrom);
        }
        arr.push('<');
    } else if (g instanceof SVGUseElement) {
        arr.push(g.getAttribute('xlink:href'));
    }
    return arr;
}

/**
 * @typedef {{
 *     key: string,
 *     element: SVGElement,
 *     children: MNode[],
 *     mark: string | undefined,
 *     parent: MNode | null,
 *     preOrderIndex: number,
 *     descendantCount: number,
 * }} MNode
 * @typedef {{ root: MNode, mapping: Map<string, MNode[]>, mathNodesOrderedByDescendentCountDescending: MNode[] }} AST
 */

/**
 * @param {SVGElement} svg
 * @param {boolean} isFrom
 * @returns {AST}
 */
function createAST(svg, isFrom) {
    
    let preOrderIndex = 0;

    /** @type {MNode[]} */
    let allMathNodes = [];

    /**
     * @param {SVGElement} g
     * @param {Map<string,MNode[]>} map
     * @param {MNode | null} parent
     * @returns {MNode}
     */
    function createASTInternal(g, map, parent) {
        if (!(g instanceof SVGGElement) && !(g instanceof SVGSVGElement)) return { 
            key: '',
            element: g,
            children: [],
            mark: undefined,
            parent: parent,
            preOrderIndex: preOrderIndex++,
            descendantCount: 0,
        };

        const key = g.dataset.latex + preOrderMMLNodes(g, [], isFrom).join('');

        /** @type {MNode} */
        const mnode = {
            key: key,
            element: g,
            children: [],
            mark: undefined,
            parent: parent,
            preOrderIndex: preOrderIndex++,
            descendantCount: 0,
        };

        allMathNodes.push(mnode);

        if (map.has(key)) {
            map.get(key).push(mnode);
        } else {
            map.set(key, [mnode]);
        }

        for (const c of g.children) {
            const cAST = createASTInternal(c, map, mnode);
            if (cAST) {
                mnode.descendantCount += 1 + cAST.descendantCount;
                mnode.children.push(cAST);
            }
        }

        return mnode.descendantCount === 0 ? null : mnode;
    }

    /** @type {SVGGElement} */
    const rootG = svg.firstChild.firstChild;

    const map = new Map();

    const rootNode = createASTInternal(rootG, map, null);

    allMathNodes.sort((a, b) => b.descendantCount - a.descendantCount);

    return { root: rootNode, mapping: map, mathNodesOrderedByDescendentCountDescending: allMathNodes };
}

/**
 * @param {MNode} node 
 * @param {string} mark 
 */
function markSubtree(node, mark) {
    node.mark = mark;
    for (const c of node.children) markSubtree(c, mark);
}

/**
 * @param {AST} tree
 * @returns {SVGElement[]}
 */
function getUnmarkedLeafNodes(tree) {
    const unmarked = [];
    /**
     * @param {MNode} node 
     */
    function getUnmarkedLeafNodesInternal(node) {
        if (node.children.length === 0 && !node.mark) {
            unmarked.push(node.element);
        } else {
            for (const c of node.children) getUnmarkedLeafNodesInternal(c);
        }
    }
    getUnmarkedLeafNodesInternal(tree.root);
    return unmarked;
}

/**
 * @param {SVGUseElement | SVGRectElement} elem 
 * @param {{ delay: number, duration: number, strokeWidth: string }}
 */
function animateIn(elem, { delay, duration, strokeWidth}) {
    let pathLen = 1;
    if (elem instanceof SVGUseElement) {
        const href = elem.getAttribute('xlink:href');
        /**
         * @type {SVGPathElement}
         */
        const path = document.querySelector(href);
        pathLen = path.getTotalLength();
    } else {
        pathLen = elem.getTotalLength();
    }

    elem.animate([
        { strokeDasharray: `${pathLen} ${pathLen}`, strokeWidth: strokeWidth || '1dvw', strokeDashoffset: pathLen, fill: '#0000' },
        { strokeDashoffset: 0, fill: '#0000' },
        { strokeDasharray: `${pathLen} ${pathLen}`, strokeWidth: strokeWidth || '1dvw', strokeDashoffset: 0, stroke: '#0000' }
    ], {
        duration: duration,
        easing: 'ease-out',
        delay: delay,
        fill: 'backwards'
    });
}

/**
 * @param {SVGUseElement | SVGRectElement} elem 
 * @param {{ delay: number, duration: number, strokeWidth: string }}
 */
function animateOut(elem, { delay, duration, strokeWidth }) {
    let pathLen = 1;
    if (elem instanceof SVGUseElement) {
        const href = elem.getAttribute('xlink:href');
        /**
         * @type {SVGPathElement}
         */
        const path = document.querySelector(href);
        pathLen = path.getTotalLength();
    } else {
        pathLen = elem.getTotalLength();
    }

    elem.animate([
        { strokeWidth: strokeWidth || '1dvw', strokeDasharray: `${pathLen} ${pathLen}`, strokeDashoffset: 0, stroke: '#0000' },
        { strokeDashoffset: 0, fill: '#0000' },
        { strokeWidth: strokeWidth || '1dvw', strokeDasharray: `${pathLen} ${pathLen}`, strokeDashoffset: pathLen, fill: '#0000' },
    ], {
        duration: duration,
        easing: 'ease-out',
        delay: delay,
        fill: 'backwards',
    }).onfinish = () => elem.classList.add(hiddenClass);
}

/**
 * @param {AST} treeFrom
 * @param {AST} treeTo
 * @returns {{ from: SVGElement, to: SVGElement }[]}
 */
function getCorrespondingNodes(treeFrom, treeTo) {
    /** @type {{ from: MNode, to: MNode }[]} */
    const animateFromTo = [];

    for (const node of treeTo.mathNodesOrderedByDescendentCountDescending) {
        if (node.mark) continue;
        let correspondingNode = null;
        if (treeFrom.mapping.has(node.key)) {
            for (const n of treeFrom.mapping.get(node.key)) {
                if (!n.mark) {
                    correspondingNode = n;
                    markSubtree(n, 'used');
                    let np = n.parent;
                    while (np) {
                        np.mark = 'locked';
                        np = np.parent;
                    }
                    break;
                }
            }
        }
        if (correspondingNode) {
            markSubtree(node, 'found');
            animateFromTo.push({
                from: correspondingNode,
                to: node,
            });
        }
    }

    const animateFromToElements = animateFromTo
        .sort((a, b) => a.from.preOrderIndex - b.from.preOrderIndex)
        .map(pair => ({ from: pair.from.element, to: pair.to.element }));
    
    return animateFromToElements;
}

/**
 * 
 * @param {SVGElement} elem 
 * @param {(elem: SVGElement) => void} func 
 */
function forEachLeaf(elem, func) {
    if (elem.children.length !== 0) {
        for (const child of elem.children) {
            forEachLeaf(child, func);
        }
    } else {
        func(elem);
    }
}

/**
 * @param {{ from: SVGGElement, to: SVGGElement }}
 * @param {{ delay: number, duration: number, ignoreSmallTransform: boolean }}
 */
function animateFromTo({ from, to }, { delay, duration, ignoreSmallTransform }) {

    /** @type {SVGMatrix} */
    const fromParCTMS = from.getScreenCTM();
    
    /** @type {SVGMatrix} */
    const toParCTMS = to.getScreenCTM();
    
    const mat = fromParCTMS.inverse().multiply(toParCTMS);

    const pxBaseTransform = (from.getAttribute('transform') || '').replace(/translate\(\s*([\d\.-]*)\s*,\s*([\d\.-]*)\s*\)/, 'translate($1px,$2px)');
    
    const scaleEpsilon = 0.01;
    const translateEpsilon = 1;
    const smallTransform = ignoreSmallTransform && Math.abs(mat.e) < translateEpsilon && Math.abs(mat.f) < translateEpsilon && Math.abs(mat.a - 1) < scaleEpsilon && Math.abs(mat.d - 1) < scaleEpsilon;

    if (!smallTransform) {
        from.animate([
            { easing: 'ease-in-out' },
            { easing: 'ease-in-out', transform: `${pxBaseTransform} translate(${mat.e}px, ${mat.f}px) scale(${mat.a}, ${mat.d})` },
            { easing: 'ease-in-out', transform: `${pxBaseTransform} translate(${mat.e}px, ${mat.f}px) scale(${mat.a}, ${mat.d})` },
            { easing: 'ease-in-out', transform: `${pxBaseTransform} translate(${mat.e}px, ${mat.f}px) scale(${mat.a}, ${mat.d})` },
        ], {
            duration: duration,
            delay: delay,
            fill: 'backwards',
        });
    }

    const fromKeyframes = [
        { },
        { fill: '#0000', stroke: '#0000' },
    ];
    const fromOptions = {
        duration: duration / 3,
        easing: 'linear',
        delay: delay + 2 * duration / 3,
        fill: 'backwards',
    };
    forEachLeaf(from, elem => elem.animate(fromKeyframes, fromOptions).onfinish = () => from.classList.add(hiddenClass));

    const toKeyframes = [
        { fill: '#0000', stroke: '#0000' },
        { },
    ];
    const toOptions = {
        duration: duration / 3,
        easing: 'linear',
        delay: delay + duration / 3,
        fill: 'backwards',
    };
    forEachLeaf(to, elem => elem.animate(toKeyframes, toOptions));

    return !smallTransform;
}

/**
 * @param  {...any} args 
 * @returns {number | undefined}
 */
function firstNumber(...args) {
    for (const arg of args) {
        if (!Number.isNaN(Number.parseFloat(arg))) return Number.parseFloat(arg);
    }
    return undefined;
}

/**
 * @typedef {{
 *     duration?: number,
 *     durationIn?: number,
 *     durationFromTo?: number,
 *     durationOut?: number,
 *     stagger?: number,
 *     staggerIn?: number,
 *     staggerFromTo?: number,
 *     staggerOut?: number,
 *     strokeWidth?: string,
 *     baseDelay?: number,
 * }} MathTransitionOptions
 */

/**
 * @param {HTMLElement | null} from The <mjx-container> to morph (or null if the `to` element should just appear)
 * @param {HTMLElement | null} to   The target <mjx-container> to morph to (or null if the `from` element should just vanish)
 * @param {MathTransitionOptions | { onfinish?: () => void, oncancel?: () => void } | undefined} options
 * @returns {() => void} cancel function
 */
export function transitionMath(fromContainer, toContainer, options) {

    const from = fromContainer && (fromContainer.tagName === 'MJX-CONTAINER' ? fromContainer : fromContainer.querySelector('mjx-container'));
    const to = toContainer && (toContainer.tagName === 'MJX-CONTAINER' ? toContainer : toContainer.querySelector('mjx-container'));

    if (!from && !to) {
        console.warn('Neither `from` nor `to` mjx-containers found...');
        return;
    }

    const baseDelay = firstNumber(options?.baseDelay, 0);
    const duration = firstNumber(options?.duration, 1500);
    const durationIn = firstNumber(options?.durationIn, duration);
    const durationFromTo = firstNumber(options?.durationFromTo, duration);
    const durationOut = firstNumber(options?.durationOut, duration);
    const stagger = options?.stagger;
    const staggerIn = firstNumber(options?.staggerIn, stagger, 50);
    const staggerFromTo = firstNumber(options?.staggerFromTo, stagger, 25);
    const staggerOut = firstNumber(options?.staggerOut, stagger, 50);
    const strokeWidth = options?.strokeWidth;
    const oncancel = options?.oncancel;
    const onfinish = options?.onfinish;

    let fromTree = null;
    let toTree = null;

    if (from) {
        const fromSVGs = from.querySelectorAll('svg');
        if (fromSVGs.length > 1) {
            // console.warn('Multiple SVGs not supported yet. Try forcing MathJax to use a single SVG by enclosing the entire equation in curly braces: ${...}$.');
        } else if (fromSVGs.length === 0) {
            throw new TypeError('No SVG elements found in <mjx-container> element. Make sure MathJax is setup to use SVGs.');
        }

        if (from.dataset.animationHandle) cancelAnimation(from.dataset.animationHandle);
        removeVisibilityClassesRecursive(fromContainer);
        fromContainer.classList.add(visibleClass);
        from.classList.add(visibleClass);

        fromTree = createAST(fromSVGs[0], true);
    }

    if (to) {
        const toSVGs = to.querySelectorAll('svg');
        if (toSVGs.length > 1) {
            // console.warn('Multiple SVGs not supported yet. Try forcing MathJax to use a single SVG by enclosing the entire equation in curly braces: ${...}$.');
        } else if (toSVGs.length === 0) {
            throw new TypeError('No SVG elements found in <mjx-container> element. Make sure MathJax is setup to use SVGs.');
        }

        if (to.dataset.animationHandle) cancelAnimation(to.dataset.animationHandle);
        removeVisibilityClassesRecursive(toContainer);
        toContainer.classList.add(visibleClass);
        to.classList.add(visibleClass);

        toTree = createAST(toSVGs[0], false);
    }

    const animateFromToElems = (fromTree && toTree) ? getCorrespondingNodes(fromTree, toTree) : [];
    const animateOutElems = fromTree ? getUnmarkedLeafNodes(fromTree) : [];
    const animateInElems = toTree ? getUnmarkedLeafNodes(toTree) : [];

    const animOptions = {
        delay: baseDelay-staggerOut,
        duration: duration,
        strokeWidth: strokeWidth,
        ignoreSmallTransform: true,
    };

    animOptions.duration = durationIn;
    for (const animOutElem of animateOutElems) {
        animOptions.delay += staggerOut;
        animateOut(animOutElem, animOptions);
    }

    animOptions.duration = durationFromTo;
    for (const corresponding of animateFromToElems) {
        animOptions.delay += staggerFromTo;
        if (!animateFromTo(corresponding, animOptions)) {
            animOptions.delay -= staggerFromTo;
        }
    }
    
    animOptions.duration = durationOut;
    for (const animInElem of animateInElems) {
        animOptions.delay += staggerIn;
        animateIn(animInElem, animOptions);
    }

    // Handle animation cancels and finishing with proper cleanup

    const entireDuration = animOptions.duration + animOptions.delay;

    let fromCancelled = from ? false : true;
    let toCancelled = to ? false : true;

    let done = false;
    let cancelled = false;
    
    const cancelFunc = () => {
        if (done) return;
        cancelled = true;
        if (oncancel) oncancel();
    };

    const finishFunc = () => {
        if (cancelled) return;
        done = true;
        if (from && !fromCancelled) {
            if (from.dataset.animationHandle === fromReg.handle) {
                delete from.dataset.animationHandle;
                removeVisibilityClassesRecursive(fromContainer);
                fromContainer.classList.add(hiddenClass);
            }
            if (fromReg) fromReg.onfinish();
        }
        if (to && !toCancelled) {
            if (to.dataset.animationHandle === toReg.handle) {
                delete to.dataset.animationHandle;
                removeVisibilityClassesRecursive(toContainer);
                toContainer.classList.add(visibleClass);
                to.classList.add(visibleClass);
            }
            if (toReg) toReg.onfinish();
        }
        if (onfinish) onfinish();
    };

    let fromReg = undefined;

    if (from) {
        const fromCancelFunc = () => {
            if (fromCancelled) return;
            fromCancelled = true;
            if (from.dataset.animationHandle === fromReg.handle) {
                delete from.dataset.animationHandle;
                for (const c of from.children) {
                    cancelAnimationsRecursive(c);
                }
                removeVisibilityClassesRecursive(fromContainer);
                fromContainer.classList.add(visibleClass);
                from.classList.add(visibleClass);
            }
            if (toCancelled) cancelFunc();
        };
        fromReg = registerAnimation({ cancel: fromCancelFunc });
        from.dataset.animationHandle = fromReg.handle;
        const fromAnim = from.animate({}, { duration: entireDuration });
        fromAnim.oncancel = () => cancelAnimation(fromReg.handle);
        fromAnim.onfinish = finishFunc;
    }

    let toReg = undefined;

    if (to) {
        const toCancelFunc = () => {
            if (toCancelled) return;
            toCancelled = true;
            if (to.dataset.animationHandle === toReg.handle) {
                delete to.dataset.animationHandle;
                for (const c of to.children) {
                    cancelAnimationsRecursive(c);
                }
                removeVisibilityClassesRecursive(toContainer);
                toContainer.classList.add(hiddenClass);
            }
            if (fromCancelled) cancelFunc();
        };
        toReg = registerAnimation({ cancel: toCancelFunc });
        to.dataset.animationHandle = toReg.handle;
        const toAnim = to.animate({}, { duration: entireDuration });
        toAnim.oncancel = () => cancelAnimation(toReg.handle);
        toAnim.onfinish = finishFunc;
    }  

    const completeCancelFunc = () => {
        if (fromReg) cancelAnimation(fromReg.handle);
        if (toReg) cancelAnimation(toReg.handle);
    };

    return completeCancelFunc;
}

/**
 * @param {HTMLElement} container
 * @param {MathTransitionOptions | { startIndex: number } | undefined} options
 * @returns {{ showAtIndex(index: number): void, equationCount: number, next(): boolean, previous(): boolean }} 
 */
export function createAnimationHelperFromContainer(container, options) {
    const baseDuration = firstNumber(
        container.dataset.mathDuration,
        options?.duration
    );
    const baseDurationIn = firstNumber(
        container.dataset.mathDurationIn,
        options?.durationIn,
        baseDuration,
    );
    const baseDurationFromTo = firstNumber(
        container.dataset.mathDurationFromTo,
        options?.durationFromTo,
        baseDuration,
    );
    const baseDurationOut = firstNumber(
        container.dataset.mathDurationOut,
        options?.durationOut,
        baseDuration,
    );

    const baseStagger = firstNumber(
        container.dataset.mathStagger,
        options?.stagger
    );
    const baseStaggerIn = firstNumber(
        container.dataset.mathStaggerIn,
        options?.staggerIn,
        baseStagger,
    );
    const baseStaggerFromTo = firstNumber(
        container.dataset.mathStaggerFromTo,
        options?.staggerFromTo,
        baseStagger,
    );
    const baseStaggerOut = firstNumber(
        container.dataset.mathStaggerOut,
        options?.staggerOut,
        baseStagger,
    );
    const baseStrokeWidth = container.dataset.mathStrokeWidth || options?.strokeWidth;
    
    const startIndex = firstNumber(
        container.dataset.mathStartIndex,
        options?.startIndex,
        0
    );

    let currentIndex = startIndex;

    if (!container.classList.contains(mathContainerClass) && !container.classList.contains(mathInlineContainerClass)) {
        container.classList.add(mathContainerClass);
    }

    /**
     * @param {number} index 
     * @returns {boolean}
     */
    const inRange = index => index >= 0 && index < container.children.length;

    /**
     * @param {number} index
     * @returns {HTMLElement | null}
     */
    const getMathElementAtIndex = index => {
        if (!inRange(index)) return null;
        return container.children[index];
    }

    const startElem = getMathElementAtIndex(startIndex);
    if (!startElem) {
        container.style.width = '0';
        container.style.height = '0';
    } else {
        const setupWidthAndHeight = () => {
            container.style.width = `${startElem.offsetWidth}px`;
            container.style.height = `${startElem.offsetHeight}px`;
        };
        if (startElem.querySelector('mjx-container')) {
            setupWidthAndHeight();
        } else {
            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.target === document.head) continue;
                    for (const addedNode of mutation.addedNodes) {
                        if (addedNode.tagName === 'MJX-CONTAINER') {
                            setupWidthAndHeight();
                            observer.disconnect();
                            return;
                        }
                    }
                }
            });
            observer.observe(startElem, { subtree: true, childList: true });
        }
    }

    for (const c of container.children) {
        c.classList.add(mathElementClass);
        c.classList.add(hiddenClass);
    }
    getMathElementAtIndex(currentIndex)?.classList.remove(hiddenClass);
    getMathElementAtIndex(currentIndex)?.classList.add(visibleClass);
    
    const showAtIndex = (index) => {
        if (index === currentIndex) return;
        if (!inRange(index) && !inRange(currentIndex)) return;

        const from = getMathElementAtIndex(currentIndex);
        const to = getMathElementAtIndex(index);

        const fromWidth = from?.offsetWidth || 0;
        const fromHeight = from?.offsetHeight || 0;
        const toWidth = to?.offsetWidth || 0;
        const toHeight = to?.offsetHeight || 0;

        container.style.transition = `width 1s ${fromWidth <= toWidth ? 0 : 0.5}s, height 1s ${fromHeight <= toHeight ? 0 : 0.5}s`;

        container.style.width = `${toWidth}px`;
        container.style.height = `${toHeight}px`;

        let duration = firstNumber(
            to?.dataset.mathDurationIn,
            from?.dataset.mathDurationOut,
            to?.dataset.mathDuration,
            from?.dataset.mathDuration,
            baseDuration
        );
        let durationIn = firstNumber(
            to?.dataset.mathDurationIn,
            to?.dataset.mathDuration,
            from?.dataset.mathDuration,
            baseDurationIn
        );
        let durationFromTo = firstNumber(
            from?.dataset.mathDurationFromTo,
            to?.dataset.mathDurationFromTo,
            from?.dataset.mathDuration,
            to?.dataset.mathDuration,
            baseDurationFromTo
        );
        let durationOut = firstNumber(
            from?.dataset.mathDurationOut,
            from?.dataset.mathDuration,
            to?.dataset.mathDuration,
            baseDurationOut
        );

        let stagger = firstNumber(
            to?.dataset.mathStagger,
            from?.dataset.mathStagger,
            baseStagger
        );
        let staggerIn = firstNumber(
            to?.dataset.mathStaggerIn,
            to?.dataset.mathStagger,
            from?.dataset.mathStagger,
            baseStaggerIn
        );
        let staggerFromTo = firstNumber(
            from?.dataset.mathStaggerFromTo,
            to?.dataset.mathStaggerFromTo,
            from?.dataset.mathStagger,
            to?.dataset.mathStagger,
            baseStaggerFromTo
        );
        let staggerOut = firstNumber(
            from?.dataset.mathStaggerOut,
            from?.dataset.mathStagger,
            to?.dataset.mathStagger,
            baseStaggerOut
        );

        transitionMath(getMathElementAtIndex(currentIndex), getMathElementAtIndex(index), {
            duration, durationIn, durationOut, durationFromTo, stagger, staggerFromTo, staggerIn, staggerOut, strokeWidth: baseStrokeWidth,
            baseDelay: fromWidth < toWidth ? 500 : 0
            // oncancel: () => console.log('cancel from', from, 'to', to),
            // onfinish: () => console.log('finish from', from, 'to', to),
        });
        currentIndex = Math.min(Math.max(index, -1), container.children.length);
    };

    return {
        equationCount: container.children,
        showAtIndex,
        next() {
            showAtIndex(currentIndex + 1);
            return inRange(currentIndex);
        },
        previous() {
            showAtIndex(currentIndex - 1);
            return inRange(currentIndex);
        }
    }
}
