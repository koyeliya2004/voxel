import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const VoxelBackground: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const clockRef = useRef<THREE.Clock | null>(null);
    const requestRef = useRef<number | null>(null);

    // State tracking refs
    const birdsRef = useRef<THREE.Mesh[]>([]);
    const waterfallDataRef = useRef<any[]>([]);
    const glowDataRef = useRef<any[]>([]);
    const blueGlowDataRef = useRef<any[]>([]);
    const treeDataRef = useRef<any[]>([]);
    const islandsRef = useRef<any[]>([]);
    const leafFallDataRef = useRef<any[]>([]);
    const leafDataGlobalRef = useRef<any[]>([]);

    // Instanced Meshes refs
    const instancedLeavesRef = useRef<THREE.InstancedMesh | null>(null);
    const instancedFallingLeavesRef = useRef<THREE.InstancedMesh | null>(null);
    const instancedWaterfallsRef = useRef<THREE.InstancedMesh | null>(null);
    const instancedGlowRef = useRef<THREE.InstancedMesh | null>(null);
    const instancedBlueGlowRef = useRef<THREE.InstancedMesh | null>(null);

    const voxelSize = 0.5;

    const COLORS = {
        sky: 0x010b13,
        fog: 0x010b13,
        grass: 0x064e3b,    
        leaves: 0x10b981,   
        trunk: 0x1a0f0a,    
        stone: 0x1e293b,    
        water: 0x1e3a8a,    
        crystal: 0x60a5fa,  
        glow: 0x34d399,     // Emerald Glow
        blueGlow: 0x3b82f6, // New Blue Glow
        bird: 0xffffff,
        flower: 0xec4899    
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // --- Init ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(COLORS.sky);
        scene.fog = new THREE.FogExp2(COLORS.fog, 0.025);

        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        cameraRef.current = camera;
        
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance"
        });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
        container.appendChild(renderer.domElement);

        const clock = new THREE.Clock();
        clockRef.current = clock;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0x34d399, 1.0);
        sunLight.position.set(20, 50, 30);
        scene.add(sunLight);

        // Water Surface
        const waterGeo = new THREE.PlaneGeometry(1500, 1500);
        const waterMat = new THREE.MeshStandardMaterial({ 
            color: COLORS.water, 
            metalness: 0.9, 
            roughness: 0.05,
            transparent: true,
            opacity: 0.75
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -2.1;
        scene.add(water);

        // --- Scene Generation ---
        const generateOptimizedScene = () => {
            const cubeGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
            const dummy = new THREE.Object3D();

            let grassPos: number[][] = [], stonePos: number[][] = [], flowerPos: number[][] = [];
            const worldWidth = 120;
            const worldDepth = 150;
            const riverGap = 13.5;

            // Generate valley landscape
            for(let x = -worldWidth/2; x < worldWidth/2; x += voxelSize) {
                for(let z = -worldDepth; z < 40; z += voxelSize) {
                    const absX = Math.abs(x);
                    if(absX > riverGap) {
                        const elevationFactor = (absX - riverGap) * 0.9;
                        const h = elevationFactor + (Math.sin(x*0.25) * Math.cos(z*0.1)) * 6;
                        
                        for(let y = 0; y < h; y += voxelSize) {
                            const isTop = y >= h - voxelSize;
                            const pos = [x, -2 + y, z];
                            if(isTop) {
                                grassPos.push(pos);
                                if (absX < riverGap + 5 && Math.random() > 0.99) generateWaterfallData(x, -2+y, z);
                                if (Math.random() > 0.982) generateTreeData(x, -2+y, z);
                                if (Math.random() > 0.96) flowerPos.push([x, -2 + y + 0.1, z]);
                            } else {
                                stonePos.push(pos);
                            }
                        }
                    }
                }
            }

            const instancedGrass = new THREE.InstancedMesh(cubeGeo, new THREE.MeshStandardMaterial({ color: COLORS.grass }), grassPos.length);
            grassPos.forEach((p, i) => {
                dummy.position.set(p[0], p[1], p[2]);
                dummy.updateMatrix();
                instancedGrass.setMatrixAt(i, dummy.matrix);
            });
            scene.add(instancedGrass);

            const instancedStone = new THREE.InstancedMesh(cubeGeo, new THREE.MeshStandardMaterial({ color: COLORS.stone }), stonePos.length);
            stonePos.forEach((p, i) => {
                dummy.position.set(p[0], p[1], p[2]);
                dummy.updateMatrix();
                instancedStone.setMatrixAt(i, dummy.matrix);
            });
            scene.add(instancedStone);

            const instancedFlowers = new THREE.InstancedMesh(cubeGeo, new THREE.MeshStandardMaterial({ 
                color: COLORS.flower, emissive: COLORS.flower, emissiveIntensity: 1.5 
            }), flowerPos.length);
            flowerPos.forEach((p, i) => {
                dummy.position.set(p[0], p[1], p[2]);
                dummy.scale.set(0.3, 0.3, 0.3);
                dummy.updateMatrix();
                instancedFlowers.setMatrixAt(i, dummy.matrix);
            });
            scene.add(instancedFlowers);

            let leafPos: any[] = [], trunkPos: number[][] = [];
            treeDataRef.current.forEach(tree => {
                for(let i = 0; i < tree.height; i++) trunkPos.push([tree.x, tree.y + (i * voxelSize), tree.z]);
                const radius = 2.4;
                for(let lx = -radius; lx <= radius; lx++) {
                    for(let ly = -1; ly <= radius; ly++) {
                        for(let lz = -radius; lz <= radius; lz++) {
                            if(Math.sqrt(lx*lx + ly*ly + lz*lz) <= radius) {
                                leafPos.push({
                                    base: [tree.x, tree.y + (tree.height * voxelSize), tree.z],
                                    rel: [lx*voxelSize, ly*voxelSize, lz*voxelSize],
                                    offset: tree.offset,
                                    speed: tree.speed
                                });
                                if (Math.random() > 0.99) {
                                    leafFallDataRef.current.push({
                                        x: tree.x + lx*voxelSize,
                                        y: tree.y + (tree.height * voxelSize) + ly*voxelSize,
                                        z: tree.z + lz*voxelSize,
                                        speed: 0.03 + Math.random() * 0.04,
                                        drift: Math.random() * 10,
                                        rotOffset: Math.random() * Math.PI,
                                        resetY: tree.y + (tree.height * voxelSize) + ly*voxelSize
                                    });
                                }
                            }
                        }
                    }
                }
            });

            const instancedTrunk = new THREE.InstancedMesh(cubeGeo, new THREE.MeshStandardMaterial({ color: COLORS.trunk }), trunkPos.length);
            trunkPos.forEach((p, i) => {
                dummy.scale.set(1, 1, 1);
                dummy.position.set(p[0], p[1], p[2]);
                dummy.updateMatrix();
                instancedTrunk.setMatrixAt(i, dummy.matrix);
            });
            scene.add(instancedTrunk);

            const instancedLeaves = new THREE.InstancedMesh(cubeGeo, new THREE.MeshStandardMaterial({ color: COLORS.leaves, roughness: 0.7 }), leafPos.length);
            leafPos.forEach((leaf, i) => {
                dummy.position.set(leaf.base[0] + leaf.rel[0], leaf.base[1] + leaf.rel[1], leaf.base[2] + leaf.rel[2]);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                instancedLeaves.setMatrixAt(i, dummy.matrix);
            });
            leafDataGlobalRef.current = leafPos;
            instancedLeavesRef.current = instancedLeaves;
            scene.add(instancedLeaves);

            const instancedFallingLeaves = new THREE.InstancedMesh(cubeGeo, new THREE.MeshStandardMaterial({ color: COLORS.leaves, transparent: true, opacity: 0.8 }), leafFallDataRef.current.length);
            instancedFallingLeavesRef.current = instancedFallingLeaves;
            scene.add(instancedFallingLeaves);

            const dropGeo = new THREE.BoxGeometry(voxelSize * 0.25, voxelSize * 0.25, voxelSize * 0.25);
            const instancedWaterfalls = new THREE.InstancedMesh(dropGeo, new THREE.MeshStandardMaterial({ 
                color: 0x60a5fa, emissive: 0x3b82f6, emissiveIntensity: 2.0, transparent: true, opacity: 0.6
            }), waterfallDataRef.current.length);
            instancedWaterfallsRef.current = instancedWaterfalls;
            scene.add(instancedWaterfalls);

            const glowGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
            // Emerald Glow Data
            for(let i=0; i<120; i++) {
                glowDataRef.current.push({
                    pos: [(Math.random()-0.5)*180, Math.random()*50 + 2, (Math.random()-0.5)*180],
                    originalY: 0, 
                    floatOffset: Math.random()*Math.PI*2,
                    floatSpeed: 0.12 + Math.random() * 0.2,
                    rotSpeed: Math.random()*0.015
                });
                glowDataRef.current[i].originalY = glowDataRef.current[i].pos[1];
            }
            const instancedGlow = new THREE.InstancedMesh(glowGeo, new THREE.MeshStandardMaterial({ color: COLORS.glow, emissive: COLORS.glow, emissiveIntensity: 1.5 }), glowDataRef.current.length);
            instancedGlowRef.current = instancedGlow;
            scene.add(instancedGlow);

            // Blue Glow Data (New Particles)
            for(let i=0; i<120; i++) {
                blueGlowDataRef.current.push({
                    pos: [(Math.random()-0.5)*180, Math.random()*50 + 2, (Math.random()-0.5)*180],
                    originalY: 0, 
                    floatOffset: Math.random()*Math.PI*2,
                    floatSpeed: 0.15 + Math.random() * 0.25,
                    rotSpeed: Math.random()*0.02,
                    swirlRadius: 2 + Math.random() * 4
                });
                blueGlowDataRef.current[i].originalY = blueGlowDataRef.current[i].pos[1];
            }
            const instancedBlueGlow = new THREE.InstancedMesh(glowGeo, new THREE.MeshStandardMaterial({ color: COLORS.blueGlow, emissive: COLORS.blueGlow, emissiveIntensity: 2.0 }), blueGlowDataRef.current.length);
            instancedBlueGlowRef.current = instancedBlueGlow;
            scene.add(instancedBlueGlow);

            createIsland(-24, 18, -35, 5.0);
            createIsland(28, 14, -50, 4.5);
            createIsland(-14, 20, -18, 3.5);
            
            createBridge(0, 8, -75);
            createBirds(18);
        };

        const generateWaterfallData = (x: number, y: number, z: number) => {
            for(let i = 0; i < 18; i++) {
                waterfallDataRef.current.push({ origin: [x, y, z], currentY: y - Math.random() * 10, fallSpeed: 0.06 + Math.random() * 0.1, resetY: y });
            }
        };

        const generateTreeData = (x: number, y: number, z: number) => {
            treeDataRef.current.push({ x, y, z, height: 4 + Math.random() * 6, offset: Math.random() * 10, speed: 0.25 + Math.random() * 0.35 });
        };

        const createIsland = (bx: number, by: number, bz: number, size: number) => {
            const group = new THREE.Group();
            group.position.set(bx, by, bz);
            const geo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
            const grassMat = new THREE.MeshStandardMaterial({ color: COLORS.grass });
            const stoneMat = new THREE.MeshStandardMaterial({ color: COLORS.stone });
            for(let x = -size; x <= size; x++) {
                for(let z = -size; z <= size; z++) {
                    const d = Math.sqrt(x*x + z*z);
                    if(d <= size) {
                        const h = (size - d) * 2.8;
                        for(let y = 0; y > -h; y--) {
                            const block = new THREE.Mesh(geo, y === 0 ? grassMat : stoneMat);
                            block.position.set(x*voxelSize, y*voxelSize, z*voxelSize);
                            group.add(block);
                        }
                    }
                }
            }
            const lantern = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.glow, emissive: COLORS.glow, emissiveIntensity: 3 }));
            lantern.position.set(0, 1.2, 0);
            group.add(lantern);
            const pLight = new THREE.PointLight(COLORS.glow, 6, 25);
            pLight.position.set(0, 1.2, 0);
            group.add(pLight);
            islandsRef.current.push({ group, originalY: by, originalX: bx, originalZ: bz, offset: Math.random() * Math.PI * 2, light: pLight });
            scene.add(group);
        };

        const createBridge = (x: number, y: number, z: number) => {
            const bridgeGroup = new THREE.Group();
            const geo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
            const mat = new THREE.MeshStandardMaterial({ color: COLORS.stone });
            for(let bx = -18; bx < 18; bx += voxelSize) {
                const block = new THREE.Mesh(geo, mat);
                block.position.set(bx, 0, 0);
                bridgeGroup.add(block);
            }
            bridgeGroup.position.set(x, y, z);
            scene.add(bridgeGroup);
        };

        const createBirds = (count: number) => {
            const birdGeo = new THREE.BoxGeometry(0.3, 0.06, 0.4);
            const birdMat = new THREE.MeshBasicMaterial({ color: COLORS.bird });
            for(let i = 0; i < count; i++) {
                const bird = new THREE.Mesh(birdGeo, birdMat);
                bird.userData = { 
                    angle: Math.random()*Math.PI*2, 
                    radius: 25+Math.random()*35, 
                    speed: 0.15+Math.random()*0.3, 
                    heightOffset: Math.random()*20, 
                    bobOffset: Math.random()*Math.PI*2 
                };
                birdsRef.current.push(bird);
                scene.add(bird);
            }
        };

        generateOptimizedScene();

        // --- Animate ---
        const dummy = new THREE.Object3D();
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            // Camera Motion
            camera.position.x = Math.sin(time * 0.1) * 8 + Math.cos(time * 0.05) * 2;
            camera.position.y = 14 + Math.sin(time * 0.07) * 4;
            camera.position.z = 45 + Math.cos(time * 0.12) * 6;
            camera.lookAt(Math.sin(time * 0.08) * 3, 4 + Math.cos(time * 0.1) * 1.5, -25);

            // Birds
            birdsRef.current.forEach(b => {
                b.userData.angle += 0.003 * b.userData.speed;
                b.position.x = Math.cos(b.userData.angle) * b.userData.radius;
                b.position.z = Math.sin(b.userData.angle) * b.userData.radius - 40;
                b.position.y = 16 + b.userData.heightOffset + Math.sin(time * 0.4 + b.userData.bobOffset) * 5;
                b.rotation.y = -b.userData.angle + Math.PI/2;
                b.rotation.z = Math.sin(time * 10) * 0.12; 
                b.rotation.x = Math.sin(time * 0.3) * 0.15;
            });

            // Islands
            islandsRef.current.forEach(island => {
                island.group.position.y = island.originalY + Math.sin(time * 0.25 + island.offset) * 1.0;
                island.group.position.x = island.originalX + Math.cos(time * 0.15 + island.offset) * 0.5;
                island.group.rotation.z = Math.sin(time * 0.1 + island.offset) * 0.04;
                island.group.rotation.x = Math.cos(time * 0.15 + island.offset) * 0.03;
                island.light.intensity = 4.5 + Math.sin(time * 1.8 + island.offset) * 2.5;
            });

            // Falling Leaves
            if (instancedFallingLeavesRef.current) {
                leafFallDataRef.current.forEach((leaf, i) => {
                    leaf.y -= leaf.speed;
                    if (leaf.y < -2.5) leaf.y = leaf.resetY;
                    const drift = Math.sin(time * 1.5 + leaf.drift) * 0.8;
                    dummy.position.set(leaf.x + drift, leaf.y, leaf.z + Math.cos(time + leaf.drift) * 0.4);
                    dummy.scale.set(0.35, 0.35, 0.35);
                    dummy.rotation.set(time * 2 + leaf.rotOffset, time + leaf.rotOffset, time * 0.5);
                    dummy.updateMatrix();
                    instancedFallingLeavesRef.current!.setMatrixAt(i, dummy.matrix);
                });
                instancedFallingLeavesRef.current.instanceMatrix.needsUpdate = true;
            }

            // Waterfalls
            if (instancedWaterfallsRef.current) {
                waterfallDataRef.current.forEach((d, i) => {
                    d.currentY -= d.fallSpeed;
                    if(d.currentY < -2.1) d.currentY = d.resetY;
                    const swayX = Math.sin(time * 1.3 + d.currentY) * 0.06;
                    const swayZ = Math.cos(time * 1.1 + d.currentY) * 0.04;
                    dummy.position.set(d.origin[0] + swayX, d.currentY, d.origin[2] + swayZ);
                    dummy.scale.set(1, 1, 1);
                    dummy.updateMatrix();
                    instancedWaterfallsRef.current!.setMatrixAt(i, dummy.matrix);
                });
                instancedWaterfallsRef.current.instanceMatrix.needsUpdate = true;
            }

            // Emerald Glow Particles
            if (instancedGlowRef.current) {
                glowDataRef.current.forEach((d, i) => {
                    const y = d.originalY + Math.sin(time * d.floatSpeed + d.floatOffset) * 1.5;
                    dummy.position.set(d.pos[0] + Math.sin(time * 0.1 + d.floatOffset)*2, y, d.pos[2]);
                    dummy.rotation.y += d.rotSpeed;
                    dummy.scale.set(1, 1, 1);
                    dummy.updateMatrix();
                    instancedGlowRef.current!.setMatrixAt(i, dummy.matrix);
                });
                instancedGlowRef.current.instanceMatrix.needsUpdate = true;
            }

            // Blue Glow Particles
            if (instancedBlueGlowRef.current) {
                blueGlowDataRef.current.forEach((d, i) => {
                    const y = d.originalY + Math.sin(time * d.floatSpeed + d.floatOffset) * 2.0;
                    const swirlX = Math.sin(time * d.floatSpeed + d.floatOffset) * d.swirlRadius;
                    const swirlZ = Math.cos(time * d.floatSpeed + d.floatOffset) * d.swirlRadius;
                    dummy.position.set(d.pos[0] + swirlX, y, d.pos[2] + swirlZ);
                    dummy.rotation.x += d.rotSpeed;
                    dummy.rotation.z += d.rotSpeed;
                    dummy.scale.set(1.2, 1.2, 1.2);
                    dummy.updateMatrix();
                    instancedBlueGlowRef.current!.setMatrixAt(i, dummy.matrix);
                });
                instancedBlueGlowRef.current.instanceMatrix.needsUpdate = true;
            }

            renderer.render(scene, camera);
        };

        animate();

        // --- Handle Resize ---
        const onWindowResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onWindowResize, false);

        // --- Cleanup ---
        return () => {
            window.removeEventListener('resize', onWindowResize);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (container && rendererRef.current.domElement) {
                    container.removeChild(rendererRef.current.domElement);
                }
            }
            // Dispose scene objects
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
                    object.geometry.dispose();
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        };
    }, []);

    return (
        <div 
            ref={containerRef} 
            style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                zIndex: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
            }}
        />
    );
};

export default VoxelBackground;
