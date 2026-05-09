/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useRef, useEffect } from 'react';
import { generateImage, IMAGE_SYSTEM_PROMPT } from './services/gemini';
import { extractHtmlFromText, hideBodyText, zoomCamera } from './utils/html';

type AppStatus = 'idle' | 'generating_image' | 'generating_voxels' | 'error';

// Available aspect ratios
const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16"];

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif'
];

const SAMPLE_PROMPTS = [
    "A tree house under the sea",
    "A cyberpunk street food stall", 
    "An ancient temple floating in the sky",
    "A cozy winter cabin with smoke",
    "A futuristic mars rover",
    "A dragon guarding gold"
];

interface Example {
  img: string;
  html: string;
}

const EXAMPLES: Example[] = [
  { img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example1.png', html: 'examples/example1.html' },
  { img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example2.png', html: 'examples/example2.html' },
  { img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example3.png', html: 'examples/example3.html' },
];

const resolvePublicUrl = (assetPath: string): string => {
  const trimmedBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${trimmedBase}${normalizedPath}`;
};

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  // Main View State
  const [imageData, setImageData] = useState<string | null>(null);
  const [voxelCode, setVoxelCode] = useState<string | null>(null);
  
  // User Content Persistence (Stores the user's work separately from examples)
  const [userContent, setUserContent] = useState<{
      image: string;
      voxel: string | null;
      prompt: string;
  } | null>(null);

  // Navigation State
  const [selectedTile, setSelectedTile] = useState<number | 'user' | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const [status, setStatus] = useState<AppStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [useOptimization, setUseOptimization] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [viewMode, setViewMode] = useState<'image' | 'voxel'>('image');
  
  // Streaming Thoughts State
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  
  const [loadedThumbnails, setLoadedThumbnails] = useState<Record<string, string>>({});

  // New UI States
  const [isDragging, setIsDragging] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholders
  useEffect(() => {
    const interval = setInterval(() => {
        setPlaceholderIndex((prev) => (prev + 1) % SAMPLE_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load thumbnails via fetch to bypass potential img tag static serving issues
  useEffect(() => {
    const createdUrls: string[] = [];
    const loadThumbnails = async () => {
      const loaded: Record<string, string> = {};
      await Promise.all(EXAMPLES.map(async (ex) => {
        try {
          const response = await fetch(ex.img);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            loaded[ex.img] = url;
          }
        } catch (e) {
          console.error("Failed to load thumbnail:", ex.img, e);
        }
      }));
      setLoadedThumbnails(loaded);
    };
    loadThumbnails();

    return () => {
        // Cleanup object URLs to avoid memory leaks
        createdUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleError = (err: any) => {
    setStatus('error');
    let message = err.message || 'An unexpected error occurred.';
    
    // Friendly handling for Rate Limits (429)
    if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
      message = "API Rate Limit Exceeded. The free tier has limits. Please wait 60 seconds and try again, or use a different Gemini API key.";
    }
    
    setErrorMsg(message);
    console.error(err);
  };

  const handleImageGenerate = async () => {
    if (!prompt.trim()) return;
    
    // Ensure we are effectively on the user tile logic
    setStatus('generating_image');
    setErrorMsg('');
    setImageData(null);
    setVoxelCode(null);
    setThinkingText(null);
    setViewMode('image');
    
    // Reveal viewer when generation starts
    setIsViewerVisible(true);

    try {
      // Pass the optimization flag directly to the generation service
      const imageUrl = await generateImage(prompt, aspectRatio, useOptimization);
      
      // Update User Content
      const newUserContent = {
          image: imageUrl,
          voxel: null,
          prompt: prompt
      };
      setUserContent(newUserContent);
      
      // Update View
      setImageData(imageUrl);
      setVoxelCode(null);
      setSelectedTile('user');
      
      setStatus('idle');
      setShowGenerator(false); // Close generator on success
    } catch (err) {
      handleError(err);
    }
  };

  const processFile = (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      handleError(new Error("Invalid file type. Please upload PNG, JPEG, WEBP, HEIC, or HEIF."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      // Update User Content
      const newUserContent = {
          image: result,
          voxel: null,
          prompt: ''
      };
      setUserContent(newUserContent);

      // Update View
      setImageData(result);
      setVoxelCode(null);
      setViewMode('image');
      setStatus('idle');
      setErrorMsg('');
      setSelectedTile('user');
      setShowGenerator(false);
      
      // Reveal viewer on upload
      setIsViewerVisible(true);
    };
    reader.onerror = () => handleError(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
        processFile(file);
    }
  };

  const handleExampleClick = async (example: Example, index: number) => {
    if (status !== 'idle' && status !== 'error') return;
    
    setSelectedTile(index);
    setShowGenerator(false);
    setErrorMsg('');
    setThinkingText(null);
    setIsViewerVisible(true);
    
    try {
      // 1. Fetch Image
      const imgResponse = await fetch(example.img);
      if (!imgResponse.ok) throw new Error(`Failed to load example image: ${imgResponse.statusText}`);
      const imgBlob = await imgResponse.blob();
      
      const base64Img = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imgBlob);
      });

      // 2. Fetch HTML
      let htmlText = '';
      try {
        const htmlResponse = await fetch(resolvePublicUrl(example.html));
        if (htmlResponse.ok) {
            const rawText = await htmlResponse.text();
            
            // Safety check: If Vite returns index.html (fallback) instead of the actual file, 
            // it will contain the 'root' div. We don't want to render the app inside itself.
            if (rawText.includes('<div id="root">')) {
                throw new Error("Example file not found (server returned fallback HTML)");
            }

            // Extract, clean, and zoom
            htmlText = zoomCamera(hideBodyText(extractHtmlFromText(rawText)));
        } else {
            console.warn("HTML file not found, using placeholder");
            htmlText = `<html><body><p>${example.html} not found.</p></body></html>`;
        }
      } catch (e) {
          console.warn("Failed to fetch HTML", e);
          htmlText = "<html><body>Error loading example scene.</body></html>";
      }

      setImageData(base64Img);
      setVoxelCode(htmlText);
      setViewMode('voxel'); // Switch directly to voxel view for examples
      setStatus('idle');

    } catch (err) {
      handleError(err);
    }
  };

  const handleUserTileClick = () => {
      if (status !== 'idle' && status !== 'error') return;

      if (selectedTile === 'user') {
          // Already selected? Toggle generator to allow editing/regenerating
          const willShow = !showGenerator;
          setShowGenerator(willShow);
          
          if (willShow) {
            // If opening generator, hide viewer until action taken
            setIsViewerVisible(false);
          } else {
            // If closing generator, if we have content, show it. 
            // If no content, show placeholder (and deselect tile to reset state).
            setIsViewerVisible(true);
            
            if (!userContent) {
              setSelectedTile(null);
            }
          }
      } else {
          // Switch to user content or initialize it
          setSelectedTile('user');
          setShowGenerator(true); 
          
          // Hide viewer when initializing create mode
          setIsViewerVisible(false);

          if (userContent) {
              setImageData(userContent.image);
              setVoxelCode(userContent.voxel);
              setPrompt(userContent.prompt); // Restore prompt
              setViewMode(userContent.voxel ? 'voxel' : 'image');
          } else {
              // If no content yet, clear the view to show default placeholder
              setImageData(null);
              setVoxelCode(null);
              setViewMode('image');
          }
      }
  };

  const handleDirectVoxelize = () => {
    if (!imageData) return;
    
    setStatus('generating_voxels');
    setThinkingText("Building Roblox-style diorama...");
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas context failed");

            const size = 64; 
            canvas.width = size;
            canvas.height = size;

            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;

            const sceneCode = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; background: #87ceeb; overflow: hidden; font-family: sans-serif; }
        #overlay { 
            position: absolute; bottom: 30px; left: 30px; 
            background: rgba(0,0,0,0.8); color: white; 
            padding: 15px 25px; border: 3px solid #fff;
            font-family: 'Courier New', Courier, monospace;
            font-weight: 900; letter-spacing: 2px;
            box-shadow: 8px 8px 0px rgba(0,0,0,0.3);
            pointer-events: none;
            text-transform: uppercase;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
    <div id="overlay">VOXEL WORLD ENGINE</div>
    <script>
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 60, 180);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.4;

        const world = new THREE.Group();
        scene.add(world);

        // --- ENVIRONMENT: WATER ---
        const waterGeo = new THREE.CircleGeometry(100, 32);
        const waterMat = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff, 
            transparent: true, 
            opacity: 0.7,
            roughness: 0,
            metalness: 0.1
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -15;
        scene.add(water);

        // --- ENVIRONMENT: CLOUDS ---
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        for(let i=0; i<15; i++) {
            const cloud = new THREE.Group();
            const cloudSize = 5 + Math.random() * 10;
            for(let j=0; j<5; j++) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(cloudSize, cloudSize/2, cloudSize), cloudMat);
                b.position.set(j*2, Math.random()*2, j*1.5);
                cloud.add(b);
            }
            cloud.position.set((Math.random()-0.5)*200, 40 + Math.random()*20, (Math.random()-0.5)*200);
            scene.add(cloud);
        }

        // --- VOXELS ---
        const size = ${size};
        const pixelData = [${data.join(',')}];
        let voxels = [];
        for(let y=0; y<size; y++) {
            for(let x=0; x<size; x++) {
                const i = (y * size + x) * 4;
                if(pixelData[i+3] > 120) voxels.push({ x, y, i });
            }
        }

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ roughness: 0.8 });
        const mesh = new THREE.InstancedMesh(geometry, material, voxels.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const baseMesh = new THREE.InstancedMesh(geometry, baseMat, voxels.length);
        baseMesh.receiveShadow = true;
        
        world.add(mesh);
        world.add(baseMesh);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const voxelSpecs = [];

        voxels.forEach((v, idx) => {
            const r = pixelData[v.i]/255, g = pixelData[v.i+1]/255, b = pixelData[v.i+2]/255;
            const mid = size/2;
            const dist = Math.sqrt(Math.pow(v.x-mid, 2) + Math.pow(v.y-mid, 2));
            const lum = (r*0.3 + g*0.59 + b*0.11);
            
            // Island shape: center is thicker
            const targetH = Math.max(1, (1-dist/mid)*12*lum + 3);
            
            voxelSpecs.push({
                idx, x: v.x-mid, z: v.y-mid, targetH, currH: 0.1, delay: dist*0.04
            });

            color.setRGB(r, g, b);
            mesh.setColorAt(idx, color);
        });

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
        scene.add(sun);

        camera.position.set(70, 50, 70);
        camera.lookAt(0,0,0);

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const t = clock.getElapsedTime();
            
            world.position.y = Math.sin(t*0.6) * 1.5;
            water.position.y = -15 + Math.sin(t*0.5) * 0.5;

            voxelSpecs.forEach(v => {
                if(t > v.delay) {
                    v.currH += (v.targetH - v.currH) * 0.1;
                    
                    // Main voxel
                    dummy.position.set(v.x, v.currH/2, v.z);
                    dummy.scale.set(0.95, v.currH, 0.95);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(v.idx, dummy.matrix);

                    // Dirt base
                    dummy.position.set(v.x, -2, v.z);
                    dummy.scale.set(0.95, 4, 0.95);
                    dummy.updateMatrix();
                    baseMesh.setMatrixAt(v.idx, dummy.matrix);
                }
            });
            mesh.instanceMatrix.needsUpdate = true;
            baseMesh.instanceMatrix.needsUpdate = true;

            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>`;

            setVoxelCode(sceneCode);
            setViewMode('voxel');
            setStatus('idle');
            setThinkingText(null);
        } catch (err: any) {
            handleError(err);
        }
    };
    img.onerror = () => handleError(new Error("Failed to load image for processing"));
    img.src = imageData;
  };




  const handleDownload = () => {
    if (viewMode === 'image' && imageData) {
      const a = document.createElement('a');
      a.href = imageData;
      const ext = imageData.includes('image/jpeg') ? 'jpg' : 'png';
      a.download = `voxelize-image-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (viewMode === 'voxel' && voxelCode) {
      const a = document.createElement('a');
      a.href = `data:text/html;charset=utf-8,${encodeURIComponent(voxelCode)}`;
      a.download = `voxel-scene-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isLoading = status !== 'idle' && status !== 'error';

  // Construct the display prompt for loading screen
  const getDisplayPrompt = () => {
    if (status === 'generating_image') {
      return useOptimization ? `${IMAGE_SYSTEM_PROMPT}\n\nSubject: ${prompt}` : prompt;
    }
    if (status === 'generating_voxels') {
      return '';
    }
    return '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white">
      <style>
        {`
          .loading-dots::after {
            content: '';
            animation: dots 2s steps(4, end) infinite;
          }
          @keyframes dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80% { content: '...'; }
          }
        `}
      </style>
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-6">
          <h1 className="text-4xl sm:text-5xl font-black leading-[0.9] tracking-tight">IMAGE TO VOXEL ART</h1>
          <p className="mt-2 text-lg text-gray-600 font-semibold">Transform images into 3D voxel art via direct pixel mapping.</p>
          
          {/* API Information & Quota Help */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-left text-xs space-y-2">
            <p className="font-bold text-blue-800 uppercase flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Direct Workflows
            </p>
            <p className="text-blue-700 leading-tight">
              <strong>Direct Voxel (Code):</strong> Instantly maps pixels to 3D boxes in your browser—no API key required.
            </p>
            <p className="text-blue-600">
              <strong>Unlimited & Private:</strong> Use the "Direct Voxel" button for zero-latency 3D extrusions.
            </p>
          </div>
        </div>

        {/* Example Tiles & User Tile */}
        <div className="grid grid-cols-4 gap-4 w-full">
            {EXAMPLES.map((ex, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => handleExampleClick(ex, idx)}
                    disabled={isLoading}
                    aria-label={`Load Example ${idx + 1}`}
                    className={`aspect-square relative overflow-hidden group focus:outline-none disabled:opacity-50 cursor-pointer bg-gray-100 transition-all duration-200
                        border-2 border-black
                        active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-100
                        ${selectedTile === idx 
                            ? 'scale-[1.02] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -translate-y-1' 
                            : 'hover:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'}
                    `}
                    title="Click to view example scene"
                >
                     {loadedThumbnails[ex.img] ? (
                        <img 
                            src={loadedThumbnails[ex.img]} 
                            alt={`Example ${idx + 1}`} 
                            className="w-full h-full object-cover"
                        />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs uppercase font-bold animate-pulse">
                            Loading...
                        </div>
                     )}
                     {selectedTile !== idx && <div className="absolute inset-0 bg-white bg-opacity-40 group-hover:bg-opacity-0 transition-all duration-200"></div>}
                </button>
            ))}
            
             {/* User Generate / Generated Tile */}
             <button
                type="button"
                onClick={handleUserTileClick}
                disabled={isLoading}
                aria-label="Generate new scene"
                className={`aspect-square flex flex-col items-center justify-center transition-all duration-200 focus:outline-none disabled:opacity-50 group overflow-hidden relative border-2 border-black
                    active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-100
                    ${selectedTile === 'user' ? 'scale-[1.02] -translate-y-1' : 'hover:border-gray-600 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'}
                    ${!userContent && !showGenerator ? 'bg-white text-black hover:bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}
                    ${showGenerator && selectedTile === 'user' 
                        ? 'bg-black text-white shadow-[4px_4px_0px_0px_#888]' 
                        : (selectedTile === 'user' ? 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]')}
                `}
                title={userContent ? "View Generated Image" : "Generate New Image"}
             >
                 {userContent ? (
                     <>
                        <img src={userContent.image} alt="My Generation" className="w-full h-full object-cover" />
                        
                        {/* Overlay when deselected */}
                        {selectedTile !== 'user' && (
                             <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-12 h-12 text-white drop-shadow-md">
                                    <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                             </div>
                        )}

                        {/* Overlay when editing */}
                        {selectedTile === 'user' && showGenerator && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <span className="text-white font-bold uppercase text-sm">Editing</span>
                            </div>
                        )}
                     </>
                 ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-10 h-10 transition-transform duration-300 ${showGenerator ? 'rotate-45' : 'group-hover:scale-110'}`}>
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="text-xs font-bold uppercase mt-2">{showGenerator ? 'Close' : 'Generate'}</span>
                    </>
                 )}
             </button>
        </div>

        {/* Generator Input Section (Collapsible) */}
        {showGenerator && (
            <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-300 border-2 border-black p-6 bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-10">
            
            {/* Upload Section */}
            <div className="w-full">
                <label className="block text-sm font-bold mb-2 uppercase">
                    Upload Image
                </label>
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        w-full h-64 border-2 border-dashed border-black flex flex-col items-center justify-center cursor-pointer transition-colors
                        ${isDragging ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}
                    `}
                >
                    <input
                        type="file"
                        accept={ALLOWED_MIME_TYPES.join(',')}
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <p className="font-bold uppercase text-sm text-gray-600">Drag and drop or click to upload image</p>
                </div>
            </div>
            
            <div className="relative flex items-center justify-center w-full">
                 <div className="border-t-2 border-gray-200 w-full absolute"></div>
                 <span className="bg-gray-50 px-3 text-xs font-bold text-gray-400 uppercase relative z-10">OR</span>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow w-full">
                <label htmlFor="prompt" className="block text-sm font-bold mb-2 uppercase">
                    Generate with Puter.js (Flux)
                </label>
                <input
                    id="prompt"
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={SAMPLE_PROMPTS[placeholderIndex]}
                    aria-label="Image prompt description"
                    className="w-full px-3 border-2 border-black focus:outline-none focus:ring-0 rounded-none text-lg placeholder-gray-400 bg-white h-12"
                    disabled={isLoading}
                />
                </div>
                <div className="w-full sm:w-40 flex-shrink-0">
                    <label htmlFor="aspect" className="block text-sm font-bold mb-2 uppercase">
                    Aspect ratio
                    </label>
                    <select
                        id="aspect"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        disabled={isLoading}
                        aria-label="Select aspect ratio"
                        className="w-full px-3 border-2 border-black focus:outline-none rounded-none bg-white h-12"
                    >
                        {ASPECT_RATIOS.map(ratio => (
                            <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-center gap-6 mt-2">
                <label 
                    className="flex items-center cursor-pointer select-none"
                    title={`Add instruction: ${IMAGE_SYSTEM_PROMPT}`}
                >
                    <div className="relative">
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={useOptimization}
                        onChange={(e) => setUseOptimization(e.target.checked)}
                        disabled={isLoading}
                        aria-label="Toggle scene prompt optimization"
                    />
                    <div className={`block w-10 h-6 border-2 border-black ${useOptimization ? 'bg-black' : 'bg-gray-500'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 transition-transform ${useOptimization ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-bold uppercase">Optimise Scene</div>
                </label>

                <button
                    type="button"
                    onClick={handleImageGenerate}
                    disabled={isLoading || !prompt.trim()}
                    title="Generate a new image based on your prompt"
                    aria-label="Generate image"
                    className="w-full sm:w-40 h-12 bg-black text-white border-2 border-black font-bold uppercase hover:bg-gray-900 disabled:opacity-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] text-sm whitespace-nowrap"
                >
                    {status === 'generating_image' ? 'Generating...' : 'Generate'}
                </button>
            </div>
            </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-4 border-2 border-red-500 bg-red-50 text-red-700 text-sm font-bold animate-in fade-in" role="alert">
            ERROR: {errorMsg}
          </div>
        )}

        {/* Viewer & Buttons Wrapper */}
        <div className="space-y-2">
            {/* Viewer Section */}
            {isViewerVisible && (
            <div className="w-full aspect-square border-2 border-black relative bg-gray-50 flex items-center justify-center overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" role="region" aria-label="Content Viewer">
            
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-white z-20 flex flex-col items-start justify-center p-8 sm:p-12 overflow-hidden" aria-live="polite">
                    {/* Model Status */}
                    <div className="w-full max-w-3xl mb-10 text-xl font-bold tracking-tight">
                        {status === 'generating_image' 
                            ? 'Generating image with Puter.js (Flux Schnell)' 
                            : 'Building voxel world...'}
                    </div>

                    {/* Prompt Display */}
                    <div className="w-full max-w-3xl mb-8 opacity-70 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed border-l-2 border-gray-300 pl-4 max-h-[40%] overflow-y-auto">
                        {status === 'generating_voxels' && imageData && (
                            <img 
                                src={imageData} 
                                alt="Source" 
                                className="inline-block h-[1.5em] w-auto mr-2 align-middle border border-gray-300" 
                            />
                        )}
                        <span className="align-middle">{getDisplayPrompt()}</span>
                    </div>

                    {/* Thinking Text */}
                    <div className="w-full max-w-3xl opacity-70 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words max-h-[40%] overflow-y-auto">
                        {thinkingText ? (
                            <span>
                                {thinkingText}
                                <span className="loading-dots"></span>
                            </span>
                        ) : (
                            <span className="loading-dots">Thinking</span>
                        )}
                    </div>
                </div>
            )}

            {!imageData && !isLoading && status !== 'error' && (
                <div className="text-gray-400 text-center px-6 pointer-events-none">
                <p className="text-lg">Select an example, or generate your own!</p>
                </div>
            )}

            {imageData && viewMode === 'image' && (
                <img src={imageData} alt="Generated or Uploaded" className="w-full h-full object-contain" />
            )}

            {voxelCode && viewMode === 'voxel' && (
                <iframe
                title="Voxel Scene"
                srcDoc={voxelCode}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups"
                />
            )}
            </div>
            )}

            {/* Action Buttons  */}
            {isViewerVisible && (
            <div className="flex flex-wrap gap-4 pt-4">
            
            {/* View Selectors */}
            <div className="flex w-full gap-2 overflow-x-auto pb-2">
                {imageData && (
                    <button
                        onClick={() => setViewMode('image')}
                        className={`px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all ${viewMode === 'image' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                    >
                        Image
                    </button>
                )}
                {voxelCode && (
                    <button
                        onClick={() => setViewMode('voxel')}
                        className={`px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all ${viewMode === 'voxel' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                    >
                        Voxel Art
                    </button>
                )}
            </div>

            {imageData && (
                <button
                    type="button"
                    onClick={handleDirectVoxelize}
                    disabled={isLoading}
                    className="w-full py-4 bg-green-600 text-white border-2 border-black font-bold uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-700 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    Direct Voxel art
                </button>
            )}
            </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default App;
