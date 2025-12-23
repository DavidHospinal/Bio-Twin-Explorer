import { useMemo } from 'react';
import * as THREE from 'three';

interface ExtrudedTissueProps {
    shapes: THREE.Shape[];
    depth?: number;
    color?: string;
    position?: [number, number, number];
}

export const ExtrudedTissue = ({
    shapes,
    depth = 0.5,
    color = '#ec4899',
    position = [0, 0, 0]
}: ExtrudedTissueProps) => {
    const geometry = useMemo(() => {
        if (shapes.length === 0) return null;

        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
            steps: 1,
            depth: depth,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.03,
            bevelOffset: 0,
            bevelSegments: 3
        };

        try {
            const geom = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
            geom.center();
            return geom;
        } catch (e) {
            console.error('Error creating extruded geometry:', e);
            return null;
        }
    }, [shapes, depth]);

    if (!geometry) return null;

    return (
        <mesh position={position} geometry={geometry}>
            <meshStandardMaterial
                color={color}
                roughness={0.3}
                metalness={0.6}
                side={THREE.DoubleSide}
                transparent
                opacity={0.85}
            />
        </mesh>
    );
};
