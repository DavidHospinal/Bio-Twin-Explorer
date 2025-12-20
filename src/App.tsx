import { useState, useCallback } from 'react';
import { HandTracker } from './components/HandTracker';
import { BioTwinScene } from './components/BioTwinScene';
import { SamSegmenter } from './components/SamSegmenter';
import { Target, Grab, MousePointerClick, Brain, Upload } from 'lucide-react';

function App() {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);

  // Handler para cargar imagen
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTestImage(event.target?.result as string);
        setAiReady(false);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
      {/* Sidebar / Info Panel */}
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Bio-Twin Explorer
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            Gemelo Digital de Tejido Biológico
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <Target className="text-cyan-400" size={20} />
              <div>
                <p className="text-xs text-slate-500">Cursor (X, Y)</p>
                <p className="font-mono text-cyan-300">
                  {cursor.x.toFixed(2)}, {cursor.y.toFixed(2)}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isPinching ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}>
              <MousePointerClick size={20} />
              <div>
                <p className="text-xs">Gesture</p>
                <p className="font-bold">{isPinching ? 'PINCH ACTIVE' : 'Idle'}</p>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isGrabbing ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}>
              <Grab size={20} />
              <div>
                <p className="text-xs">Manipulation</p>
                <p className="font-bold">{isGrabbing ? 'GRABBING' : 'Released'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 relative overflow-hidden">
          {/* Escena 3D Interactiva */}
          <BioTwinScene
            cursorX={cursor.x}
            cursorY={cursor.y}
            isPinching={isPinching}
            isGrabbing={isGrabbing}
          />

          {/* SamSegmenter para segmentación AI */}
          <SamSegmenter
            imageSrc={testImage}
            onImageEmbeddingCalculated={() => setAiReady(true)}
            onMaskGenerated={() => { }}
          />

          {/* Botón para cargar imagen */}
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
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isPinching ? 'border-green-400 bg-green-400/30 scale-125' : 'border-cyan-400 bg-cyan-400/10'}`}>
            <div className={`w-1 h-1 bg-white rounded-full ${isPinching ? 'w-2 h-2' : ''}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
