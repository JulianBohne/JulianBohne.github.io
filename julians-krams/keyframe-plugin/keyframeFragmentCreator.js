var Keyframes = {

  /**
   * Maps the id of an iframe to its corresponding keyframes and the current keyframe index
   * @type {Map<string, object[]>}
   */
  idToFrameInfo: new Map(),

  /**
   * 
   * @param {string} className 
   * @param {object[]} keyframes
   */
  setKeyframes: (id, keyframes) => {
    let iframe = document.getElementById(id);

    if (!iframe) {
      console.error(`Could not set keyframes for iframe with id '${id}': Could not find element.`);
      return;
    }

    if (iframe.tagName !== 'IFRAME') {
      console.error(`Could not set keyframes for iframe with id '${id}': Element is '${iframe.tagName}', not an iframe.`)
    }

    // Remove all previous fragments associated with this iframe
    document.querySelectorAll(`span.fragment.${id}`).forEach(element => element.parentElement.removeChild(element));

    // Add new fragments for this iframe
    for (let i = 0; i < keyframes.length - 1; ++i) {
      let fragment = document.createElement('span');
      fragment.className = `fragment ${id}`;
      fragment.dataset.fragmentIndex = `${i}`;
      fragment.ariaHidden = 'true';
      fragment.style.display = 'none';
      iframe.parentElement.appendChild(fragment);
    }

    /**
     * @param {object} acc accumulator (is not mutated)
     * @param {object} obj some other object (is not mutated)
     */
    function mergeObjects(acc, obj) {
      if (acc === undefined || acc === null) acc = {};

      if (obj === null || obj === undefined) {
        return obj;

      } else if (Array.isArray(obj)) {
        return [...obj];

      } else if (obj.overwrite) {
        const result = {...obj};
        delete result.overwrite;
        return result;

      } else {
        const result = {...acc};
        
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'object') {
            result[key] = mergeObjects(result[key], value);
          } else {
            result[key] = value;
          }

          if (result[key] === undefined) {
            delete result[key];
          }
        });

        return result;
      }
    }

    const accumulatedKeyframes = keyframes.map((keyframe, idx) => {
      if (keyframe.overwrite) { 
        delete keyframe.overwrite;
        return {
          ...keyframe, 
          frameIndex: idx
        };
      } else {
        return {
          // Accumulate keyframes by only applying updates
          ...keyframes.slice(0, idx + 1).reduce((acc, curr) => {
            let accumulated = mergeObjects(acc, curr);
            delete accumulated.overwrite;
            return accumulated;
          }, {}),
          frameIndex: idx,
        };
      }
    });

    Keyframes.idToFrameInfo.set(id, { frames: accumulatedKeyframes, revealReady: false, iframeReady: false });
  }
}

window.KeyframesPlugin = Keyframes;