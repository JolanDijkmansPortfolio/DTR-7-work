console.log("script.js loaded - 7 Class Version");

const modelURL = "./model/model.json";
const metadataURL = "./model/metadata.json";

let model;
let video;
let canvas;
let ctx;
let isRunning = false;
let videoTrack;
const CONFIDENCE_THRESHOLD = 0.60;

// Tool configuration with all 7 classes
const toolConfig = {
    "1-2": {
        diagram: "./mouth-diagrams/1-2.png",
        toolName: "Tool 1-2"
    },
    "7-8": {
        diagram: "./mouth-diagrams/7-8.png",
        toolName: "Tool 7-8"
    },
    "9-10": {
        diagram: "./mouth-diagrams/9-10.png",
        toolName: "Tool 9-10"
    },
    "11-12": {
        diagram: "./mouth-diagrams/11-12.png",
        toolName: "Tool 11-12"
    },
    "13-14": {
        diagram: "./mouth-diagrams/13-14.png",
        toolName: "Tool 13-14"
    },
    "17-18": {
        diagram: "./mouth-diagrams/17-18.png",
        toolName: "Tool 17-18"
    },
    "00-no": {
        diagram: "./mouth-diagrams/00-no.png",
        toolName: "No Tool"
    }
};

// Status message helper
function showStatus(message, isError = false) {
    const statusEl = document.getElementById("statusMessage");
    statusEl.innerText = message;
    statusEl.style.color = isError ? "#b00020" : "#333";
    console.log(message);
}

// Load Teachable Machine model
async function loadModel() {
    console.log("Loading Teachable Machine model...");
    
    if (typeof tmImage === 'undefined') {
        throw new Error("Teachable Machine library not loaded");
    }
    
    showStatus("Loading AI model...");
    
    try {
        model = await tmImage.load(modelURL, metadataURL);
        console.log("Model loaded successfully");
        console.log("Available classes:", model.getClassLabels().join(", "));
        
        showStatus("Model loaded! Ready to detect tools.");
        return true;
    } catch (err) {
        console.error("Model load error:", err);
        showStatus("Failed to load model: " + err.message, true);
        throw err;
    }
}

// Start camera with iOS-compatible settings
async function startCamera() {
    video = document.getElementById("video");
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    showStatus("Requesting camera access...");

    try {
        const constraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 224 },
                height: { ideal: 224 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        video.srcObject = stream;
        videoTrack = stream.getVideoTracks()[0];
        
        showStatus("Camera started!");

        try {
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.torch) {
                await videoTrack.applyConstraints({ 
                    advanced: [{ torch: true }] 
                });
                console.log("✓ Torch enabled");
                showStatus("Camera started with flash!");
            }
        } catch (torchErr) {
            console.log("Torch not available");
        }

        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                video.play()
                    .then(() => {
                        showStatus("Ready to detect tools!");
                        resolve();
                    })
                    .catch(reject);
            };
            
            setTimeout(() => reject(new Error("Video load timeout")), 10000);
        });

    } catch (err) {
        console.error("Camera error:", err);
        showStatus("Camera error: " + err.message, true);
        throw err;
    }
}

// Prediction loop
async function predictLoop() {
    if (!isRunning) return;

    try {
        ctx.drawImage(video, 0, 0, 224, 224);
        const prediction = await model.predict(canvas);

        // Find best prediction
        let best = prediction[0];
        for (let p of prediction) {
            if (p.probability > best.probability) {
                best = p;
            }
        }

        const confidence = best.probability;
        const detectedClass = best.className;

        // Update confidence display
        document.getElementById("confidence").innerText =
            (confidence * 100).toFixed(1) + "%";

        console.log("Detected:", detectedClass, "at", (confidence * 100).toFixed(1) + "%");

        // Check if we have config for this class AND confidence is high enough
        if (toolConfig.hasOwnProperty(detectedClass) && confidence >= CONFIDENCE_THRESHOLD) {
            
            // Show tool information (including 00-no with its diagram)
            document.getElementById("toolName").innerText = toolConfig[detectedClass].toolName;

            const img = document.getElementById("mouthDiagram");
            img.src = toolConfig[detectedClass].diagram;
            img.style.display = "block";

            document.getElementById("lowConfidenceWarning").innerText = "";
            
            showStatus("✓ " + toolConfig[detectedClass].toolName + " detected!");

        } else {
            // Low confidence or unknown class
            document.getElementById("toolName").innerText = detectedClass || "Uncertain";
            document.getElementById("mouthDiagram").style.display = "none";
            
            if (confidence < CONFIDENCE_THRESHOLD) {
                document.getElementById("lowConfidenceWarning").innerText =
                    "Low confidence - adjust tool position and lighting";
            } else {
                document.getElementById("lowConfidenceWarning").innerText =
                    "Unknown class: " + detectedClass;
            }
        }

    } catch (err) {
        console.error("Prediction error:", err);
        showStatus("Prediction error: " + err.message, true);
    }

    setTimeout(() => requestAnimationFrame(predictLoop), 150);
}

// Button click handler
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM ready");
    
    const button = document.getElementById("startButton");
    
    if (!button) {
        console.error("Start button not found!");
        return;
    }

    button.addEventListener("click", async () => {
        console.log("Button clicked!");
        
        if (isRunning) {
            console.log("Already running");
            return;
        }

        button.disabled = true;
        button.innerText = "Starting...";
        
        try {
            await loadModel();
            await startCamera();

            isRunning = true;
            button.innerText = "Camera Running ✓";
            button.style.backgroundColor = "#4CAF50";
            predictLoop();

        } catch (err) {
            console.error("Startup error:", err);
            showStatus("Error: " + err.message, true);
            alert("Failed to start: " + err.message);
            
            button.disabled = false;
            button.innerText = "Start Camera";
            button.style.backgroundColor = "";
        }
    });
});
