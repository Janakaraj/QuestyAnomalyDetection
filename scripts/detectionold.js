//const enableWebcamButton = document.getElementById('webcamButton');

const stopButton = document.getElementById('stopButton');
const video = document.getElementById('webcam');
var modelLoadedEvent = new CustomEvent('modelLoaded');
var stopFlag = false;
var audioCounter = 0;
var UNPArray = [];
var UPPArray = [];
var EDFArray = [];
var MDPArray = [];

if (getUserMediaSupported()) {
    document.addEventListener('modelLoaded', enableCam);
} else {
    console.warn('getUserMedia() is not supported by your browser');
}
// load required models
blazeface.load().then(function (loadedFmodel) {
    fdmodel = loadedFmodel;
    console.log("Blazeface model loaded");
    cocoSsd.load().then(function (loadedOmodel) {
        objectDetectionModel = loadedOmodel;
        console.log("Coco-ssd model loaded");
        // Show user that now model is ready to use.
        console.log("Model loaded successfully......");
        document.dispatchEvent(modelLoadedEvent);
    });
});
stopButton.addEventListener('click', stopCam);
function initData(token, userid, stream){
localStorage.setItem('auth_token', token);
}
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
        video.addEventListener('loadeddata', detectFaces);
        video.addEventListener('loadeddata', detectObjects);
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);
        javascriptNode.onaudioprocess = function () {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            var values = 0;
            var length = array.length;
            for (var i = 0; i < length; i++) {
                values += (array[i]);
            }
            var average = values / length;
            if (Math.round(average) > 40) {
                if (audioCounter % 10 == 0) {
                    var date = new Date();
                    var timeStamp = date.getTime();
                    //capture("upp", timeStamp);
                    console.log("Call was detected at " + timeStamp);
                    console.log(audioCounter);
                }
                audioCounter++;
            }
        }
    });
}

function detectObjects() {
    objectDetectionModel.detect(video).then((predictions) => {
        if (predictions.length > 0 && !stopFlag) {
            for (let n = 0; n < predictions.length; n++) {
                //if the prediction score is greater than 0.66 its a valid prediction
                if (predictions[n].score > 0.66) {
                    //if electronic device is detected
                    if (predictions[n].class == "cell phone"
                        || predictions[n].class == "laptop"
                        || predictions[n].class == "remote"
                        || predictions[n].class == "tv") {
                        var date = new Date();
                        var timeStamp = date.getTime();
                        capture("edf", timeStamp);
                        console.log("Electronic device detected at " + timeStamp);
                    }


                    //if a person is detected partially
                    // if (predictions[n].class == "person" && predictions[n].score <= 0.8
                    //     && (predictions[n].bbox[0] < 0.4 || predictions[n].bbox[1] < 0.4 || predictions[n].bbox[2] > 0.6 || predictions[n].bbox[3] > 0.6)) {
                    //     var date = new Date();
                    //     var timeStamp = date.getTime();
                    //     //capture("upp", timeStamp);
                    //     console.log("Person detected partially at " + timeStamp);
                    // }
                }
            }
        }
        window.setTimeout(function () { reqId = window.requestAnimationFrame(detectObjects) }, 1000);
    });

}

async function detectFaces() {
    //const model = await blazeface.load();
    const predictions = await fdmodel.estimateFaces(video, false);
    if (predictions.length == 0) {
        var date = new Date();
        var timeStamp = date.getTime();
        capture("unp", timeStamp);
        console.log("User not present at " + timeStamp);
    }
    else {
        for (let i = 0; i < predictions.length; i++) {
            var probability = predictions[i].probability;
            if (predictions[i].probability > 0.66) {
                //if multiple people are detected
                if (predictions.length > 1) {
                    var date = new Date();
                    var timeStamp = date.getTime();
                    capture("mpd", timeStamp);
                    console.log("Muttiple people were detected at " + timeStamp);
                }
                if (predictions[i].bottomRight[0] < 170 || predictions[i].bottomRight[0] > 650 || predictions[i].bottomRight[1] > 450 || predictions[i].bottomRight[1] < 140) {
                    var date = new Date();
                    var timeStamp = date.getTime();
                    capture("upp", timeStamp);
                    console.log("Person detected partially at " + timeStamp);
                }
            }
        }
    }

    if (stopFlag == false) {
        window.setTimeout(function () { detectFaces() }, 1000);
    }

}

function stopCam() {
    window.cancelAnimationFrame(reqId);
    video.srcObject.getTracks().forEach(function (track) {
        track.stop();
    });
    localStorage.clear();
    stopFlag = true;
}

function capture(label, timestamp) {
    var canvas = document.getElementById('canvas');
    var video = document.getElementById('webcam');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    // var imageData = canvas.toDataURL();
    // console.log(imageData);
    // var userid = 1;
    // var data = { userid, filename, imageData, label, timestamp };

    // postData(JSON.stringify(data));
    canvas.toBlob(function (blob) {
        var fd = new FormData();
        fd.append('userid', 1)
        fd.append('imageData', blob);
        fd.append('anomalyLabel', label);
        fd.append('timestamp', timestamp);
        if(label == "unp"){
            addToArray(timestamp, blob, "unp", UNPArray);
        }
        if(label == "mdp"){
            addToArray(timestamp, blob, "mdp", MDPArray);
        }
        if(label == "upp"){
            addToArray(timestamp, blob, "upp", UPPArray);
        }
        if(label == "edf"){
            addToArray(timestamp, blob, "edf", EDFArray);
        }
        console.log(UNPArray, MDPArray, UPPArray, EDFArray);
        //postData(fd);
    });

    //     for (var key of data.entries()) {
    //         console.log(key[0] + ', ' + key[1]);
    //     }
    //     var newImg = document.createElement('img'),
    //         url = URL.createObjectURL(blob);

    //     newImg.onload = function () {
    //         // no longer need to read the blob so it's revoked
    //         URL.revokeObjectURL(url);
    //     };

    //     newImg.src = url;
    //     document.body.appendChild(newImg);
    //     /** End **/
    // });
}
async function fakePost(dataArray) {
    if (dataArray.length > 6) {
        //await delete
        console.log("posted a pair");
        console.log("deleteing a pair");
        //dataArray.splice(i,2);
        console.log(dataArray);
    }
}
function postData(formdata) {
    fetch("https://localhost:44331/api/data", {

        // Adding method type 
        method: "POST",

        // Adding body or contents to send 
        body: formdata,

        // Adding headers to the request 
        headers: {
            "Content-type": "application/json",
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
    })
        // Converting to JSON 
        .then(response => response)

        // Displaying results to console 
        .then(json => console.log(json));
}

function addToArray(timestamp, imageData, label, dataArray) {
    var newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: false, isLast: false, duration: 0 };
    if (dataArray.length == 0) {
        newEntry.isFirst = true;
        dataArray.push(newEntry);
    }
    else {
        //discard single frame captures
        if(dataArray[dataArray.length - 1].isFirst == true && dataArray[dataArray.length - 1].isLast == true){
            dataArray.pop();
        }
        if ((newEntry.timestamp - dataArray[dataArray.length - 1].timestamp) > 5000) {
            dataArray[dataArray.length - 1].isLast = true;
            newEntry.isFirst = true;
            dataArray.push(newEntry);
            dataArray[dataArray.length - 2].duration = dataArray[dataArray.length - 2].timestamp - dataArray[dataArray.length - 3].timestamp;
        }
        else {
            if (dataArray[dataArray.length - 1].isFirst == true) {
                dataArray.push(newEntry);
            }
            else {
                dataArray.pop();
                dataArray.push(newEntry);
            }
        }
    }
}
function hello(){
    console.log("hello world");
}