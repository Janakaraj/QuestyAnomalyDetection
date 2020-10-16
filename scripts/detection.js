const video = document.getElementById('webcam');
let modelLoadedEvent = new CustomEvent('modelLoaded');
let stopFlag = false;

let UNPArray = [];
let UFCArray = [];
let UPPArray = [];
let EDFArray = [];
let MPDArray = [];
let PCDArray = [];
let postArray = [];

let userId;
let auth_token;

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
var recognition = new SpeechRecognition();
recognition.continuous = true;

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
window.setInterval(function () { postDataFromArray(); }, 1000);
function initData(token, userid) {
    localStorage.setItem('auth_token', token);
    userId = userid;
}

video.addEventListener('loadeddata', detectFaces);
video.addEventListener('loadeddata', detectObjects);
video.addEventListener('loadeddata', detectCalls);


async function detectObjects() {
    if (!stopFlag) {
        objectDetectionModel.detect(video).then((predictions) => {
            if (predictions.length > 0) {
                for (let n = 0; n < predictions.length; n++) {
                    //if the prediction score is greater than 0.66 its a valid prediction
                    if (predictions[n].score > 0.66) {
                        //if electronic device is detected
                        if (predictions[n].class == "cell phone"
                            || predictions[n].class == "laptop"
                            || predictions[n].class == "remote"
                            || predictions[n].class == "tv") {
                            let date = new Date();
                            let timeStamp = date.getTime();
                            capture("edf", timeStamp);
                            console.log("Electronic device detected at " + timeStamp);
                        }
                    }
                }
            }
            window.setTimeout(function () { reqId = window.requestAnimationFrame(detectObjects) }, 1000);
        });
    }
}

async function detectFaces() {
    if (!stopFlag) {
        const predictions = await fdmodel.estimateFaces(video, false);
        if (predictions.length == 0) {
            let date = new Date();
            let timeStamp = date.getTime();
            capture("unp", timeStamp);
            console.log("User not present at " + timeStamp);
        }
        else {
            for (let i = 0; i < predictions.length; i++) {
                if (predictions[i].probability > 0.66) {
                    //if multiple people are detected
                    if (predictions.length > 1) {
                        let date = new Date();
                        let timeStamp = date.getTime();
                        capture("mpd", timeStamp);
                        console.log("Muttiple people were detected at " + timeStamp);
                    }
                    //if person is not in the centre of the frame
                    if (predictions[i].bottomRight[0] < 170 
                        || predictions[i].bottomRight[0] > 650 
                        || predictions[i].bottomRight[1] > 450 
                        || predictions[i].bottomRight[1] < 140) {
                        let date = new Date();
                        let timeStamp = date.getTime();
                        capture("upp", timeStamp);
                        console.log("Person detected partially at " + timeStamp);
                    }
                    //if user's face is covered
                    else if (predictions[0].probability < 0.97) {
                        let date = new Date();
                        let timeStamp = date.getTime();
                        capture("ufc", timeStamp);
                        console.log("Users face is covered at: " + timeStamp);
                    }
                }
            }
        }
        //check whether to continue or not
        if (stopFlag == false) {
            window.setTimeout(function () { detectFaces() }, 1000);
        }
    }
}

function detectCalls() {
    //when words are detected capture it as phone call detected anomaly
    recognition.onresult = function (event) {
        //check if words are detected
        if (event.results[event.results.length - 1][0]) {
            let date = new Date();
            let timeStamp = date.getTime();
            let canvas = document.getElementById('canvas');
            canvas.toBlob(function (blob) {
                addToPCDArray(timeStamp, blob, "pcd", false, true);
            });
            console.log("Speech was detected at: " + timeStamp);

        }
    }
    // start recognition
    recognition.start();
}

function stopCam() {
    window.cancelAnimationFrame(reqId);
    video.srcObject.getTracks().forEach(function (track) {
        track.stop();
    });
    stopFlag = true;
    recognition.stop();
    //compute the duration of the last entry
    calculateLastAnomalyDuration(UNPArray);
    calculateLastAnomalyDuration(MPDArray);
    calculateLastAnomalyDuration(UPPArray);
    calculateLastAnomalyDuration(EDFArray);
    calculateLastAnomalyDuration(UFCArray);
    postArray.push(PCDArray[PCDArray.length - 1]);
    //clear localStorage
    auth_token="";
}

function capture(label, timestamp) {
    let canvas = document.getElementById('canvas');
    // capture
    canvas.toBlob(function (blob) {
        if (label == "unp") {
            addToArray(timestamp, blob, "unp", UNPArray);
        }
        if (label == "mpd") {
            addToArray(timestamp, blob, "mpd", MPDArray);
        }
        if (label == "upp") {
            addToArray(timestamp, blob, "upp", UPPArray);
        }
        if (label == "edf") {
            addToArray(timestamp, blob, "edf", EDFArray);
        }
        if (label == "ufc") {
            addToArray(timestamp, blob, "ufc", UFCArray);
        }
    });
}

async function postAnomalyData(anomalyData) {
    let fd = new FormData();
    fd.append('userid', userId)
    fd.append('timestamp', anomalyData.timestamp);
    fd.append('image', anomalyData.imageData);
    fd.append('anomalyLabel', anomalyData.label);
    fd.append('isFirst', anomalyData.isFirst);
    fd.append('isLast', anomalyData.isLast);
    fd.append('duration', anomalyData.duration)

    await fetch("https://localhost:44331/api/Data", {

        // Adding method type 
        method: "POST",

        // Adding body or contents to send 
        body: fd,

        // Adding headers to the request 
        headers: {
            //"Content-type": "application/octet-stream",
            "Authorization": `Bearer ${auth_token}`
        }
    })
        // Converting to JSON 
        .then(response => response)

        // Displaying results to console 
        .then(json => console.log(json));
}

function addToArray(timestamp, imageData, label, dataArray) {
    let newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: false, isLast: false, duration: 0 };
    // if it's the very first snapshot, save it
    if (dataArray.length == 0) {
        newEntry.isFirst = true;
        dataArray.push(newEntry);
        postAnomalyData(newEntry);
    }
    else {
        //discard single frame captures
        if (dataArray[dataArray.length - 1].isFirst == true && dataArray[dataArray.length - 1].isLast == true) {
            dataArray.pop();
        }
        //check the interval between two frames. If it is greater than 5 seconds add interval to duration
        if ((newEntry.timestamp - dataArray[dataArray.length - 1].timestamp) > 5000) {
            dataArray[dataArray.length - 1].isLast = true;
            newEntry.isFirst = true;
            dataArray.push(newEntry);
            postAnomalyData(newEntry);
            if (dataArray.length >= 3 && dataArray[dataArray.length - 2].isLast == true && dataArray[dataArray.length - 3].isFirst == true) {
                dataArray[dataArray.length - 2].duration = dataArray[dataArray.length - 2].timestamp - dataArray[dataArray.length - 3].timestamp;
                postArray.push(dataArray[dataArray.length - 2]);
            }
        }
        //if time interval is less than 5 seconds replace the older snapshot with new one
        else {
            //if it the the first snapshot, save it
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

function addToPCDArray(timestamp, imageData, label, first, last) {
    let newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: first, isLast: last, duration: 1 };
    if (PCDArray.length == 0) {
        newEntry.isFirst = true;
        PCDArray.push(newEntry);
        postAnomalyData(newEntry);
    }
    //check time interval. if time interval is less than 10 seconds replace the older snapshot with new one
    if (PCDArray.length > 0 && newEntry.timestamp - PCDArray[PCDArray.length - 1].timestamp < 10000) {
        newEntry.duration = newEntry.timestamp - PCDArray[PCDArray.length - 1].timestamp + PCDArray[PCDArray.length - 1].duration;
        PCDArray.pop();
        PCDArray.push(newEntry);
    }
    //If greater than 10 seconds, save the snapshot 
    else {
        postArray.push(PCDArray[PCDArray.length - 1]);
        PCDArray.push(newEntry);
        postAnomalyData(newEntry);
    }
}

function calculateLastAnomalyDuration(dataArray) {
    if (dataArray.length > 1) {
        if (dataArray[dataArray.length - 2].isFirst == true) {
            dataArray[dataArray.length - 1].duration = dataArray[dataArray.length - 1].timestamp - dataArray[dataArray.length - 2].timestamp;
            dataArray[dataArray.length - 1].isLast = true;
            postArray.push(dataArray[dataArray.length - 1]);
        }
    }
}
//posts data from the postArray as soon as it is computed
function postDataFromArray() {
    if (postArray.length > 0) {
        postAnomalyData(postArray[0]);
        postArray.splice(0, 1);
        console.log(postArray);
    }
}