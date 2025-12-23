import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { ImagePlane3D } from './ImagePlane3D';
import { ExtrudedTissue } from './ExtrudedTissue';

interface BioTwinSceneProps {
    cursorX: number;
    cursorY: number;
    isPinching: boolean;
    isGrabbing: boolean;
    tissueShapes?: THREE.Shape[];
    imageSrc?: string | null;
    particles?: Float32Array | null;
    isExploded?: boolean;
    handRotation?: { x: number; y: number };
}

// Cursor 3D que sigue la posicion de la mano
const HandCursor3D = ({ x, y, isPinching }: { x: number; y: number; isPinching: boolean }) => {
    const posX = (x - 0.5) * 12;
    const posY = (0.5 - y) * 8;

    return (
        <mesh position={[posX, posY, 3]}>
            <sphereGeometry args={[isPinching ? 0.4 : 0.25, 16, 16]} />
            <meshStandardMaterial
                color={isPinching ? "#22c55e" : "#06b6d4"}
                emissive={isPinching ? "#22c55e" : "#06b6d4"}
                emissiveIntensity={0.8}
                transparent
                opacity={0.9}
            />
        </mesh>
    );
};

export const BioTwinScene = ({
    cursorX,
    cursorY,
    isPinching,
    tissueShapes,
    imageSrc,
    particles,
    isExploded = false,
    handRotation = { x: 0, y: 0 }
}: BioTwinSceneProps) => {
    const hasImage = imageSrc && imageSrc.length > 0;
    const hasShapes = tissueShapes && tissueShapes.length > 0;

    return (
        <div className="w-full h-full min-h-[300px]">
            <Canvas
                camera={{ position: [0, 0, 8], fov: 60 }}
                style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
            >
                {/* Iluminacion */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={1.5} />
                <pointLight position={[-10, -10, -5]} color="#06b6d4" intensity={0.8} />
                <pointLight position={[10, 10, 10]} color="#ec4899" intensity={0.5} />

                {/* Controles de orbita */}
                <OrbitControls
                    enableZoom={true}
                    enablePan={true}
                    autoRotate={false}
                />

                {/* Grid de referencia */}
                <Grid
                    args={[20, 20]}
                    position={[0, -4, 0]}
                    cellSize={1}
                    cellThickness={0.5}
                    cellColor="#334155"
                    sectionSize={5}
                    sectionThickness={1}
                    sectionColor="#475569"
                    fadeDistance={25}
                    fadeStrength={1}
                    followCamera={false}
                />

                {/* Cursor 3D */}
                <HandCursor3D x={cursorX} y={cursorY} isPinching={isPinching} />

                {/* Imagen 3D con particulas */}
                {hasImage && (
                    <ImagePlane3D
                        imageSrc={imageSrc}
                        particles={particles || null}
                        isExploded={isExploded}
                        rotation={handRotation}
                    />
                )}

                {/* Tejido extrudido si hay shapes */}
                {hasShapes && !hasImage && (
                    <ExtrudedTissue
                        shapes={tissueShapes}
                        depth={0.5}
                        color="#ec4899"
                        position={[0, 0, 0]}
                    />
                )}
            </Canvas>

            {/* Instrucciones */}
            <div className="absolute top-2 left-2 text-xs text-slate-400 bg-black/50 p-2 rounded">
                <p>Pinch: Segmentar | Grab: Rotar</p>
                <p>Doble Pinch: Explotar/Reunir</p>
            </div>
        </div>
    );
};
