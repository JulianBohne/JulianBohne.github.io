import Reveal from "../../support/vendor/reveal/dist/reveal.esm.js"

if (!window.KeyframesPlugin) {
  var Keyframes = {};
} else {
  var Keyframes = window.KeyframesPlugin;
}

Keyframes.isInIFrame = () => {
  // https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

Keyframes.setKeyframeCallback = (keyframeCallback, themeCallback) => {
  window.onmessage = message => {
    if (message.data.type === 'keyframe') {

      keyframeCallback(message.data);

    } else if (message.data.type === 'css-declarations') {

      const styleTag = document.createElement('style');
      styleTag.classList.add('css-declarations');
      styleTag.innerHTML = message.data.declarations;
      document.head.appendChild(styleTag);

    } else if (message.data.type === 'theme-change') {
      if (message.data.isDark) {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
      if (themeCallback) themeCallback(message.data.isDark);
    }
  };

  window.top.postMessage('init', '*');
};

// https://stackoverflow.com/questions/9153445/how-to-communicate-between-iframe-and-the-parent-site

if (Keyframes.isInIFrame()) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      window.top.postMessage('ArrowRight', '*');
    } else if (event.key === 'ArrowLeft') {
      window.top.postMessage('ArrowLeft', '*');
    }
  });
} else {

  const isDarkMode = () => document.documentElement.classList.contains('dark');

  Reveal.on('ready', () =>
    document.getElementById('decker-menu-color-button').addEventListener('click', () => {
      const isDark = isDarkMode();
      document.querySelectorAll('iframe').forEach(iframe => {
        if (!iframe.id || !Keyframes.idToFrameInfo.has(iframe.id)) return;
        iframe.contentWindow.postMessage({
          type: 'theme-change',
          isDark: isDark,
        });
      });
    })
  );

  const messageCurrentIFramesWithKeyframes = (e) => {
    if (e.type === 'slidechanged') {
      if (e.previousSlide) {
        e.previousSlide.querySelectorAll('iframe').forEach(iframe => {
          if (!iframe.id || !Keyframes.idToFrameInfo.has(iframe.id)) return;

          let keyframeIndex = e.previousSlide.querySelectorAll(`span.fragment.visible.${iframe.id}`).length;

          const frameInfo = Keyframes.idToFrameInfo.get(iframe.id);

          if (frameInfo.iframeReady) {
            let message = {
              type: 'keyframe',
              init: !frameInfo.revealReady,
              slideJustRevealed: false,
              slideJustHidden: true,
              keyframe: frameInfo.frames[keyframeIndex],
            }

            iframe.contentWindow.postMessage(message);
          }

          frameInfo.revealReady = true;
        })
      }
    }
    document.querySelectorAll('section.present iframe').forEach(iframe => {
      if (!iframe.id || !Keyframes.idToFrameInfo.has(iframe.id)) return;

      let keyframeIndex = document.querySelectorAll(`section.present span.fragment.visible.${iframe.id}`).length;

      const frameInfo = Keyframes.idToFrameInfo.get(iframe.id);

      if (frameInfo.iframeReady) {
        let keyframe = {
          type: 'keyframe',
          init: !frameInfo.revealReady,
          slideJustRevealed: e.type === 'slidechanged',
          slideJustHidden: false,
          keyframe: frameInfo.frames[keyframeIndex],
        }

        iframe.contentWindow.postMessage(keyframe);
      }

      frameInfo.revealReady = true;
    });
  }

  Reveal.on('slidechanged', messageCurrentIFramesWithKeyframes);
  Reveal.on('fragmentshown', messageCurrentIFramesWithKeyframes);
  Reveal.on('fragmenthidden', messageCurrentIFramesWithKeyframes);

  window.onmessage = function(e) {

    if (e.data === 'ArrowRight') {
      Reveal.right();
    } else if (e.data === 'ArrowLeft') {
      Reveal.left();
    } else if (e.data === 'init') {

      const iframe = Array.from(document.querySelectorAll('iframe')).filter(iframe => iframe.contentWindow === e.source)[0];

      if (!iframe) {
        console.warn(`Could not find iframe that sent 'init' message.`, e);
        return;
      }

      let keyframeIndex = document.querySelectorAll(`span.fragment.visible.${iframe.id}`).length;

      const frameInfo = Keyframes.idToFrameInfo.get(iframe.id);
      
      // Send styles
      const cssDeclElem = document.querySelector('.css-declarations');
      if (cssDeclElem) {
        iframe.contentWindow.postMessage({
          type: 'css-declarations',
          declarations: cssDeclElem.innerHTML,
        })
      }

      // Send theme
      iframe.contentWindow.postMessage({
        type: 'theme-change',
        isDark: isDarkMode(),
      });

      // Send keyframe if reveal is already initialized
      if (frameInfo.revealReady) {
        let keyframe = {
          type: 'keyframe',
          init: true,
          keyframe: frameInfo.frames[keyframeIndex],
          // TODO: Other fields???
        }

        iframe.contentWindow.postMessage(keyframe);
      }

      frameInfo.iframeReady = true;

    } else {
      console.log('Unknown message ', e.data);
    }
  };

  console.log('Installed keyframe hooks');
}

export default Keyframes;
