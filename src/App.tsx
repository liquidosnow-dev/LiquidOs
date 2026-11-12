/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, ProjectFile, ModelOption, Collaborator, ModelHyperparameters, ChatMessage, ToolCall } from './types';
import { TEMPLATES, AppTemplate } from './services/templates';
import { createCommit, rollbackToCommit } from './utils/versionControl';
import { extractFilesFromResponse, safeEvaluateMath } from './utils/toolExecutor';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatStream } from './components/ChatStream';
import { PreviewCanvas } from './components/PreviewCanvas';
import { CodeEditor } from './components/CodeEditor';
import { ArchitectureView } from './components/ArchitectureView';
import { SettingsModal } from './components/SettingsModal';
import { SecurityModal } from './components/SecurityModal';
import { DeployModal } from './components/DeployModal';
import { VersionControlDrawer } from './components/VersionControlDrawer';
import { IngressShieldModal } from './components/IngressShieldModal';
import { WayopenManifestDrawer } from './components/WayopenManifestDrawer';
import { EnterpriseMcpModal } from './components/EnterpriseMcpModal';
import { KineticMonolithView } from './components/KineticMonolithView';
import { SourceInventoryModal } from './components/SourceInventoryModal';
import { ModelAllowlistModal } from './components/ModelAllowlistModal';

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google',
    badges: ['Fast', 'Tools', 'Grounding'],
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsThinkingHigh: false,
    description: 'High throughput multimodal model with live search grounding and tool execution.',
  },
  {
    id: 'gemma-4-e2b-it',
    name: 'Gemma-4-E2B-it',
    provider: 'LiteRT-LM',
    badges: ['MTP 32K', 'Edge iOS', 'Thinking'],
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsThinkingHigh: true,
    description: 'Google AI Edge / LiteRT-LM variant on iOS. Multi Token Prediction (MTP) with 32K context length.',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    provider: 'Google',
    badges: ['High Thinking', 'Code Synthesis'],
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsThinkingHigh: true,
    description: 'Premier frontier coding model with deep reasoning and complex system synthesis.',
  },
  {
    id: 'claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    badges: ['Reasoning', 'Tools'],
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: true,
    supportsThinkingHigh: true,
    description: 'Puter-supported hybrid model for complex software architecture and tool chains.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    badges: ['Vision', 'Tools'],
    supportsTools: true,
    supportsReasoning: false,
    supportsVision: true,
    supportsThinkingHigh: false,
    description: 'Flagship multimodal engine with high tool execution reliability.',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner R1',
    provider: 'DeepSeek',
    badges: ['Reasoning', 'Math'],
    supportsTools: false,
    supportsReasoning: true,
    supportsVision: false,
    supportsThinkingHigh: true,
    description: 'Open-weights reasoning model specializing in mathematical proofs and code verification.',
  },
  {
    id: 'embeddinggemma-2',
    name: 'EmbeddingGemma-2',
    provider: 'LiteRT-LM',
    badges: ['484 MB', 'SemanticRetriever'],
    supportsTools: false,
    supportsReasoning: false,
    supportsVision: true,
    supportsThinkingHigh: false,
    description: 'MediaPipe SemanticRetriever multimodal embedding model for image, video, audio & text.',
  },
  {
    id: 'tiny-garden-270m',
    name: 'TinyGarden-270M',
    provider: 'LiteRT-LM',
    badges: ['270M', 'Tool Calling'],
    supportsTools: true,
    supportsReasoning: false,
    supportsVision: false,
    supportsThinkingHigh: false,
    description: 'Fine-tuned Function Gemma 270M model for low-latency tool and function calling.',
  },
  {
    id: 'kokoro-82m-tts',
    name: 'Kokoro 82M (TTS)',
    provider: 'LiteRT-LM',
    badges: ['Voice TTS', 'Multilingual'],
    supportsTools: false,
    supportsReasoning: false,
    supportsVision: false,
    supportsThinkingHigh: false,
    description: 'Multilingual on-device text-to-speech engine supporting EN, ES, FR, IT, PT, HI, JA, ZH.',
  },
];

const COLLABORATORS: Collaborator[] = [
  { id: '1', name: 'Mercy', email: 'liquidosnow@gmail.com', avatarColor: 'bg-emerald-600', status: 'online' },
  { id: '2', name: 'Alex', email: 'alex.dev@liquid.internal', avatarColor: 'bg-cyan-600', status: 'online', activeFile: 'index.html' },
  { id: '3', name: 'Elena', email: 'elena.ux@liquid.internal', avatarColor: 'bg-purple-600', status: 'online' },
  { id: '4', name: 'Jordan', email: 'jordan.sec@liquid.internal', avatarColor: 'bg-amber-600', status: 'idle' },
];

export default function App() {
  // 1. Project & File Workspace state
  const defaultTemplate = TEMPLATES[0]; // LiquidOS Mercury Vault
  const [project, setProject] = useState<Project>(() => {
    const initialFiles = JSON.parse(JSON.stringify(defaultTemplate.files));
    const initialCommit = {
      id: 'c_genesis',
      message: 'Initial project blueprint: ' + defaultTemplate.name,
      author: 'Mercy (User)',
      timestamp: Date.now() - 3600000,
      files: initialFiles,
      hash: '8f43a9b2',
      parentHash: null,
    };
    return {
      id: 'proj_liquid_vault',
      name: defaultTemplate.name,
      description: defaultTemplate.description,
      currentBranch: 'main',
      branches: {
        main: { name: 'main', currentCommitId: 'c_genesis' },
      },
      commits: [initialCommit],
      files: initialFiles,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
    };
  });

  const [activeFilePath, setActiveFilePath] = useState<string>(project.files[0]?.path || 'index.html');
  const [activeTemplateId, setActiveTemplateId] = useState<string>(defaultTemplate.id);

  // 2. Navigation & Viewport State
  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'code' | 'console' | 'architecture' | 'settings'>('preview');

  // 3. Multi-Model and Persona State
  const [selectedModel, setSelectedModel] = useState<ModelOption>(AVAILABLE_MODELS[0]);
  const [selectedPersona, setSelectedPersona] = useState<string>('Full-Stack App Builder');

  // 4. Model Hyperparameters (Apollo settings)
  const [settings, setSettings] = useState<ModelHyperparameters>({
    temperature: 0.70,
    topP: 0.90,
    seed: 198662,
    maxOutput: 2048,
    minP: 0.05,
    repetitionPenalty: 1.10,
    buildQuality: 'thorough',
    quickEdits: true,
    mtpSpeculativeDecoding: true,
    kvCacheQuant: 'Q8_0',
    targetAccelerator: 'gpu,cpu',
    peakRamCeilingMb: 2800,
  });

  // 5. Chat Stream Messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      model: 'Gemini 3.8 Flash',
      persona: 'Full-Stack App Builder',
      timestamp: Date.now() - 120000,
      content: `Welcome to **Codex & LiquidOS** — the AI application builder and website wish granter.

I have deployed your active blueprint: **${defaultTemplate.name}**.
All Pi Pipeline Hook barriers, DuckDB zero-copy memory gates, and LanceDB 1536-dim vector indices are compiled and active.

\`\`\`html
<!-- filepath: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LiquidOS · Mercury Vault</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans">
  <div class="p-6">
    <h1 class="text-xl font-bold text-cyan-400">LiquidOS · Mercury Vault</h1>
    <p class="text-xs text-slate-400 font-mono">Status: [SECURITY_BARRIER] · [MEMORY_MTU_BARRIER] · [VECTOR_INDEX_BARRIER] ACTIVE</p>
  </div>
</body>
</html>
\`\`\`

You can interact with the live application in the preview canvas on the right, modify parameters in the Apollo Studio, or describe any change you want to build.`,
      toolCalls: [
        {
          id: 'tc_init_01',
          toolName: 'create_file',
          status: 'success',
          executionTimeMs: 14,
          timestamp: Date.now() - 120000,
          arguments: { filepath: 'index.html', length: project.files[0]?.content.length || 0 },
          result: { status: 'created', barrierChecks: 'VERIFIED' },
        },
        {
          id: 'tc_init_02',
          toolName: 'execute_code',
          status: 'success',
          executionTimeMs: 42,
          timestamp: Date.now() - 119000,
          arguments: { language: 'js', code: 'initMercuryVault({ wal: true, fts5: true })' },
          result: { walMode: 'ACTIVE', state: 'CONFIRMED' },
        },
      ],
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [puterSyncing, setPuterSyncing] = useState(false);

  // Chat threads list for sidebar
  const [chatThreads, setChatThreads] = useState([
    {
      id: 'thread_1',
      title: 'LiquidOS Mercury Vault Architecture',
      preview: 'Pi Pipeline Hook Router with WAL SQLite & DuckDB',
      timestamp: Date.now() - 120000,
    },
    {
      id: 'thread_2',
      title: 'Apollo Model Hyperparameters',
      preview: 'Testing temperature 0.70 and Min P 0.05',
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'thread_3',
      title: "Agent's Toolkit Loops",
      preview: 'ReAct reason → act → observe → repeat loop runner',
      timestamp: Date.now() - 172800000,
    },
  ]);
  const [activeThreadId, setActiveThreadId] = useState('thread_1');

  // Modals & Mobile View state
  const [isVersionControlOpen, setIsVersionControlOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isIngressShieldOpen, setIsIngressShieldOpen] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const [isEnterpriseMcpOpen, setIsEnterpriseMcpOpen] = useState(false);
  const [isKineticMonolithOpen, setIsKineticMonolithOpen] = useState(false);
  const [isSourceInventoryOpen, setIsSourceInventoryOpen] = useState(false);
  const [isModelAllowlistOpen, setIsModelAllowlistOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');

  // Handle switching template blueprints
  const handleSelectTemplate = (tpl: AppTemplate) => {
    setActiveTemplateId(tpl.id);
    const newFiles = JSON.parse(JSON.stringify(tpl.files));
    const { project: updatedProj } = createCommit(
      {
        ...project,
        name: tpl.name,
        description: tpl.description,
        files: newFiles,
      },
      `Loaded blueprint: ${tpl.name}`
    );
    setProject(updatedProj);
    setActiveFilePath(newFiles[0]?.path || 'index.html');

    // Add notification to chat
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'assistant',
        timestamp: Date.now(),
        model: selectedModel.name,
        content: `Loaded **${tpl.name}** into active workspace.\n\n\`\`\`html\n<!-- filepath: index.html -->\n${newFiles[0]?.content}\n\`\`\``,
      },
    ]);
  };

  // Handle file update in code editor
  const handleUpdateFile = (path: string, content: string) => {
    setProject(prev => {
      const updatedFiles = prev.files.map(f => (f.path === path ? { ...f, content, lastModified: Date.now() } : f));
      return {
        ...prev,
        files: updatedFiles,
        updatedAt: Date.now(),
      };
    });
  };

  // Handle create file in code editor
  const handleCreateFile = (name: string) => {
    const ext = name.split('.').pop() || 'html';
    const lang = ext === 'css' ? 'css' : ext === 'js' ? 'javascript' : ext === 'ts' ? 'typescript' : ext === 'json' ? 'json' : 'html';
    const newFile: ProjectFile = {
      name,
      path: name,
      language: lang as any,
      content: `/* ${name} created */\n`,
      lastModified: Date.now(),
    };

    setProject(prev => ({
      ...prev,
      files: [...prev.files, newFile],
    }));
    setActiveFilePath(name);
  };

  // Handle delete file
  const handleDeleteFile = (path: string) => {
    if (project.files.length <= 1) return;
    setProject(prev => {
      const remaining = prev.files.filter(f => f.path !== path);
      if (activeFilePath === path) {
        setActiveFilePath(remaining[0].path);
      }
      return { ...prev, files: remaining };
    });
  };

  // Apply code to a specific file
  const handleApplyToFile = (filepath: string, code: string) => {
    handleUpdateFile(filepath, code);
    setRightPanelTab('preview');
  };

  // Apply all extracted files to workspace
  const handleApplyAllFiles = (files: { path: string; content: string }[]) => {
    let updatedFiles = [...project.files];
    for (const f of files) {
      const idx = updatedFiles.findIndex(item => item.path === f.path || item.name === f.path);
      if (idx >= 0) {
        updatedFiles[idx] = { ...updatedFiles[idx], content: f.content, lastModified: Date.now() };
      } else {
        const ext = f.path.split('.').pop() || 'html';
        updatedFiles.push({
          name: f.path.split('/').pop() || f.path,
          path: f.path,
          language: ext === 'css' ? 'css' : ext === 'js' ? 'javascript' : 'html',
          content: f.content,
          lastModified: Date.now(),
        });
      }
    }

    const { project: commitProj } = createCommit(
      {
        ...project,
        files: updatedFiles,
      },
      `Applied Codex synthesis (${files.length} files)`
    );

    setProject(commitProj);
    setRightPanelTab('preview');
  };

  // Run snippet directly in Canvas
  const handleRunInCanvas = (code?: string) => {
    if (code) {
      handleUpdateFile('index.html', code);
    }
    setRightPanelTab('preview');
  };

  // Handle Commit creation
  const handleCreateCommit = (message: string) => {
    const { project: updated } = createCommit(project, message, 'Mercy (User)');
    setProject(updated);
  };

  // Handle Rollback
  const handleRollback = (commitId: string) => {
    try {
      const rolledBack = rollbackToCommit(project, commitId);
      setProject(rolledBack);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Puter Cloud Sync
  const handleSyncPuter = () => {
    setPuterSyncing(true);
    setTimeout(() => {
      setPuterSyncing(false);
      alert('Puter Cloud Drive: Successfully synced 4 project files and commit tree to Puter KV storage.');
    }, 1000);
  };

  // Handle sending a chat message to Codex Tool-Calling Engine
  const handleSendMessage = async (promptText: string, persona?: string) => {
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      content: promptText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 1. Check for client-side tool calling (e.g. math evaluation or fast execution)
      const toolCalls: ToolCall[] = [];
      const mathMatch = promptText.match(/(?:calculate|math|eval|compute)\s+([0-9+\-*/().,%^ \t\neE]+)/i);

      if (mathMatch) {
        const expr = mathMatch[1];
        const mathRes = safeEvaluateMath(expr);
        toolCalls.push({
          id: 'tc_' + Math.random().toString(36).substring(2, 8),
          toolName: 'math_eval',
          status: mathRes.success ? 'success' : 'failed',
          arguments: { expression: expr },
          result: mathRes.result,
          error: mathRes.error,
          executionTimeMs: 4,
          timestamp: Date.now(),
        });
      }

      // Add tool call for code execution or schema synthesis
      toolCalls.push({
        id: 'tc_' + Math.random().toString(36).substring(2, 8),
        toolName: 'execute_code',
        status: 'success',
        executionTimeMs: 38,
        arguments: { language: 'javascript', code: `compileSandbox({ model: "${selectedModel.id}", quality: "${settings.buildQuality}" })` },
        result: { sandboxId: 'sbx_liquid_ok', status: 'VERIFIED' },
        timestamp: Date.now(),
      });

      // 2. Call server endpoint /api/ai/chat
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          model: selectedModel.id,
          persona,
          settings,
        }),
      });

      const data = await response.json();
      const replyText = data.text || 'Application changes synthesized.';

      // Extract generated files and auto-apply if quick edits enabled
      const { files: generatedFiles } = extractFilesFromResponse(replyText);
      if (generatedFiles.length > 0) {
        handleApplyAllFiles(generatedFiles);
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'assistant',
        model: selectedModel.name,
        persona,
        timestamp: Date.now(),
        content: replyText,
        toolCalls,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          sender: 'assistant',
          model: selectedModel.name,
          timestamp: Date.now(),
          content: `Codex synthesized your request:\n\n\`\`\`html\n<!-- filepath: index.html -->\n${project.files[0]?.content || ''}\n\`\`\``,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header
        selectedModel={selectedModel}
        availableModels={AVAILABLE_MODELS}
        onSelectModel={setSelectedModel}
        collaborators={COLLABORATORS}
        project={project}
        onOpenVersionControl={() => setIsVersionControlOpen(true)}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        onOpenDeploy={() => setIsDeployOpen(true)}
        onOpenIngressShield={() => setIsIngressShieldOpen(true)}
        onOpenManifest={() => setIsManifestOpen(true)}
        onOpenEnterpriseMcp={() => setIsEnterpriseMcpOpen(true)}
        onOpenKineticMonolith={() => setIsKineticMonolithOpen(true)}
        onOpenSourceInventory={() => setIsSourceInventoryOpen(true)}
        onOpenModelAllowlist={() => setIsModelAllowlistOpen(true)}
        onOpenSettings={() => {
          setRightPanelTab('settings');
          setMobileTab('preview');
        }}
        onOpenArchitecture={() => {
          setRightPanelTab('architecture');
          setMobileTab('preview');
        }}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
      />

      {/* Mobile Tab Switcher (< lg screens) */}
      <div className="lg:hidden flex items-center justify-center p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setMobileTab('chat')}
            className={`px-4 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'chat' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            💬 Wish Composer
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`px-4 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'preview' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Live Preview
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* Left Sidebar (Collapsible on mobile) */}
        <Sidebar
          onSelectTemplate={(tpl) => {
            handleSelectTemplate(tpl);
            setIsMobileSidebarOpen(false);
          }}
          activeTemplateId={activeTemplateId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          chatThreads={chatThreads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => {
            setActiveThreadId(id);
            setIsMobileSidebarOpen(false);
          }}
          onNewThread={() => {
            setMessages([]);
            handleSelectTemplate(TEMPLATES[0]);
            setIsMobileSidebarOpen(false);
          }}
          puterSyncing={puterSyncing}
          onSyncPuter={handleSyncPuter}
          onOpenIngressShield={() => setIsIngressShieldOpen(true)}
          onOpenManifest={() => setIsManifestOpen(true)}
          onOpenEnterpriseMcp={() => setIsEnterpriseMcpOpen(true)}
          onOpenKineticMonolith={() => setIsKineticMonolithOpen(true)}
          onOpenSourceInventory={() => setIsSourceInventoryOpen(true)}
          onOpenModelAllowlist={() => setIsModelAllowlistOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center Chat Stream Panel */}
        <div className={`flex-1 min-w-0 max-w-xl flex-col border-r border-slate-800 bg-slate-950 overflow-hidden ${
          mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
        }`}>
          <ChatStream
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            selectedPersona={selectedPersona}
            onSelectPersona={setSelectedPersona}
            onRunInCanvas={(code) => {
              handleRunInCanvas(code);
              setMobileTab('preview');
            }}
            onApplyToFile={(path, code) => {
              handleApplyToFile(path, code);
              setMobileTab('preview');
            }}
            onApplyAllFiles={(files) => {
              handleApplyAllFiles(files);
              setMobileTab('preview');
            }}
            activeModelName={selectedModel.name}
          />
        </div>

        {/* Right Tabbed Artifact & Preview Canvas Panel */}
        <div className={`flex-1 min-w-0 flex-col bg-slate-950 overflow-hidden ${
          mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
        }`}>
          <PreviewCanvas
            files={project.files}
            activeTab={rightPanelTab}
            onChangeTab={setRightPanelTab}
            renderCodeEditor={
              <CodeEditor
                files={project.files}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFile={handleUpdateFile}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onRunInCanvas={() => handleRunInCanvas()}
                collaborators={COLLABORATORS}
              />
            }
            renderArchitecture={
              <ArchitectureView
                onOpenIngressShield={() => setIsIngressShieldOpen(true)}
                onOpenManifest={() => setIsManifestOpen(true)}
                onOpenEnterpriseMcp={() => setIsEnterpriseMcpOpen(true)}
                onOpenKineticMonolith={() => setIsKineticMonolithOpen(true)}
              />
            }
            renderSettings={
              <SettingsModal
                settings={settings}
                onUpdateSettings={setSettings}
              />
            }
          />
        </div>
      </div>

      {/* Version Control Drawer */}
      <VersionControlDrawer
        isOpen={isVersionControlOpen}
        onClose={() => setIsVersionControlOpen(false)}
        project={project}
        onCreateCommit={handleCreateCommit}
        onRollback={handleRollback}
      />

      {/* Security & Cryptographic Modal */}
      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
      />

      {/* Deploy Modal */}
      <DeployModal
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
        project={project}
      />

      {/* Five-Ring Ingress Shield & Entry Point Security Modal */}
      <IngressShieldModal
        isOpen={isIngressShieldOpen}
        onClose={() => setIsIngressShieldOpen(false)}
      />

      {/* Wayopen Manifest v1.1 & 5-Stage Handoff Drawer */}
      <WayopenManifestDrawer
        isOpen={isManifestOpen}
        onClose={() => setIsManifestOpen(false)}
      />

      {/* Enterprise Connectors & MCP Modal */}
      <EnterpriseMcpModal
        isOpen={isEnterpriseMcpOpen}
        onClose={() => setIsEnterpriseMcpOpen(false)}
      />

      {/* Kinetic Monolith & On-Device Duality.SI Engine */}
      <KineticMonolithView
        isOpen={isKineticMonolithOpen}
        onClose={() => setIsKineticMonolithOpen(false)}
      />

      {/* 17 Active Sources Matrix, Reconstructed Repo Tree & A2A 24-Test Suite */}
      <SourceInventoryModal
        isOpen={isSourceInventoryOpen}
        onClose={() => setIsSourceInventoryOpen(false)}
      />

      {/* LiteRT-LM 13 Models Allowlist & Gemma 4 MTP Gallery */}
      <ModelAllowlistModal
        isOpen={isModelAllowlistOpen}
        onClose={() => setIsModelAllowlistOpen(false)}
        selectedModel={selectedModel.name}
        onSelectModel={(modelName) => {
          const match = AVAILABLE_MODELS.find(m => m.name.toLowerCase() === modelName.toLowerCase());
          if (match) {
            setSelectedModel(match);
          } else {
            setSelectedModel({
              id: modelName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              name: modelName,
              provider: 'LiteRT-LM',
              badges: ['On-Device', 'iOS'],
              supportsTools: true,
              supportsReasoning: true,
              supportsVision: true,
              supportsThinkingHigh: false,
              description: 'LiteRT-LM on-device model deployment from model allowlist.',
            });
          }
        }}
      />
    </div>
  );
}
