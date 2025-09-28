import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend,
    LineController, 
    BarController,
    SubTitle,
    Filler
} from 'chart.js';
import * as THREE from 'three';

// --- Global Chart.js Configuration and Registration (Exhaustive registration) ---
ChartJS.register(
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    LineController, 
    BarController,
    SubTitle,
    Filler
);

// --- DARK MODE CHART DEFAULTS ---
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;
ChartJS.defaults.color = '#DDDDDD'; // Global text color for charts (axes, labels)
ChartJS.defaults.borderColor = '#333333'; // Global border/grid line color (subtle)

const tooltipConfig = {
    mode: 'index',
    intersect: false,
    backgroundColor: 'rgba(30, 41, 59, 0.95)', // Slate-800
    titleFont: { size: 14, weight: 'bold' },
    bodyFont: { size: 12 },
    padding: 10,
    cornerRadius: 6,
};

// --- DATA CONFIGURATION ---
const systemData = {
    labels: ['2000-2004', '2005-2009', '2010-2014', '2015-2019', '2020-2024'],
    atmosphere: {
        tabs: ['Gases', 'Clouds', 'Radiation'],
        data: {
            Gases: { co2: [370, 385, 400, 415, 425], methane: [1750, 1790, 1830, 1870, 1920], ozone: [300, 298, 295, 292, 290] },
            Clouds: { pressure: [650, 655, 660, 665, 670], temp: [-25, -24.5, -24, -23.5, -23] },
            Radiation: { net: [238, 238.5, 239, 239.5, 240], no2: [25, 23, 21, 19, 17] }
        },
        colors: { primary: '#34D399', secondary: '#10B981', accent: '#FBBF24', bg: 'bg-green-900/40', llm: 'text-green-400' } // Emerald/Green accents
    },
    ocean: {
        tabs: ['Dynamics', 'Ecosystem', 'Thermal', 'Exchange'],
        data: {
            Dynamics: { adt: [20.0, 20.5, 21.1, 21.8, 22.5], ssl: [30, 45, 60, 75, 90] },
            Ecosystem: { chlorophyll: [0.45, 0.44, 0.43, 0.42, 0.41], radiance: [1.05, 1.03, 1.01, 0.99, 0.97] },
            Thermal: { sst: [18.5, 18.6, 18.8, 19.0, 19.3], seaIce: [14.5, 14.0, 13.5, 13.0, 12.4] },
            Exchange: { waterVapour: [25.0, 25.3, 25.6, 26.0, 26.5], windSpeed: [7.8, 7.7, 7.9, 8.0, 8.2] }
        },
        colors: { primary: '#60A5FA', secondary: '#3B82F6', accent: '#F87171', bg: 'bg-blue-900/40', llm: 'text-blue-400' } // Blue accents
    },
    cryosphere: {
        tabs: ['Extent', 'Volume', 'Thermal'],
        data: {
            Extent: { iceArea: [15.5, 15.0, 14.2, 13.5, 12.8], snowExtent: [38.0, 37.5, 36.5, 35.5, 34.0] },
            Volume: { swe: [250, 230, 210, 190, 170], snowDepth: [50, 48, 45, 42, 38] },
            Thermal: { temp: [-15.0, -14.0, -13.0, -12.0, -11.0], freezeThaw: [180, 190, 200, 210, 220] }
        },
        colors: { primary: '#4BC0C0', secondary: '#20B2AA', accent: '#EC4899', bg: 'bg-cyan-900/40', llm: 'text-cyan-400' } // Teal/Cyan accents
    },
    land: {
        tabs: ['Thermal', 'Hydrology', 'Cover', 'Boundary'],
        data: {
            Thermal: { lst: [28.0, 28.5, 29.1, 29.8, 30.5], temp: [14.5, 14.8, 15.2, 15.6, 16.0] },
            Hydrology: { evaporation: [2.0, 2.1, 2.2, 2.3, 2.4], soilMoisture: [0.45, 0.44, 0.42, 0.40, 0.39] },
            Cover: { index: [85, 84, 83, 82, 81] },
            Boundary: { pressure: [1013, 1012.8, 1013.2, 1013.0, 1013.1], flux: [100, 102, 104, 106, 108] }
        },
        colors: { primary: '#FACC15', secondary: '#EAB308', accent: '#A855F7', bg: 'bg-yellow-900/40', llm: 'text-yellow-400' } // Amber/Yellow accents
    }
};


// --- GLOBAL LLM / API SETUP ---
const apiKey = "AIzaSyAYhkf_cimCGWSTuXVmCmUNZzwXEybOXi0"; 
const baseGeminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent`;

async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API returned status ${response.status}: ${errorBody.substring(0, 100)}...`);
            }
            return response;
        } catch (error) {
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error(`Network or final API error: ${error.message}`);
            }
        }
    }
}

// --- STATIC CHART ANALYSIS TEXT ---
function getAnalysisText(system, tab) {
    const trends = {
        atmosphere: {
            Gases: 'Atmospheric gases like **CO2 and Methane** show an alarming, continuous rise, driving global warming. **Ozone** shows a slow recovery after initial declines.',
            Clouds: 'Average **Cloud Pressure** is slightly rising (lower altitude), while **Cloud Temperature** is also rising, consistent with overall warming.',
            Radiation: '**Net Radiation** absorbed by the Earth has steadily increased. **NO2** levels show a clear decline due to pollution controls.'
        },
        ocean: {
            Dynamics: '**Sea Surface Level** has risen significantly, driven by thermal expansion and ice melt. **Absolute Dynamic Topography** shows subtle circulation shifts.',
            Ecosystem: '**Chlorophyll-a** (phytoplankton) and **Ocean Color Radiance** generally show a subtle decline in primary productivity due to warming.',
            Thermal: '**Sea Surface Temperature (SST)** shows a pronounced warming trend. **Sea Ice Extent** demonstrates a significant, consistent decline.',
            Exchange: '**Water Vapour** over the ocean is increasing due to warmer SSTs, feeding intense storms. **Wind Speed** shows minor, overall increases.'
        },
        cryosphere: {
            Extent: '**Ice Surface Area** and **Snow Extent** show clear, accelerating decline, leading to reduced planetary reflectivity (albedo).',
            Volume: '**Snow Water Equivalent (SWE)**, the most crucial freshwater metric, shows a sharp decrease, threatening regional water supplies.',
            Thermal: '**Ice Surface Temperature** is consistently warming, directly correlated with an increase in **Freeze/Thaw Days**, meaning longer melt seasons.'
        },
        land: {
            Thermal: '**Land Surface Temperature (LST)** and near-surface **Air Temperature** both show strong, accelerating upward trends, increasing heatwave risk.',
            Hydrology: 'The inverse relationship between rising **Evaporation** and declining **Soil Moisture** illustrates the increasing intensity of hydrological stress and drought.',
            Cover: 'The overall **Land Cover Index** is decreasing, signifying global loss of natural ecosystems due to human activities.',
            Boundary: 'While **Surface Pressure** is stable, **Surface Flux** (net radiation absorbed by the ground) shows a rising trend, confirming the land is absorbing more solar energy.'
        }
    };
    return (trends[system] && trends[system][tab]) ? trends[system][tab] : 'No analysis available for this selection.';
}

// --- DYNAMIC 3D GLOBE CONDITION ANALYSIS TEXT ---
function getConditionAnalysis(system, index) {
    const period = systemData.labels[index];
    const baseMessage = `Viewing average conditions for the period: **${period}**`;

    if (system === 'atmosphere') {
        const co2 = systemData.atmosphere.data.Gases.co2[index];
        const methane = systemData.atmosphere.data.Gases.methane[index];
        if (index === 0) return `${baseMessage}. Early period of observation. CO₂ levels are relatively low (${co2} ppm), showing baseline greenhouse gas concentrations.`;
        if (index < 4) return `${baseMessage}. **Greenhouse gas accumulation is moderate.** CO₂ has increased to ${co2} ppm, leading to a visible rise in atmospheric heat retention.`;
        return `${baseMessage}. **Critical warming threshold reached.** CO₂ and Methane are near peak observed levels, resulting in the globe displaying the highest heat-trapping effect.`;
    } 
    if (system === 'cryosphere') {
        const ice = systemData.cryosphere.data.Extent.iceArea[index];
        if (index === 0) return `${baseMessage}. **Peak ice extent.** Arctic and Antarctic ice caps are near their maximum observed average size (${ice} 10⁶ km²).`;
        if (index < 4) return `${baseMessage}. **Visible decline.** Ice area loss is accelerating, with caps starting to shrink significantly (${ice} 10⁶ km²), reducing Earth's albedo.`;
        return `${baseMessage}. **Minimum ice coverage.** The ice caps are at their smallest observed average extent (${ice} 10⁶ km²), demonstrating severe polar warming.`;
    }
    if (system === 'land') {
        const lst = systemData.land.data.Thermal.lst[index];
        if (index === 0) return `${baseMessage}. **Baseline temperatures.** Land surface temperatures are at a cool average (${lst} °C).`;
        if (index < 4) return `${baseMessage}. **Heat stress rising.** Continents show increasing warmth and subtle shifts toward drier, warmer conditions (${lst} °C).`;
        return `${baseMessage}. **Maximum recorded heat.** The land surface displays the highest average temperatures, indicating severe heatwave potential and drought stress (${lst} °C).`;
    }
    if (system === 'ocean') {
        const sst = systemData.ocean.data.Thermal.sst[index];
        if (index === 0) return `${baseMessage}. **Cooler ocean waters.** Sea surface temperatures are at a historical average (${sst} °C), supporting baseline ocean circulation.`;
        if (index < 4) return `${baseMessage}. **Ocean heat accelerating.** Waters are visibly warmer (${sst} °C), causing thermal expansion and impacting marine ecosystems.`;
        return `${baseMessage}. **Peak ocean heat.** Global sea surface temperatures are at their highest observed average (${sst} °C), correlating with rising sea level.`;
    }
    return baseMessage;
}


// --- LLM ANALYSIS COMPONENT ---

const LlmAnalysis = ({ system, tab, data, llmColor }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);

    const getLlmImpactAnalysis = useCallback(async () => {
        setLoading(true);
        setAnalysis(null);
        
        const systemInfo = data;
        let prompt = `Analyze the trend for ${tab} in the ${system} system from 2000 to 2024. The data points (5-year averages) are: ${JSON.stringify(systemInfo)}. What are the key real-world impacts and future projections (next decade) of this trend?`;

        const systemInstruction = "You are an expert climate scientist and science communicator. Based on the provided trend data and current scientific literature, generate a concise, easy-to-understand two-paragraph summary explaining the real-world implications and future projections of this specific trend over the next decade. Do not use markdown headers or lists.";

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
        };
        
        if (apiKey === "") {
             setLoading(false);
             setAnalysis({ error: "API_AUTH_FAILURE" }); 
             return;
        }
        
        const apiUrl = `${baseGeminiApiUrl}?key=${apiKey}`;

        try {
            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const text = candidate.content.parts[0].text;
                let sources = [];
                const groundingMetadata = candidate.groundingMetadata;
                if (groundingMetadata && groundingMetadata.groundingAttributions) {
                    sources = groundingMetadata.groundingAttributions
                        .map(attribution => ({
                            uri: attribution.web?.uri,
                            title: attribution.web?.title,
                        }))
                        .filter(source => source.uri && source.title);
                }
                setAnalysis({ text, sources });
            } else {
                 setAnalysis({ error: 'LLM response was empty or malformed. Status: ' + JSON.stringify(result).substring(0, 100) + '...' });
            }

        } catch (error) {
            setAnalysis({ error: error.message });
        } finally {
            setLoading(false);
        }
    }, [system, tab, data]);

    const renderApiKeyInstructions = () => (
        <div className="p-6 bg-yellow-900/40 border-2 border-yellow-700 rounded-xl shadow-md space-y-4">
            <h4 className="text-xl font-bold text-yellow-400 flex items-center">
                <span className="text-2xl mr-2">🔑</span> Gemini API Key Required
            </h4>
            <p className="text-gray-300">The "Analyze Impact" feature uses the Google Gemini API, but the **API Key is currently empty** in the code. To enable this powerful, context-aware analysis, you need to provide your own key:</p>
            
            <div className="space-y-3 pl-4 border-l-4 border-yellow-700">
                <p className="text-lg font-semibold text-gray-100">How to Get and Insert Your Key:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2">
                    <li>Go to the <a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-medium">Google AI documentation</a> to create a new key.</li>
                    <li>Copy the generated key string.</li>
                    <li>In the code editor for <code className="bg-slate-700 p-1 rounded font-mono text-white">src/App.jsx</code>, find the line near the top that says: <code className="bg-slate-700 p-1 rounded font-mono text-white">const apiKey = "";</code></li>
                    <li>Replace the empty string with your key: <code className="bg-slate-700 p-1 rounded font-mono text-white">const apiKey = "YOUR_KEY_HERE";</code></li>
                    <li>Save the file and rerun the application.</li>
                </ol>
            </div>
            <p className="text-sm text-yellow-500">API usage may incur costs. Please review the Gemini API terms before obtaining and using a key.</p>
        </div>
    );

    const renderAnalysis = () => {
        if (loading) {
            return (
                <p className="text-center py-4 text-gray-400 flex items-center justify-center">
                    <span className="animate-spin mr-2">⚙️</span> Generating deep dive analysis...
                </p>
            );
        }
        
        if (analysis?.error === "API_AUTH_FAILURE") {
            return renderApiKeyInstructions();
        }

        if (analysis?.error) {
            return (
                <div className="p-4 bg-red-900/40 border border-red-700 text-red-400 rounded-xl">
                    <h4 className="font-bold">Error during Gemini Analysis:</h4>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{analysis.error}</p>
                </div>
            );
        }
        if (analysis?.text) {
            const paragraphs = analysis.text.split('\n\n').filter(p => p.trim() !== '');
            const sourceList = analysis.sources.map((s, i) => (
                <li key={i}>
                    <a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">{s.title}</a>
                </li>
            ));

            return (
                <div className="p-4 bg-slate-700 rounded-xl shadow-inner border border-slate-600">
                    <h4 className={`text-xl font-semibold ${llmColor} mb-3`}>✨ Gemini Impact Analysis</h4>
                    {paragraphs.map((p, i) => <p key={i} className="text-gray-300 leading-relaxed mt-2">{p}</p>)}
                    {analysis.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-600 text-sm text-gray-400">
                            <p className="font-semibold mb-1">Sources consulted:</p>
                            <ul className="list-disc list-inside space-y-0.5">{sourceList}</ul>
                        </div>
                    )}
                </div>
            );
        }
        return (
            <button 
                onClick={getLlmImpactAnalysis} 
                className={`mt-4 md:mt-0 px-4 py-2 text-white font-semibold rounded-lg shadow-lg transition duration-300 transform hover:scale-[1.02]`}
                style={{ 
                    backgroundColor: systemData[system].colors.secondary, 
                    boxShadow: `0 4px 6px -1px ${systemData[system].colors.primary}50, 0 2px 4px -2px ${systemData[system].colors.primary}50` 
                }}
            >
                ✨ Analyze Impact with Gemini
            </button>
        );
    };

    return (
        <div id="llm-analysis-result" className="mt-6 border-t border-slate-700 pt-4 flex-1">
            {renderAnalysis()}
        </div>
    );
};


// --- CHART RENDERING LOGIC (Isolated for stability) ---

const getChartConfig = (system, tab) => {
    const dataContainer = systemData[system]?.data;
    const data = dataContainer ? dataContainer[tab] : undefined;

    if (!data) {
        return { type: 'line', data: { labels: systemData.labels, datasets: [] }, options: {} };
    }
    
    const colors = systemData[system].colors;
    const labels = systemData.labels;

    let config = { 
        type: 'line', 
        data: { labels: labels, datasets: [] }, 
        options: { 
            plugins: { 
                title: { display: true, text: tab + ' Trends' },
                tooltip: tooltipConfig 
            }, 
            scales: {
                y: { grid: { color: '#333333' } },
                x: { grid: { color: '#333333' } },
            }
        } 
    };

    if (system === 'atmosphere' && tab === 'Gases') {
        config.data.datasets.push({ label: 'CO2 (ppm)', data: data.co2, borderColor: colors.primary, tension: 0.3, yAxisID: 'y' });
        config.data.datasets.push({ label: 'Methane (ppb)', data: data.methane, borderColor: colors.secondary, tension: 0.3, yAxisID: 'y1' });
        config.data.datasets.push({ label: 'Ozone (DU)', data: data.ozone, borderColor: colors.accent, tension: 0.3, yAxisID: 'y2' });
        config.options.scales = { 
            y: { title: { display: true, text: 'CO2 (ppm)' }, grid: { color: '#333333' } }, 
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'CH4 (ppb)' }, grid: { drawOnChartArea: false, color: '#333333' } }, 
            y2: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Ozone (DU)' }, grid: { drawOnChartArea: false, color: '#333333' } } 
        };
    } 
    else {
        const keys = Object.keys(data);
        const type = (system === 'land' && tab !== 'Thermal') ? 'bar' : 'line';
        config.type = type;

        config.data.datasets.push({ label: keys[0], data: data[keys[0]], borderColor: colors.primary, backgroundColor: type === 'bar' ? colors.primary + '30' : undefined, tension: 0.3, yAxisID: 'y' });

        if (keys.length > 1) {
            config.data.datasets.push({ label: keys[1], data: data[keys[1]], borderColor: colors.secondary, backgroundColor: type === 'bar' ? colors.secondary + '30' : undefined, tension: 0.3, yAxisID: 'y1' });
            config.options.scales = { 
                y: { title: { display: true, text: keys[0].split('(')[0] }, grid: { color: '#333333' } }, 
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: keys[1].split('(')[0] }, grid: { drawOnChartArea: false, color: '#333333' } } 
            };
        } else {
            config.options.scales = { y: { title: { display: true, text: keys[0].split('(')[0] }, grid: { color: '#333333' } } };
        }
    }

    if (system === 'ocean' && tab === 'Thermal') {
         const sstData = systemData.ocean.data.Thermal.sst;
         const seaIceData = systemData.ocean.data.Thermal.seaIce;
         
         config.data.datasets = [
            { label: 'SST (°C)', data: sstData, borderColor: colors.primary, tension: 0.3, yAxisID: 'y' },
            { label: 'Sea Ice Extent (10⁶ km²)', data: seaIceData, borderColor: colors.secondary, tension: 0.3, yAxisID: 'y1' }
         ];
         config.options.scales = { 
            y: { title: { display: true, text: 'SST (°C)' }, grid: { color: '#333333' } }, 
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Ice Extent (10⁶ km²)' }, grid: { drawOnChartArea: false, color: '#333333' } } 
        };
    }

    return config;
};

// New dedicated component to handle Chart.js rendering
const ChartCanvas = ({ system, tab }) => {
    const canvasRef = useRef(null);
    const chartInstanceRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');
        const config = getChartConfig(system, tab);
        
        try {
            chartInstanceRef.current = new ChartJS(ctx, config);
        } catch(e) {
            console.error("Chart initialization failed:", e);
        }
        
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [system, tab]);

    return (
        <div className="chart-container relative w-full max-w-4xl mx-auto h-[400px]">
            <canvas ref={canvasRef} />
        </div>
    );
};

const ChartRenderer = ({ system, tab }) => {
    const systemInfo = systemData[system];
    const dataForLlm = systemInfo.data[tab];

    return (
        <div className="mt-8">
            <h3 className="text-2xl font-semibold mb-6 text-gray-100">{tab} Trends</h3>
            <div className="p-4 bg-slate-800 rounded-xl shadow-xl border border-slate-700">
                <ChartCanvas system={system} tab={tab} />
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-8 space-y-4 md:space-y-0 md:space-x-4">
                <p className="p-4 bg-indigo-900/40 border-l-4 border-indigo-600 text-gray-300 text-lg rounded-r-lg flex-1"
                   dangerouslySetInnerHTML={{ __html: getAnalysisText(system, tab).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
                <LlmAnalysis system={system} tab={tab} data={dataForLlm} llmColor={systemInfo.colors.llm} />
            </div>
        </div>
    );
};

// --- THREE.JS UTILITY FUNCTIONS ---

const EARTH_RADIUS = 100;

const vertexShader = `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize( normalMatrix * normal );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
`;

const fragmentShader = `
    uniform vec3 atmosphereColor;
    varying vec3 vNormal;
    void main() {
        float intensity = pow( 0.9 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 2.0 );
        gl_FragColor = vec4( atmosphereColor, 0.8 ) * intensity;
    }
`;

const create3DParticles = () => {
    const particleCount = 1000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = [];
    const maxRange = 1000;

    for (let i = 0; i < particleCount; i++) {
        positions.push(
            (Math.random() - 0.5) * maxRange,
            (Math.random() - 0.5) * maxRange,
            (Math.random() - 0.5) * maxRange
        );
    }
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6
    });
    
    return new THREE.Points(particleGeometry, particleMaterial);
};


// --- 1. AESTHETIC HOME PAGE GLOBE (Non-Interactive, simple continuous rotation) ---

const HomeGlobe = () => {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null); 
    const globeRef = useRef(null);
    const atmosphereRef = useRef(null);
    const particlesRef = useRef(null);
    const animateIdRef = useRef(null);

    const initScene = useCallback(() => {
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Cleanup previous instance
        if (rendererRef.current) {
            rendererRef.current.dispose();
            if (rendererRef.current.domElement.parentNode) {
                rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
            }
        }
        
        sceneRef.current = new THREE.Scene();
        sceneRef.current.background = new THREE.Color(0x0a0a20); 

        cameraRef.current = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        cameraRef.current.position.z = 300;
        
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        rendererRef.current.setSize(width, height);
        rendererRef.current.setPixelRatio(window.devicePixelRatio);
        container.appendChild(rendererRef.current.domElement);

        // GLOBE (Default look - blue ocean / subtle land)
        const globeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1565C0, // Base Ocean Color
            specular: 0xCCCCCC,
            shininess: 30,
        }); 
        globeRef.current = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 64, 64), globeMaterial);
        sceneRef.current.add(globeRef.current);

        // ATMOSPHERE (Haze)
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: { atmosphereColor: { value: new THREE.Color(0x00BFFF) } },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
        });
        atmosphereRef.current = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.05, 64, 64), atmosphereMaterial);
        sceneRef.current.add(atmosphereRef.current);
        
        // STARFIELD
        particlesRef.current = create3DParticles();
        sceneRef.current.add(particlesRef.current);

        // LIGHTING
        const ambientLight = new THREE.AmbientLight(0xAAAAAA, 0.4);
        sceneRef.current.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
        directionalLight.position.set(200, 100, 300);
        sceneRef.current.add(directionalLight);
        
        const onWindowResize = () => {
            if (!rendererRef.current || !cameraRef.current) return;
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            cameraRef.current.aspect = newWidth / newHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(newWidth, newHeight);
        };
        window.addEventListener('resize', onWindowResize, false);

        // Start animation loop
        animate();
    }, []);

    const animate = useCallback(() => {
        animateIdRef.current = requestAnimationFrame(animate);

        if (globeRef.current) {
            // ONLY continuous rotation
            globeRef.current.rotation.y += 0.001; 
            if (atmosphereRef.current) atmosphereRef.current.rotation.copy(globeRef.current.rotation);
        }
        if (particlesRef.current) particlesRef.current.rotation.y += 0.0001;

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    }, []);

    useEffect(() => {
        initScene();

        return () => {
            if (animateIdRef.current) cancelAnimationFrame(animateIdRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (rendererRef.current.domElement.parentNode) {
                    rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current = null;
                // Explicitly nullify all refs for clean cleanup
                sceneRef.current = null; cameraRef.current = null; globeRef.current = null; atmosphereRef.current = null; particlesRef.current = null;
            }
        };
    }, [initScene]);

    return (
        <div ref={containerRef} className="w-full h-screen absolute top-0 left-0 z-0">
        </div>
    );
};


// --- 2. DATA-DRIVEN SYSTEM GLOBE (Interactive, data-changing) ---

const System3DRenderer = ({ system, dataIndex, onDataIndexChange }) => {
    const containerRef = useRef(null);
    const [sliderValue, setSliderValue] = useState(dataIndex);
    
    // Local refs for the interactive system globe
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const globeRef = useRef(null);
    const atmosphereRef = useRef(null);
    const polarIceCapsRef = useRef(null);
    const particlesRef = useRef(null);
    const animateIdRef = useRef(null);
    
    const rotationTargetX = useRef(0);
    const rotationTargetY = useRef(0);
    const isDraggingRef = useRef(false);
    const previousMousePositionRef = useRef({ x: 0, y: 0 });
    let isAnimating = true;

    const initScene = useCallback(() => {
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Cleanup function for robustness
        const cleanup = () => {
            if (animateIdRef.current) cancelAnimationFrame(animateIdRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (rendererRef.current.domElement.parentNode) {
                    rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current = null;
                sceneRef.current = null; cameraRef.current = null; globeRef.current = null; 
                atmosphereRef.current = null; polarIceCapsRef.current = null; particlesRef.current = null;
            }
        };
        cleanup();

        sceneRef.current = new THREE.Scene();
        sceneRef.current.background = new THREE.Color(0x0a0a20); 

        cameraRef.current = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        cameraRef.current.position.z = 300;
        
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        rendererRef.current.setSize(width, height);
        rendererRef.current.setPixelRatio(window.devicePixelRatio);
        container.appendChild(rendererRef.current.domElement);
        
        // GLOBE (Base material for data mapping)
        const globeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1565C0, 
            specular: 0xCCCCCC,
            shininess: 30,
        }); 
        globeRef.current = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 64, 64), globeMaterial);
        sceneRef.current.add(globeRef.current);

        // ATMOSPHERE
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: { atmosphereColor: { value: new THREE.Color(0x00BFFF) } },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
        });
        atmosphereRef.current = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.05, 64, 64), atmosphereMaterial);
        sceneRef.current.add(atmosphereRef.current);
        
        // ICE CAPS
        const iceGeometryNorth = new THREE.SphereGeometry(EARTH_RADIUS * 1.001, 64, 64, 0, Math.PI * 2, 0, Math.PI / 6);
        const iceGeometrySouth = new THREE.SphereGeometry(EARTH_RADIUS * 1.001, 64, 64, 0, Math.PI * 2, Math.PI - Math.PI / 6, Math.PI / 6);
        const iceMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9, emissive: 0x404040 });
        polarIceCapsRef.current = new THREE.Group();
        polarIceCapsRef.current.add(new THREE.Mesh(iceGeometryNorth, iceMaterial));
        polarIceCapsRef.current.add(new THREE.Mesh(iceGeometrySouth, iceMaterial));
        sceneRef.current.add(polarIceCapsRef.current);
        polarIceCapsRef.current.visible = false; 

        // STARFIELD
        particlesRef.current = create3DParticles(); 
        sceneRef.current.add(particlesRef.current);

        // LIGHTING
        const ambientLight = new THREE.AmbientLight(0xAAAAAA, 0.4);
        sceneRef.current.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
        directionalLight.position.set(200, 100, 300);
        sceneRef.current.add(directionalLight);

        // --- INTERACTIVITY HANDLERS ---
        const onMouseMove = (event) => {
            if (isDraggingRef.current) {
                const deltaX = event.clientX - previousMousePositionRef.current.x;
                const deltaY = event.clientY - previousMousePositionRef.current.y;
                rotationTargetY.current += deltaX * 0.005;
                rotationTargetX.current += deltaY * 0.005;
                rotationTargetX.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationTargetX.current));
                previousMousePositionRef.current = { x: event.clientX, y: event.clientY };
            }
        };
        const onMouseDown = (event) => {
            if(event.target === rendererRef.current.domElement) {
                isDraggingRef.current = true;
                previousMousePositionRef.current = { x: event.clientX, y: event.clientY };
            }
        };
        const onMouseUp = () => { isDraggingRef.current = false; };
        const onWindowResize = () => {
            if (!rendererRef.current || !cameraRef.current) return;
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            cameraRef.current.aspect = newWidth / newHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(newWidth, newHeight);
        };

        container.addEventListener('mousedown', onMouseDown, false);
        document.addEventListener('mouseup', onMouseUp, false); 
        container.addEventListener('mousemove', onMouseMove, false);
        window.addEventListener('resize', onWindowResize, false);
        
        animate();
    }, []);

    const animate = useCallback(() => {
        if (!isAnimating || !rendererRef.current || !globeRef.current) {
            if (animateIdRef.current !== null) cancelAnimationFrame(animateIdRef.current);
            animateIdRef.current = null;
            return;
        }
        animateIdRef.current = requestAnimationFrame(animate);

        globeRef.current.rotation.x += (rotationTargetX.current - globeRef.current.rotation.x) * 0.1;
        
        // Subtle continuous rotation on system views
        globeRef.current.rotation.y += (rotationTargetY.current - globeRef.current.rotation.y) * 0.1 + 0.001;
        
        atmosphereRef.current.rotation.copy(globeRef.current.rotation);
        polarIceCapsRef.current.rotation.copy(globeRef.current.rotation);
        if(particlesRef.current) particlesRef.current.rotation.y += 0.0001;

        rendererRef.current.render(sceneRef.current, cameraRef.current);
    }, []);

    const update3DModel = useCallback((index) => {
        if (!globeRef.current || !atmosphereRef.current || !polarIceCapsRef.current) return;
        
        // Reset base state
        polarIceCapsRef.current.visible = false;
        globeRef.current.material.emissive.set(0x000000);
        globeRef.current.material.color.set(0x1565C0); 
        atmosphereRef.current.material.uniforms.atmosphereColor.value.set(0x00BFFF);

        
        // --- DATA VISUALIZATION LOGIC ---
        const dataLabel = systemData.labels[index];
        const dataContainer = document.getElementById('data-slider-value');
        let dataValue; 

        if (system === 'atmosphere') {
            dataValue = systemData.atmosphere.data.Gases.co2[index];
            const warmthFactor = (dataValue - 370) / (425 - 370); 

            atmosphereRef.current.material.uniforms.atmosphereColor.value.set(new THREE.Color(0x00BFFF).lerp(new THREE.Color(0xFF8C00), warmthFactor * 0.5));
            globeRef.current.material.emissive.set(new THREE.Color(0x000000).lerp(new THREE.Color(0xDD3300), warmthFactor * 0.3));
            globeRef.current.material.color.set(new THREE.Color(0x28B463).lerp(new THREE.Color(0x0A7CFF), 0.5)); 
            
            if (dataContainer) dataContainer.textContent = `${dataLabel} | CO₂: ${dataValue} ppm (Warming Factor)`;
        } 
        else if (system === 'cryosphere') {
            polarIceCapsRef.current.visible = true;
            dataValue = systemData.cryosphere.data.Extent.iceArea[index];
            const areaMin = 12.8;
            const areaMax = 15.5;
            const areaFactor = (dataValue - areaMin) / (areaMax - areaMin);

            const scale = 0.8 + (areaFactor * 0.2); 
            polarIceCapsRef.current.scale.set(scale, scale, scale);

            globeRef.current.material.color.set(0x2196F3); 

            if (dataContainer) dataContainer.textContent = `${dataLabel} | Ice Area: ${dataValue} 10⁶ km²`;
        }
        else if (system === 'land') {
            dataValue = systemData.land.data.Thermal.lst[index];
            const tempFactor = (dataValue - 28.0) / (30.5 - 28.0);
            
            const baseColor = new THREE.Color(0x28B463);
            const warmColor = new THREE.Color(0xD32F2F);
            globeRef.current.material.color.copy(baseColor).lerp(warmColor, tempFactor);
            
            if (dataContainer) dataContainer.textContent = `${dataLabel} | LST: ${dataValue} °C (Surface Warming)`;
        }
        else if (system === 'ocean') {
            dataValue = systemData.ocean.data.Thermal.sst[index];
            const tempFactor = (dataValue - 18.5) / (19.3 - 18.5);
            
            const baseColor = new THREE.Color(0x1565C0);
            const warmColor = new THREE.Color(0x00BCD4);
            globeRef.current.material.color.copy(baseColor).lerp(warmColor, tempFactor);
            
            if (dataContainer) dataContainer.textContent = `${dataLabel} | SST: ${dataValue} °C (Ocean Heat)`;
        }
    }, [system]);

    useEffect(() => {
        initScene();

        return () => {
             isAnimating = false; // Stop the animation flag
             if (animateIdRef.current) cancelAnimationFrame(animateIdRef.current);
             // Cleanup is already handled robustly in initScene cleanup
        };
    }, [initScene]);

    useEffect(() => {
        if (globeRef.current) {
            update3DModel(sliderValue);
        }
    }, [sliderValue, system, update3DModel]);

    const handleSliderChange = (e) => {
        const newIndex = parseInt(e.target.value);
        setSliderValue(newIndex);
        onDataIndexChange(newIndex);
    };

    const conditionText = getConditionAnalysis(system, sliderValue);
    
    return (
        <div className="mt-8">
            <h3 className="text-2xl font-semibold mb-6 text-gray-100">3D Global Visualization (Data-Driven)</h3>
            <div className="p-4 bg-slate-800 rounded-xl shadow-xl border border-slate-700 flex flex-col items-center">
                <div id="three-container" ref={containerRef} className="w-full h-[60vh] max-h-[650px] bg-slate-900 rounded-lg overflow-hidden relative">
                </div>
                
                <div className="w-full max-w-xl mt-6 p-4 bg-slate-700 rounded-xl shadow-md">
                    <label htmlFor="dataSlider" className="block text-lg font-medium text-gray-200 mb-2">Cycle Through 5-Year Averages:</label>
                    <input 
                        type="range" 
                        id="dataSlider" 
                        min="0" 
                        max="4" 
                        value={sliderValue} 
                        step="1" 
                        onChange={handleSliderChange}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-sm mt-2 font-mono text-gray-400">
                        {systemData.labels.map(l => <span key={l}>{l.substring(0, 4)}</span>)}
                    </div>
                    <p id="data-slider-value" className="text-center font-bold text-lg mt-4 text-blue-400">{systemData.labels[sliderValue]}</p>
                </div>

                {/* NEW DYNAMIC CONDITION ANALYSIS BLOCK */}
                <div className="mt-6 p-4 w-full max-w-xl bg-indigo-900/40 border-l-4 border-indigo-600 rounded-r-lg text-gray-300">
                    <p className="font-semibold text-lg text-indigo-300 mb-1">Current Condition Summary:</p>
                    <p dangerouslySetInnerHTML={{ __html: conditionText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
                {/* END NEW BLOCK */}

                <div className="mt-8 text-center text-gray-400">
                    <p>The **data-driven globe** dynamically reflects **{system === 'cryosphere' ? 'Ice Cap Extent' : system === 'atmosphere' ? 'Atmospheric Glow' : system === 'land' ? 'Surface Warming' : 'Ocean Color'}**.</p>
                    <p className="text-sm mt-1">Click and drag to rotate the globe. Use the slider to see climate trends evolve over 25 years.</p>
                </div>
            </div>
        </div>
    );
};

// Component for the Systems Dropdown in the Navbar
const SystemsDropdown = ({ handleNavClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const systemsList = [
        { id: 'atmosphere', name: 'Atmosphere 💨', color: 'text-green-400', desc: 'Gases & Clouds' },
        { id: 'ocean', name: 'Ocean 🌊', color: 'text-blue-400', desc: 'SST & Sea Level' },
        { id: 'cryosphere', name: 'Cryosphere 🧊', color: 'text-cyan-400', desc: 'Ice & Snow' },
        { id: 'land', name: 'Land Surface 🌳', color: 'text-yellow-400', desc: 'Temperature & Soil' },
    ];

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleItemClick = (systemId) => {
        handleNavClick(systemId);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={toggleDropdown}
                className="py-2 px-4 text-sm font-semibold rounded-lg text-white bg-blue-700 hover:bg-blue-600 transition duration-150 flex items-center shadow-md shadow-blue-700/50"
            >
                Systems 
                <svg className={`w-4 h-4 ml-1 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            {isOpen && (
                <div 
                    className="absolute right-0 mt-3 w-60 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden z-50"
                    onMouseLeave={() => setIsOpen(false)}
                >
                    {systemsList.map((item) => (
                        <a 
                            key={item.id}
                            href="#" 
                            onClick={(e) => { e.preventDefault(); handleItemClick(item.id); }}
                            className="block p-4 hover:bg-slate-700 transition duration-150 border-b border-slate-700 last:border-b-0"
                        >
                            <span className={`text-base font-semibold ${item.color}`}>{item.name}</span>
                            <span className="block text-xs text-gray-400">{item.desc}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- RENDERER USAGE ---

const Home3DView = ({ handleNavClick }) => {
    const systems = [
        { id: 'atmosphere', name: 'Atmosphere', color: 'bg-green-600', hover: 'hover:bg-green-500', icon: '💨' },
        { id: 'ocean', name: 'Ocean', color: 'bg-blue-600', hover: 'hover:bg-blue-500', icon: '🌊' },
        { id: 'cryosphere', name: 'Cryosphere', color: 'bg-cyan-600', hover: 'hover:bg-cyan-500', icon: '🧊' },
        { id: 'land', name: 'Land Surface', color: 'bg-yellow-600', hover: 'hover:bg-yellow-500', icon: '🌳' },
    ];

    return (
        <div id="home-3d-view" className="relative h-[calc(100vh-80px)] overflow-hidden flex items-center justify-center pt-10">
            {/* 1. AESTHETIC GLOBE IS HERE */}
            <HomeGlobe />

            {/* Central Content Overlay */}
            <div className="relative z-10 text-center p-8 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-blue-700/50 shadow-2xl shadow-blue-900/50 w-full max-w-4xl mx-auto">
                
                <h1 className="text-6xl font-extrabold text-white mb-2 tracking-tight">GLOBAL TRENDS</h1>
                <p className="text-2xl font-light text-blue-400 mb-10">25 Years of Earth System Data</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                    {systems.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => handleNavClick(s.id)}
                            className={`p-3 md:p-4 rounded-xl text-lg font-semibold text-white transition duration-300 transform shadow-lg hover:scale-[1.05] ${s.color} ${s.hover}`}
                        >
                            {s.icon} {s.name}
                        </button>
                    ))}
                </div>
                <p className="mt-8 text-sm text-gray-500">Click a system to view detailed charts and interactive 3D visualizations.</p>
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

const App = () => {
    const [currentSystem, setCurrentSystem] = useState('home');
    const [viewMode, setViewMode] = useState('charts');
    const [currentTab, setCurrentTab] = useState('Gases'); 
    const [currentDataIndex, setCurrentDataIndex] = useState(4);

    useEffect(() => {
        if (currentSystem !== 'home' && systemData[currentSystem]) {
            setCurrentTab(systemData[currentSystem].tabs[0]);
        }
    }, [currentSystem]);
    
    const handleNavClick = (systemId) => {
        setCurrentSystem(systemId);
        setViewMode('charts');
    };

    const renderSystemView = () => {
        if (currentSystem === 'home' || !systemData[currentSystem]) return null;

        const systemInfo = systemData[currentSystem];
        const { tabs, bg, colors } = systemInfo;
        const systemTitle = currentSystem.charAt(0).toUpperCase() + currentSystem.slice(1) + (currentSystem === 'land' ? ' Surface' : '');

        return (
            <div id={`${currentSystem}-view`} className="pt-10">
                <div className={`p-8 rounded-xl bg-slate-800/50 shadow-lg mb-8 border border-slate-700`}>
                    <h1 className="text-4xl font-bold capitalize text-gray-100">{systemTitle} System Dashboard</h1>
                    <p className="mt-2 text-gray-400">Analyze the long-term trends by selecting a thematic category below.</p>
                </div>
                
                <div className="flex flex-wrap justify-start gap-3 mb-8">
                    <button 
                        className={`sub-nav-btn text-sm md:text-base font-medium py-2 px-4 rounded-full transition duration-150 ${viewMode === 'charts' 
                            ? 'text-white bg-blue-600 shadow-md shadow-blue-600/50' 
                            : 'text-gray-400 bg-slate-700 hover:bg-slate-600'}`} 
                        onClick={() => setViewMode('charts')}
                    >
                        Data Charts
                    </button>
                    <button 
                        className={`sub-nav-btn text-sm md:text-base font-medium py-2 px-4 rounded-full transition duration-150 ${viewMode === '3d' 
                            ? 'text-white bg-blue-600 shadow-md shadow-blue-600/50' 
                            : 'text-gray-400 bg-slate-700 hover:bg-slate-600'}`} 
                        onClick={() => setViewMode('3d')}
                    >
                        3D Global View
                    </button>
                </div>

                <div id="chart-tab-group" className={`tab-btn-group flex flex-wrap justify-start gap-3 mb-8 ${viewMode === 'charts' ? 'block' : 'hidden'}`}>
                    {tabs.map((tab) => (
                        <button 
                            key={tab}
                            className={`text-sm md:text-base font-medium py-2 px-4 rounded-full transition duration-150 
                                ${currentTab === tab 
                                    ? `text-white bg-slate-700 border-b-2 border-` + systemData[currentSystem].colors.primary.replace('#', '') + ` shadow-inner`
                                    : 'text-gray-400 bg-slate-800 hover:bg-slate-700'}`}
                            onClick={() => setCurrentTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                
                <div className="system-content-area">
                    {viewMode === 'charts' ? (
                        <ChartRenderer key={currentSystem + currentTab} system={currentSystem} tab={currentTab} />
                    ) : (
                        // 2. DATA-DRIVEN GLOBE IS HERE
                        <System3DRenderer key={currentSystem} system={currentSystem} dataIndex={currentDataIndex} onDataIndexChange={setCurrentDataIndex} />
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-900 text-gray-100" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Fixed Header Navigation (Professional Dark Theme) */}
            <header className="fixed top-0 left-0 w-full bg-slate-900 border-b border-blue-700 shadow-2xl z-50">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    
                    {/* Brand/Logo Area */}
                    <a href="#" onClick={() => handleNavClick('home')} className="flex items-center space-x-3 group">
                        {/* Globe Icon (Inline SVG for professionalism) */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-400 group-hover:text-blue-300 transition duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5a2.5 2.5 0 002.5 2.5h.5a2.5 2.5 0 012.5 2.5v1.5m-9.5-3.5h1.5A2.5 2.5 0 0110 9h1.5a2.5 2.5 0 002.5-2.5V4.75M20.945 11H19a2 2 0 00-2 2v1a2 2 0 01-2 2v2.945m-9-1.39v-1.5a2.5 2.5 0 012.5-2.5h.5a2.5 2.5 0 002.5-2.5V4.75M20.945 11H19a2 2 0 00-2 2v1a2 2 0 01-2 2v2.945m-9-1.39v-1.5a2.5 2.5 0 012.5-2.5h.5a2.5 2.5 0 002.5-2.5V4.75"/>
                        </svg>
                        <span className="text-2xl font-extrabold text-white tracking-wider">Celestial Sync</span>
                    </a>

                    {/* Navigation Links (Consolidated and Professional) */}
                    <nav className="flex space-x-4 items-center">
                        <a 
                            href="#" 
                            className={`py-2 px-3 text-sm font-medium rounded-lg transition duration-150 ease-in-out ${currentSystem === 'home' ? 'text-white bg-blue-700 shadow-md shadow-blue-700/50' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`} 
                            onClick={() => handleNavClick('home')}
                        >
                            Home
                        </a>
                        <SystemsDropdown handleNavClick={handleNavClick} />
                    </nav>
                </div>
            </header>

            {/* Main Application Container */}
            <div id="app-container" className="relative">
                {currentSystem === 'home' ? Home3DView({handleNavClick}) : (
                    <div className="container mx-auto px-4 pb-12 pt-20">
                        {renderSystemView()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
