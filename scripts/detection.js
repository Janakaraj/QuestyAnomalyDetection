var modelLoadedEvent = new CustomEvent('modelLoaded');
var stopFlag = false;

var UNPArray = [];
var UFCArray = [];
var UPPArray = [];
var EDFArray = [];
var MPDArray = [];
var PCDArray = [];
var postArray = [];

var jwtToken = "";
var userId;

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
function initData(token, userid) {
    jwtToken = localStorage.setItem('auth_token', token);
    userId = userid;
}

function startDetection() {
    // Only continue if the models has finished loading.
    if (!objectDetectionModel && !fdmodel) {
        return;
    }

    video.addEventListener('loadeddata', detectFaces);
    video.addEventListener('loadeddata', detectObjects);
    video.addEventListener('loadeddata', detectCalls);
}

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
                            var date = new Date();
                            var timeStamp = date.getTime();
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
            var date = new Date();
            var timeStamp = date.getTime();
            //FNDTimeArray.push(timeStamp);
            capture("unp", timeStamp);
            console.log("User not present at " + timeStamp);
        }
        else {
            for (let i = 0; i < predictions.length; i++) {
                if (predictions[i].probability > 0.66) {
                    //if multiple people are detected
                    if (predictions.length > 1) {
                        var date = new Date();
                        var timeStamp = date.getTime();
                        capture("mpd", timeStamp);
                        console.log("Muttiple people were detected at " + timeStamp);
                    }
                    //if user's face is covered
                    if (predictions[0].probability < 0.97) {
                        var date = new Date();
                        var timeStamp = date.getTime();
                        capture("ufc", timeStamp);
                        console.log("Users face is covered at: " + timeStamp);
                    }
                    //if person is not in the centre of the frame
                    if (predictions[i].bottomRight[0] < 170 || predictions[i].bottomRight[0] > 650 || predictions[i].bottomRight[1] > 450 || predictions[i].bottomRight[1] < 140) {
                        var date = new Date();
                        var timeStamp = date.getTime();
                        capture("upp", timeStamp);
                        console.log("Person detected partially at " + timeStamp);
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
            var date = new Date();
            var timeStamp = date.getTime();
            var canvas = document.getElementById('canvas');
            canvas.toBlob(function (blob) {
                addToPCDArray(timeStamp, blob, "pcd", false, true);
            });

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
    console.log(postArray);
}

function capture(label, timestamp) {
    var canvas = document.getElementById('canvas');
    // postData(JSON.stringify(data));
    canvas.toBlob(function (blob) {
        // var fd = new FormData();
        // fd.append('userid', 1)
        // fd.append('imageData', blob);
        // fd.append('anomalyLabel', label);
        // fd.append('timestamp', timestamp);

        // const data = new URLSearchParams();
        // for (const pair of fd) {
        //     data.append(pair[0], pair[1]);
        // }

        //save captured anomaly data in respective arrays
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

        console.log(UNPArray, MPDArray, UPPArray, EDFArray, UFCArray, PCDArray);
        // if (UNPArray.length > 4) {
        //     fakePost(UNPArray);
        // }
        // console.log(UNPArray);
        //postData(fd);
    });
}
// async function fakePost(dataArray) {
//     if (dataArray.length > 6) {
//         //await delete
//         console.log("posted a pair");
//         console.log("deleteing a pair");
//         //dataArray.splice(i,2);
//         console.log(dataArray);
//     }
// }
function postAnomalyData(anomalyData) {
    fetch("https://localhost:44331/api/data", {

        // Adding method type 
        method: "POST",

        // Adding body or contents to send 
        body: anomalyData,

        // Adding headers to the request 
        headers: {
            "Content-type": "application/json"
        }
    })
        // Converting to JSON 
        .then(response => response)

        // Displaying results to console 
        .then(json => console.log(json));
}

function addToArray(timestamp, imageData, label, dataArray) {
    var newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: false, isLast: false, duration: 0 };
    // if it's the very first snapshot, save it
    if (dataArray.length == 0) {
        newEntry.isFirst = true;
        dataArray.push(newEntry);
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
            //postAnomalyData(JSON.parse(JSON.stringify(newEntry)));
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
    var newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: first, isLast: last, duration: 1 };
    //check time interval. If greater than 10 seconds, calculate duration and save the snapshot
    if (PCDArray.length > 0 && newEntry.timestamp - PCDArray[PCDArray.length - 1].timestamp < 10000) {
        newEntry.duration = newEntry.timestamp - PCDArray[PCDArray.length - 1].timestamp + PCDArray[PCDArray.length - 1].duration;
        PCDArray.pop();
        PCDArray.push(newEntry);
    }
    //if time interval is less than 10 seconds replace the older snapshot with new one
    else {
        postArray.push(PCDArray[PCDArray.length - 1]);
        PCDArray.push(newEntry);
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
