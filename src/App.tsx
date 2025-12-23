import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { HandTracker } from './components/HandTracker';
import { BioTwinScene } from './components/BioTwinScene';
import { SamSegmenter } from './components/SamSegmenter';
import type { SamSegmenterRef } from './components/SamSegmenter';
import { maskToShapes, maskToParticles } from './utils/maskToShape';
import { Grab, MousePointerClick, Brain, Upload, Sparkles, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

function App() {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [tissueShapes, setTissueShapes] = useState<THREE.Shape[]>([]);
  const [particles, setParticles] = useState<Float32Array | null>(null);
  const [isExploded, setIsExploded] = useState(false);
  const [handRotation, setHandRotation] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const samRef = useRef<SamSegmenterRef>(null);
  const lastPinchTime = useRef<number>(0);
  const pinchCount = useRef<number>(0);
  const lastWristAngle = useRef<number>(0);
  const sceneContainerRef = useRef<HTMLDivElement>(null);

  // Handler para cargar imagen
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTestImage(event.target?.result as string);
        setAiReady(false);
        setTissueShapes([]);
        setParticles(null);
        setIsExploded(false);
        setHandRotation({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Handler para mascara generada por SAM
  const handleMaskGenerated = useCallback((maskData: Float32Array, width: number, height: number) => {
    console.log('Mask generated:', width, 'x', height);

    const shapes = maskToShapes(maskData, width, height);
    console.log('Shapes created:', shapes.length);
    setTissueShapes(shapes);

    const particlePositions = maskToParticles(maskData, width, height, 6);
    setParticles(particlePositions);
  }, []);

  // Detector de pinch para segmentacion y explosion
  useEffect(() => {
    if (isPinching && aiReady) {
      const now = Date.now();

      if (now - lastPinchTime.current < 300) {
        pinchCount.current++;
        if (pinchCount.current >= 2) {
          setIsExploded(prev => !prev);
          pinchCount.current = 0;
          console.log('Double pinch - toggle explosion');
        }
      } else {
        pinchCount.current = 1;

        if (now - lastPinchTime.current > 500) {
          console.log('Pinch detected at:', cursor.x, cursor.y);
          samRef.current?.runDecoder(cursor.x, cursor.y);
        }
      }

      lastPinchTime.current = now;
    }
  }, [isPinching, aiReady, cursor.x, cursor.y]);

  // Handler para rotacion con muneca (cuando grab esta activo)
  const handleGrab = useCallback((grabbing: boolean, wristAngle: number) => {
    setIsGrabbing(grabbing);

    if (grabbing) {
      // Calcular diferencia de angulo para rotacion suave
      const angleDiff = wristAngle - lastWristAngle.current;

      // Solo rotar si hay cambio significativo (evitar jitter)
      if (Math.abs(angleDiff) > 0.01 && Math.abs(angleDiff) < 1) {
        setHandRotation(prev => ({
          x: prev.x,
          y: prev.y + angleDiff * 2 // Multiplicar para hacer la rotacion mas rapida
        }));
      }
    }

    lastWristAngle.current = wristAngle;
  }, []);

  // Reset rotacion
  const resetRotation = () => {
    setHandRotation({ x: 0, y: 0 });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      sceneContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Listener para cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header con controles */}
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            Bio-Twin Explorer
          </h1>
          <p className="text-xs text-slate-400">Gemelo Digital de Tejido Biologico</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Indicadores compactos */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs ${isPinching ? 'bg-green-500/30 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
              <MousePointerClick size={12} className="inline mr-1" />
              {isPinching ? 'PINCH' : 'idle'}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs ${isGrabbing ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700 text-slate-400'}`}>
              <Grab size={12} className="inline mr-1" />
              {isGrabbing ? 'ROTANDO' : 'idle'}
            </div>
            {particles && (
              <div className={`px-3 py-1 rounded-full text-xs ${isExploded ? 'bg-pink-500/30 text-pink-300' : 'bg-slate-700 text-pink-400'}`}>
                <Sparkles size={12} className="inline mr-1" />
                {isExploded ? 'EXPLOSIONADO' : `${Math.floor(particles.length / 3)} pts`}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Brain size={16} className={aiReady ? "text-green-400" : "text-yellow-400"} />
            <span className={`text-xs ${aiReady ? "text-green-400" : "text-yellow-400"}`}>
              {aiReady ? "AI Ready" : "AI Loading"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Two columns */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Panel - Camera */}
        <div className="w-1/3 flex flex-col gap-4">
          <div className="flex-1 relative bg-black rounded-2xl overflow-hidden border border-slate-800">
            <HandTracker
              onCursorMove={(x, y) => setCursor({ x, y })}
              onPinch={(active) => setIsPinching(active)}
              onGrab={handleGrab}
            />

            {/* Virtual Cursor Overlay */}
            <div
              className="absolute pointer-events-none transition-transform duration-75 ease-out z-50"
              style={{
                left: `${cursor.x * 100}%`,
                top: `${cursor.y * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isPinching ? 'border-green-400 bg-green-400/30 scale-125' : isGrabbing ? 'border-purple-400 bg-purple-400/30 scale-110' : 'border-cyan-400 bg-cyan-400/10'}`}>
                <div className={`w-1 h-1 bg-white rounded-full ${isPinching ? 'w-2 h-2' : ''}`} />
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <label className="flex-1 cursor-pointer bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                <Upload size={16} />
                Cargar Imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={resetRotation}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {testImage && (
              <div className="border border-slate-600 rounded-lg overflow-hidden">
                <img
                  src={testImage}
                  alt="Imagen cargada"
                  className="w-full h-24 object-contain bg-black"
                />
              </div>
            )}

            {aiReady && (
              <div className="mt-3 text-xs space-y-1 text-slate-400">
                <p><span className="text-green-400">Pinch:</span> Segmentar</p>
                <p><span className="text-purple-400">Puno cerrado + girar muneca:</span> Rotar 360</p>
                <p><span className="text-pink-400">Doble Pinch rapido:</span> Explotar/Reunir</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - 3D Scene (LARGE) */}
        <div
          ref={sceneContainerRef}
          className={`flex-1 bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}
        >
          {/* Escena 3D Interactiva */}
          <BioTwinScene
            cursorX={cursor.x}
            cursorY={cursor.y}
            isPinching={isPinching}
            isGrabbing={isGrabbing}
            tissueShapes={tissueShapes}
            imageSrc={testImage}
            particles={particles}
            isExploded={isExploded}
            handRotation={handRotation}
          />

          {/* SamSegmenter */}
          <SamSegmenter
            ref={samRef}
            imageSrc={testImage}
            onImageEmbeddingCalculated={() => setAiReady(true)}
            onMaskGenerated={handleMaskGenerated}
          />

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-lg transition-colors z-10"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
