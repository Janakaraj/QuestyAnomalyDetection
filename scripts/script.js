//dumy data
var streamv;
var token = 'abc';
var userid = 1;
const constraints = {
    video: true,
    audio: true
};

// checks media support
if (getUserMediaSupported()) {
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        streamv = stream;
    });
} else {
    console.warn('getUserMedia() is not supported by your browser');
}
function getUserMediaSupported() {
    return !!(navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia);
}