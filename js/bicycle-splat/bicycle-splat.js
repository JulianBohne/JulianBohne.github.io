import * as SPLAT from "./vendor/gsplat/dist/index.es.js";
import Reveal from "/support/vendor/reveal/dist/reveal.esm.js"

const scene = new SPLAT.Scene();
const camera = new SPLAT.Camera();

const canvasID = 'render-output';

const canvas = /** @type {HTMLCanvasElement} */ document.getElementById(canvasID);
const renderer = new SPLAT.WebGLRenderer(canvas);
const controls = new SPLAT.OrbitControls(camera, renderer.canvas, -2, 0.2, undefined, false, new SPLAT.Vector3(1, 0, 0));

async function main() {
  const url = "js/bicycle-splat/splats/bicycle-7k-mini.splat";

  await SPLAT.Loader.LoadAsync(url, scene, () => { });

  let pWidth = canvas.clientWidth;
  let pHeight = canvas.clientHeight;

  let stopRendering = false;

  // This is not firing for some reason :/
  Reveal.on('ready', () => console.log('READY!'));
  setTimeout(() => {
    /** @type {HTMLElement} */
    const slide = document.querySelector('section.present');
    if (slide.contains(canvas)) {
      stopRendering = false;
      renderer.resize();
      requestAnimationFrame(frame);
    }
  }, 1000);

  const frame = () => {
    if (stopRendering) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width !== pWidth || height !== pHeight) {
      renderer.resize();
      pWidth = width;
      pHeight = height;
    }

    controls.update();
    canvas.style.cursor = 'default';

    // console.log('Rendering bicycle...');
    renderer.render(scene, camera);

    requestAnimationFrame(frame);
  };

  Reveal.on('slidechanged', (e) => {
    /** @type {HTMLElement} */
    const slide = e.currentSlide;
    if (slide.contains(canvas)) {
      stopRendering = false;
      renderer.resize();
      requestAnimationFrame(frame);
    } else {
      stopRendering = true;
    }
  });
}

main();
