export class Slider {
    constructor(container, object, property, min, max, callback, label_text) {
        const sliderContainer = document.createElement('div');
        sliderContainer.style.display = 'flex';
        sliderContainer.style.flexDirection = 'row';
        sliderContainer.style.alignContent = 'center';
        sliderContainer.style.justifyContent = 'center';
        sliderContainer.style.gap = '1em';
        if ((label_text ?? String(property)).length > 0) {
            const label = sliderContainer.appendChild(document.createElement('label'));
            label.textContent = label_text ?? String(property);
        }
        const sliderInput = sliderContainer.appendChild(document.createElement('input'));
        sliderInput.type = 'range';
        sliderInput.min = String(min);
        sliderInput.max = String(max);
        sliderInput.step = '0.01'; // Make customizable?
        const thing = object[property];
        sliderInput.value = String(thing);
        sliderInput.addEventListener('input', () => {
            console.log('hey');
            object[property] = Number(sliderInput.value);
            callback();
        });
        container.appendChild(sliderContainer);
    }
}
