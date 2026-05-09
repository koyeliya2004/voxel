import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home as HomeIcon, 
  History as HistoryIcon, 
  Box, 
  Play,
  Settings,
  Code2,
  MonitorPlay,
  Activity,
  ArrowLeft, 
  Download, 
  Plus, 
  Trash2, 
  Info, 
  ChevronRight,
  Upload,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Zap,
  Globe,
  Cpu
} from 'lucide-react';
import { generateImage, IMAGE_SYSTEM_PROMPT } from './services/imageService';
import { extractHtmlFromText, hideBodyText, zoomCamera } from './utils/html';

type AppStatus = 'idle' | 'generating_image' | 'generating_voxels' | 'error';
type View = 'home' | 'app' | 'history' | 'nexus';

interface HistoryItem {
    id: string;
    timestamp: number;
    image: string;
    voxel: string | null;
    prompt: string;
}

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

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('voxel_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [prompt, setPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  // Main View State
  const [imageData, setImageData] = useState<string | null>(null);
  const [voxelCode, setVoxelCode] = useState<string | null>(null);
  
  const [status, setStatus] = useState<AppStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [useOptimization, setUseOptimization] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [viewMode, setViewMode] = useState<'image' | 'voxel'>('image');
  const [thinkingText, setThinkingText] = useState<string | null>(null);

  // UI States
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nexus States
  const [nexusPrompt, setNexusPrompt] = useState('');
  const [nexusCode, setNexusCode] = useState('');
  const [nexusIsLoading, setNexusIsLoading] = useState(false);
  const [nexusError, setNexusError] = useState<string | null>(null);
  const [nexusViewMode, setNexusViewMode] = useState<'render' | 'code'>('render');
  const [nexusStatusText, setNexusStatusText] = useState('SYSTEM IDLE');

  // Persistence for history
  useEffect(() => {
    localStorage.setItem('voxel_history', JSON.stringify(history));
  }, [history]);

  // Rotate placeholders
  useEffect(() => {
    const interval = setInterval(() => {
        setPlaceholderIndex((prev) => (prev + 1) % SAMPLE_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addToHistory = (image: string, voxel: string | null, promptStr: string) => {
    const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        image,
        voxel,
        prompt: promptStr
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleError = (err: any) => {
    setStatus('error');
    let message = err.message || 'An unexpected error occurred.';
    if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
      message = "API Rate Limit Exceeded. The free tier has limits. Please wait 60 seconds and try again, or check your API key settings.";
    }
    setErrorMsg(message);
    console.error(err);
  };

  const handleImageGenerate = async () => {
    if (!prompt.trim()) return;
    setStatus('generating_image');
    setErrorMsg('');
    setImageData(null);
    setVoxelCode(null);
    setThinkingText(null);
    setViewMode('image');

    try {
      const imageUrl = await generateImage(prompt, aspectRatio, useOptimization);
      setImageData(imageUrl);
      setVoxelCode(null);
      setStatus('idle');
      addToHistory(imageUrl, null, prompt);
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
      setImageData(result);
      setVoxelCode(null);
      setViewMode('image');
      setStatus('idle');
      setErrorMsg('');
      addToHistory(result, null, 'Uploaded Image');
    };
    reader.onerror = () => handleError(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDirectVoxelize = () => {
    if (!imageData) return;
    setStatus('generating_voxels');
    setThinkingText("Building voxel scene...");
    
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
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
    <script>
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 60, 180);
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = true;
        const world = new THREE.Group();
        scene.add(world);
        const waterGeo = new THREE.CircleGeometry(100, 32);
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.7 });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -15;
        scene.add(water);
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
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const baseMesh = new THREE.InstancedMesh(geometry, baseMat, voxels.length);
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
            const targetH = Math.max(1, (1-dist/mid)*12*lum + 3);
            voxelSpecs.push({ idx, x: v.x-mid, z: v.y-mid, targetH, currH: 0.1, delay: dist*0.04 });
            color.setRGB(r, g, b);
            mesh.setColorAt(idx, color);
        });
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(50, 100, 50);
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
                    dummy.position.set(v.x, v.currH/2, v.z);
                    dummy.scale.set(0.95, v.currH, 0.95);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(v.idx, dummy.matrix);
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
            
            // Update history with the voxel code for the recently created item
            setHistory(prev => {
                const newHistory = [...prev];
                // Since handleDirectVoxelize is called after imageData is set, 
                // the latest item in history (at index 0) should be updated.
                if (newHistory.length > 0) {
                    newHistory[0] = { ...newHistory[0], voxel: sceneCode };
                }
                return newHistory;
            });
        } catch (err: any) {
            handleError(err);
        }
    };
    img.onerror = () => handleError(new Error("Failed to load image for processing"));
    img.src = imageData;
  };

  const handleDownload = (content: string | null, type: 'image' | 'voxel') => {
    if (!content) return;
    const a = document.createElement('a');
    if (type === 'image') {
        a.href = content;
        const ext = content.includes('image/jpeg') ? 'jpg' : 'png';
        a.download = `voxelize-image-${Date.now()}.${ext}`;
    } else {
        a.href = `data:text/html;charset=utf-8,${encodeURIComponent(content)}`;
        a.download = `voxel-scene-${Date.now()}.html`;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderHome = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl w-full space-y-12 py-12"
    >
      <header className="text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-600 rounded-full text-blue-600 font-black uppercase text-xs">
          <Zap size={14} fill="currentColor" /> Web3D Voxel Suite
        </div>
        <h1 className="text-6xl sm:text-8xl font-black tracking-tighter leading-[0.8] uppercase flex flex-col items-center">
          <span>VOXEL</span>
          <span className="text-blue-600">WORLD</span>
          <span className="text-2xl mt-4 bg-black text-white px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">ENGINE v1.0</span>
        </h1>
        <p className="text-xl font-medium text-gray-600 max-w-xl mx-auto leading-relaxed">
          The ultimate 3D voxelization platform. Transform your photos into living pixel-perfect dioramas instantly.
        </p>
        <div className="flex flex-wrap justify-center gap-6 pt-4">
          <button 
            onClick={() => setView('app')}
            className="group px-10 py-5 bg-black text-white border-2 border-black font-black uppercase text-xl shadow-[10px_10px_0px_0px_rgba(37,99,235,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-3"
          >
            Start Creating <ChevronRight className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button 
            onClick={() => setView('history')}
            className="px-10 py-5 bg-white text-black border-2 border-black font-black uppercase text-xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-3"
          >
            History <HistoryIcon size={24} />
          </button>
          <button 
            onClick={() => setView('nexus')}
            className="px-10 py-5 bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-2 border-black font-black uppercase text-xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-3"
          >
            Voxel Nexus <Box size={24} />
          </button>
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-12 border-t-4 border-black pt-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-black uppercase flex items-center gap-3">
              <Info size={32} className="text-blue-600" />
              How it works
            </h2>
            <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">3-Step 3D Transformation</p>
          </div>
          <div className="space-y-8">
            <div className="flex gap-6 group">
              <div className="w-12 h-12 shrink-0 bg-black text-white flex items-center justify-center font-black text-xl group-hover:bg-blue-600 transition-colors">1</div>
              <div>
                <h3 className="font-black uppercase text-xl">Input Your Vision</h3>
                <p className="text-gray-600 leading-relaxed">Upload any image or use our AI prompt system to generate a brand new concept scene.</p>
              </div>
            </div>
            <div className="flex gap-6 group">
              <div className="w-12 h-12 shrink-0 bg-black text-white flex items-center justify-center font-black text-xl group-hover:bg-blue-600 transition-colors">2</div>
              <div>
                <h3 className="font-black uppercase text-xl">Pixel Extraction</h3>
                <p className="text-gray-600 leading-relaxed">Our browser-based engine maps every pixel to a 3D coordinate, preserving colors with mathematical precision.</p>
              </div>
            </div>
            <div className="flex gap-6 group">
              <div className="w-12 h-12 shrink-0 bg-black text-white flex items-center justify-center font-black text-xl group-hover:bg-blue-600 transition-colors">3</div>
              <div>
                <h3 className="font-black uppercase text-xl">3D Voxelization</h3>
                <p className="text-gray-600 leading-relaxed">Thousands of geometric blocks are extruded into a real-time Three.js scene with water, clouds, and lighting.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-8">
            <div className="bg-gray-100 border-4 border-black p-8 flex flex-col justify-center gap-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] relative overflow-hidden group">
                <Globe className="absolute -right-8 -bottom-8 w-48 h-48 text-black opacity-5 group-hover:rotate-45 transition-transform duration-1000" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600 font-black border-2 border-blue-200 text-sm">PRO TECH</div>
                    <p className="font-black uppercase text-lg">Hardware Accelerated</p>
                </div>
                <p className="text-lg font-medium text-gray-700 leading-relaxed relative z-10">
                    "Built on Three.js InstancedMesh for hyper-efficient rendering. Create complex dioramas without slowing down your browser."
                </p>
                <div className="flex gap-4 relative z-10">
                    <div className="flex items-center gap-1 text-xs font-black text-blue-600 uppercase"><Cpu size={14} /> GPU Enabled</div>
                    <div className="flex items-center gap-1 text-xs font-black text-green-600 uppercase"><Zap size={14} /> 0ms Latency</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-6 border-2 border-black bg-white space-y-2">
                    <p className="text-2xl font-black">100%</p>
                    <p className="text-[10px] font-black uppercase text-gray-400">Private & Local</p>
                </div>
                <div className="p-6 border-2 border-black bg-white space-y-2">
                    <p className="text-2xl font-black">∞</p>
                    <p className="text-[10px] font-black uppercase text-gray-400">Exports</p>
                </div>
            </div>
        </div>
      </section>

      <section className="border-t-4 border-black pt-12 space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
                <h2 className="text-4xl font-black uppercase flex items-center gap-3">
                <Box size={32} className="text-fuchsia-600" />
                Nexus Protocol
                </h2>
                <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Text-to-Code Neural Engine</p>
            </div>
            <div className="px-4 py-2 bg-fuchsia-100 border-2 border-fuchsia-600 text-fuchsia-600 font-black uppercase text-[10px]">Experimental v3.0</div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-black text-white border-2 border-black space-y-4 hover:shadow-[8px_8px_0px_0px_rgba(217,70,239,1)] transition-all group">
                <Zap className="text-cyan-400 group-hover:scale-110 transition-transform" size={32} />
                <h3 className="font-black uppercase text-xl">Semantic Input</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Skip the image entirely. Describe your object in natural language and watch the matrix construct it from scratch using procedural logic.</p>
                <ul className="text-[10px] font-mono text-cyan-500/60 uppercase space-y-1 pt-2">
                  <li>• NLP to Geometry mapping</li>
                  <li>• Instant logic derivation</li>
                </ul>
            </div>
            <div className="p-8 bg-white border-2 border-black space-y-4 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group">
                <Cpu className="text-fuchsia-600 group-hover:rotate-12 transition-transform" size={32} />
                <h3 className="font-black uppercase text-xl">Llama 70B Core</h3>
                <p className="text-gray-600 text-sm leading-relaxed">Powered by Llama-3.3-70B via Groq LPUs for sub-second code generation of complex Three.js procedural geometries.</p>
                <ul className="text-[10px] font-mono text-fuchsia-500/60 uppercase space-y-1 pt-2">
                  <li>• Inference in &lt;1.0s</li>
                  <li>• High-density voxel grids</li>
                </ul>
            </div>
            <div className="p-8 bg-gray-50 border-2 border-black space-y-4 hover:shadow-[8px_8px_0px_0px_rgba(37,99,235,1)] transition-all group">
                <Code2 className="text-blue-600 group-hover:-translate-y-1 transition-transform" size={32} />
                <h3 className="font-black uppercase text-xl">Native WebGL</h3>
                <p className="text-gray-600 text-sm leading-relaxed">Generates optimized Three.js boilerplate code that runs directly in any modern browser without heavy assets or server-side rendering.</p>
                <ul className="text-[10px] font-mono text-blue-500/60 uppercase space-y-1 pt-2">
                  <li>• Pure client-side execution</li>
                  <li>• OrbitControls interaction</li>
                </ul>
            </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-900 text-slate-100 p-8 border-2 border-black rounded-lg">
            <h4 className="font-black uppercase text-lg mb-4 flex items-center gap-2">
              <Plus size={20} className="text-cyan-400" />
              How to operate
            </h4>
            <div className="space-y-4 text-sm font-medium">
              <div className="flex gap-4">
                <span className="shrink-0 size-6 bg-cyan-500 text-black flex items-center justify-center font-black rounded">1</span>
                <p>Navigate to the <span className="text-cyan-400 underline">Nexus</span> tab from the header or home button.</p>
              </div>
              <div className="flex gap-4">
                <span className="shrink-0 size-6 bg-cyan-500 text-black flex items-center justify-center font-black rounded">2</span>
                <p>Enter a descriptive prompt like <code className="bg-black/50 px-1 py-0.5 rounded text-fuchsia-400">"Modern skyscraper with neon lights"</code>.</p>
              </div>
              <div className="flex gap-4">
                <span className="shrink-0 size-6 bg-cyan-500 text-black flex items-center justify-center font-black rounded">3</span>
                <p>Hit <span className="text-cyan-400">Initiate Render</span> and watch the AI generate the Three.js code and render the result.</p>
              </div>
              <div className="flex gap-4">
                <span className="shrink-0 size-6 bg-cyan-500 text-black flex items-center justify-center font-black rounded">4</span>
                <p>Switch between <span className="text-cyan-400 font-bold">Viewport</span> to see the 3D model and <span className="text-fuchsia-400 font-bold">Source</span> to inspect the code.</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-2 border-black p-8 flex flex-col justify-center">
            <div className="flex items-start gap-4 mb-4">
              <Info className="shrink-0 text-yellow-600" />
              <h4 className="font-black uppercase text-lg text-yellow-900">Optimization Matrix</h4>
            </div>
            <p className="text-sm font-medium text-yellow-900 leading-relaxed">
                Voxel Nexus excels at structured geometries. For the best results, include keywords like <span className="underline decoration-yellow-400">"detailed"</span>, <span className="underline decoration-yellow-400">"symmetrical"</span>, or specific materials like <span className="underline decoration-yellow-400">"neon"</span>, <span className="underline decoration-yellow-400">"stone"</span>, or <span className="underline decoration-yellow-400">"gold"</span>.
            </p>
            <div className="mt-6 p-4 bg-white/50 border border-yellow-200 rounded text-[11px] font-mono text-yellow-800">
              STABLE DIFFUSION + LLAMA-3 SYNTHESIS ACTIVE
            </div>
          </div>
        </div>
      </section>

      <footer className="text-center pt-12 border-t-2 border-black border-dashed">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Copyright © 2024 VoxelWorld Engine • All creators welcome</p>
      </footer>
    </motion.div>
  );

  const renderHistory = () => (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="max-w-4xl w-full space-y-12 py-12"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-4 border-black pb-8">
        <button onClick={() => setView('home')} className="flex items-center gap-2 font-black uppercase text-xl hover:text-blue-600 transition-colors w-fit">
          <ArrowLeft size={28} /> Home
        </button>
        <div className="text-left sm:text-right">
            <h1 className="text-5xl font-black uppercase tracking-tight">Vault</h1>
            <p className="font-bold text-gray-400 uppercase text-xs">Stored Creations ({history.length})</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400 border-4 border-dashed border-gray-200">
          <HistoryIcon size={80} className="mb-6 opacity-10" />
          <p className="font-black uppercase text-xl">The vault is empty</p>
          <button 
            onClick={() => setView('app')} 
            className="mt-6 px-8 py-3 bg-black text-white font-black uppercase text-sm hover:scale-105 transition-transform"
          >
            Deploy New Creator
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {history.map((item) => (
            <motion.div 
              layout
              key={item.id} 
              className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col group overflow-hidden"
            >
               <div className="aspect-square relative overflow-hidden bg-gray-100 border-b-2 border-black">
                  <img src={item.image} alt={item.prompt} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => removeFromHistory(item.id, e)}
                      className="p-3 bg-red-500 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-0 transition-transform"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                    <p className="text-xs font-black text-gray-800 uppercase line-clamp-1 mb-1">
                        {item.prompt || 'Manual Upload'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <Plus size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => {
                            setImageData(item.image);
                            setVoxelCode(item.voxel);
                            setViewMode(item.voxel ? 'voxel' : 'image');
                            setView('app');
                        }}
                        className="flex-grow py-3 bg-black text-white border-2 border-black text-xs font-black uppercase hover:bg-blue-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                        Review
                    </button>
                    <button 
                        onClick={() => handleDownload(item.voxel || item.image, item.voxel ? 'voxel' : 'image')}
                        className="p-3 border-2 border-black text-black hover:bg-gray-100 transition-colors"
                        title="Download Asset"
                    >
                        <Download size={18} />
                    </button>
                  </div>
               </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );

  const renderApp = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="w-full max-w-2xl space-y-8 py-12"
    >
      <header className="flex items-center justify-between border-b-4 border-black pb-6">
        <button onClick={() => setView('home')} className="flex items-center gap-2 font-black uppercase text-lg group">
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" /> Home
        </button>
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setView('history')} 
                className="font-black uppercase text-xs px-4 py-2 border-2 border-black hover:bg-black hover:text-white transition-all flex items-center gap-2"
            >
               <HistoryIcon size={14} /> Vault
            </button>
            <button 
                onClick={() => setView('nexus')} 
                className="font-black uppercase text-xs px-4 py-2 border-2 border-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
            >
               <Layers size={14} /> Nexus
            </button>
        </div>
      </header>

      {/* Generator Form */}
      <div className="space-y-6 border-4 border-black p-8 bg-gray-50 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
        <div className="absolute -top-3 -right-3 bg-blue-600 text-white px-3 py-1 font-black text-[10px] uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            Active Workspace
        </div>
        
        <div className="space-y-6">
          <div 
             onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
             onDragLeave={() => setIsDragging(false)}
             onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if(file) processFile(file); }}
             onClick={() => fileInputRef.current?.click()}
             className={`w-full h-48 border-4 border-dashed border-black flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging ? 'bg-blue-50 border-blue-600 scale-[0.99]' : 'bg-white hover:bg-gray-50'}`}
          >
            <input type="file" accept={ALLOWED_MIME_TYPES.join(',')} ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <Upload size={40} className={`mb-3 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="font-black uppercase text-sm text-gray-500">Scan physical asset</p>
            <p className="text-[10px] font-bold text-gray-300 uppercase mt-1">Drag file here</p>
          </div>

          <div className="relative flex items-center justify-center h-4">
            <div className="absolute w-full border-t-2 border-gray-200"></div>
            <span className="relative z-10 px-6 bg-gray-50 text-[10px] font-black text-gray-400 uppercase">Input Stream</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
             <div className="flex-grow relative">
                <input 
                  type="text" 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  placeholder={SAMPLE_PROMPTS[placeholderIndex]} 
                  className="w-full h-14 px-5 bg-white border-4 border-black focus:outline-none font-bold placeholder:text-gray-200 text-lg"
                />
                <Sparkles className="absolute right-4 top-4 text-blue-400" size={24} />
             </div>
             <button 
               onClick={handleImageGenerate}
               disabled={status !== 'idle' || !prompt.trim()}
               className="h-14 px-10 bg-black text-white border-4 border-black font-black uppercase text-base hover:translate-x-1 hover:translate-y-1 shadow-[6px_6px_0px_0px_rgba(37,99,235,1)] hover:shadow-none transition-all disabled:opacity-50"
             >
               {status === 'generating_image' ? 'Processing...' : 'Sync AI'}
             </button>
          </div>
        </div>
      </div>

      {/* Viewer Wrapper */}
      <div className="space-y-6">
        {(imageData || status !== 'idle') && (
           <div className="border-4 border-black relative aspect-square bg-gray-50 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
             
             {/* Loading Overlay */}
             {status !== 'idle' && (
               <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-8 text-center space-y-8">
                  <div className="relative">
                    <div className="w-20 h-20 border-8 border-gray-100 border-t-blue-600 animate-spin"></div>
                    <Box className="absolute inset-0 m-auto text-black animate-pulse" size={32} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">System {status.replace('_', ' ')}</h3>
                    {thinkingText && (
                        <p className="text-gray-400 font-mono text-sm uppercase">
                            <span className="inline-block animate-bounce mr-2">›</span>
                            {thinkingText}
                        </p>
                    )}
                  </div>
               </div>
             )}

             {errorMsg && (
               <div className="absolute inset-0 bg-red-50 z-30 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center mb-6 border-4 border-black">
                    <HistoryIcon size={32} />
                  </div>
                  <p className="text-red-600 font-black uppercase text-lg mb-2">Protocol Violation</p>
                  <p className="text-gray-600 text-sm font-medium max-w-xs">{errorMsg}</p>
                  <button onClick={() => setErrorMsg('')} className="mt-8 px-10 py-3 bg-black text-white text-xs font-black uppercase border-2 border-black hover:bg-gray-800 transition-colors">Dismiss Warning</button>
               </div>
             )}

             {imageData && viewMode === 'image' && (
               <img src={imageData} alt="AI Art" className="w-full h-full object-contain" />
             )}

             {voxelCode && viewMode === 'voxel' && (
               <iframe title="Voxel Scene" srcDoc={voxelCode} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" />
             )}
           </div>
        )}

        {/* Post-Generation Navigation */}
        {imageData && (
           <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex gap-4">
                 <button 
                   onClick={() => setViewMode('image')} 
                   className={`flex-1 flex items-center justify-center gap-3 py-4 border-4 border-black font-black uppercase text-sm transition-all ${viewMode === 'image' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                 >
                   <ImageIcon size={20} /> Preview
                 </button>
                 <button 
                   onClick={() => setViewMode('voxel')} 
                   disabled={!voxelCode}
                   className={`flex-1 flex items-center justify-center gap-3 py-4 border-4 border-black font-black uppercase text-sm transition-all ${viewMode === 'voxel' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50 disabled:opacity-30'}`}
                 >
                   <Layers size={20} /> Voxel Art
                 </button>
              </div>

              {!voxelCode ? (
                <button 
                  onClick={handleDirectVoxelize}
                  disabled={status !== 'idle'}
                  className="w-full py-6 bg-blue-600 text-white border-4 border-black font-black uppercase text-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-4"
                >
                  <Box size={32} /> Construct 3D World
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                   <button 
                     onClick={() => handleDownload(imageData, 'image')}
                     className="py-5 border-4 border-black font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                   >
                     <Download size={18} /> Asset Jpeg
                   </button>
                   <button 
                     onClick={() => handleDownload(voxelCode, 'voxel')}
                     className="py-5 bg-green-500 text-white border-4 border-black font-black uppercase text-xs flex items-center justify-center gap-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-0 transition-transform"
                   >
                     <Download size={18} /> Voxel Bundle (HTML)
                   </button>
                </div>
              )}
           </div>
        )}
      </div>
    </motion.div>
  );

  const handleNexusGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nexusPrompt.trim()) {
      setNexusError("PARAMETER MISSING: Describe the target entity.");
      return;
    }

    setNexusIsLoading(true);
    setNexusError(null);
    setNexusStatusText('INITIALIZING VOXEL MATRIX...');

    const systemPrompt = `You are an elite 3D voxel generation AI. 
You must output a complete HTML file. Use the exact boilerplate below, and ONLY modify the COLORS object and the buildEntity() function to create the requested object using createVoxel(x, y, z, colorHex).

<!DOCTYPE html>
<html>
<head>
    <style>body{margin:0;overflow:hidden;background:#050505;}canvas{display:block;}</style>
    <script type="importmap">
        { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }
    </script>
</head>
<body>
    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050505, 0.02);
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth/innerHeight, 0.1, 1000);
        camera.position.set(30, 20, 30);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.autoRotate = true; controls.autoRotateSpeed = 2.0;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(50, 100, 50); dirLight.castShadow = true;
        scene.add(dirLight);
        const backLight = new THREE.PointLight(0x00e5ff, 2, 100);
        backLight.position.set(-20, 10, -20); scene.add(backLight);

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const materials = {};
        function getMat(hex) { if(!materials[hex]){ materials[hex] = new THREE.MeshStandardMaterial({color:hex, roughness:0.7}); } return materials[hex]; }

        const mainGroup = new THREE.Group();
        scene.add(mainGroup);

        function createVoxel(x, y, z, hex) {
            const mesh = new THREE.Mesh(geometry, getMat(hex));
            mesh.position.set(x, y, z);
            mesh.castShadow = true; mesh.receiveShadow = true;
            mainGroup.add(mesh);
        }

        // --- AI MODIFIES BELOW THIS LINE ---
        const COLORS = {
            main: 0xff0055, // Add colors needed for the prompt
        };

        function buildEntity() {
            // BUILD VOXELS HERE BASED ON PROMPT. Use loops and procedural generation.
            createVoxel(0,0,0, COLORS.main);
        }
        // --- AI MODIFIES ABOVE THIS LINE ---

        buildEntity();

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            mainGroup.position.y = Math.sin(clock.getElapsedTime() * 2) * 1.5; // Floating effect
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
        
        window.onresize = () => { camera.aspect = window.innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    </script>
</body>
</html>

OUTPUT ONLY HTML. NO MARKDOWN. NO CHAT. NO EXPLANATIONS.`;

    try {
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate procedural voxel code for: ${nexusPrompt}. Make it detailed and centered at 0,0,0.` }
          ],
          temperature: 0.5,
          max_tokens: 6000
        })
      });

      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!response.ok) {
        const errorData = isJson ? await response.json() : await response.text();
        const msg = isJson ? (errorData.error || "Generation failed") : "Server returned HTML/Text instead of JSON. Ensure the backend is running properly.";
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      if (!isJson) {
        throw new Error("Unexpected response format (expected JSON from proxy).");
      }

      const result = await response.json();
      const rawContent = result.choices[0].message.content;
      
      // Robust HTML extraction
      const extractHTML = (text: string) => {
        const match = text.match(/<html[\s\S]*?<\/html>/i);
        if (match) return match[0];
        return text.replace(/```(html)?/gi, '').replace(/```/g, '').trim();
      };

      const extractedHTML = extractHTML(rawContent);
      
      setNexusCode(extractedHTML);
      setNexusStatusText('RENDER SEQUENCE COMPLETE');
      setNexusViewMode('render');
      
      // Add to main app history for persistence
      addToHistory('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', extractedHTML, `Nexus: ${nexusPrompt}`);
      
    } catch (err: any) {
      setNexusError(err.message || "An error occurred.");
      setNexusStatusText('ERROR IN GENERATION');
    } finally {
      setNexusIsLoading(false);
    }
  };

  const renderNexus = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#030305] text-slate-300 font-sans flex flex-col selection:bg-cyan-500/30 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#030305] to-[#030305] pointer-events-none z-0"></div>
      
      <header className="relative z-10 h-16 border-b border-white/5 bg-white/[0.02] backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('home')} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-10 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <Box className="text-white size-5 absolute" />
              <div className="absolute inset-0 border border-white/20 rounded-xl"></div>
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter text-white uppercase flex items-center gap-2">
                Voxel<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Nexus</span>
              </h1>
              <p className="text-[9px] font-mono text-cyan-500/70 tracking-[0.3em] uppercase">Procedural Synthesis Engine v3.0</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-black/40 px-4 py-2 rounded-lg border border-white/5">
            <span className="flex items-center gap-2"><Cpu size={12} className="text-cyan-500"/> WebGL 2.0 Active</span>
            <div className="w-px h-3 bg-white/10"></div>
            <span className="flex items-center gap-2"><Activity size={12} className="text-fuchsia-500"/> Llama 70B Core</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative z-10">
        <div className="w-full md:w-[420px] bg-white/[0.01] border-r border-white/5 flex flex-col shrink-0 relative">
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent"></div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
            <form onSubmit={handleNexusGenerate} className="flex flex-col gap-5 flex-1">
              <div className="flex-1 flex flex-col">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                  <Layers size={12} className="text-fuchsia-500"/> Synthesis Parameters
                </label>
                <textarea 
                  value={nexusPrompt}
                  onChange={(e) => setNexusPrompt(e.target.value)}
                  placeholder="Enter semantic description...&#10;&#10;Examples:&#10;> Cyberpunk hover-car with neon trim&#10;> Blocky golden retriever puppy&#10;> Ancient stone golem with moss"
                  className="w-full flex-1 min-h-[160px] p-4 bg-black/50 border border-white/10 rounded-xl focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 focus:outline-none text-sm font-mono resize-none transition-all text-fuchsia-100 placeholder:text-slate-700 leading-relaxed"
                />
              </div>

              <button 
                type="submit"
                disabled={nexusIsLoading}
                className={`group relative overflow-hidden flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all ${
                  nexusIsLoading 
                  ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-white/5' 
                  : 'bg-white text-black hover:bg-cyan-50 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-[0.98]'
                }`}
              >
                {nexusIsLoading ? (
                  <>
                    <Activity size={16} className="animate-pulse" />
                    <span>Processing Matrix...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} className="text-cyan-500 group-hover:scale-110 transition-transform" fill="currentColor"/>
                    <span>Initiate Render</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-auto space-y-3">
              {nexusError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-mono text-[10px] uppercase leading-relaxed flex gap-2 items-start">
                  <span className="text-red-500">!</span> {nexusError}
                </div>
              )}
              
              <div className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">System Status</span>
                <span className={`text-[9px] font-mono uppercase tracking-widest ${nexusIsLoading ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`}>
                  {nexusStatusText}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col relative bg-black/20 m-4 rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black">
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-between pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={() => setNexusViewMode('render')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest backdrop-blur-md transition-all border ${
                  nexusViewMode === 'render' 
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                  : 'bg-black/50 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <MonitorPlay size={14} /> Viewport
              </button>
              <button 
                onClick={() => setNexusViewMode('code')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest backdrop-blur-md transition-all border ${
                  nexusViewMode === 'code' 
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.2)]' 
                  : 'bg-black/50 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <Code2 size={14} /> Source
              </button>
            </div>

            {nexusCode && (
              <button 
                onClick={() => setNexusCode('')}
                className="pointer-events-auto flex items-center justify-center size-8 rounded-lg bg-black/50 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors backdrop-blur-md"
                title="Clear Scene"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 relative w-full h-full bg-[#050505]">
            {nexusCode ? (
              nexusViewMode === 'render' ? (
                <iframe 
                  srcDoc={nexusCode}
                  title="Voxel Viewport"
                  className="w-full h-full border-none absolute inset-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="absolute inset-0 p-6 pt-20 overflow-auto bg-[#0a0a0c]">
                  <pre className="font-mono text-[11px] text-slate-300 leading-relaxed">
                    <code dangerouslySetInnerHTML={{ __html: nexusCode.replace(/</g, '&lt;').replace(/>/g, '&gt;') }}></code>
                  </pre>
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full"></div>
                  <div className="size-24 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center bg-white/[0.02] backdrop-blur-sm relative animate-[spin_20s_linear_infinite]">
                    <Box size={40} strokeWidth={1} className="text-white/20" />
                  </div>
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-white/50 mb-2">No Entity Loaded</h3>
                <p className="font-mono text-[10px] text-white/30 max-w-xs leading-relaxed">Input parameters in the control matrix and initiate render to synthesize a voxel object.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.5); }
      `}} />
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 flex flex-col items-center px-4 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {view === 'home' && renderHome()}
        {view === 'app' && renderApp()}
        {view === 'history' && renderHistory()}
        {view === 'nexus' && renderNexus()}
      </AnimatePresence>
    </div>
  );
};

export default App;
