const video = document.getElementById('webcam');
let modelLoadedEvent = new CustomEvent('modelLoaded');
let stopFlag = false;
//stores user not present anomaly
UNPArray = [];
//stores user face covered anomaly
UFCArray = [];
//stores user partially present anomaly
UPPArray = [];
//stores electronic device found anomaly
EDFArray = [];
//stores multiple people detected anomaly
MPDArray = [];
//stores phone call detected anomaly
PCDArray = [];
//stores data to be posted after the anomly is over 
postArray = [];
let globalThis = this;
let userId;
let auth_token;

//intialize the speech recognition object
var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
var recognition = new SpeechRecognition();
recognition.continuous = true;

//this function loads the models
function loadModels(callback) {
    blazeface.load().then(function (loadedFmodel) {
        fdmodel = loadedFmodel;
        console.log("Blazeface model loaded");
        cocoSsd.load().then(function (loadedOmodel) {
            objectDetectionModel = loadedOmodel;
            console.log("Coco-ssd model loaded");
            // Show user that now model is ready to use.
            console.log("Model loaded successfully......");
            document.dispatchEvent(modelLoadedEvent);
            callback();
        });
    });
}

//this function will start the detection
function startDetaction() {
    //calls the detection functions when loadeddata event on the video object is fired
    video.addEventListener('playing', detectFaces);
    video.addEventListener('playing', detectObjects);
    video.addEventListener('playing', detectCalls);
}
//stop button
stopButton.addEventListener('click', stopCam);

//calls postDataFromArraycfunction to post data in the postArray
window.setInterval(function () { postDataFromArray(); }, 1000);

//this function will assign the jwt token and the user id
function initData(token, userid) {
    this.auth_token = token;
    this.userId = userid;
}

//this function will detect objects using the coco-sdd model
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

//this function will detect face using the blazeface model
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

//this function detects speech with web speech api
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

//this function stops the detection process
function stopCam() {
    window.cancelAnimationFrame(reqId);
    video.srcObject.getTracks().forEach(function (track) {
        track.stop();
    });
    stopFlag = true;
    recognition.stop();
    //compute the duration of the last entry
    calculateLastAnomalyDuration(globalThis.UNPArray);
    calculateLastAnomalyDuration(globalThis.MPDArray);
    calculateLastAnomalyDuration(globalThis.UPPArray);
    calculateLastAnomalyDuration(globalThis.EDFArray);
    calculateLastAnomalyDuration(globalThis.UFCArray);
    if(globalThis.PCDArray.length>0){
        globalThis.postArray.push(globalThis.PCDArray[globalThis.PCDArray.length - 1]);
    }
    
}

//this function captures the snapshot and timestamp when anomaly is detected
function capture(label, timestamp) {
    let canvas = document.getElementById('canvas');
    // capture
    canvas.toBlob(function (blob) {
        if (label == "unp") {
            addToArray(timestamp, blob, "unp", globalThis.UNPArray);
        }
        if (label == "mpd") {
            addToArray(timestamp, blob, "mpd", globalThis.MPDArray);
        }
        if (label == "upp") {
            addToArray(timestamp, blob, "upp", globalThis.UPPArray);
        }
        if (label == "edf") {
            addToArray(timestamp, blob, "edf", globalThis.EDFArray);
        }
        if (label == "ufc") {
            addToArray(timestamp, blob, "ufc", globalThis.UFCArray);
        }
    });
}

//this function will post the data
async function postAnomalyData(anomalyData) {
    let fd = new FormData();
    fd.append('userid', this.userId)
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
            "Authorization": `Bearer ${this.auth_token}`
        }
    })
    .then(response => response.json())
        // Converting to JSON 
        .then(response => {
            if (!response.ok) {
              throw new Error('Something went wrong.' + response.message);
            }
            return response;
          })

        // Displaying results to console 
        
        .catch((error) => {
            console.log(error)
          });
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
                globalThis.postArray.push(dataArray[dataArray.length - 2]);
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

//this function handles data entry in the PCDArray (phone call anomaly)
function addToPCDArray(timestamp, imageData, label, first, last) {
    let newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: first, isLast: last, duration: 1 };
    if (globalThis.PCDArray.length == 0) {
        newEntry.isFirst = true;
        globalThis.PCDArray.push(newEntry);
        postAnomalyData(newEntry);
    }
    //check time interval. if time interval is less than 10 seconds replace the older snapshot with new one
    if (globalThis.PCDArray.length > 0 && newEntry.timestamp - globalThis.PCDArray[globalThis.PCDArray.length - 1].timestamp < 10000) {
        newEntry.duration = newEntry.timestamp - globalThis.PCDArray[globalThis.PCDArray.length - 1].timestamp + globalThis.PCDArray[globalThis.PCDArray.length - 1].duration;
        globalThis.PCDArray.pop();
        globalThis.PCDArray.push(newEntry);
    }
    //If greater than 10 seconds, save the snapshot 
    else {
        globalThis.postArray.push(globalThis.PCDArray[globalThis.PCDArray.length - 1]);
        globalThis.PCDArray.push(newEntry);
        postAnomalyData(newEntry);
    }
}

//this function computes the duration of the last pair of anomalies after the stopCam function is called
function calculateLastAnomalyDuration(dataArray) {
    if (dataArray.length > 1) {
        if (dataArray[dataArray.length - 2].isFirst == true) {
            dataArray[dataArray.length - 1].duration = dataArray[dataArray.length - 1].timestamp - dataArray[dataArray.length - 2].timestamp;
            dataArray[dataArray.length - 1].isLast = true;
            globalThis.postArray.push(dataArray[dataArray.length - 1]);
        }
    }
}
//posts data from the postArray as soon as it is computed
function postDataFromArray() {
    if (globalThis.postArray.length > 0) {
        postAnomalyData(globalThis.postArray[0]);
        globalThis.postArray.splice(0, 1);
        console.log(globalThis.postArray);
    }
}