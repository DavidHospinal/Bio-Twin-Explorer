import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { HandTracker } from './components/HandTracker';
import { BioTwinScene } from './components/BioTwinScene';
import { SamSegmenter } from './components/SamSegmenter';
import type { SamSegmenterRef } from './components/SamSegmenter';
import { maskToShapes, maskToParticles } from './utils/maskToShape';
import { Target, Grab, MousePointerClick, Brain, Upload, Sparkles, RotateCcw } from 'lucide-react';

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

  const samRef = useRef<SamSegmenterRef>(null);
  const lastPinchTime = useRef<number>(0);
  const pinchCount = useRef<number>(0);
  const grabStartPos = useRef<{ x: number; y: number } | null>(null);

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

    // Generar shapes
    const shapes = maskToShapes(maskData, width, height);
    console.log('Shapes created:', shapes.length);
    setTissueShapes(shapes);

    // Generar particulas
    const particlePositions = maskToParticles(maskData, width, height, 6);
    setParticles(particlePositions);
  }, []);

  // Detector de pinch para segmentacion y explosion
  useEffect(() => {
    if (isPinching && aiReady) {
      const now = Date.now();

      // Detectar doble pinch para explosion
      if (now - lastPinchTime.current < 300) {
        pinchCount.current++;
        if (pinchCount.current >= 2) {
          setIsExploded(prev => !prev);
          pinchCount.current = 0;
          console.log('Double pinch - toggle explosion');
        }
      } else {
        pinchCount.current = 1;

        // Pinch simple para segmentacion (con throttle)
        if (now - lastPinchTime.current > 500) {
          console.log('Pinch detected at:', cursor.x, cursor.y);
          samRef.current?.runDecoder(cursor.x, cursor.y);
        }
      }

      lastPinchTime.current = now;
    }
  }, [isPinching, aiReady, cursor.x, cursor.y]);

  // Handler para rotacion con grab
  useEffect(() => {
    if (isGrabbing) {
      if (!grabStartPos.current) {
        grabStartPos.current = { x: cursor.x, y: cursor.y };
      } else {
        // Calcular rotacion basada en movimiento
        const deltaX = (cursor.x - grabStartPos.current.x) * Math.PI * 2;
        const deltaY = (cursor.y - grabStartPos.current.y) * Math.PI * 2;

        setHandRotation(prev => ({
          x: prev.x + deltaY * 0.1,
          y: prev.y + deltaX * 0.1
        }));

        grabStartPos.current = { x: cursor.x, y: cursor.y };
      }
    } else {
      grabStartPos.current = null;
    }
  }, [isGrabbing, cursor.x, cursor.y]);

  // Reset rotacion
  const resetRotation = () => {
    setHandRotation({ x: 0, y: 0 });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
      {/* Sidebar / Info Panel */}
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Bio-Twin Explorer
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            Gemelo Digital de Tejido Biologico
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <Target className="text-cyan-400" size={18} />
              <div>
                <p className="text-xs text-slate-500">Cursor</p>
                <p className="font-mono text-cyan-300 text-sm">
                  {cursor.x.toFixed(2)}, {cursor.y.toFixed(2)}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isPinching ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}>
              <MousePointerClick size={18} />
              <div>
                <p className="text-xs">Pinch</p>
                <p className="font-bold text-sm">{isPinching ? 'SEGMENTANDO' : 'Idle'}</p>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isGrabbing ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}>
              <Grab size={18} />
              <div>
                <p className="text-xs">Grab</p>
                <p className="font-bold text-sm">{isGrabbing ? 'ROTANDO' : 'Released'}</p>
              </div>
            </div>

            {particles && particles.length > 0 && (
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isExploded ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}>
                <Sparkles size={18} />
                <div>
                  <p className="text-xs">Particulas</p>
                  <p className="font-bold text-sm">{isExploded ? 'EXPLOSIONADO' : `${Math.floor(particles.length / 3)} pts`}</p>
                </div>
              </div>
            )}

            <button
              onClick={resetRotation}
              className="w-full flex items-center justify-center gap-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition-colors"
            >
              <RotateCcw size={14} />
              Reset Rotacion
            </button>
          </div>

          {/* Preview de imagen cargada */}
          {testImage && (
            <div className="mt-4 border border-slate-600 rounded-lg overflow-hidden">
              <p className="text-xs text-slate-400 p-2 bg-slate-900/50">Imagen cargada:</p>
              <img
                src={testImage}
                alt="Imagen para segmentar"
                className="w-full h-auto object-contain max-h-32"
              />
            </div>
          )}

          {aiReady && (
            <div className="mt-4 text-xs text-center space-y-1">
              <p className="text-green-400">Pinch: Segmentar area</p>
              <p className="text-purple-400">Grab: Rotar imagen</p>
              <p className="text-pink-400">Doble Pinch: Explotar/Reunir</p>
            </div>
          )}
        </div>

        <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden">
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

          {/* SamSegmenter para segmentacion AI */}
          <SamSegmenter
            ref={samRef}
            imageSrc={testImage}
            onImageEmbeddingCalculated={() => setAiReady(true)}
            onMaskGenerated={handleMaskGenerated}
          />

          {/* Boton para cargar imagen */}
          <div className="absolute top-4 right-4">
            <label className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors">
              <Upload size={14} />
              Cargar Imagen
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs">
            <Brain size={16} className={aiReady ? "text-green-400" : "text-yellow-400"} />
            <span className={aiReady ? "text-green-400" : "text-yellow-400"}>
              {aiReady ? "AI Ready" : "AI Loading/Idle"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
        <HandTracker
          onCursorMove={(x, y) => setCursor({ x, y })}
          onPinch={(active) => setIsPinching(active)}
          onGrab={(active) => setIsGrabbing(active)}
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
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isPinching ? 'border-green-400 bg-green-400/30 scale-125' : isGrabbing ? 'border-purple-400 bg-purple-400/30 scale-110' : 'border-cyan-400 bg-cyan-400/10'}`}>
            <div className={`w-1 h-1 bg-white rounded-full ${isPinching ? 'w-2 h-2' : ''}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
