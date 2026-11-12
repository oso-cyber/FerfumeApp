import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CurvePath, Group, LineCurve3, Shape, Vector3, TextureLoader, SRGBColorSpace } from 'three';

export type TopDesign = { style: 'Dollops' | 'Rosettes' | 'Swirls'; coverage: 'Full top' | 'Border / picture space' | 'Half top'; photoUri?: string | null };

function CentrePhoto({ uri, size }: { uri: string; size: number }) {
    const texture = useLoader(TextureLoader, uri);
    texture.colorSpace = SRGBColorSpace;
    return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>;
}

function outline(shape: string, radius: number): [number, number][] {
    if (shape === 'Heart' || shape === 'Star') return (shape === 'Heart' ? HEART_SHAPE : STAR_SHAPE).getPoints(24).map((p) => [p.x * radius, p.y * radius]);
    const count = shape === 'Square' ? 4 : shape === 'Hexagonal' ? 6 : 48;
    const r = shape === 'Square' ? radius * 0.92 * Math.SQRT2 : radius;
    return Array.from({ length: count }, (_, i) => [Math.sin(i * Math.PI * 2 / count + (shape === 'Square' ? Math.PI / 4 : 0)) * r, Math.cos(i * Math.PI * 2 / count + (shape === 'Square' ? Math.PI / 4 : 0)) * r]);
}

function contourCurve(points: [number, number][]) {
    const curve = new CurvePath<Vector3>();
    points.forEach(([x, z], i) => {
        const next = points[(i + 1) % points.length];
        curve.add(new LineCurve3(new Vector3(x, 0, z), new Vector3(next[0], 0, next[1])));
    });
    return curve;
}

function TopIcing({ design, shape, radius, y, color, cupcake = false }: { design: TopDesign; shape: string; radius: number; y: number; color: string; cupcake?: boolean }) {
    const boundary = outline(shape, radius * 0.8);
    const perimeter = contourCurve(boundary);
    const positions: [number, number][] = perimeter.getSpacedPoints(24).slice(0, -1).map((p) => [p.x, p.z]);
    const inside = (x: number, z: number) => {
        let result = false;
        for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
            const a = boundary[i], b = boundary[j];
            if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
        }
        return result;
    };
    if (design.coverage !== 'Border / picture space') {
        for (let x = -radius * 0.6; x <= radius * 0.6; x += radius * 0.3)
            for (let z = -radius * 0.6; z <= radius * 0.6; z += radius * 0.3)
                if (inside(x, z)) positions.push([x, z]);
    }
    const singleRose = cupcake && design.style === 'Rosettes' && design.coverage === 'Full top';
    if (singleRose) positions.splice(0, positions.length, [0, 0]);
    return <group position={[0, y, 0]}>
        {design.coverage === 'Border / picture space' && design.photoUri && <PreviewBoundary key={design.photoUri} fallback={null}><Suspense fallback={null}><CentrePhoto uri={design.photoUri} size={radius * (shape === 'Star' ? 0.4 : shape === 'Heart' ? 0.5 : 0.85)} /></Suspense></PreviewBoundary>}
        {positions.filter(([x]) => design.coverage !== 'Half top' || x < 0).map(([x, z], i) => <group key={i} position={[x, 0, z]} scale={singleRose ? [8, 2, 8] : [1, 1, 1]}>
            {design.style === 'Dollops' ? <mesh position={[0, 0.045, 0]}><coneGeometry args={[radius * 0.065, 0.1, 8]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh> :
                [0, 1, 2].map((level) => <mesh key={level} position={[0, level * (design.style === 'Swirls' ? 0.04 : 0.015), 0]} rotation={[Math.PI / 2, 0, level * 0.4]}><torusGeometry args={[radius * (0.055 - level * 0.015), radius * 0.022, 6, 12]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>)}
        </group>)}
    </group>;
}

const GLYPHS: Record<string, string[]> = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

function BitmapText({
    value,
    top,
    width,
    height,
    surfaceDepth,
    wrap,
}: {
    value: string;
    top: boolean;
    width: number;
    height: number;
    surfaceDepth: number;
    wrap: boolean;
}) {
    const normalized = value.toUpperCase().replace(/[^A-Z ]/g, '');
    const glyphWidth = 5;
    const gap = 1;
    const columns = normalized.length * (glyphWidth + gap);
    const cell = Math.min(0.035, width / Math.max(columns, 1));
    const startX = -(columns * cell) / 2;
    return (
        <group position={top ? [0, height / 2 + 0.012, 0] : [0, 0, 0]} rotation={[0, 0, 0]}>
            {Array.from(normalized).flatMap((character, characterIndex) => {
                const glyph = GLYPHS[character] || GLYPHS[' '];
                return glyph.flatMap((row, rowIndex) => Array.from(row).flatMap((pixel, columnIndex) => pixel === '1' ? (
                    <mesh
                        key={`${characterIndex}-${rowIndex}-${columnIndex}`}
                        position={(() => {
                            const textX = startX + (characterIndex * (glyphWidth + gap) + columnIndex) * cell;
                            if (!top && wrap) {
                                const angle = textX / surfaceDepth;
                                return [
                                    Math.sin(angle) * surfaceDepth,
                                    (3 - rowIndex) * cell,
                                    Math.cos(angle) * surfaceDepth + 0.004,
                                ];
                            }
                            return [
                                textX,
                                top ? 0 : (3 - rowIndex) * cell,
                                top ? (3 - rowIndex) * cell : surfaceDepth + 0.004,
                            ];
                        })()}
                        rotation={!top && wrap
                            ? [0, (startX + (characterIndex * (glyphWidth + gap) + columnIndex) * cell) / surfaceDepth, 0]
                            : [0, 0, 0]}
                    >
                        <boxGeometry args={[
                            cell * 0.9,
                            top ? cell * 0.18 : cell * 0.9,
                            top ? cell * 0.9 : cell * 0.18,
                        ]} />
                        <meshStandardMaterial color="#3A2418" />
                    </mesh>
                ) : []));
            })}
        </group>
    );
}

const HEART_SHAPE = (() => {
    const shape = new Shape();
    shape.moveTo(0, -0.7);
    shape.bezierCurveTo(-0.2, -0.5, -0.9, -0.08, -0.76, 0.4);
    shape.bezierCurveTo(-0.66, 0.76, -0.2, 0.78, 0, 0.42);
    shape.bezierCurveTo(0.2, 0.78, 0.66, 0.76, 0.76, 0.4);
    shape.bezierCurveTo(0.9, -0.08, 0.2, -0.5, 0, -0.7);
    return shape;
})();

const STAR_SHAPE = (() => {
    const shape = new Shape();
    const points = Array.from({ length: 10 }, (_, index) => {
        const radius = index % 2 === 0 ? 0.72 : 0.32;
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
    });
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    return shape;
})();

type CakeCanvas3DProps = {
    topDesign?: TopDesign;
    cupcake?: { flavor: string; color: string; toppings: string[] };
    tiers: Array<{ width: number; height: number; shape: string; flavorColors: string[] }>;
    coating: string;
    coatingColor: string;
    toppings: string[];
    customTexts?: string[];
};

type CakeModelProps = CakeCanvas3DProps;

function CupcakeModel({ flavor, color, toppings, topDesign }: NonNullable<CakeCanvas3DProps['cupcake']> & { topDesign?: TopDesign }) {
    const group = useRef<Group>(null);
    useFrame((_, delta) => { if (group.current) group.current.rotation.y += delta * 0.25; });
    const frosting = flavor === 'Chocolate' ? '#795040' : '#FFF0D8';
    return (
        <group ref={group} position={[0, -0.2, 0]}>
            <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.53, 0.37, 0.65, 48]} />
                <meshStandardMaterial color="#DDBD92" roughness={0.95} />
            </mesh>
            {Array.from({ length: 32 }, (_, i) => {
                const angle = i * Math.PI / 16;
                return <mesh key={i} position={[Math.sin(angle) * 0.45, -0.2, Math.cos(angle) * 0.45]} rotation={[Math.cos(angle) * 0.23, 0, -Math.sin(angle) * 0.23]}>
                    <cylinderGeometry args={[0.015, 0.012, 0.65, 5]} /><meshStandardMaterial color="#C6A478" roughness={1} />
                </mesh>;
            })}
            <mesh position={[0, 0.13, 0]} scale={[1, 0.42, 1]}>
                <sphereGeometry args={[0.55, 32, 16]} /><meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
            {topDesign && !(topDesign.style === 'Swirls' && topDesign.coverage === 'Full top') ? <TopIcing cupcake design={topDesign} shape="Round" radius={0.52} y={0.36} color={frosting} /> : <>{Array.from({ length: 6 }, (_, i) => (
                <mesh key={i} position={[0.015 * Math.sin(i), 0.27 + i * 0.105, 0]} rotation={[Math.PI / 2, 0, i * 0.12]}>
                    <torusGeometry args={[0.39 - i * 0.065, 0.085 - i * 0.007, 10, 40]} />
                    <meshStandardMaterial color={frosting} roughness={0.85} />
                </mesh>
            ))}
            <mesh position={[0, 0.85, 0]}><coneGeometry args={[0.075, 0.16, 16]} /><meshStandardMaterial color={frosting} roughness={0.85} /></mesh></>}
            {toppings.includes('strawberries') && <mesh position={[0.24, 0.43, 0.18]} scale={[0.8, 1.2, 0.8]}><sphereGeometry args={[0.12, 16, 12]} /><meshStandardMaterial color="#CF3044" roughness={0.65} /></mesh>}
            {toppings.includes('oreo') && <mesh position={[-0.22, 0.51, 0]} rotation={[Math.PI / 2, 0.3, 0]}><cylinderGeometry args={[0.17, 0.17, 0.055, 24]} /><meshStandardMaterial color="#241914" roughness={0.95} /></mesh>}
            {toppings.includes('flowers') && <group position={[0.2, 0.5, 0.25]}>
                {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[Math.sin(i * Math.PI * 2 / 5) * 0.065, Math.cos(i * Math.PI * 2 / 5) * 0.065, 0]} scale={[1, 1, 0.4]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial color="#F3A7CA" /></mesh>)}
                <mesh position={[0, 0, 0.025]}><sphereGeometry args={[0.028, 10, 8]} /><meshStandardMaterial color="#FFD76A" /></mesh>
            </group>}
            {toppings.includes('gold leaf') && [0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.sin(i * 2) * 0.23, 0.4 + i * 0.08, Math.cos(i * 2) * 0.23]} rotation={[0.3, i, 0.4]}><boxGeometry args={[0.07, 0.05, 0.008]} /><meshStandardMaterial color="#D9AC42" metalness={0.7} roughness={0.35} /></mesh>)}
        </group>
    );
}

function CakeModel({ tiers, coating, coatingColor, toppings, customTexts = [], topDesign }: CakeModelProps) {
    const cakeGroup = useRef<Group>(null);
    const [rotation, setRotation] = useState({ x: 0, y: -0.35 });
    const dragging = useRef(false);
    const lastPointer = useRef({ x: 0, y: 0 });
    useFrame(() => {
        if (cakeGroup.current && !dragging.current) {
            cakeGroup.current.rotation.y += 0.006;
            cakeGroup.current.rotation.x += (rotation.x - cakeGroup.current.rotation.x) * 0.12;
        }
    });

    const handlePointerDown = (event: any) => {
        event.stopPropagation();
        dragging.current = true;
        lastPointer.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: any) => {
        if (!dragging.current) return;
        event.stopPropagation();
        const deltaX = event.clientX - lastPointer.current.x;
        const deltaY = event.clientY - lastPointer.current.y;
        lastPointer.current = { x: event.clientX, y: event.clientY };
        setRotation((current) => ({
            x: Math.max(-0.6, Math.min(0.6, current.x + deltaY * 0.01)),
            y: current.y + deltaX * 0.01,
        }));
    };

    const stopDragging = (event: any) => {
        event.stopPropagation();
        dragging.current = false;
    };

    return (
        <group
            ref={cakeGroup}
            scale={[1, 1, 1]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onPointerOut={stopDragging}
        >
            {tiers.map((tier, index) => {
                const radius = 0.72 * tier.width;
                const y = tiers.slice(0, index).reduce((total, item) => total + item.height, 0)
                    + tier.height / 2
                    - tiers.reduce((total, item) => total + item.height, 0) / 2;
                const tierHeight = tier.height;
                const shape = tier.shape;
                const flavorColor = tier.flavorColors[0] || '#FFF4D6';
                const secondFlavorColor = tier.flavorColors[1];
                const supportsRoundDetails = shape === 'Round' || shape === 'Hexagonal';
                const isExtrudedShape = shape === 'Heart' || shape === 'Star';
                const topSurfaceY = tierHeight / 2 + 0.035;
                // ExtrudeGeometry starts at depth 0. Offset rotated shapes so their
                // vertical bounds match cylinders and boxes when tiers are stacked.
                const extrudedTierPositionY = (tierHeight / 2);
                const toppingSurfaceY = topSurfaceY;
                const decorationAngles = shape === 'Square'
                    ? [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]
                    : [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];
                const decorationPositions = decorationAngles.map((angle) => [
                    Math.cos(angle) * radius * (shape === 'Square' ? 0.62 : 0.7),
                    toppingSurfaceY,
                    Math.sin(angle) * radius * (shape === 'Square' ? 0.62 : 0.7),
                ] as const);
                const ganacheDripPositions: Array<readonly [number, number]> = supportsRoundDetails
                    ? [-0.45, -0.15, 0.18, 0.5].map((offset) => [offset * radius, radius * 0.99] as const)
                    : shape === 'Square'
                        ? [-0.62, -0.22, 0.2, 0.6].map((offset) => [offset * radius, radius * 0.91] as const)
                        : isExtrudedShape
                            ? [-0.52, -0.2, 0.2, 0.5].map((offset) => [offset * radius, radius * 0.5] as const)
                            : [-0.5, -0.15, 0.2, 0.5].map((offset) => [offset * radius, radius * 0.78] as const);
                const ganacheDripLengths = [0.24, 0.14, 0.3, 0.19];
                const shapeGeometry = shape === 'Heart' ? HEART_SHAPE : STAR_SHAPE;
                const frostingContour = contourCurve(outline(shape, radius * (isExtrudedShape ? 1.04 : 1) + (isExtrudedShape ? 0 : 0.02)));
                const sideOutline = isExtrudedShape
                    ? shapeGeometry.getSpacedPoints(18).slice(0, -1).map((point) => [point.x * radius * 1.04, point.y * radius * 1.04] as const)
                    : Array.from({ length: 12 }, (_, sideIndex) => {
                        const angle = sideIndex * Math.PI / 6;
                        const x = Math.sin(angle);
                        const z = Math.cos(angle);
                        const surfaceRadius = shape === 'Square'
                            ? radius * 0.93 / Math.max(Math.abs(x), Math.abs(z))
                            : shape === 'Hexagonal'
                                ? (radius + 0.025) * Math.cos(Math.PI / 6) / Math.cos((angle % (Math.PI / 3)) - Math.PI / 6)
                                : radius + 0.025;
                        return [x * surfaceRadius, z * surfaceRadius] as const;
                    });
                return (
                    <group key={index} position={[0, y, 0]}>
                        <mesh
                            castShadow
                            receiveShadow
                            position={isExtrudedShape ? [0, extrudedTierPositionY, 0] : [0, 0, 0]}
                            rotation={isExtrudedShape ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
                            scale={isExtrudedShape ? [radius, radius, 1] : [1, 1, 1]}
                        >
                            {shape === 'Square' ? (
                                <boxGeometry args={[radius * 1.8, tierHeight, radius * 1.8]} />
                            ) : shape === 'Heart' ? (
                                <extrudeGeometry args={[HEART_SHAPE, { depth: tierHeight, bevelEnabled: false }]} />
                            ) : shape === 'Star' ? (
                                <extrudeGeometry args={[STAR_SHAPE, { depth: tierHeight, bevelEnabled: false }]} />
                            ) : (
                                <cylinderGeometry args={[radius, radius, tierHeight, shape === 'Hexagonal' ? 6 : 48]} />
                            )}
                            <meshStandardMaterial
                                color={flavorColor}
                                roughness={coating === 'Ganache' ? 0.25 : 0.82}
                                metalness={coating === 'Ganache' ? 0.08 : 0}
                            />
                        </mesh>
                        {secondFlavorColor && shape === 'Square' && (
                            <mesh position={[0, tierHeight / 4, 0]} castShadow receiveShadow>
                                <boxGeometry args={[radius * 1.8 + 0.004, tierHeight / 2 + 0.004, radius * 1.8 + 0.004]} />
                                <meshStandardMaterial
                                    color={secondFlavorColor}
                                    roughness={coating === 'Ganache' ? 0.25 : 0.82}
                                    metalness={coating === 'Ganache' ? 0.08 : 0}
                                />
                            </mesh>
                        )}
                        {secondFlavorColor && (shape === 'Round' || shape === 'Hexagonal') && (
                            <mesh position={[0, tierHeight / 4, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[radius + 0.003, radius + 0.003, tierHeight / 2 + 0.004, shape === 'Hexagonal' ? 6 : 48]} />
                                <meshStandardMaterial
                                    color={secondFlavorColor}
                                    roughness={coating === 'Ganache' ? 0.25 : 0.82}
                                    metalness={coating === 'Ganache' ? 0.08 : 0}
                                />
                            </mesh>
                        )}
                        {shape === 'Square' && coating !== 'Naked' && (
                            <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
                                <boxGeometry args={[radius * 1.84, tierHeight + 0.05, radius * 1.84]} />
                                <meshStandardMaterial
                                    color={coatingColor}
                                    roughness={coating === 'Ganache' ? 0.22 : coating === 'Buttercream' ? 0.88 : 0.45}
                                    metalness={coating === 'Ganache' ? 0.08 : 0}
                                />
                            </mesh>
                        )}
                        {isExtrudedShape && coating === 'Fondant' && (
                            <mesh
                                rotation={[Math.PI / 2, 0, 0]}
                                scale={[radius * 1.04, radius * 1.04, 1]}
                                position={[0, (tierHeight + 0.05) / 2, 0]}
                                castShadow
                                receiveShadow
                            >
                                <extrudeGeometry
                                    args={[shapeGeometry, { depth: tierHeight + 0.05, bevelEnabled: false }]}
                                />
                                <meshStandardMaterial color={coatingColor} roughness={0.35} />
                            </mesh>
                        )}
                        {isExtrudedShape && coating === 'Buttercream' && (
                            <mesh
                                rotation={[Math.PI / 2, 0, 0]}
                                scale={[radius * 1.04, radius * 1.04, 1]}
                                position={[0, tierHeight / 2 + 0.025, 0]}
                                castShadow
                                receiveShadow
                            >
                                <extrudeGeometry
                                    args={[shapeGeometry, { depth: tierHeight + 0.05, bevelEnabled: false }]}
                                />
                                <meshStandardMaterial color={coatingColor} roughness={0.88} />
                            </mesh>
                        )}
                        {isExtrudedShape && coating === 'Ganache' && (
                            <mesh
                                rotation={[Math.PI / 2, 0, 0]}
                                scale={[radius, radius, 1]}
                                position={[0, tierHeight / 2 + 0.025, 0]}
                            >
                                <extrudeGeometry
                                    args={[shapeGeometry, { depth: 0.05, bevelEnabled: false }]}
                                />
                                <meshStandardMaterial color={coatingColor} roughness={0.22} metalness={0.08} />
                            </mesh>
                        )}
                        {supportsRoundDetails && coating === 'Buttercream' && (
                            <mesh>
                                <cylinderGeometry args={[radius + 0.02, radius + 0.02, tierHeight + 0.05, shape === 'Hexagonal' ? 6 : 64]} />
                                <meshStandardMaterial color={coatingColor} roughness={0.88} />
                            </mesh>
                        )}
                        {coating === 'Buttercream' && Array.from({ length: 9 }, (_, i) => -tierHeight / 2 + i * tierHeight / 8).map((lineY) => (
                            <mesh
                                key={lineY}
                                position={[0, lineY, 0]}
                            >
                                <tubeGeometry args={[frostingContour, 96, 0.009, 5, true]} />
                                <meshStandardMaterial color={coatingColor} roughness={0.92} />
                            </mesh>
                        ))}
                        {supportsRoundDetails && coating === 'Fondant' && (
                            <mesh castShadow receiveShadow>
                                <cylinderGeometry args={[radius + 0.035, radius + 0.035, tierHeight + 0.05, 64]} />
                                <meshStandardMaterial color={coatingColor} roughness={0.35} />
                            </mesh>
                        )}
                        {coating === 'Ganache' && ganacheDripPositions.map(([dripX, dripZ], dripIndex) => {
                            const dripLength = ganacheDripLengths[dripIndex];
                            return (
                            <mesh
                                key={`drip-${dripIndex}`}
                                position={[dripX, tierHeight / 2 + 0.025 - dripLength / 2, dripZ]}
                            >
                                <cylinderGeometry args={[0.045, 0.065, dripLength, 16]} />
                                <meshStandardMaterial color={coatingColor} roughness={0.22} metalness={0.08} />
                            </mesh>
                            );
                        })}
                        {topDesign && index === tiers.length - 1 && <TopIcing design={topDesign} shape={shape} radius={radius} y={toppingSurfaceY + 0.015} color={coatingColor} />}
                        {customTexts[index]?.trim() && (
                            <BitmapText
                                value={customTexts[index]}
                                top={isExtrudedShape}
                                width={radius * 1.35}
                                height={tierHeight}
                                surfaceDepth={shape === 'Square' ? radius * 0.9 : radius + 0.004}
                                wrap={supportsRoundDetails}
                            />
                        )}
                        {supportsRoundDetails && (
                            <mesh position={[0, toppingSurfaceY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                                <torusGeometry args={[radius * 0.86, 0.035, 12, 48]} />
                                <meshStandardMaterial color="#FFF8E7" roughness={0.55} />
                            </mesh>
                        )}
                        {toppings.includes('strawberries') && (supportsRoundDetails
                            ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => (
                            <mesh
                                key={`berry-${angle}`}
                                position={[Math.cos(angle) * radius * 0.82, toppingSurfaceY, Math.sin(angle) * radius * 0.82]}
                                castShadow
                            >
                                <sphereGeometry args={[0.075, 16, 16]} />
                                <meshStandardMaterial color="#D7263D" roughness={0.45} />
                            </mesh>
                        ))
                            : [0, 1, 2].map((toppingIndex) => (
                                <mesh
                                    key={`berry-${toppingIndex}`}
                                    position={toppingIndex === 2
                                        ? [0, toppingSurfaceY, 0]
                                        : [(toppingIndex === 0 ? -1 : 1) * radius * 0.42, toppingSurfaceY, radius * 0.52]}
                                    castShadow
                                >
                                    <sphereGeometry args={[0.075, 16, 16]} />
                                    <meshStandardMaterial color="#D7263D" roughness={0.45} />
                                </mesh>
                            ))
                        )}
                        {toppings.includes('flowers') && decorationPositions.map((position, decorationIndex) => (
                            <group key={`flower-${decorationIndex}`} position={position} rotation={[0, decorationAngles[decorationIndex], 0]}>
                                {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((petalAngle) => (
                                    <mesh
                                        key={`flower-${decorationIndex}-${petalAngle}`}
                                        position={[Math.cos(petalAngle) * 0.055, 0.02, Math.sin(petalAngle) * 0.055]}
                                        rotation={[Math.PI / 2, 0, 0]}
                                        castShadow
                                    >
                                        <torusGeometry args={[0.045, 0.018, 8, 12]} />
                                        <meshStandardMaterial color="#F7B2D8" roughness={0.5} />
                                    </mesh>
                                ))}
                                <mesh position={[0, 0.025, 0]} castShadow>
                                    <sphereGeometry args={[0.025, 10, 10]} />
                                    <meshStandardMaterial color="#FFD76A" roughness={0.45} />
                                </mesh>
                            </group>
                        ))}
                        {toppings.includes('gold leaf') && (
                            decorationPositions.map((position, decorationIndex) => (
                                <mesh
                                    key={`gold-leaf-${decorationIndex}`}
                                    position={[position[0], position[1] + 0.035, position[2]]}
                                    rotation={[0.2, decorationAngles[decorationIndex], 0.2]}
                                    castShadow
                                >
                                    <boxGeometry args={[0.1, 0.018, 0.07]} />
                                    <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.25} />
                                </mesh>
                            ))
                        )}
                        {toppings.includes('oreo') && (
                            decorationPositions.map((position, decorationIndex) => (
                                <mesh
                                    key={`oreo-${decorationIndex}`}
                                    position={[position[0], position[1] + 0.045, position[2]]}
                                    rotation={[Math.PI / 2, decorationAngles[decorationIndex], 0]}
                                    castShadow
                                >
                                    <cylinderGeometry args={[0.07, 0.07, 0.035, 24]} />
                                    <meshStandardMaterial color="#17120F" roughness={0.8} />
                                </mesh>
                            ))
                        )}
                        {sideOutline.map(([x, z], decorationIndex) => {
                            const decoration = toppings.filter((item) => ['flowers', 'gold leaf', 'strawberries', 'oreo'].includes(item));
                            const selected = decoration[Math.floor(decorationIndex / 2) % decoration.length];
                            if (!selected || decorationIndex % 2 !== 0) return null;
                            return (
                                <group key={`side-${decorationIndex}`} position={[x, tierHeight * (decorationIndex % 3 - 1) * 0.22, z]} rotation={[0, Math.atan2(x, z), 0]}>
                                    {selected === 'flowers' ? <>
                                        {Array.from({ length: 5 }, (_, petal) => (
                                            <mesh key={petal} position={[Math.sin(petal * Math.PI * 2 / 5) * 0.05, Math.cos(petal * Math.PI * 2 / 5) * 0.05, 0.025]} scale={[1, 1, 0.4]}>
                                                <sphereGeometry args={[0.04, 10, 8]} /><meshStandardMaterial color="#F7B2D8" roughness={0.8} />
                                            </mesh>
                                        ))}
                                        <mesh position={[0, 0, 0.045]}><sphereGeometry args={[0.024, 10, 8]} /><meshStandardMaterial color="#FFD76A" /></mesh>
                                    </> : selected === 'gold leaf' ? (
                                        <mesh rotation={[0, 0, decorationIndex * 0.7]}><boxGeometry args={[0.09, 0.12, 0.012]} /><meshStandardMaterial color="#D9AC42" metalness={0.7} roughness={0.35} /></mesh>
                                    ) : selected === 'oreo' ? (
                                        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.065, 0.065, 0.035, 20]} /><meshStandardMaterial color="#241914" roughness={0.9} /></mesh>
                                    ) : (
                                        <mesh scale={[0.8, 1.2, 0.55]}><sphereGeometry args={[0.07, 12, 10]} /><meshStandardMaterial color="#CC3045" roughness={0.65} /></mesh>
                                    )}
                                </group>
                            );
                        })}
                    </group>
                );
            })}

        </group>
    );
}

function NativeCakeCanvas({
    topDesign,
    cupcake,
    tiers,
    coating,
    coatingColor,
    toppings,
    customTexts = [],
}: CakeCanvas3DProps) {
    const totalHeight = tiers.reduce((sum, tier) => sum + tier.height, 0);
    const widestTier = Math.max(1, ...tiers.map((tier) => tier.width));
    const cameraDistance = cupcake ? 3.2 : Math.max(3.4, totalHeight * 1.8, widestTier * 3);
    return (
        <View style={styles.container}
            onStartShouldSetResponderCapture={() => true}
            onMoveShouldSetResponderCapture={() => true}
            onResponderTerminationRequest={() => false}
        >
            <Canvas
                camera={{ position: [0, cameraDistance * 0.3, cameraDistance], fov: 42, up: [0, 1, 0] }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.8} />
                <directionalLight position={[2, 4, 4]} intensity={2} color="#FFF4E6" />
                <directionalLight position={[-3, 1, 2]} intensity={0.7} color="#E6EEFF" />
                <directionalLight position={[0, 3, -3]} intensity={1} color="#FFFFFF" />
                {cupcake ? <CupcakeModel {...cupcake} topDesign={topDesign} /> : <CakeModel
                    topDesign={topDesign}
                    tiers={tiers}
                    coating={coating}
                    coatingColor={coatingColor}
                    toppings={toppings}
                    customTexts={customTexts}
                />}
            </Canvas>
        </View>
    );
}

class PreviewBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function CakeCanvas3D(props: CakeCanvas3DProps) {
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        let mounted = true;
        const checkGraphics = async () => {
            try {
                const { GLView } = await import('expo-gl');
                const context = await GLView.createContextAsync();
                await GLView.destroyContextAsync(context);
                if (mounted) setAvailable(true);
            } catch {
                // Keep the editable summary when the runtime cannot create a GL context.
            }
        };
        void checkGraphics();
        return () => { mounted = false; };
    }, []);
    const fallback = (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: '#FFD700', fontWeight: '800', marginBottom: 8 }}>{props.cupcake ? `${props.cupcake.flavor} cupcake` : 'Your cake design'}</Text>
            <Text style={{ color: '#fff', textAlign: 'center' }}>
                {props.tiers.length} tiers · {props.coating}{'\n'}
                {props.cupcake ? props.cupcake.toppings.join(', ') : props.tiers.map((tier, index) => `Tier ${index + 1}: ${tier.shape}, ${Math.round(tier.width * 10)} cm`).join('\n')}
            </Text>
            <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 8 }}>You can keep editing using the options below. A 3D preview appears when supported.</Text>
        </View>
    );
    return available ? <PreviewBoundary fallback={fallback}><NativeCakeCanvas {...props} /></PreviewBoundary> : fallback;
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
    },
});
