//dumy data
var streamv;
var token = 'abc';
var userid = 1;
const constraints = {
    video: true,
    audio: true
};

if (getUserMediaSupported()) {
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        streamv = stream;
    });
    document.addEventListener('modelLoaded', () => {
        initializeData(token, userid, streamv)
    });
} else {
    console.warn('getUserMedia() is not supported by your browser');
}
function getUserMediaSupported() {
    return !!(navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia);
}