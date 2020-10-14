const stopButton = document.getElementById('stopButton');
const video = document.getElementById('webcam');
initData("abc",1);
if (getUserMediaSupported()) {
    document.addEventListener('modelLoaded', enableCam);
} else {
    console.warn('getUserMedia() is not supported by your browser');
}
stopButton.addEventListener('click', stopCam);
function getUserMediaSupported() {
    return !!(navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia);
}
function enableCam() {
    // Only continue if the models has finished loading.
    if (!objectDetectionModel && !fdmodel) {
        return;
    }
    // Hide the button once clicked.
    //enableWebcamButton.disabled = true;
    stopButton.disabled = false;

    // getUsermedia parameters to use both audio and video.
    const constraints = {
        video: true,
        audio: true,
        noiseSuppression: true
    };

    // Activate the webcam stream.
    navigator.getUserMedia = (
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia
    );
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        startDetection();        
        //video.addEventListener('loadeddata', detectFaces(video));
        //video.addEventListener('loadeddata', detectObjects(video));
    });
}
