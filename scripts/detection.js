detectionInstance = new detection();
//intialize the speech recognition object
var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
var recognition = new SpeechRecognition();
//listen continously to the user
recognition.continuous = true;
function detection() {
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.height = 480;
    this.video.width = 640;
    document.body.appendChild(this.video);

    this.stopFlag = false;
    this.canvas = document.createElement('canvas');
    this.canvas.id = "canvas";
    this.canvas.setAttribute("style","overflow:auto");
    document.body.appendChild(this.canvas);
    //stores user not present anomaly
    this.UNPArray = [];
    //stores user face covered anomaly
    this.UFCArray = [];
    //stores user partially present anomaly
    this.UPPArray = [];
    //stores electronic device found anomaly
    this.EDFArray = [];
    //stores multiple people detected anomaly
    this.MPDArray = [];
    //stores phone call detected anomaly
    this.PCDArray = [];
    //stores data to be posted after the anomly is over 
    this.postArray = [];
    this.userId;
    this.auth_token;
}

//this function loads the models and returns true if models are loaded successfully and false if not
// use the callback as : detectionInstance.loadModels((status)=>{return status})
detection.prototype.loadModels = function (callback) {
    try{
        blazeface.load().then(function (loadedFmodel) {
            fdmodel = loadedFmodel;
            cocoSsd.load().then(function (loadedOmodel) {
                objectDetectionModel = loadedOmodel;
                console.log("models loaded...");
                callback(true);
            });
        });
    }
    catch(e){
        callback(false);
    }
}

//this function will start the detection
detection.prototype.startDetection = function () {
    //calls the detection functions when 'playing' event on the video object is fired
    detectionInstance.video.addEventListener('playing', () => { detectionInstance.detectFaces() });
    detectionInstance.video.addEventListener('playing', () => { detectionInstance.detectObjects() });
    detectionInstance.video.addEventListener('playing', () => { detectionInstance.detectCalls() });
}

//calls postDataFromArraycfunction to post data in the postArray
window.setInterval(function () { detectionInstance.postDataFromArray(); }, 1000);

//this function will assign the jwt token and the user id
//pass startDetection as callback to this function bacause the initializeData function will trigger the 'playing' 
//event so we have to start listening to the event before the event is fired
detection.prototype.initializeData = function (token, userid, stream,callback) {
    this.auth_token = token;
    this.userId = userid;
    callback();
    this.video.srcObject = stream;
}

//this function will detect objects using the coco-sdd model
detection.prototype.detectObjects = async function () {
    if (!this.stopFlag) {
        objectDetectionModel.detect(detectionInstance.video).then((predictions) => {
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
                            detectionInstance.capture("edf", timeStamp);
                        }
                    }
                }
            }
            window.setTimeout(function () { reqId = window.requestAnimationFrame(detectionInstance.detectObjects) }, 1000);
        });
    }
}

//this function will detect face using the blazeface model
detection.prototype.detectFaces = async function () {
    if (!this.stopFlag) {
        const predictions = await fdmodel.estimateFaces(detectionInstance.video, false);
        if (predictions.length == 0) {
            let date = new Date();
            let timeStamp = date.getTime();
            detectionInstance.capture("unp", timeStamp);
        }
        else {
            for (let i = 0; i < predictions.length; i++) {
                if (predictions[i].probability > 0.66) {
                    //if multiple people are detected
                    if (predictions.length > 1) {
                        let date = new Date();
                        let timeStamp = date.getTime();
                        detectionInstance.capture("mpd", timeStamp);
                    }
                    //if person is not in the centre of the frame
                    if (predictions[i].bottomRight[0] < 170
                        || predictions[i].bottomRight[0] > 650
                        || predictions[i].bottomRight[1] > 450
                        || predictions[i].bottomRight[1] < 140) {
                        let date = new Date();
                        let timeStamp = date.getTime();
                        detectionInstance.capture("upp", timeStamp);
                    }
                    //if user's face is covered
                    else if (predictions[0].probability < 0.97) {
                        let date = new Date();
                        let timeStamp = date.getTime();
                        detectionInstance.capture("ufc", timeStamp);
                    }
                }
            }
        }
        //check whether to continue or not
        if (this.stopFlag == false) {
            window.setTimeout(function () { detectionInstance.detectFaces() }, 1000);
        }
    }
}

//this function detects speech with web speech api
detection.prototype.detectCalls = function () {
    //when words are detected capture it as phone call detected anomaly
    recognition.onresult = function (event) {
        //check if words are detected
        if (event.results[event.results.length - 1][0]) {
            let date = new Date();
            let timeStamp = date.getTime();
            let canvas = document.getElementById('canvas');
            canvas.toBlob(function (blob) {
                detectionInstance.addToPCDArray(timeStamp, blob, "pcd", false, true);
            });
        }
    }
    // start recognition
    recognition.start();
}

//this function stops the detection process
detection.prototype.stopDetection = function () {
    window.cancelAnimationFrame(reqId);
    this.video.srcObject.getTracks().forEach(function (track) {
        track.stop();
    });
    this.stopFlag = true;
    recognition.stop();
    //compute the duration of the last entry
    detectionInstance.calculateLastAnomalyDuration(this.UNPArray);
    detectionInstance.calculateLastAnomalyDuration(this.MPDArray);
    detectionInstance.calculateLastAnomalyDuration(this.UPPArray);
    detectionInstance.calculateLastAnomalyDuration(this.EDFArray);
    detectionInstance.calculateLastAnomalyDuration(this.UFCArray);
    if (this.PCDArray.length > 0) {
        this.postArray.push(this.PCDArray[this.PCDArray.length - 1]);
    }

}

//this function captures the snapshot and timestamp when anomaly is detected
detection.prototype.capture = function (label, timestamp) {
    let canvas = document.getElementById('canvas');
    // capture
    canvas.toBlob(function (blob) {
        if (label == "unp") {
            detectionInstance.addToArray(timestamp, blob, "unp", detectionInstance.UNPArray);
        }
        if (label == "mpd") {
            detectionInstance.addToArray(timestamp, blob, "mpd", detectionInstance.MPDArray);
        }
        if (label == "upp") {
            detectionInstance.addToArray(timestamp, blob, "upp", detectionInstance.UPPArray);
        }
        if (label == "edf") {
            detectionInstance.addToArray(timestamp, blob, "edf", detectionInstance.EDFArray);
        }
        if (label == "ufc") {
            detectionInstance.addToArray(timestamp, blob, "ufc", detectionInstance.UFCArray);
        }
    });
}

//this function will post the data
detection.prototype.postAnomalyData = async function (anomalyData) {
    let fd = new FormData();
    fd.append('userId', this.userId)
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

        // Displaying error to console 

        .catch((error) => {
            console.log(error)
        });
}

detection.prototype.addToArray = function (timestamp, imageData, label, dataArray) {
    let newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: false, isLast: false, duration: 0 };
    // if it's the very first snapshot, save it
    if (dataArray.length == 0) {
        newEntry.isFirst = true;
        dataArray.push(newEntry);
        detectionInstance.postAnomalyData(newEntry);
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
            detectionInstance.postAnomalyData(newEntry);
            if (dataArray.length >= 3 && dataArray[dataArray.length - 2].isLast == true && dataArray[dataArray.length - 3].isFirst == true) {
                dataArray[dataArray.length - 2].duration = dataArray[dataArray.length - 2].timestamp - dataArray[dataArray.length - 3].timestamp;
                this.postArray.push(dataArray[dataArray.length - 2]);
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
detection.prototype.addToPCDArray = function (timestamp, imageData, label, first, last) {
    let newEntry = { timestamp: timestamp, imageData: imageData, label: label, isFirst: first, isLast: last, duration: 1 };
    if (this.PCDArray.length == 0) {
        newEntry.isFirst = true;
        this.PCDArray.push(newEntry);
        detectionInstance.postAnomalyData(newEntry);
    }
    //check time interval. if time interval is less than 10 seconds replace the older snapshot with new one
    if (this.PCDArray.length > 0 && newEntry.timestamp - this.PCDArray[this.PCDArray.length - 1].timestamp < 10000) {
        newEntry.duration = newEntry.timestamp - this.PCDArray[this.PCDArray.length - 1].timestamp + this.PCDArray[this.PCDArray.length - 1].duration;
        this.PCDArray.pop();
        this.PCDArray.push(newEntry);
    }
    //If greater than 10 seconds, save the snapshot 
    else {
        this.postArray.push(this.PCDArray[this.PCDArray.length - 1]);
        this.PCDArray.push(newEntry);
        detectionInstance.postAnomalyData(newEntry);
    }
}

//this function computes the duration of the last pair of anomalies after the stopDetection function is called
detection.prototype.calculateLastAnomalyDuration = function (dataArray) {
    if (dataArray.length > 1) {
        if (dataArray[dataArray.length - 2].isFirst == true) {
            dataArray[dataArray.length - 1].duration = dataArray[dataArray.length - 1].timestamp - dataArray[dataArray.length - 2].timestamp;
            dataArray[dataArray.length - 1].isLast = true;
            this.postArray.push(dataArray[dataArray.length - 1]);
        }
    }
}
//posts data from the postArray as soon as it is computed
detection.prototype.postDataFromArray = function () {
    if (this.postArray.length > 0) {
        detectionInstance.postAnomalyData(this.postArray[0]);
        this.postArray.splice(0, 1);
    }
}