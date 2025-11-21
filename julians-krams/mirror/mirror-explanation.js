import Keyframes from "../keyframe-plugin/keyframe.js";
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { Usable, LineObject, ArrowObject, attachSVGPartToPoint } from '../utils.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { createAnimationHelperFromContainer } from "../mathjax-morph/mathjax-morph.js";

const gltfLoader = new GLTFLoader();

const epsilon = 1e-4;

const c = {
    blue:   new THREE.Color(0x5b8efd),
    purple: new THREE.Color(0x725def),
    pink:   new THREE.Color(0xdd217d),
    orange: new THREE.Color(0xff5f00),
    yellow: new THREE.Color(0xffb00d),
};

// Fun read for later: https://minus-ze.ro/posts/morphing-arbitrary-paths-in-svg/

// Globals object
/**
 * @typedef {Map<any, { value: any, children: NestedLazy }>} NestedLazy
 * @type {{
 *     windowVisible: boolean,
 *     darkMode: Usable<boolean>,
 *     backgroundColor: THREE.Color,
 *     renderer: THREE.WebGLRenderer | undefined,
 *     camera: THREE.PerspectiveCamera | undefined,
 *     trackedCamera: THREE.PerspectiveCamera | undefined,
 *     overHeadCamera: THREE.OrthographicCamera | undefined,
 *     scene: THREE.Scene | undefined,
 *     overlayScene: THREE.Scene | undefined,
 *     gui: GUI,
 *     editModeEnabled: Usable<boolean>,
 *     transformingObject: Usable<boolean>,
 *     mirror: {
 *         object: THREE.Mesh | undefined,
 *         getNormal: () => THREE.Vector3,
 *         camera: THREE.PerspectiveCamera | undefined,
 *         renderTarget: THREE.RenderTarget | undefined,
 *     },
 *     expl: {
 *         fixedCamera: THREE.PerspectiveCamera | undefined,
 *         camera: Usable<THREE.PerspectiveCamera> | undefined,
 *         renderTarget: THREE.RenderTarget | undefined,
 *         mirrorCamera: Usable<THREE.PerspectiveCamera> | undefined,
 *         animatedMirrorCamera: Usable<THREE.PerspectiveCamera> | undefined,
 *         mirrorRenderTarget: THREE.RenderTarget | undefined,
 *     },
 *     editableObjects: THREE.Object3D[],
 *     overlayObjects: THREE.Group,
 *     orbit: OrbitControls | undefined,
 *     state: {
 *         fixClipPlaneAmount: Usable<number>,
 *         optimizeClipPlaneAmount: Usable<number>,
 *         lerpToOverheadCamera: Usable<number>,
 *         lerpExampleMirrorCamera: Usable<number>,
 *         showCameraFrustum: Usable<boolean>,
 *         showMirrorFrustum: Usable<boolean>,
 *     },
 *     target: {
 *         fixClipPlaneAmount: Usable<number>,
 *         optimizeClipPlaneAmount: Usable<number>,
 *         lerpToOverheadCamera: Usable<number>,
 *         lerpExampleMirrorCamera: Usable<number>,
 *         showCameraFrustum: Usable<boolean>,
 *         showMirrorFrustum: Usable<boolean>,
 *     },
 *     transformControls: TransformControls | undefined,
 *     pickedObject: THREE.Object3D | undefined,
 *     userPickedClipPlaneScale: Usable<number>,
 *     shownClipPlaneScale: Usable<number>
 *     clock: THREE.Clock,
 *     tick: Usable<number>,
 *     keyframe: Usable<{
 *         init?: boolean,
 *         showMirrorRay?: boolean,
 *     }>,
 *     lazyObjects: NestedLazy,
 * }}
 */
const g = {
    windowVisible: false,
    darkMode: new Usable(false),
    backgroundColor: new THREE.Color(),
    renderer: undefined,
    camera: undefined,
    trackedCamera: undefined,
    overHeadCamera: undefined,
    scene: undefined,
    overlayScene: undefined,
    gui: new GUI({ title: 'Settings' }),
    editModeEnabled: new Usable(false),
    transformingObject: new Usable(false),
    mirror: {
        object: undefined,
        getNormal: () => new THREE.Vector3(1, 0, 0).applyQuaternion(g.mirror.object.getWorldQuaternion(new THREE.Quaternion())),
        camera: undefined,
        renderTarget: undefined,
    },
    expl: {
        fixedCamera: undefined,
        camera: undefined,
        renderTarget: undefined,
        mirrorCamera: undefined,
        animatedMirrorCamera: undefined,
        mirrorRenderTarget: undefined,
    },
    editableObjects: [],
    overlayObjects: new THREE.Group(),
    orbit: undefined,
    state: {
        fixClipPlaneAmount: new Usable(0.0),
        optimizeClipPlaneAmount: new Usable(0.0),
        lerpToOverheadCamera: new Usable(0.0),
        lerpExampleMirrorCamera: new Usable(0.0),
        showCameraFrustum: new Usable(true),
        showMirrorFrustum: new Usable(true),
    },
    target: {
        fixClipPlaneAmount: new Usable(0.0),
        optimizeClipPlaneAmount: new Usable(0.0),
        lerpToOverheadCamera: new Usable(0.0),
        lerpExampleMirrorCamera: new Usable(0.0),
        showCameraFrustum: new Usable(true),
        showMirrorFrustum: new Usable(true),
    },
    transformControls: undefined,
    pickedObject: null,
    userPickedClipPlaneScale: new Usable(1),
    shownClipPlaneScale: new Usable(1),
    clock: new THREE.Clock(true),
    tick: new Usable(0),
    keyframe: new Usable({}),
    lazyObjects: new Map(),
};

let ready = false;
let SignalSetupDone = undefined;
let SetupDone = new Promise((resolve) => { SignalSetupDone = resolve });

/**
 * @param {THREE.Object3D} obj
 * @param {boolean | undefined} notClickable
 */
function addEditableObject(obj, notClickable) {
    if (!notClickable) g.editableObjects.push(obj);
    const initialPosition = obj.position.clone();
    const initialOrientation = obj.quaternion.clone();
    Usable.UseAny((editMode, _) => {
        if (editMode) return;
        obj.position.lerp(initialPosition, 0.1);
        obj.quaternion.slerp(initialOrientation, 0.1);
    }, g.editModeEnabled, g.tick);
}

/**
 * @template T
 * @param {any} key
 * @param {() => T} create
 * @returns {T}
 */
function lazy(key, create) {
    const currentLazyObjects = g.lazyObjects;
    if (currentLazyObjects.has(key)) return currentLazyObjects.get(key).value;
    g.lazyObjects = new Map();
    const obj = create();
    currentLazyObjects.set(key, { value: obj, children: g.lazyObjects });
    g.lazyObjects = currentLazyObjects;
    return obj;
}

/**
 * @template T
 * @param {T} v
 * @returns {Usable<T>} 
 */
function u(v) {
    return new Usable(v);
}

function preload() {
    gltfLoader.load(
        '/julians-krams/mirror/MirrorScene.glb',
        async gltf => {
            await SetupDone;

            /**
             * @type {THREE.Scene}
             */
            const scene = gltf.scene;
            console.log('MirrorScene', gltf);
            
            scene.traverse(object => {
                if (object.type === 'DirectionalLight') {
                    object.intensity = 6.0;
                }
            });

            g.mirror.object = scene.getObjectByName('Mirror');

            /**
             * @type {THREE.Mesh}
             */
            const mirrorRim = scene.getObjectByName('MirrorRim');
            g.darkMode.use(darkMode => mirrorRim.material.color.setHex( darkMode ? 0xffffff : 0x000000 ));
            
            /**
             * @type {THREE.MeshStandardMaterial}
             */
            const mirrorMat = g.mirror.object.material;
            mirrorMat.roughness = 1.0;
            mirrorMat.color.setHex(0x818181);
            mirrorMat.emissive = new THREE.Color( 0xffffff );
            g.darkMode.use(isDark => {
                mirrorMat.emissiveIntensity = isDark ? 1 : 0.8;
            });
            mirrorMat.emissiveMap = g.mirror.renderTarget.texture;
            g.mirror.object.material.onBeforeCompile = shader => {
                shader.vertexShader = shader.vertexShader.replace('#include <clipping_planes_pars_vertex>', `
                    #include <clipping_planes_pars_vertex>

                    varying vec3 vScreenPos;
                `).replace('#include <project_vertex>', `
                    #include <project_vertex>

                    vScreenPos = (projectionMatrix * mvPosition).xyw;
                `);

                shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_pars_fragment>', `
                    #include <clipping_planes_pars_fragment>

                    varying vec3 vScreenPos;
                `).replace('#include <emissivemap_fragment>', `
                    #ifdef USE_EMISSIVEMAP
                        vec2 nScreenPos = (vScreenPos.xy / vScreenPos.z) * 0.5 + 0.5;
                        nScreenPos.x = 1.0 - nScreenPos.x;

                        vec4 emissiveColor = texture2D( emissiveMap, nScreenPos );

                        #ifdef DECODE_VIDEO_TEXTURE_EMISSIVE

                            // use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)

                            emissiveColor = sRGBTransferEOTF( emissiveColor );

                        #endif

                        totalEmissiveRadiance *= emissiveColor.rgb;

                    #endif
                `);
            };
            
            g.scene.add(gltf.scene);

            const targetPos = gltf.scene.getObjectByName('CameraTarget').getWorldPosition(new THREE.Vector3());

            g.camera.copy(gltf.scene.getObjectByName('StartCamera'));
            
            g.trackedCamera = g.camera.clone();
            
            g.orbit.object = g.trackedCamera;
            g.orbit.target.set(targetPos.x, targetPos.y, targetPos.z);
            g.orbit.update();

            addEditableObject(g.trackedCamera, true);
            
            g.overHeadCamera = gltf.scene.getObjectByName('OverheadCamera');

            const explCam = gltf.scene.getObjectByName('ExampleCamera');
            explCam.near = 1;
            explCam.far = 8;
            explCam.aspect = 1.5;
            explCam.updateProjectionMatrix();

            g.expl.camera = new Usable(explCam);

            g.expl.fixedCamera = explCam.clone();

            const frustum = createViewFrustum(g.expl.camera);
            frustum.meshMaterial.transparent = true;
            g.darkMode.use(darkMode => {
                const hex = darkMode ? 0xffffff : 0x000000;
                frustum.lineMaterial.color.setHex(hex);
                frustum.meshMaterial.color.setHex(hex);
            });
            g.state.showCameraFrustum.use(showFrustum => frustum.frustum.visible = showFrustum);
            
            g.expl.mirrorCamera = new Usable(explCam.clone());
            g.expl.animatedMirrorCamera = new Usable(explCam.clone());
            const mirrorFrustum = createViewFrustum(g.expl.animatedMirrorCamera);
            mirrorFrustum.meshMaterial.transparent = true;

            g.state.lerpToOverheadCamera.use(t => {
                frustum.meshMaterial.opacity = t;
                mirrorFrustum.meshMaterial.opacity = t;
            });

            mirrorFrustum.lineMaterial.linewidth = 2;
            Usable.UseAny((darkMode, t) => {
                const hex = darkMode ? 0xffffff : 0x000000;
                mirrorFrustum.lineMaterial.color.setHex(0xff7700).lerp(new THREE.Color(hex), 1-t);
                mirrorFrustum.meshMaterial.color.setHex(0xff7700).lerp(new THREE.Color(hex), 1-t);
            }, g.darkMode, g.state.lerpExampleMirrorCamera);
            g.state.lerpExampleMirrorCamera.use(t => mirrorFrustum.frustum.visible = t > 0.01)
            g.state.showMirrorFrustum.use(showFrustum => mirrorFrustum.frustum.visible = showFrustum);
            
            resize();
            
            const resScale = 2;

            g.expl.renderTarget = new THREE.RenderTarget(resScale*150*window.devicePixelRatio, resScale*100*window.devicePixelRatio);
            g.expl.mirrorRenderTarget = new THREE.RenderTarget(resScale*150*window.devicePixelRatio, resScale*100*window.devicePixelRatio);

            addEditableObject(g.scene.getObjectByName('Tetrahedron'));
            addEditableObject(g.scene.getObjectByName('Cuboid'));
            addEditableObject(g.scene.getObjectByName('Mirror'));
            addEditableObject(g.scene.getObjectByName('Icosahedron'));

            console.log(g.editableObjects);

            // Transform gizmo
            const control = new TransformControls(g.camera, g.renderer.domElement);
            g.state.lerpToOverheadCamera.use(v => {
                control.camera = v > 0.9 ? g.overHeadCamera : g.camera;
            })
            control.addEventListener('dragging-changed', event => {
                g.transformingObject.set(event.value);
            });
            const gizmo = control.getHelper();
            g.overlayObjects.add(gizmo);
            g.transformControls = control;

            ready = true;
        },
        // called while loading is progressing
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log('An error happened', error);
        }
    )
}

/**
 * Modifies and returns the modified vec
 * @param {THREE.Vector4} vec
 * @param {THREE.Camera} cam
 * @returns {THREE.Vector4}
 */
function clipToWorldSpace(vec, cam) {
    const z = vec.z;
    vec.applyMatrix4(cam.projectionMatrixInverse);
    if (z < 0) {
        vec.divideScalar(Math.abs(vec.w));
    } else {
        vec.divideScalar(Math.max(vec.w, epsilon));
        vec.w = 1;
    }
    cam.updateWorldMatrix(true, false);
    vec.applyMatrix4(cam.matrixWorld);
    // cam.localToWorld(vec);
    return vec;
}

/**
 * @param {Usable<THREE.Camera>} usableCamera 
 * @returns {{ lineMaterial: LineMaterial, meshMaterial: THREE.MeshStandardMaterial, frustum: THREE.Group }}
 */
function createViewFrustum(usableCamera) {
    const lineMat = new LineMaterial({ color: 0x00ff00 });
    const lineGeometries = [];
    
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const boxGeom = new THREE.SphereGeometry(0.1);
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);

    const frustumGroup = new THREE.Group();

    frustumGroup.add(boxMesh);

    /**
     * @type {THREE.Vector4[]}
     */
    const positions = [];
    // // Just every line on its own
    // const lineIndices = [
    //     [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 6], [4, 6], [5, 7], [6, 7],
    // ];
    // Optimized for few lines
    const lineIndices = [
        [0, 1, 5, 4, 0, 2, 3, 7, 6, 2],
        [1, 3],
        [5, 7],
        [4, 6]
    ];
    
    for (let z = -1; z < 3; z += 2) {
        for (let y = -1; y < 3; y += 2) {
            for (let x = -1; x < 3; x += 2) {
                const position = new THREE.Vector4(x, y, z, 1);
                positions.push(position);
            }
        }
    }

    for (const _ of lineIndices) {
        const geom = new LineGeometry();
        lineGeometries.push(geom);
        frustumGroup.add(new Line2(geom, lineMat));
    }

    g.overlayObjects.add(frustumGroup);

    // const ballGeom = new THREE.SphereGeometry(0.1, 5, 5);
    // const ball = new THREE.Mesh(ballGeom, greenMat);
    // cam.localToWorld(ball.position);
    // g.overlayObjects.add(ball);
    // balls.push(ball);

    usableCamera.use(cam => {
        boxMesh.position.copy(cam.position);
        boxMesh.rotation.copy(cam.rotation);

        let i = 0;
        for (let z = -1; z < 3; z += 2) {
            for (let y = -1; y < 3; y += 2) {
                for (let x = -1; x < 3; x += 2) {
                    const position = positions[i];
                    position.set(x, y, z, 1);
                    clipToWorldSpace(position, cam);
                    ++i;
                }
            }
        }
        for (let i = 0; i < lineIndices.length; ++i) {
            const line = lineIndices[i];
            const lineArray = new Float32Array(line.length * 3);
            for (let j = 0; j < line.length; ++j) {
                const position = positions[line[j]];
                lineArray[j*3 + 0] = position.x;
                lineArray[j*3 + 1] = position.y;
                lineArray[j*3 + 2] = position.z;
            }
            lineGeometries[i].setPositions(lineArray);
        }
    });

    return { lineMaterial: lineMat, meshMaterial: boxMat, frustum: frustumGroup };
}

/**
 * @param {Usable<number>} usableTarget
 * @param {Usable<number>} usableCurrent
 * @param {number} speed
 * @param {Usable<number> | undefined} tick
 */
function createAnimatedValue(usableTarget, usableCurrent, speed, tick) {
    let k = speed;
    let velocity = 0;
    Usable.UseAny((editMode, targetValue, dt) => {
        dt = Math.min(dt, 1.0 / 30.0);

        let x = usableCurrent.peek();

        const speedyCloseToTargetHack = Math.max(0.02, dt);
        k = speed * Math.max((1 + speedyCloseToTargetHack) / (Math.abs(targetValue - x) + speedyCloseToTargetHack), 1);

        const d = 2 * Math.sqrt(k); // Critically damped - https://en.wikipedia.org/wiki/Damping
        if (editMode) return;
        velocity += k * (targetValue - x) * dt - velocity * d * dt;
        x += velocity * dt;

        if (x !== targetValue) {
            if (Math.abs(x - targetValue) < epsilon || Number.isNaN(x)) {
                velocity = 0;
                usableCurrent.set(targetValue);
            } else {
                usableCurrent.set(x);
            }
        } else {
            velocity = 0;
        }
    }, g.editModeEnabled, usableTarget, tick || g.tick);
}

/**
 * @param {Usable<number>} usableTarget 
 * @param {number | undefined} speed
 * @param {Usable<number> | undefined} tick
 * @returns {Usable<number>}
 */
function deriveAnimated(usableTarget, speed, tick) {
    const usableCurrent = new Usable(usableTarget.peek());
    createAnimatedValue(usableTarget, usableCurrent, speed === undefined ? 10 : speed, tick);
    return usableCurrent;
}

/**
 * @param {Usable<number>} usableTarget 
 * @param {number | undefined} speed 
 * @returns {Usable<number>}
 */
function deriveAnimatedExp(usableTarget, speed) {
    const usableCurrent = new Usable(usableTarget.peek());
    speed = speed === undefined ? 5 : speed;
    Usable.UseAny((target, dt) => {
        let x = usableCurrent.peek();
        let t = 1 - Math.exp(-speed * dt);
        x = lerp(x, target, t);
        if (x !== target) {
            if (Math.abs(x - target) < 0.01 || Number.isNaN(x)) {
                usableCurrent.set(target);
            } else {
                usableCurrent.set(x);
            }
        }
    }, usableTarget, g.tick);
    return usableCurrent;
}

/**
 * @param {Usable<number>} usableTarget 
 * @param {number | undefined} speed 
 * @returns {Usable<number>}
 */
function deriveAnimatedEased(usableTarget, duration) {
    const usableCurrent = new Usable(usableTarget.peek());
    duration = duration === undefined ? 1 : duration;

    let t;
    let startValue;
    let target;
    usableTarget.use(newTarget => {
        if (newTarget !== target) {
            t = 0;
            startValue = usableCurrent.peek();
            target = newTarget;
        }
    });

    Usable.UseAny((dt) => {
        let current = usableCurrent.peek();
        t += dt;
        const x = lerp(startValue, target, clamp(easeInOutCubic(t / duration), 0, 1));
        if (x !== current) {
            usableCurrent.set(x);
        }
    }, g.tick);
    return usableCurrent;
}

function setup() {
    // Setup basic camera
    const camera = new THREE.PerspectiveCamera(
        75, // (vertical?) FOV
        window.innerWidth / window.innerHeight,
        0.1, // near plane
        100 // far plane
    );
    camera.position.z = 5;
    g.camera = camera;
    g.mirror.camera = g.camera.clone();

    // Setup scene
    g.scene = new THREE.Scene();
    g.scene.add(g.overlayObjects);
    g.darkMode.use(() => {
        g.backgroundColor.setStyle(window.getComputedStyle(document.body).backgroundColor);
    });

    g.overlayScene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    g.scene.add(ambientLight);

    const grid = new THREE.GridHelper(10, 20, 0x818181, 0x818181);
    g.scene.add(grid);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.zIndex = '-1';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    document.body.appendChild(renderer.domElement);
    g.renderer = renderer;
    
    g.mirror.renderTarget = new THREE.WebGLRenderTarget(g.renderer.domElement.width, g.renderer.domElement.height);

    const controls = new OrbitControls(g.camera, renderer.domElement);
    controls.zoomSpeed = 2;
    g.orbit = controls;
    Usable.UseAny((editMode, lerpToOverheadCamera, transformingObject) => {
        g.orbit.enabled = (editMode && lerpToOverheadCamera < 0.05 && !transformingObject);
    }, g.editModeEnabled, g.state.lerpToOverheadCamera, g.transformingObject)

    resize();

    // Setup animated values
    createAnimatedValue(g.target.fixClipPlaneAmount, g.state.fixClipPlaneAmount, 20);
    createAnimatedValue(g.target.optimizeClipPlaneAmount, g.state.optimizeClipPlaneAmount, 20);
    createAnimatedValue(g.target.lerpToOverheadCamera, g.state.lerpToOverheadCamera, 5);
    createAnimatedValue(g.target.lerpExampleMirrorCamera, g.state.lerpExampleMirrorCamera, 10);

    Usable.UseAny((editMode, overHeadCamera, showTarget) => {
        if (editMode) return;
        const currentShowing = g.state.showCameraFrustum.peek();
        if (currentShowing && !showTarget && overHeadCamera < 0.0001) {
            g.state.showCameraFrustum.set(false);
        } else if (!currentShowing && showTarget) {
            g.state.showCameraFrustum.set(true);
        }
    }, g.editModeEnabled, g.state.lerpToOverheadCamera, g.target.showCameraFrustum)

    Usable.UseAny((editMode, showTarget) => {
        if (editMode) return;
        g.state.showMirrorFrustum.set(showTarget);
    }, g.editModeEnabled, g.target.showMirrorFrustum);

    // Setup gui

    g.gui.close();

    g.gui.add(g.state.fixClipPlaneAmount, 'value', 0, 1, 0.01)
        .name('Fix Clip Plane')
        .onChange(() => { g.state.fixClipPlaneAmount.touch() });

    g.gui.add(g.state.optimizeClipPlaneAmount, 'value', 0, 1, 0.01)
        .name('Optimize Clip Plane')
        .onChange(() => { g.state.optimizeClipPlaneAmount.touch() });
    
    g.gui.add(g.state.showCameraFrustum, 'value')
        .name('Camera Frustum')
        .onChange(() => g.state.showCameraFrustum.touch());
    
    g.gui.add(g.state.showMirrorFrustum, 'value')
        .name('Mirror Camera Frustum')
        .onChange(() => g.state.showMirrorFrustum.touch());

    g.gui.add(g.state.lerpToOverheadCamera, 'value', 0, 1, 0.01)
        .name('Overhead Camera')
        .onChange(() => { g.state.lerpToOverheadCamera.touch() });

    g.gui.add(g.state.lerpExampleMirrorCamera, 'value', 0, 1, 0.01)
        .name('Mirror Example')
        .onChange(() => { g.state.lerpExampleMirrorCamera.touch() });
    
    console.log(g.gui);

    /**
     * @type {HTMLInputElement}
     */
    const editModeCheckbox = document.getElementById('edit_mode');
    /**
     * @type {HTMLInputElement}
     */
    const translateModeCheckbox = document.getElementById('interaction_mode_translate');
    /**
     * @type {HTMLInputElement}
     */
    const rotateModeCheckbox = document.getElementById('interaction_mode_rotate');

    editModeCheckbox.addEventListener('change', () => {
        if (!editModeCheckbox.checked) {
            g.transformControls.detach();
            g.pickedObject = null;
            translateModeCheckbox.checked = false;
            rotateModeCheckbox.checked = false;
        }
        g.editModeEnabled.set(editModeCheckbox.checked);
    });
    g.editModeEnabled.set(editModeCheckbox.checked);

    translateModeCheckbox.addEventListener('change', () => {
        rotateModeCheckbox.checked = false;
        if (translateModeCheckbox.checked) {
            g.transformControls.setMode('translate');
            if (g.pickedObject) g.transformControls.attach(g.pickedObject);
        } else {
            g.transformControls.detach();
        }
    });
    
    rotateModeCheckbox.addEventListener('change', () => {
        translateModeCheckbox.checked = false;
        if (rotateModeCheckbox.checked) {
            g.transformControls.setMode('rotate');
            if (g.pickedObject) g.transformControls.attach(g.pickedObject);
        } else {
            g.transformControls.detach();
        }
    });
    
    const raycaster = new THREE.Raycaster();
    let clickValid = true;
    g.renderer.domElement.addEventListener('pointerdown', () => {
        clickValid = true;
    });
    g.renderer.domElement.addEventListener('pointermove', () => {
        clickValid = false;
    });
    g.renderer.domElement.addEventListener('click', e => {
        if (!clickValid || (!translateModeCheckbox.checked && !rotateModeCheckbox.checked)) return;

        const pointer = new THREE.Vector2(
            2 * e.clientX / window.innerWidth - 1,
            -2 * e.clientY / window.innerHeight + 1
        );
        raycaster.setFromCamera(pointer, g.state.lerpToOverheadCamera.peek() > 0.9 ? g.overHeadCamera : g.camera);
        const intersects = raycaster.intersectObjects(g.editableObjects, true);
        
        if (intersects.length === 0) {
            g.transformControls.detach();
            g.pickedObject = null;
        } else {
            let obj = intersects[0].object;
            while (!g.editableObjects.some(ed => ed === obj)) obj = obj.parent;
            g.pickedObject = obj;
            g.transformControls.attach(obj);
        }
    });

    SignalSetupDone();
}

/**
 * @param {THREE.Matrix4} target
 * @param {THREE.Matrix4} from
 * @param {THREE.Matrix4} to
 * @param {number} t
 */
function lerpMat4(target, from, to, t) {
    for (let i = 0; i < target.elements.length; ++i) {
        target.elements[i] = (1 - t) * from.elements[i] + t * to.elements[i];
    }
}

/**
 * @param {number} x 
 * @returns {number}
 */
function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

/**
 * @param {number} x 
 * @returns {number}
 */
function easeInCubic(x) {
    return x * x * x;
}

/**
 * @param {number} x 
 * @returns {number}
 */
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerp(a, b, t) {
    return (1 - t) * a + t * b;
}

/**
 * @param {number} x
 * @param {number} low
 * @param {number} high
 */
function clamp(x, low, high) {
    return Math.min(Math.max(x, low), high);
}

/**
 * @param {THREE.Camera} target 
 * @param {THREE.Camera} from 
 * @param {THREE.Camera} to 
 * @param {number} t 
 */
function lerpCamera(target, from, to, t) {
    target.position.copy(from.position).lerp(to.position, t);
    target.setRotationFromQuaternion(from.quaternion.clone().slerp(to.quaternion, t));
    lerpMat4(target.projectionMatrix, from.projectionMatrix, to.projectionMatrix, easeOutCubic(t));
    target.projectionMatrixInverse.copy(target.projectionMatrix).invert();
}

/**
 * @param {THREE.PerspectiveCamera} baseCam 
 * @param {THREE.PerspectiveCamera} mirrorCam 
 * @param {boolean} setShownClipPlaneValue
 */
function setupMirrorCamera(baseCam, mirrorCam, setShownClipPlaneValue) {
    mirrorCam.copy(baseCam);

    const mirrorPos = g.mirror.object.getWorldPosition(new THREE.Vector3());
    const mirrorNormal = g.mirror.getNormal();

    const camPos = mirrorCam.position.clone();
    const reflectedCamPos = camPos.clone().sub(mirrorPos).reflect(mirrorNormal).add(mirrorPos);

    const baseCamRotation = baseCam.getWorldQuaternion(new THREE.Quaternion());
    const reflectedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(baseCamRotation).reflect(mirrorNormal);
    const reflectedForward = new THREE.Vector3(0, 0, -1).applyQuaternion(baseCamRotation).reflect(mirrorNormal);
    
    const reflectedCamRot = new THREE.Matrix4().lookAt(new THREE.Vector3(), reflectedForward, reflectedUp);

    mirrorCam.position.copy(reflectedCamPos);
    mirrorCam.setRotationFromMatrix(reflectedCamRot);

    // Setup clipping plane
    const clipPlanePos = mirrorCam.worldToLocal(mirrorPos.clone());
    const clipPlaneNormal = mirrorNormal.applyQuaternion(mirrorCam.getWorldQuaternion(new THREE.Quaternion()).invert());

    const cameraSpacePlane = new THREE.Vector4(
        clipPlaneNormal.x,
        clipPlaneNormal.y,
        clipPlaneNormal.z,
        -clipPlanePos.dot(clipPlaneNormal)
    );

    const clipSpaceOppositeCorner = new THREE.Vector4(
        Math.sign(cameraSpacePlane.x),
        Math.sign(cameraSpacePlane.y),
        1, 1
    );

    const cameraSpaceOppositeCorner = clipSpaceOppositeCorner.clone().applyMatrix4(mirrorCam.projectionMatrixInverse);

    /*
     *  0  4  8 12
     *  1  5  9 13
     *  2  6 10 14
     *  3  7 11 15
     */

    const row3 = new THREE.Vector4(
        mirrorCam.projectionMatrix.elements[ 2],
        mirrorCam.projectionMatrix.elements[ 6],
        mirrorCam.projectionMatrix.elements[10],
        mirrorCam.projectionMatrix.elements[14]
    );

    const row4 = new THREE.Vector4(
        mirrorCam.projectionMatrix.elements[ 3],
        mirrorCam.projectionMatrix.elements[ 7],
        mirrorCam.projectionMatrix.elements[11],
        mirrorCam.projectionMatrix.elements[15]
    );

    const planeScaleFactor = 2 * row4.dot(cameraSpaceOppositeCorner) / cameraSpacePlane.dot(cameraSpaceOppositeCorner);

    const lerpedScaleFactor = lerp(g.userPickedClipPlaneScale.peek(), planeScaleFactor, g.state.optimizeClipPlaneAmount.peek());

    if (setShownClipPlaneValue) g.shownClipPlaneScale.set(lerpedScaleFactor);

    const replacementRow3 = cameraSpacePlane.clone().multiplyScalar(lerpedScaleFactor).sub(row4);
    replacementRow3.lerp(row3, 1 - easeInCubic(g.state.fixClipPlaneAmount.peek()));
    
    mirrorCam.projectionMatrix.elements[ 2] = replacementRow3.x;
    mirrorCam.projectionMatrix.elements[ 6] = replacementRow3.y;
    mirrorCam.projectionMatrix.elements[10] = replacementRow3.z;
    mirrorCam.projectionMatrix.elements[14] = replacementRow3.w;
    
    mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert();
}

/**
 * @param {any} key 
 * @param {THREE.Vector2} ndcCoords 
 * @param {Usable<number>} tIn
 * @param {Usable<number>} tToMirrorCam
 */
function ray(key, ndcCoords, tIn, tToMirrorCam) {
    lazy(key, () => {
        const flippedNdcCoords = new THREE.Vector2(-ndcCoords.x, ndcCoords.y);
        const rayStartProjectCoords = new THREE.Vector4(ndcCoords.x, ndcCoords.y, -1, 1);

        const rayStartVec = new THREE.Vector3();
        const rayDirectionVec = new THREE.Vector3();

        const rayStart = g.expl.camera.derive(cam =>
            rayStartVec.copy(clipToWorldSpace(rayStartProjectCoords.set(ndcCoords.x, ndcCoords.y, -1, 1), cam))
        );

        const rayDirection = rayStart.derive(start =>
            rayDirectionVec
                .copy(start)
                .sub(g.expl.camera.value.position)
                .normalize()
        );
        
        const raycaster = new THREE.Raycaster();

        const rayHit = Usable.DeriveAny(() => {
            raycaster.setFromCamera(ndcCoords, g.expl.camera.value);
            raycaster.far = 20;
            const intersect = raycaster.intersectObjects(g.editableObjects, true).at(0);
            const didHit = !!intersect;
            const didHitMirror = didHit && intersect.object === g.mirror.object;
            return {
                hitPos: rayDirection.value.clone()
                    .multiplyScalar(intersect?.distance || 20)
                    .add(g.expl.camera.value.position),
                distance: intersect?.distance,
                didHitMirror: didHitMirror,
            };
        }, g.tick, g.expl.mirrorCamera);

        const rayHitPos = rayHit.derive(hit => hit.hitPos);

        const bouncePos = rayHit.derive(({ hitPos, didHitMirror, distance }) => {
            if (!didHitMirror) return hitPos;
            raycaster.setFromCamera(flippedNdcCoords, g.expl.mirrorCamera.value);
            raycaster.far = 20;
            const intersect = raycaster.intersectObjects(g.editableObjects, true)
                .find(intersect => intersect.distance > distance);
            return rayDirection.value.clone()
                    .reflect(g.mirror.getNormal())
                    .multiplyScalar(intersect?.distance || 20)
                    .add(g.expl.mirrorCamera.value.position);
        });

        const tDirect = Usable.DeriveAny((startPos, hitPos, bouncePos, t) => {
            const direct = startPos.distanceTo(hitPos);
            const bounce = hitPos.distanceTo(bouncePos);
            const directTMax = direct / (direct + bounce);
            return clamp(directTMax < epsilon ? 0 : (t - (1 - directTMax)) / directTMax, 0, 1);
        }, rayStart, rayHitPos, bouncePos, tIn);

        const tBounce = Usable.DeriveAny((startPos, hitPos, bouncePos, t) => {
            const direct = startPos.distanceTo(hitPos);
            const bounce = hitPos.distanceTo(bouncePos);
            const bounceTMax = bounce / (direct + bounce);
            return clamp(bounceTMax < epsilon ? 0 : t / bounceTMax, 0, 1);
        }, rayStart, rayHitPos, bouncePos, tIn);

        const rayBounceProjectCoords = new THREE.Vector4(flippedNdcCoords.x, flippedNdcCoords.y, -1, 1);
        const rayBounceProjectedVec = new THREE.Vector3();
        g.expl.mirrorCamera.use(cam => 
            rayBounceProjectedVec.copy(clipToWorldSpace(rayBounceProjectCoords.set(flippedNdcCoords.x, flippedNdcCoords.y, -1, 1), cam))
        );

        const bounceStart = Usable.DeriveAny(({ hitPos, didHitMirror }, tToMirrorCam) => {
            if (!didHitMirror || tToMirrorCam === 0) return hitPos;
            return hitPos.clone().lerp(rayBounceProjectedVec, tToMirrorCam);
        }, rayHit, tToMirrorCam);

        const gray = new THREE.Color(0x777777);
        g.darkMode.use(darkMode => gray.setHex(darkMode ? 0x666666 : 0xaaaaaa))

        const lineObj = new LineObject(rayHitPos, rayStart, tDirect);
        Usable.UseAny(({ didHitMirror }, t) => {
            lineObj.lineMaterial.linewidth = didHitMirror ? 2 : 1;
            lineObj.lineMaterial.color.setHex(didHitMirror ? 0xff7700 : gray.getHex());
        }, rayHit, tToMirrorCam);
        const lineObj2 = new LineObject(bouncePos, bounceStart, tBounce);
        lineObj2.lineMaterial.color.setHex(0xff7700);
        lineObj2.lineMaterial.linewidth = 2;

        g.overlayObjects.add(lineObj.obj);
        g.overlayObjects.add(lineObj2.obj);
        
    });
}

function setupRays() {
    lazy('mirrorRays', () => {
        const t = deriveAnimated(g.keyframe.derive(({ showMirrorRay }) => showMirrorRay ? 1.0 : 0.0), 10);
        const tToMirrorCam = deriveAnimated(g.keyframe.derive(({ mirrorRayToMirrorCam }) => mirrorRayToMirrorCam ? 1.0 : 0.0), 10);
        for (let i = -0.9; i <= 0.95; i += 0.1) {
            const ndcCoords = new THREE.Vector2(i, -0.6);
            ray(i, ndcCoords, t, tToMirrorCam);
        }
    });

    // ray.from.modify(from => from.copy(g.mirror.object.position));
    // ray.to.modify(to => to.copy(g.expl.camera.value.position));
}

function setupReflectionArrows(dt) {
    lazy('reflectionArrows', () => {
        const localTick = new Usable(0);

        // Reflection math
        const reflectionMath = document.getElementById('panel-reflection');
        reflectionMath.style.visibility = 'visible';
        const animHelp = createAnimationHelperFromContainer(reflectionMath.children[0], { startIndex: -1 });
        g.keyframe.use(({ reflectionMathIndex }) => {
            animHelp.showAtIndex(reflectionMathIndex == undefined ? -1 : reflectionMathIndex);
        });

        // Arrow things
        const animInMirrorNormal = deriveAnimatedEased(g.keyframe.derive(({ showMirrorNormal }) => showMirrorNormal ? 1.0 : 0.0), 0.5);
        const animInRelativeCamPos = deriveAnimatedEased(g.keyframe.derive(({ showRelativeCamPos }) => showRelativeCamPos ? 1.0 : 0.0), 1);
        const projectRelativeCamPos = deriveAnimatedEased(g.keyframe.derive(({ projectRelativeCamPos }) => projectRelativeCamPos ? 1.0 : 0.0), 1);
        const subtractProjectRelativeCamPos = deriveAnimatedEased(g.keyframe.derive(({ subtractProjectedRelativeCamPos }) => subtractProjectedRelativeCamPos ? 1.0 : 0.0), 1);
        const animInReflectedVec = deriveAnimatedEased(g.keyframe.derive(({ showReflectedVec }) => showReflectedVec ? 1.0 : 0.0), 1);

        const camPos = g.expl.camera.derive(cam => cam.position);
        const normalEndVec = new THREE.Vector3();
        const mirror = localTick.derive(() => {
            const normal = g.mirror.getNormal();
            return {
                pos: g.mirror.object.position,
                normal: normal,
                normalEnd: normalEndVec.copy(g.mirror.object.position).add(normal),
            }
        });

        const projectedVec = new THREE.Vector3();
        const projected = Usable.DeriveAny((camPos, { pos: mirrorPos, normal }, t) => {
            const dot = projectedVec.copy(camPos).sub(mirrorPos).dot(normal)
            projectedVec.copy(normal).multiplyScalar(dot).add(mirrorPos).lerp(camPos, 1 - t);
            return projectedVec;
        }, camPos, mirror, projectRelativeCamPos)

        const mirrorPos = mirror.derive(m => m.pos);

        const subCamStartVec = new THREE.Vector3();
        const subCamStart = Usable.DeriveAny((camPos, { pos: mirrorPos }, t) => {
            subCamStartVec.copy(mirrorPos).lerp(camPos, t);
            return subCamStartVec;
        }, camPos, mirror, subtractProjectRelativeCamPos)

        const subMiddleVec1 = new THREE.Vector3();
        const subMiddle1 = Usable.DeriveAny((camPos, mirrorCam, projected, t) => {
            subMiddleVec1.copy(camPos).add(mirrorCam.position).divideScalar(2).lerp(projected, 1-t);
            return subMiddleVec1;
        }, camPos, g.expl.mirrorCamera, projected, subtractProjectRelativeCamPos)

        const subMiddleVec2 = new THREE.Vector3();
        const subMiddle2 = Usable.DeriveAny((camPos, mirrorCam, mirrorPos, t) => {
            subMiddleVec2.copy(camPos).add(mirrorCam.position).divideScalar(2).lerp(mirrorPos, 1-t);
            return subMiddleVec2;
        }, camPos, g.expl.mirrorCamera, mirrorPos, subtractProjectRelativeCamPos)

        const subCamEndVec = new THREE.Vector3();
        const subCamEnd = Usable.DeriveAny((mirrorCam, projected, t) => {
            subCamEndVec.copy(projected).lerp(mirrorCam.position, t);
            return subCamEndVec;
        }, g.expl.mirrorCamera, projected, subtractProjectRelativeCamPos)

        const camSubtractedArrow1 = new ArrowObject(
            subCamStart,
            subMiddle1,
            { animInAmount: animInRelativeCamPos, nudgeY: -0.3 }
        );
        camSubtractedArrow1.lineMaterial.linewidth = 4;
        camSubtractedArrow1.lineMaterial.color.copy(c.purple);
        g.overlayScene.add(camSubtractedArrow1.obj);

        const camSubtractedArrow2 = new ArrowObject(
            subMiddle2,
            subCamEnd,
            { animInAmount: animInRelativeCamPos, nudgeY: -0.2 }
        );
        camSubtractedArrow2.lineMaterial.linewidth = 4;
        camSubtractedArrow2.lineMaterial.color.copy(c.purple);
        g.overlayScene.add(camSubtractedArrow2.obj);

        const camPosProjectedArrow = new ArrowObject(
            mirrorPos,
            projected,
            { animInAmount: animInRelativeCamPos, nudgeY: -0.1 }
        );
        camPosProjectedArrow.lineMaterial.linewidth = 4;
        camPosProjectedArrow.lineMaterial.color.copy(c.purple);
        g.overlayScene.add(camPosProjectedArrow.obj);

        const camPosArrow = new ArrowObject(
            mirrorPos,
            camPos,
            { animInAmount: animInRelativeCamPos }
        );
        camPosArrow.lineMaterial.linewidth = 4;
        camPosArrow.lineMaterial.color.copy(c.blue);
        g.overlayScene.add(camPosArrow.obj);

        const cLabelPointVec = new THREE.Vector3();
        const cLabelPoint = Usable.DeriveAny((mirror, cam) => {
            cLabelPointVec.copy(mirror).lerp(cam, 0.5);
            return cLabelPointVec;
        }, mirrorPos, camPos);

        const nLabelPointVec = new THREE.Vector3();
        const nLabelPoint = Usable.DeriveAny(({pos, normalEnd}) => {
            nLabelPointVec.copy(pos).lerp(normalEnd, 0.5);
            return nLabelPointVec;
        }, mirror);

        const usableOverHead = new Usable(g.overHeadCamera);
        attachSVGPartToPoint(cLabelPoint, usableOverHead, document.getElementById('math-c-1'));
        attachSVGPartToPoint(cLabelPoint, usableOverHead, document.getElementById('math-c-2'));
        attachSVGPartToPoint(nLabelPoint, usableOverHead, document.getElementById('math-n-2'), -0.5, -0.5);
        
        const mirrorCamPosArrow = new ArrowObject(
            mirrorPos,
            g.expl.mirrorCamera.derive(cam => cam.position),
            { animInAmount: animInReflectedVec }
        );
        mirrorCamPosArrow.lineMaterial.linewidth = 4;
        mirrorCamPosArrow.lineMaterial.color.copy(c.pink);
        g.overlayScene.add(mirrorCamPosArrow.obj);
        
        const mirrorNormal = new ArrowObject(
            mirrorPos,
            mirror.derive(m => m.normalEnd),
            { nudgeY: 0.1, animInAmount: animInMirrorNormal }
        );
        mirrorNormal.lineMaterial.linewidth = 4;
        mirrorNormal.lineMaterial.color.copy(c.yellow);
        g.overlayScene.add(mirrorNormal.obj);

        /// Rotation reflection

        const useAnimCameraForwardVec = deriveAnimatedEased(g.keyframe.derive(({showCameraForwardVector}) => showCameraForwardVector ? 1.0 : 0.0), 0.5);
        const useAnimreflectedForwardVec = deriveAnimatedEased(g.keyframe.derive(({showReflectedCameraForwardVector}) => showReflectedCameraForwardVector ? 1.0 : 0.0), 1);
        const useAnimReflectedCameraConstructedBasis = deriveAnimatedEased(g.keyframe.derive(({showReflectedCameraConstructedBasis}) => showReflectedCameraConstructedBasis ? 1.0 : 0.0), 1);

        const cameraForwardEndVec = new THREE.Vector3();
        const cameraForwardEnd = g.expl.camera.derive(cam => {
            cameraForwardEndVec.set(0, 0, -1);
            cam.localToWorld(cameraForwardEndVec);
            return cameraForwardEndVec;
        });
        
        const cameraForwardArrow = new ArrowObject(
            camPos,
            cameraForwardEnd,
            { animInAmount: useAnimCameraForwardVec }
        );
        cameraForwardArrow.lineMaterial.linewidth = 4;
        cameraForwardArrow.lineMaterial.color.copy(c.blue);
        g.overlayScene.add(cameraForwardArrow.obj);

        const mirrorCameraForwardEndVec = new THREE.Vector3();
        const mirrorCameraForwardEnd = g.expl.mirrorCamera.derive(cam => {
            mirrorCameraForwardEndVec.set(0, 0, -1);
            cam.localToWorld(mirrorCameraForwardEndVec);
            return mirrorCameraForwardEndVec;
        });

        const mirrorCamAnimPosVec = new THREE.Vector3();
        const mirrorCamAnimPos = Usable.DeriveAny((camPos, mirrorCam, t) => {
            mirrorCamAnimPosVec.copy(camPos).lerp(mirrorCam.position, t);
            return mirrorCamAnimPosVec;
        }, camPos, g.expl.mirrorCamera, useAnimreflectedForwardVec)

        const mirrorCamAnimForwardEndVec = new THREE.Vector3();
        const mirrorCamAnimForwardEnd = Usable.DeriveAny((forwardEnd, mirrorForwardEnd, t) => {
            mirrorCamAnimForwardEndVec.copy(forwardEnd).lerp(mirrorForwardEnd, t);
            return mirrorCamAnimForwardEndVec;
        }, cameraForwardEnd, mirrorCameraForwardEnd, useAnimreflectedForwardVec)
        
        const mirrorCameraForwardArrow = new ArrowObject(
            mirrorCamAnimPos,
            mirrorCamAnimForwardEnd,
            { animInAmount: useAnimCameraForwardVec, nudgeY: -0.1 }
        );
        mirrorCameraForwardArrow.lineMaterial.linewidth = 4;
        mirrorCameraForwardArrow.lineMaterial.color.copy(c.pink);
        g.overlayScene.add(mirrorCameraForwardArrow.obj);
        
        const mirrorCamRightEndVec = new THREE.Vector3();
        const mirrorCamRightEnd = g.expl.mirrorCamera.derive(cam => {
            mirrorCamRightEndVec.set(1, 0, 0);
            cam.localToWorld(mirrorCamRightEndVec);
            return mirrorCamRightEndVec;
        });

        const mirrorCameraRightArrow = new ArrowObject(
            mirrorCamAnimPos,
            mirrorCamRightEnd,
            { animInAmount: useAnimReflectedCameraConstructedBasis, nudgeY: -0.2 }
        );
        mirrorCameraRightArrow.lineMaterial.linewidth = 4;
        mirrorCameraRightArrow.lineMaterial.color.copy(c.purple);
        g.overlayScene.add(mirrorCameraRightArrow.obj);

        return localTick;
    }).set(dt);
}

function setupCameraViews(dt) {
    lazy('cameraViews', () => {
        const localTick = new Usable(0);

        const planeWidth = 6;
        const planeHeight = 4;

        const cameraPreviewPlaneGeom = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const cameraPreviewPlaneMat = new THREE.MeshStandardMaterial({ emissiveMap: g.expl.renderTarget.texture, emissive: 0xffffff, emissiveIntensity: 1 });
        const cameraPreviewPlane = new THREE.Mesh(cameraPreviewPlaneGeom, cameraPreviewPlaneMat);
        
        const mirrorCameraPreviewPlaneMat = new THREE.MeshStandardMaterial({
            emissiveMap: g.expl.mirrorRenderTarget.texture,
            emissive: 0xffffff,
            emissiveIntensity: 1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
        });
        const mirrorCameraPreviewPlane = new THREE.Mesh(cameraPreviewPlaneGeom, mirrorCameraPreviewPlaneMat);
        
        const outlineArray = new Float32Array([
            -planeWidth/2, -planeHeight/2, 0.01,
             planeWidth/2, -planeHeight/2, 0.01,
             planeWidth/2,  planeHeight/2, 0.01,
            -planeWidth/2,  planeHeight/2, 0.01,
            -planeWidth/2, -planeHeight/2, 0.01,
        ]);
        const outlineGeom = new LineGeometry();
        outlineGeom.setPositions(outlineArray)

        const cameraPreviewOutlineMaterial = new LineMaterial({ linewidth: 2 });
        g.darkMode.use(darkMode => cameraPreviewOutlineMaterial.color.setHex(darkMode ? 0xffffff : 0x000000));
        const cameraPreviewOutlineObj = new Line2(outlineGeom, cameraPreviewOutlineMaterial);
        
        const mirrorCameraPreviewOutlineMaterial = new LineMaterial({ linewidth: 2, color: 0xff7700 });
        const mirrorCameraPreviewOutlineObj = new Line2(outlineGeom, mirrorCameraPreviewOutlineMaterial);

        const cameraPreview = new THREE.Group();
        cameraPreview.add(cameraPreviewPlane);
        cameraPreview.add(cameraPreviewOutlineObj);
        
        const mirrorCameraPreview = new THREE.Group();
        mirrorCameraPreview.add(mirrorCameraPreviewPlane);
        mirrorCameraPreview.add(mirrorCameraPreviewOutlineObj);

        const cameraPreviewTarget = new THREE.Group();
        cameraPreviewTarget.position.set(14.5, 0, 0);
        cameraPreviewTarget.rotateX(-Math.PI / 2);

        const mirrorCameraPreviewTarget = new THREE.Group();
        mirrorCameraPreviewTarget.position.set(8.25, planeWidth/2, 0);
        mirrorCameraPreviewTarget.rotateX(-Math.PI / 2);
        
        const cameraPreviewTargetOverlay = new THREE.Group();
        cameraPreviewTargetOverlay.position.copy(mirrorCameraPreviewTarget.position).lerp(cameraPreviewTarget.position, 0.5);
        cameraPreviewTargetOverlay.rotateX(-Math.PI / 2);

        const mirrorCameraPreviewFlippedTarget = cameraPreviewTargetOverlay.clone();
        mirrorCameraPreviewFlippedTarget.position.y += planeWidth/2;
        mirrorCameraPreviewFlippedTarget.rotateY(Math.PI);
        
        const cameraPreviewTargetBottom = new THREE.Vector3().copy(cameraPreviewTargetOverlay.position);
        cameraPreviewTargetBottom.x += 2;
        cameraPreviewTargetBottom.z = 3;

        const useAnimCameraPreview = deriveAnimated(g.keyframe.derive(({ showCameraPreview }) => showCameraPreview ? 1 : 0), 10);
        const useAnimMirrorPreviewFlip = deriveAnimated(g.keyframe.derive(({ flipCameraPreview }) => flipCameraPreview ? 1 : 0), 10);
        const useAnimMoveCameraPreviewToBottom = deriveAnimated(g.keyframe.derive(({ moveCameraPreviewToBottom }) => moveCameraPreviewToBottom ? 1 : 0), 10, localTick);
        
        Usable.UseAny((cam, t, tFlip, tBottom) => {
            cameraPreview.visible = t > epsilon;
            cameraPreviewOutlineMaterial.linewidth = 1 + t;
            cameraPreview.position.set(0, 0, -cam.near);
            cam.localToWorld(cameraPreview.position);
            cameraPreview.position.lerp(cameraPreviewTarget.position, t).lerp(cameraPreviewTargetOverlay.position, tFlip).lerp(cameraPreviewTargetBottom, tBottom);
            cameraPreview.scale.set
            cameraPreview.quaternion.copy(cam.quaternion).slerp(cameraPreviewTarget.quaternion, t).slerp(cameraPreviewTargetOverlay.quaternion, tFlip);
            const scale = lerp(0.21, 1, t);
            cameraPreview.scale.set(scale, scale, scale);
        }, g.expl.camera, useAnimCameraPreview, useAnimMirrorPreviewFlip, useAnimMoveCameraPreviewToBottom);
        
        Usable.UseAny((cam, t, tFlip) => {
            mirrorCameraPreview.position.set(0, 0, -cam.near);
            if (!g.keyframe.value.fadeOutMirrorPreview) {
                mirrorCameraPreviewPlaneMat.opacity = lerp(1, 0.5, tFlip);
                mirrorCameraPreview.visible = t > epsilon;
            }
            cam.localToWorld(mirrorCameraPreview.position);
            mirrorCameraPreview.position.lerp(mirrorCameraPreviewTarget.position, t).lerp(mirrorCameraPreviewFlippedTarget.position, tFlip);
            mirrorCameraPreview.quaternion.copy(cam.quaternion).slerp(mirrorCameraPreviewTarget.quaternion, t).slerp(mirrorCameraPreviewFlippedTarget.quaternion, tFlip);
            const scale = lerp(0.21, 1, t);
            mirrorCameraPreview.scale.set(scale, scale, scale);
        }, g.expl.mirrorCamera, useAnimCameraPreview, useAnimMirrorPreviewFlip);

        deriveAnimated(g.keyframe.derive(({ fadeOutMirrorPreview }) => fadeOutMirrorPreview ? 1.0 : 0.0), 10).use(t => {
            mirrorCameraPreview.visible = t < 1-0.1;
            mirrorCameraPreviewPlaneMat.opacity = lerp(0.5, 0.0, t);
            mirrorCameraPreviewOutlineMaterial.color.setHex(0xff7700).lerp(cameraPreviewOutlineMaterial.color, t);
        });

        g.overlayScene.add(cameraPreview);
        g.overlayScene.add(mirrorCameraPreview);
        
        return localTick;
    }).set(dt);
}

function setupFrustumMath(dt) {
    lazy('frustumMath', () => {
        const localTick = new Usable(0);

        const frustumMath = document.getElementById('panel-frustum');
        frustumMath.style.visibility = 'visible';
        const animHelp = createAnimationHelperFromContainer(frustumMath.children[0], { startIndex: -1 });
        g.keyframe.use(({ frustumMathIndex }) => {
            animHelp.showAtIndex(frustumMathIndex == undefined ? -1 : frustumMathIndex);
        });

        const interactiveMath = document.getElementById('interactive-math');
        const interactiveMathNumber = document.getElementById('interactive-math-number');

        interactiveMathNumber.innerText = g.userPickedClipPlaneScale.peek().toString();
        let previousX = undefined;
        
        g.shownClipPlaneScale.use(n => {
            interactiveMathNumber.innerText = n.toFixed(2);
        });

        interactiveMathNumber.onpointerdown = () => {
            /**
             * @param {MouseEvent} e 
             */
            const listener = (e) => {
                let number = g.userPickedClipPlaneScale.peek();
                number += Math.pow(Math.abs(e.clientX - previousX) / 50, 2) * Math.sign(e.clientX - previousX);
                number = clamp(number, 0.1, 10);
                g.userPickedClipPlaneScale.set(number);
                previousX = e.clientX;
            };
            document.addEventListener('pointerdown', e => {
                console.log('DOWN');
                previousX = e.clientX;
                document.addEventListener('pointermove', listener);
                document.addEventListener('pointerup', () => {
                    document.removeEventListener('pointermove', listener);
                }, { once: true });
            })
        };

        let pShowInteractiveMath = false;
        g.keyframe.use(({ showInteractiveMath }) => {
            if (showInteractiveMath) {
                interactiveMath.classList.remove('hide-interactive-math');
                interactiveMath.classList.add('show-interactive-math');
            } else {
                interactiveMath.classList.remove('show-interactive-math');
                interactiveMath.classList.add('hide-interactive-math');
            }
            if (pShowInteractiveMath !== showInteractiveMath && showInteractiveMath) {
                g.userPickedClipPlaneScale.set(1);
                interactiveMathNumber.innerText = g.userPickedClipPlaneScale.peek().toString();
            }
            pShowInteractiveMath = showInteractiveMath;
        });

        const mirrorCamPos = g.expl.mirrorCamera.derive(cam => cam.position);
        const mirrorPos = localTick.derive(() => g.mirror.object.position);
        const projectedPosVec = new THREE.Vector3();
        const projectedPos = Usable.DeriveAny((mirrorCamPos, mirrorPos) => {
            const normal = g.mirror.getNormal();
            const d = projectedPosVec.copy(mirrorPos).sub(mirrorCamPos).dot(normal);
            projectedPosVec.copy(normal).multiplyScalar(d).add(mirrorCamPos);
            return projectedPosVec;
        }, mirrorCamPos, mirrorPos);

        const useAnimInProjectedLine = deriveAnimated(g.keyframe.derive(({ showMirrorCamDistanceToMirror }) => showMirrorCamDistanceToMirror ? 1.0 : 0.0), 10);

        let projectedLine = new LineObject(projectedPos, mirrorCamPos, useAnimInProjectedLine);
        projectedLine.lineMaterial.color.copy(c.purple);
        projectedLine.lineMaterial.linewidth = 4;
        g.overlayScene.add(projectedLine.obj);

        let projectedDashedLine = new LineObject(projectedPos, mirrorPos, useAnimInProjectedLine);
        projectedDashedLine.lineMaterial.color.copy(c.purple);
        projectedDashedLine.lineMaterial.linewidth = 4;
        projectedDashedLine.lineMaterial.dashed = true;
        projectedDashedLine.lineMaterial.dashOffset = 0;
        projectedDashedLine.lineMaterial.dashScale = 5;
        projectedDashedLine.lineMaterial.dashSize = 1;
        console.log(projectedDashedLine.lineMaterial);
        g.overlayScene.add(projectedDashedLine.obj);

        return localTick;
    }).set(dt);
}

function setupWhatAboutVR() {
    lazy('whatAboutVR', () => {
        const div = document.getElementById('what-about-vr');
        div.classList.remove('hide');
        g.keyframe.derive(({ showWhatAboutVRAtIndex }) => {
            showWhatAboutVRAtIndex = typeof(showWhatAboutVRAtIndex) === 'number' ? showWhatAboutVRAtIndex : -1;
            for (let i = 0; i < Math.min(showWhatAboutVRAtIndex + 1, div.children.length); ++i) {
                div.children[i].classList.remove('hide');
            }
            for (let i = Math.max(showWhatAboutVRAtIndex+1, 0); i < div.children.length; ++i) {
                div.children[i].classList.add('hide');
            }
        })
    });
}

function draw() {
    if (!g.windowVisible || !ready) return;
    
    const dt = g.clock.getDelta();
    g.tick.set(dt);

    lerpCamera(g.camera, g.trackedCamera, g.overHeadCamera, g.state.lerpToOverheadCamera.peek());
    lerpCamera(g.expl.camera.peek(), g.camera, g.expl.fixedCamera, easeOutCubic(g.state.lerpToOverheadCamera.peek()));
    g.expl.camera.touch();

    setupMirrorCamera(g.camera, g.mirror.camera, false);
    setupMirrorCamera(g.expl.camera.peek(), g.expl.mirrorCamera.peek(), true);
    g.expl.mirrorCamera.touch();
    lerpCamera(g.expl.animatedMirrorCamera.peek(), g.expl.mirrorCamera.peek(), g.expl.camera.peek(), 1-g.state.lerpExampleMirrorCamera.peek());
    g.expl.animatedMirrorCamera.touch();

    setupRays();

    setupReflectionArrows(dt);
    setupCameraViews(dt);
    setupFrustumMath(dt);
    setupWhatAboutVR();

    // Render mirror cameras
    g.overlayObjects.visible = false;
        g.scene.background = g.backgroundColor;
            g.mirror.object.material.emissiveMap = null;
                g.renderer.setRenderTarget(g.mirror.renderTarget);
                    g.renderer.render(g.scene, g.mirror.camera);
                g.renderer.setRenderTarget(null);

                g.renderer.setRenderTarget(g.expl.mirrorRenderTarget);
                    g.renderer.render(g.scene, g.expl.mirrorCamera.peek());
                g.renderer.setRenderTarget(null);
            g.mirror.object.material.emissiveMap = g.mirror.renderTarget.texture;
        g.scene.background = null;
    g.overlayObjects.visible = true;
    
    g.mirror.object.material.emissive.setHex(0xffffff);
    g.renderer.render(g.scene, g.camera);
            
    // Render example cam
    g.scene.background = g.backgroundColor;
        g.overlayObjects.visible = false;
            g.mirror.object.material.emissiveMap = g.keyframe.value.applyTextureToMirror ? g.expl.mirrorRenderTarget.texture : null;
            g.mirror.object.material.emissive.setHex(g.keyframe.value.applyTextureToMirror ? 0xffffff : (g.darkMode.value ? 0x000000 : 0xffffff));
            g.renderer.setRenderTarget(g.expl.renderTarget);
                g.renderer.render(g.scene, g.expl.camera.peek());
            g.renderer.setRenderTarget(null);
        g.overlayObjects.visible = true;
    g.scene.background = null;

    // Overlay scene
    g.renderer.autoClear = false;
    g.renderer.clearDepth();
        g.renderer.render(g.overlayScene, g.overHeadCamera);
    g.renderer.autoClear = true;

    // Update lil-gui
    for (const controller of g.gui.controllers) {
        controller.updateDisplay();
    }
}

function resize() {
    g.renderer?.setSize(window.innerWidth, window.innerHeight);
    g.mirror.renderTarget?.setSize(g.renderer.domElement.width, g.renderer.domElement.height);
    const aspect = window.innerWidth / window.innerHeight;
    g.camera.aspect = aspect;
    g.camera.updateProjectionMatrix();
    
    if (g.trackedCamera && g.overHeadCamera) {
        g.trackedCamera.aspect = aspect;
        g.trackedCamera.updateProjectionMatrix();
        const camWidth = 24;
        const camHeight = 12;
        if (aspect < camWidth / camHeight) {
            g.overHeadCamera.right = camWidth/2;
            g.overHeadCamera.left = -camWidth/2;
            g.overHeadCamera.top = g.overHeadCamera.right / aspect;
            g.overHeadCamera.bottom = g.overHeadCamera.left / aspect;
        } else {
            g.overHeadCamera.top = camHeight/2;
            g.overHeadCamera.bottom = -camHeight/2;
            g.overHeadCamera.right = g.overHeadCamera.top * aspect;
            g.overHeadCamera.left = g.overHeadCamera.bottom * aspect;
        }
        g.overHeadCamera.updateProjectionMatrix();
    }
}

function startDrawing() {
    setup();
    window.onresize = resize;
    g.renderer.setAnimationLoop(draw);
}

preload();

if (!Keyframes.isInIFrame()) {
    g.windowVisible = true;
    startDrawing();
} else {
    let pinstantClipPlane = undefined;
    Keyframes.setKeyframeCallback(
        f => {
            console.log('keyframe received', f.keyframe);

            const kf = f.keyframe;

            g.target.fixClipPlaneAmount.set(kf.fixClipPlane ? 1.0 : 0.0);
            g.target.optimizeClipPlaneAmount.set(kf.optimizeClipPlane ? 1.0 : 0.0);
            g.target.lerpToOverheadCamera.set(kf.overheadCam ? 1.0 : 0.0);
            g.target.showCameraFrustum.set(!!kf.showCameraFrustum);
            g.target.showMirrorFrustum.set(!!kf.showMirrorCameraFrustum);
            g.target.lerpExampleMirrorCamera.set(kf.showMirrorCameraFrustum ? 1.0 : 0.0);
            
            if (f.slideJustRevealed) g.windowVisible = true;
            if (f.slideJustHidden) g.windowVisible = false;
            
            if (f.init || (!!kf.instantClipPlane != !!pinstantClipPlane)) {
                g.state.fixClipPlaneAmount.set(kf.fixClipPlane ? 1.0 : 0.0);
                g.state.optimizeClipPlaneAmount.set(kf.optimizeClipPlane ? 1.0 : 0.0);
            }

            g.keyframe.set({ init: f.init, ...kf });

            if (f.init) {
                g.state.lerpToOverheadCamera.set(kf.overheadCam ? 1.0 : 0.0);
                g.state.showCameraFrustum.set(!!kf.showCameraFrustum);
                g.state.showMirrorFrustum.set(!!kf.showMirrorCameraFrustum);
                g.state.lerpExampleMirrorCamera.set(kf.showMirrorCameraFrustum ? 1.0 : 0.0);


                console.log('Initializing');
                startDrawing();
            }

            pinstantClipPlane = kf.instantClipPlane;
        },
        isDark => {
            g.darkMode.set(isDark);
        },
    );
}