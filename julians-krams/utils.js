import * as THREE from 'three';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2 } from 'three/addons/lines/Line2.js';

/**
 * @template T
 */
export class Usable {
    /**
     * @param {T} initialValue 
     */
    constructor(initialValue) {
        this.value = initialValue;
        this.callbackFunctions = new Set();
    }
    /**
     * @template {unknown[]} T
     * @param {(...params: T) => void} callback 
     * @param  {{ [K in keyof T]: Usable<T[K]> }} usables
     */
    static UseAny(
        callback,
        ...usables
    ) {
        const collectedCallback = () => {
            callback(...usables.map(usable => usable.value))
        };
        const forgetFunctions = usables.map(usable => usable.use(collectedCallback));
        return () => forgetFunctions.forEach(f => f());
    }
    /**
     * @template {unknown[]} T
     * @template U
     * @param {(...params: T) => U} deriveFunc 
     * @param  {{ [K in keyof T]: Usable<T[K]> }} usables
     * @returns {Usable<U>}
     */
    static DeriveAny(
        deriveFunc,
        ...usables
    ) {
        /** @type {Usable<U>} */
        const derived = new Usable()
        let usableCountDown = usables.length;
        const collectedCallback = () => {
            if (usableCountDown > 1) {
                --usableCountDown;
                return;
            }
            derived.set(deriveFunc(...usables.map(usable => usable.value)));
        };
        usables.forEach(usable => usable.use(collectedCallback));
        return derived;
    }

    /**
     * @param {(value: T) => void} callback 
     * @returns {() => void}
     */
    use(callback) {
        const forgetFunction = () => this.forget(callback);
        if (this.callbackFunctions.has(callback)) {
            console.warn('Callback function already in use:', callback);
            return forgetFunction;
        }
        this.callbackFunctions.add(callback);
        callback(this.value);
        return forgetFunction;
    }
    /**
     * @param {(value: T) => void} callback
     */
    forget(callback) {
        if (!this.callbackFunctions.delete(callback)) {
            console.warn('Callback function not in use, but trying to forget:', callback);
            return;
        }
    }
    /**
     * @returns {T}
     */
    peek() {
        return this.value;
    }
    touch() {
        this.callbackFunctions.forEach((callback) => {
            callback(this.value);
        });
    }
    /**
     * @param {T} value 
     */
    set(value) {
        this.value = value;
        this.touch();
    }
    /**
     * @param {(value: T) => T} mappingFunction 
     */
    map(mappingFunction) {
        this.value = mappingFunction(this.value);
        this.touch();
    }
    /**
     * @param {(value: T) => void} modifyFunction 
     */
    modify(modifyFunction) {
        modifyFunction(this.value);
        this.touch();
    }
    /**
     * @template U
     * @param {(value: T) => U} deriveFunction
     * @returns {Usable<U>}
     */
    derive(deriveFunction) {
        const derived = new Usable();
        this.use(value => derived.set(deriveFunction(value)));
        return derived;
    }
    /**
     * @returns {string}
     */
    toJSON() {
        return this.value;
    }
}

/**
 * @param {THREE.Camera} camera 
 * @param {THREE.Vector3} worldPos 
 * @param {THREE.Vector3} cameraSpaceOffset 
 * @returns {[ number, number ]}
 */
export function worldToScreen(camera, worldPos, cameraSpaceOffset) {
    const pos = worldPos.clone()
    if (cameraSpaceOffset) pos.add(cameraSpaceOffset.clone().applyQuaternion(camera.quaternion));
    const camLocalVec = camera.worldToLocal(pos.clone());
    if (camLocalVec.z > 0) { // Behind camera
        return [-1000000, -1000000];
    }
    pos.project(camera);
    if (pos.z < -1) { // Behind near plane
        return [-1000000, -1000000];
    }
    return [(pos.x / 2 + 0.5) * window.innerWidth, (-pos.y / 2 + 0.5) * window.innerHeight];
}

export class LineObject {
    /**
     * @param {Usable<THREE.Vector3>} from
     * @param {Usable<THREE.Vector3>} to
     * @param {Usable<number> | undefined} animInAmount
     * @param {Usable<number> | undefined} tick
     * @param {LineMaterial | undefined} material
     * @param {number | undefined} nudgeY
     */
    constructor(from, to, animInAmount, tick, material, nudgeY) {
        this.lineGeometry = new LineGeometry();
        this.lineMaterial = material || new LineMaterial({ color: 0x00ff00 });
        this.obj = new Line2(this.lineGeometry, this.lineMaterial)
        this.from = from;
        this.to = to;
        this.lineArray = new Float32Array(2 * 3);
        nudgeY = nudgeY === undefined ? 0 : nudgeY;

        const tickUsable = tick || new Usable(0);

        Usable.UseAny(vec => {
            this.lineArray[0] = vec.x;
            this.lineArray[1] = vec.y + nudgeY;
            this.lineArray[2] = vec.z;
        }, from, tickUsable);

        Usable.UseAny((from, to, t, _) => {
            this.obj.visible = t > 0;
            this.lineArray[3] = from.x * (1-t) + to.x * t;
            this.lineArray[4] = from.y * (1-t) + to.y * t + nudgeY;
            this.lineArray[5] = from.z * (1-t) + to.z * t;
            this.lineGeometry.setPositions(this.lineArray);
            this.obj.computeLineDistances();
        }, from, to, animInAmount || new Usable(1), tickUsable);
    }
}

export class ArrowObject {
    /**
     * @param {Usable<THREE.Vector3>} from
     * @param {Usable<THREE.Vector3>} to
     * @param {{
     *     animInAmount: Usable<number> | undefined,
     *     arrowWidth: number | undefined,
     *     nudgeY: number | undefined
     * } | undefined} options
     */
    constructor(from, to, options) {
        this.obj = new THREE.Group();
        this.lineMaterial = new LineMaterial({ color: 0xff00ff });

        let { animInAmount, arrowWidth, nudgeY } = options || { 
            animInAmount: new Usable(1),
            arrowWidth: 0.1,
            nudgeY: 0,
        };

        animInAmount = animInAmount || new Usable(1);
        arrowWidth = arrowWidth === undefined ? 0.1 : arrowWidth;
        nudgeY = nudgeY === undefined ? 0 : nudgeY;

        const dir = new THREE.Vector3();
        Usable.UseAny((from, to) => {
            dir.copy(to).sub(from).normalize();
        }, from, to);

        const animatedToVec = new THREE.Vector3();
        const animatedTo = Usable.DeriveAny((from, to, animInAmount) => {
            animatedToVec.copy(from).lerp(to, animInAmount);
            return animatedToVec;
        }, from, to, animInAmount);

        const arrowHeadVecA = new THREE.Vector3();
        const arrowHeadA = animatedTo.derive(animatedTo => {
            arrowHeadVecA.copy(animatedTo);
            arrowHeadVecA.x -= dir.x * arrowWidth*2 - dir.z * arrowWidth;
            arrowHeadVecA.z -= dir.z * arrowWidth*2 + dir.x * arrowWidth;
            return arrowHeadVecA;
        });

        const arrowHeadVecB = new THREE.Vector3();
        const arrowHeadB = animatedTo.derive(animatedTo => {
            arrowHeadVecB.copy(animatedTo);
            arrowHeadVecB.x -= dir.x * arrowWidth*2 + dir.z * arrowWidth;
            arrowHeadVecB.z -= dir.z * arrowWidth*2 - dir.x * arrowWidth;
            return arrowHeadVecB;
        });

        const animEarly = animInAmount.derive(t => Math.min(t * 5, 1));

        this.obj.add(new LineObject(from, to, animInAmount, undefined, this.lineMaterial, nudgeY).obj, );
        this.obj.add(new LineObject(animatedTo, arrowHeadA, animEarly, undefined, this.lineMaterial, nudgeY).obj);
        this.obj.add(new LineObject(animatedTo, arrowHeadB, animEarly, undefined, this.lineMaterial, nudgeY).obj);
    }
}

/**
 * 
 * @param {Usable<THREE.Vector3>} usablePoint
 * @param {Usable<THREE.Camera>} usableCam
 * @param {SVGGElement} svgPart
 * @param {number | undefined} screenOffsetPercX This is in percent of the SVG parts size
 * @param {number | undefined} screenOffsetPercY This is in percent of the SVG parts size
 */
export function attachSVGPartToPoint(usablePoint, usableCam, svgPart, screenOffsetPercX, screenOffsetPercY) {
    screenOffsetPercX = screenOffsetPercX === undefined ? 0 : screenOffsetPercX;
    screenOffsetPercY = screenOffsetPercY === undefined ? 0 : screenOffsetPercY;

    const transformPrefix = svgPart.getAttribute('transform') || '';
    const invScreenCTM = svgPart.getScreenCTM().inverse();
    const initialDomRect = svgPart.getBoundingClientRect();
    
    const camSpaceOffset = new THREE.Vector3();

    Usable.UseAny((point, cam) => {
        const [sx, sy] = worldToScreen(cam, point, camSpaceOffset);
        const offsetX = (sx - initialDomRect.x + screenOffsetPercX * initialDomRect.width) * invScreenCTM.a;
        const offsetY = (sy - initialDomRect.y + screenOffsetPercY * initialDomRect.height) * invScreenCTM.d;
        svgPart.setAttribute('transform', `${transformPrefix} translate(${offsetX},${offsetY})`);
    }, usablePoint, usableCam);
}
