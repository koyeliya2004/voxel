import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Play,
  Trash2,
  Settings,
  Layers,
  Code2,
  MonitorPlay,
  Activity,
  Zap,
  Cpu
} from 'lucide-react';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'render' | 'code'>('render');
  const [statusText, setStatusText] = useState('SYSTEM IDLE');

  const extractHTML = (text: string) => {
    const match = text.match(/<html[\s\S]*?<\/html>/i);
    if (match) return match[0];
    return text.replace(/```(html)?/gi, '').replace(/```/g, '').trim();
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!prompt.trim()) {
      setError('PARAMETER MISSING: Describe the target entity.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusText('INITIALIZING VOXEL MATRIX...');

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
            main: 0xff0055,
        };

        function buildEntity() {
            createVoxel(0,0,0, COLORS.main);
        }
        // --- AI MODIFIES ABOVE THIS LINE ---

        buildEntity();

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            mainGroup.position.y = Math.sin(clock.getElapsedTime() * 2) * 1.5;
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
      const response = await fetch('/api/generate-voxel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate procedural voxel code for: ${prompt}. Make it detailed and centered at 0,0,0.` }
          ],
          temperature: 0.5,
          max_tokens: 6000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'API request failed');
      }

      const result = await response.json();
      const extractedHTML = extractHTML(result.choices[0].message.content);

      setGeneratedCode(extractedHTML);
      setStatusText('RENDER SEQUENCE COMPLETE');
      setViewMode('render');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      setStatusText('ERROR IN GENERATION');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#030305] text-slate-300 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#030305] to-[#030305] pointer-events-none z-0"></div>
      <header className="relative z-10 h-16 border-b border-white/5 bg-white/[0.02] backdrop-blur-md flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
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

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-black/40 px-4 py-2 rounded-lg border border-white/5">
            <span className="flex items-center gap-2"><Cpu size={12} className="text-cyan-500" /> WebGL 2.0 Active</span>
            <div className="w-px h-3 bg-white/10"></div>
            <span className="flex items-center gap-2"><Activity size={12} className="text-fuchsia-500" /> Llama 70B Core</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative z-10">
        <div className="w-full md:w-[420px] bg-white/[0.01] border-r border-white/5 flex flex-col shrink-0 relative">
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent"></div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
            <form onSubmit={handleGenerate} className="flex flex-col gap-5 flex-1">
              <div className="flex-1 flex flex-col">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                  <Layers size={12} className="text-fuchsia-500" /> Synthesis Parameters
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter semantic description...&#10;&#10;Examples:&#10;> Cyberpunk hover-car with neon trim&#10;> Blocky golden retriever puppy&#10;> Ancient stone golem with moss"
                  className="w-full flex-1 min-h-[160px] p-4 bg-black/50 border border-white/10 rounded-xl focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 focus:outline-none text-sm font-mono resize-none transition-all text-fuchsia-100 placeholder:text-slate-700 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`group relative overflow-hidden flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all ${
                  isLoading
                    ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-white/5'
                    : 'bg-white text-black hover:bg-cyan-50 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-[0.98]'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                    <Activity size={16} className="animate-pulse" />
                    <span>Processing Matrix...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} className="text-cyan-500 group-hover:scale-110 transition-transform" fill="currentColor" />
                    <span>Initiate Render</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-auto space-y-3">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-mono text-[10px] uppercase leading-relaxed flex gap-2 items-start">
                  <span className="text-red-500">!</span> {error}
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">System Status</span>
                <span className={`text-[9px] font-mono uppercase tracking-widest ${isLoading ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`}>
                  {statusText}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col relative bg-black/20 m-4 rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black">
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-between pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={() => setViewMode('render')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest backdrop-blur-md transition-all border ${
                  viewMode === 'render'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                    : 'bg-black/50 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <MonitorPlay size={14} /> Viewport
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest backdrop-blur-md transition-all border ${
                  viewMode === 'code'
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.2)]'
                    : 'bg-black/50 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <Code2 size={14} /> Source
              </button>
            </div>

            {generatedCode && (
              <button
                onClick={() => setGeneratedCode('')}
                className="pointer-events-auto flex items-center justify-center size-8 rounded-lg bg-black/50 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors backdrop-blur-md"
                title="Clear Scene"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 relative w-full h-full bg-[#050505]">
            {generatedCode ? (
              viewMode === 'render' ? (
                <iframe
                  srcDoc={generatedCode}
                  title="Voxel Viewport"
                  className="w-full h-full border-none absolute inset-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="absolute inset-0 p-6 pt-20 overflow-auto bg-[#0a0a0c]">
                  <pre className="font-mono text-[11px] text-slate-300 leading-relaxed">
                    <code dangerouslySetInnerHTML={{ __html: generatedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;') }}></code>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.5); }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      ` }} />
    </div>
  );
};

export default App;
