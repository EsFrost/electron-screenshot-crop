const { ipcRenderer } = require('electron');

let screenshotImage;


function saveImage() {
    if (screenshotImage) {
        // Convert the image to a data URL
        const canvas = document.createElement('canvas');
        canvas.width = screenshotImage.width;
        canvas.height = screenshotImage.height;
        canvas.getContext('2d').drawImage(screenshotImage, 0, 0);
        const dataURL = canvas.toDataURL('image/png');

        // Send the data URL to the main process to save the file
        ipcRenderer.send('save-image', dataURL);
    } else {
        alert('No image to save. Please take a screenshot first.');
    }
}

// Add a "Save Image" button to your HTML
document.getElementById('save-image').addEventListener('click', saveImage);

async function captureScreen() {
    try {
        const sources = await ipcRenderer.invoke('GET_SOURCES');
        
        let sourceId;
        if (sources.length > 1) {
            sourceId = await new Promise((resolve) => {
                const buttons = sources.map(source => `<button data-id="${source.id}">${source.name}</button>`).join('');
                document.body.insertAdjacentHTML('beforeend', `<div id="source-picker">${buttons}</div>`);
                document.getElementById('source-picker').addEventListener('click', (e) => {
                    if (e.target.dataset.id) {
                        document.getElementById('source-picker').remove();
                        resolve(e.target.dataset.id);
                    }
                });
            });
        } else {
            sourceId = sources[0].id;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                }
            }
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                video.pause();

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);

                stream.getTracks().forEach(track => track.stop());
                resolve(canvas.toDataURL('image/png'));
            };
        });
    } catch (error) {
        console.error('Error capturing screen:', error);
        throw error;
    }
}

document.getElementById('take-screenshot').addEventListener('click', async () => {
    try {
        const screenshotDataUrl = await captureScreen();
        screenshotImage = new Image();
        screenshotImage.src = screenshotDataUrl;
        screenshotImage.onload = () => {
            const container = document.getElementById('screenshot-container');
            container.innerHTML = '';
            container.appendChild(screenshotImage);
            document.getElementById('crop-screenshot').disabled = false;
        };
    } catch (error) {
        console.error('Error taking screenshot:', error);
        alert(`Error taking screenshot: ${error.message}`);
    }
});

let isSelecting = false;
let startX, startY, endX, endY;

document.getElementById('crop-screenshot').addEventListener('click', () => {
    if (screenshotImage) {
        const container = document.getElementById('cropper-container');
        container.innerHTML = '';
        container.style.display = 'block';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.backgroundColor = 'rgba(0,0,0,0.5)';
        container.style.zIndex = '9999';

        const canvas = document.createElement('canvas');
        canvas.width = screenshotImage.width;
        canvas.height = screenshotImage.height;
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.margin = 'auto';
        canvas.style.display = 'block';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(screenshotImage, 0, 0);

        canvas.addEventListener('mousedown', startSelection);
        canvas.addEventListener('mousemove', updateSelection);
        canvas.addEventListener('mouseup', endSelection);

        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply';
        applyButton.style.position = 'fixed';
        applyButton.style.bottom = '20px';
        applyButton.style.left = '50%';
        applyButton.style.transform = 'translateX(-50%)';
        applyButton.addEventListener('click', applyCrop);
        container.appendChild(applyButton);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.position = 'fixed';
        cancelButton.style.bottom = '20px';
        cancelButton.style.left = 'calc(50% + 60px)';
        cancelButton.style.transform = 'translateX(-50%)';
        cancelButton.addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
        container.appendChild(cancelButton);
    } else {
        alert('Please take a screenshot first before cropping.');
    }
});

function startSelection(e) {
    isSelecting = true;
    const rect = e.target.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    endX = startX;
    endY = startY;
}

function updateSelection(e) {
    if (!isSelecting) return;
    const rect = e.target.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;
    redrawCanvas();
}

function endSelection() {
    isSelecting = false;
}

function redrawCanvas() {
    const canvas = document.querySelector('#cropper-container canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(screenshotImage, 0, 0);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
}

function applyCrop() {
    const cropWidth = Math.abs(endX - startX);
    const cropHeight = Math.abs(endY - startY);
    
    if (cropWidth < 10 || cropHeight < 10) {
        alert('Please select a larger area to crop.');
        return;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    ctx.drawImage(screenshotImage, 
        Math.min(startX, endX), Math.min(startY, endY), cropWidth, cropHeight, 
        0, 0, cropWidth, cropHeight);
    
    screenshotImage = new Image();
    screenshotImage.onload = () => {
        const container = document.getElementById('screenshot-container');
        container.innerHTML = '';
        container.appendChild(screenshotImage);
        document.getElementById('cropper-container').style.display = 'none';
    };
    screenshotImage.src = canvas.toDataURL('image/png');

    screenshotImage.onload = () => {
        const container = document.getElementById('screenshot-container');
        container.innerHTML = '';
        container.appendChild(screenshotImage);
        document.getElementById('cropper-container').style.display = 'none';

        // Add a save button after cropping
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Cropped Image';
        saveButton.addEventListener('click', saveImage);
        container.appendChild(saveButton);
    };
    screenshotImage.src = canvas.toDataURL('image/png');
}