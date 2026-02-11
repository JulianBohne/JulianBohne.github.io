import Reveal from "/support/vendor/reveal/dist/reveal.esm.js"
import { Slider } from './gui.js';
import { Splatter } from './renderer.js';

(async () => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('surface');
  canvas.width = 800;
  canvas.height = 600;
  // canvas.onclick = () => {
  //   canvas.requestPointerLock();
  // };
  const gui_container = document.getElementById('gui-container');
  const splatter = await Splatter.new(canvas, 1);
  const degreesPerPixel = 1;
  canvas.onmousemove = e => {
      if (document.pointerLockElement == canvas) {
          const deltaYaw = e.movementX * degreesPerPixel * (Math.PI / 180);
          const deltaPitch = e.movementY * degreesPerPixel * (Math.PI / 180);
          splatter.camera.yaw += deltaYaw;
          splatter.camera.pitch += deltaPitch;
      }
  };
  // new Slider(gui_container, splatter.camera, 'fov', 0.1, 0.9*Math.PI, () => {});
  // new Slider(gui_container, splatter.camera, 'far', 1, 100, () => {});
  // new Slider(gui_container, splatter.camera, 'near', 0.1, 10, () => { });
  // new Slider(gui_container, splatter.camera, 'x', -10, 10, () => { });
  // new Slider(gui_container, splatter.camera, 'y', -10, 10, () => {});
  // new Slider(gui_container, splatter.camera, 'z', -10, 10, () => {});
  gui_container.appendChild(document.createElement('span')).textContent = 'Position $\\vec \\mu$';
  new Slider(gui_container, splatter.gaussians[0].position, '0', -10, 10, () => { }, 'x');
  new Slider(gui_container, splatter.gaussians[0].position, '1', -10, 10, () => { }, 'y');
  new Slider(gui_container, splatter.gaussians[0].position, '2', -10, 10, () => { }, 'z');
  gui_container.appendChild(document.createElement('span')).textContent = 'Scale $\\vec s$';
  new Slider(gui_container, splatter.gaussians[0].scale, '0', 0.1, 2, () => { }, 'x');
  new Slider(gui_container, splatter.gaussians[0].scale, '1', 0.1, 2, () => { }, 'y');
  new Slider(gui_container, splatter.gaussians[0].scale, '2', 0.1, 2, () => { }, 'z');
  gui_container.appendChild(document.createElement('span')).textContent = 'Rotation $\\vec r$';
  new Slider(gui_container, splatter.gaussians[0].rotation, '0', -Math.PI, Math.PI, () => { }, 'x');
  new Slider(gui_container, splatter.gaussians[0].rotation, '1', -Math.PI, Math.PI, () => { }, 'y');
  new Slider(gui_container, splatter.gaussians[0].rotation, '2', -Math.PI, Math.PI, () => { }, 'z');
  gui_container.appendChild(document.createElement('span')).textContent = 'Color $\\vec c$';
  const colorInputContainer = gui_container.appendChild(document.createElement('div'));
  const colorInput = colorInputContainer.appendChild(document.createElement('input'));
  colorInput.type = 'color';
  colorInput.value = '#888888';
  colorInput.oninput = () => {
      const color = colorInput.value;
      const r = parseInt(color.slice(1, 1 + 2), 16) / 255;
      const g = parseInt(color.slice(3, 3 + 2), 16) / 255;
      const b = parseInt(color.slice(5, 5 + 2), 16) / 255;
      splatter.gaussians[0].color[0] = r;
      splatter.gaussians[0].color[1] = g;
      splatter.gaussians[0].color[2] = b;
  };
  gui_container.appendChild(document.createElement('span')).textContent = 'Opacity $\\alpha$';
  new Slider(gui_container, splatter.gaussians[0], 'alpha', 0, 1, () => { }, '');

  let stopRendering = false;

  Reveal.on('ready', () => {
    MathJax.typeset();
    /** @type {HTMLElement} */
    const slide = document.querySelector('section.present');
    if (slide.contains(canvas)) {
      stopRendering = false;
      requestAnimationFrame(animationFunc);
    }
  });
  // Just in case the reveal event doesn't work
  setTimeout(() => {
    MathJax.typeset();
    /** @type {HTMLElement} */
    const slide = document.querySelector('section.present');
    if (slide.contains(canvas)) {
      stopRendering = false;
      requestAnimationFrame(animationFunc);
    }
  }, 1000);

  const animationFunc = async (time) => {
      if (stopRendering) return;
      // console.log('Rendering single gaussian...');
      splatter.gaussians[0].update();
      splatter.update_gaussians_from_cpu();
      splatter.render(time);
      requestAnimationFrame(animationFunc);
  };

  Reveal.on('slidechanged', (e) => {
    /** @type {HTMLElement} */
    const slide = e.currentSlide;
    if (slide.contains(canvas)) {
      stopRendering = false;
      requestAnimationFrame(animationFunc);
    } else {
      stopRendering = true;
    }
  });
})();
