// Age verification system with liveness detection
document.addEventListener('DOMContentLoaded', async () => {
    // Load face-api.js models
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models/faceDetection'),
        faceapi.nets.ageGenderNet.loadFromUri('/models/ageDetection')
    ]);
    
    // DOM elements
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const videoLiveness = document.getElementById('video-liveness');
    const canvasLiveness = document.getElementById('canvas-liveness');
    const faceStatus = document.getElementById('face-status');
    const livenessStatus = document.getElementById('liveness-status');
    const livenessProgress = document.getElementById('liveness-progress');
    const verificationResult = document.getElementById('verification-result');
    const purchaseOptions = document.getElementById('purchase-options');
    
    // State variables
    let stream = null;
    let detectedAge = null;
    let initialDistance = null;
    let livenessCheckPassed = false;
    
    // Step navigation
    function showStep(stepNumber) {
        document.querySelectorAll('.step').forEach(step => {
            step.style.display = 'none';
        });
        document.getElementById(`step${stepNumber}`).style.display = 'block';
    }
    
    // Start verification
    startBtn.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            showStep(2);
            startFaceDetection();
        } catch (err) {
            console.error('Error accessing camera:', err);
            faceStatus.textContent = 'Error: Could not access camera. Please ensure you have granted camera permissions.';
            faceStatus.style.backgroundColor = '#ffebee';
            faceStatus.style.color = 'var(--error-color)';
        }
    });
    
    // Restart verification
    restartBtn.addEventListener('click', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        detectedAge = null;
        initialDistance = null;
        livenessCheckPassed = false;
        showStep(1);
    });
    
    // Face detection and age estimation
    async function startFaceDetection() {
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);
        
        let faceDetected = false;
        
        const detectionInterval = setInterval(async () => {
            if (faceDetected) return;
            
            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions()
            ).withAgeAndGender();
            
            if (detections.length === 0) {
                faceStatus.textContent = 'No face detected. Please position your face in the frame.';
                faceStatus.style.backgroundColor = '#fff8e1';
                faceStatus.style.color = 'var(--warning-color)';
                return;
            }
            
            if (detections.length > 1) {
                faceStatus.textContent = 'Multiple faces detected. Please ensure only one face is visible.';
                faceStatus.style.backgroundColor = '#fff8e1';
                faceStatus.style.color = 'var(--warning-color)';
                return;
            }
            
            // Single face detected
            faceDetected = true;
            clearInterval(detectionInterval);
            
            const detection = detections[0];
            detectedAge = Math.round(detection.age);
            initialDistance = detection.detection.box.width; // Using face width as proxy for distance
            
            // Draw detection box
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            
            // Display age estimation
            faceStatus.textContent = `Estimated age: ${detectedAge} years`;
            faceStatus.style.backgroundColor = '#e8f5e9';
            faceStatus.style.color = 'var(--secondary-color)';
            
            // Proceed to liveness check
            setTimeout(() => {
                showStep(3);
                startLivenessCheck();
            }, 2000);
        }, 500);
    }
    
    // Liveness check by detecting distance change
    async function startLivenessCheck() {
        videoLiveness.srcObject = stream;
        const displaySize = { width: videoLiveness.width, height: videoLiveness.height };
        faceapi.matchDimensions(canvasLiveness, displaySize);
        
        let progress = 0;
        const requiredProgress = 100;
        const progressIncrement = 5;
        const checkInterval = 1000; // ms
        
        const livenessInterval = setInterval(async () => {
            const detections = await faceapi.detectAllFaces(
                videoLiveness,
                new faceapi.TinyFaceDetectorOptions()
            );
            
            if (detections.length !== 1) {
                livenessStatus.textContent = 'Please keep your face in the frame';
                livenessStatus.style.backgroundColor = '#fff8e1';
                livenessStatus.style.color = 'var(--warning-color)';
                return;
            }
            
            const currentDistance = detections[0].detection.box.width;
            const distanceChange = ((currentDistance - initialDistance) / initialDistance) * 100;
            
            if (distanceChange > 15) { // Face got significantly closer
                progress += progressIncrement;
                livenessProgress.style.width = `${progress}%`;
                
                livenessStatus.textContent = `Liveness check: ${progress}% complete`;
                livenessStatus.style.backgroundColor = '#e8f5e9';
                livenessStatus.style.color = 'var(--secondary-color)';
                
                if (progress >= requiredProgress) {
                    clearInterval(livenessInterval);
                    livenessCheckPassed = true;
                    completeVerification();
                }
            } else {
                livenessStatus.textContent = 'Please move slightly closer to the camera';
                livenessStatus.style.backgroundColor = '#fff8e1';
                livenessStatus.style.color = 'var(--warning-color)';
            }
            
            // Draw detection box
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvasLiveness.getContext('2d').clearRect(0, 0, canvasLiveness.width, canvasLiveness.height);
            faceapi.draw.drawDetections(canvasLiveness, resizedDetections);
        }, checkInterval);
    }
    
    // Complete verification and show results
    function completeVerification() {
        showStep(4);
        
        // Display verification result
        verificationResult.innerHTML = `
            <h3>Verification Successful</h3>
            <p>Estimated age: <strong>${detectedAge} years</strong></p>
            <p>Liveness check: <strong style="color: var(--secondary-color)">Passed</strong></p>
        `;
        
        // Determine purchase options based on age
        let alcoholStatus, tobaccoStatus, lotteryStatus;
        
        if (detectedAge >= 21) {
            alcoholStatus = 'Allowed';
            tobaccoStatus = 'Allowed';
            lotteryStatus = 'Allowed';
        } else if (detectedAge >= 18) {
            alcoholStatus = 'Restricted (21+)';
            tobaccoStatus = 'Allowed';
            lotteryStatus = 'Allowed';
        } else {
            alcoholStatus = 'Restricted (21+)';
            tobaccoStatus = 'Restricted (18+)';
            lotteryStatus = 'Restricted (18+)';
        }
        
        // Display purchase options
        purchaseOptions.innerHTML = `
            <h3>Purchase Options</h3>
            <ul>
                <li class="${alcoholStatus === 'Allowed' ? 'allowed' : 'restricted'}">Alcohol: ${alcoholStatus}</li>
                <li class="${tobaccoStatus === 'Allowed' ? 'allowed' : 'restricted'}">Tobacco: ${tobaccoStatus}</li>
                <li class="${lotteryStatus === 'Allowed' ? 'allowed' : 'restricted'}">Lottery: ${lotteryStatus}</li>
            </ul>
            <p class="notice">Note: Restrictions may vary by location. Always check local laws.</p>
        `;
        
        // Stop video streams
        stream.getTracks().forEach(track => track.stop());
    }
});