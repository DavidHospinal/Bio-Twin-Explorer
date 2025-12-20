import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

interface HandTrackerProps {
    onCursorMove: (x: number, y: number) => void;
    onPinch: (isPinching: boolean, x: number, y: number) => void;
    onGrab: (isGrabbing: boolean) => void;
}

export const HandTracker: React.FC<HandTrackerProps> = ({ onCursorMove, onPinch, onGrab }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Usar refs para callbacks para evitar re-inicializaciones
    const onCursorMoveRef = useRef(onCursorMove);
    const onPinchRef = useRef(onPinch);
    const onGrabRef = useRef(onGrab);

    // Actualizar refs cuando cambien los callbacks
    useEffect(() => {
        onCursorMoveRef.current = onCursorMove;
        onPinchRef.current = onPinch;
        onGrabRef.current = onGrab;
    }, [onCursorMove, onPinch, onGrab]);

    useEffect(() => {
        let handLandmarker: HandLandmarker | null = null;
        let animationFrameId: number;
        let lastVideoTime = -1;

        const setupMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );

                handLandmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });

                setIsLoaded(true);
                startWebcam();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load MediaPipe');
                console.error(err);
            }
        };

        const startWebcam = async () => {
            if (!videoRef.current) {
                console.log('[HandTracker] videoRef is null');
                return;
            }

            try {
                console.log('[HandTracker] Requesting camera access...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 }
                });
                console.log('[HandTracker] Camera access granted');
                videoRef.current.srcObject = stream;

                // Esperar a que el video cargue y luego reproducir
                videoRef.current.onloadeddata = () => {
                    console.log('[HandTracker] Video loaded, starting playback');
                    videoRef.current?.play().then(() => {
                        console.log('[HandTracker] Video playing, starting prediction loop');
                        predictWebcam();
                    }).catch(err => {
                        console.error('[HandTracker] Error playing video:', err);
                    });
                };
            } catch (err) {
                console.error('[HandTracker] Camera error:', err);
                setError('Camera access denied');
            }
        };

        const predictWebcam = () => {
            if (!handLandmarker || !videoRef.current || !canvasRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (video.videoWidth === 0 || video.videoHeight === 0) {
                animationFrameId = requestAnimationFrame(predictWebcam);
                return;
            }

            // Resize canvas to match video
            if (canvas.width !== video.videoWidth) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            const startTimeMs = performance.now();

            if (video.currentTime !== lastVideoTime) {
                lastVideoTime = video.currentTime;
                const results = handLandmarker.detectForVideo(video, startTimeMs);

                if (ctx) {
                    ctx.save();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Mirror effect setup
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);

                    if (results.landmarks && results.landmarks.length > 0) {
                        const drawingUtils = new DrawingUtils(ctx);

                        // Dibujar TODAS las manos detectadas
                        for (let i = 0; i < results.landmarks.length; i++) {
                            const landmarks = results.landmarks[i];
                            const handColor = i === 0 ? "#00FF00" : "#FF00FF"; // Verde para mano 1, Magenta para mano 2

                            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                                color: handColor,
                                lineWidth: 3
                            });
                            drawingUtils.drawLandmarks(landmarks, {
                                color: i === 0 ? "#FF0000" : "#00FFFF",
                                lineWidth: 1,
                                radius: 4
                            });
                        }

                        // Usar la primera mano para el cursor
                        const landmarks = results.landmarks[0];

                        // Logic for Cursor (Index Finger Tip - ID 8)
                        const indexTip = landmarks[8];
                        const thumbTip = landmarks[4];

                        // X is inverted due to mirror
                        const cursorX = 1 - indexTip.x;
                        const cursorY = indexTip.y;

                        onCursorMoveRef.current(cursorX, cursorY);

                        // Logic for Pinch (Index Tip to Thumb Tip distance)
                        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
                        const isPinching = distance < 0.05; // Threshold
                        onPinchRef.current(isPinching, cursorX, cursorY);

                        // Logic for Grab (Fist-like)
                        // Simplified: check if finger tips are close to wrist? or just a generic "pinch + middle finger down"
                        // For now, let's assume Pinch is the main trigger. Grab can be implemented if needed for 3D rotation.
                        // Let's use all tips close together for grab.
                        const middleTip = landmarks[12];

                        const grabDistance = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);
                        const isGrabbing = grabDistance < 0.1 && isPinching;
                        onGrabRef.current(isGrabbing);
                    }

                    ctx.restore();
                }
            }

            animationFrameId = requestAnimationFrame(predictWebcam);
        };

        setupMediaPipe();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            if (handLandmarker) {
                handLandmarker.close();
            }
            cancelAnimationFrame(animationFrameId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo ejecutar una vez al montar - los callbacks son estables

    return (
        <div className="relative w-full h-full overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-black">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-cyan-400 animate-pulse">
                    Initializing Computer Vision...
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center text-red-500">
                    {error}
                </div>
            )}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover -scale-x-100 opacity-50 hover:opacity-100 transition-opacity duration-300"
            />
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-xs text-cyan-300 backdrop-blur-md">
                Bio-Twin Vision v1.0
            </div>
        </div>
    );
};
