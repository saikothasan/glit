// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { useAgent } from "agents/react";
import { 
  Terminal as TermIcon, Play, Globe, FileText, 
  Layout, Send, Bot, User, Github, Wifi 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import './App.css';

// Simple in-memory terminal buffer
const TerminalView = ({ output }: { output: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [output]);
  return (
    <div ref={ref} className="h-full bg-black text-green-400 font-mono text-xs p-4 overflow-y-auto whitespace-pre-wrap">
      {output || "> Ready..."}
    </div>
  );
};

function App() {
  const agent = useAgent({ agent: "PolymathAgent", name: "default" });
  
  // State
  const [messages, setMessages] = useState<{role:string, content:string}[]>([]);
  const [input, setInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'terminal' | 'preview'>('terminal');

  // Listen for broadcast events from the backend
  useEffect(() => {
    if (!agent) return;
    
    // We poll/listen via the standard React hook or custom event listener if exposed
    // Assuming standard Agent pattern:
    const handleEvent = (e: MessageEvent) => {
        try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'terminal_chunk') {
                setTerminalOutput(prev => prev + msg.data);
            } else if (msg.type === 'preview_ready') {
                setPreviewUrl(msg.data);
                setActiveTab('preview');
            }
        } catch {}
    };
    
    // @ts-ignore - Attaching raw listener if SDK exposes socket, 
    // otherwise rely on onMessage callback if provided by useAgent
    if (agent.socket) agent.socket.addEventListener('message', handleEvent);
    
    return () => {
        if (agent.socket) agent.socket.removeEventListener('message', handleEvent);
    }
  }, [agent]);

  const handleSend = async () => {
    if (!input || !agent) return;
    const msg = input; 
    setInput("");
    setMessages(p => [...p, { role: 'user', content: msg }]);
    
    try {
        const reply = await agent.onChatMessage(msg);
        setMessages(p => [...p, { role: 'assistant', content: reply }]);
    } catch (e) {
        setMessages(p => [...p, { role: 'system', content: "Error..." }]);
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900 justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="bg-blue-600 p-1 rounded"><Layout className="w-4 h-4 text-white" /></div>
          <span>Polymath IDE</span>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400 gap-2">
            <Wifi className={`w-3 h-3 ${agent ? 'text-green-500' : 'text-yellow-500'}`} />
            {agent ? 'Connected' : 'Connecting...'}
        </Badge>
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
            {/* Sidebar / Explorer */}
            <ResizablePanel defaultSize={15} minSize={10} maxSize={20} className="border-r border-zinc-800 bg-zinc-900/50 hidden md:block">
                <div className="p-2 space-y-1">
                    <div className="text-xs text-zinc-500 font-bold px-2 py-1">EXPLORER</div>
                    <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-zinc-100 h-8 text-xs">
                        <FileText className="w-3 h-3 mr-2" /> script.py
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-zinc-100 h-8 text-xs">
                        <Github className="w-3 h-3 mr-2" /> Clone Repo...
                    </Button>
                </div>
            </ResizablePanel>

            <ResizableHandle className="bg-zinc-800" />

            {/* Chat / Editor Area */}
            <ResizablePanel defaultSize={45}>
                <div className="flex flex-col h-full">
                   <ScrollArea className="flex-1 p-4">
                     <div className="space-y-6 max-w-2xl mx-auto">
                        {messages.map((m, i) => (
                           <div key={i} className={`flex gap-4 ${m.role==='user'?'flex-row-reverse':''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role==='user'?'bg-blue-600':'bg-zinc-800'}`}>
                                 {m.role==='user'?<User size={16}/>:<Bot size={16}/>}
                              </div>
                              <div className={`p-3 rounded-lg text-sm leading-relaxed ${m.role==='user'?'bg-blue-600/20 text-blue-100':'bg-zinc-800/50 text-zinc-300'}`}>
                                 {m.content}
                              </div>
                           </div>
                        ))}
                     </div>
                   </ScrollArea>
                   <div className="p-4 border-t border-zinc-800 bg-zinc-900">
                      <div className="flex gap-2 max-w-2xl mx-auto">
                         <Textarea 
                            value={input} onChange={e=>setInput(e.target.value)} 
                            className="bg-zinc-950 border-zinc-700 focus-visible:ring-blue-600 min-h-[50px]"
                            placeholder="Example: Write a python server and preview it..."
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                         />
                         <Button onClick={handleSend} size="icon" className="h-[50px] w-[50px] bg-blue-600 hover:bg-blue-500">
                            <Send size={18} />
                         </Button>
                      </div>
                   </div>
                </div>
            </ResizablePanel>

            <ResizableHandle className="bg-zinc-800" />

            {/* Output / Preview Panel */}
            <ResizablePanel defaultSize={40}>
                <div className="flex flex-col h-full bg-zinc-950">
                   <div className="flex items-center h-10 border-b border-zinc-800 px-2 gap-2 bg-zinc-900">
                      <Button 
                        variant="ghost" size="sm" 
                        className={`h-7 text-xs ${activeTab==='terminal'?'bg-zinc-800 text-zinc-100':'text-zinc-500'}`}
                        onClick={()=>setActiveTab('terminal')}
                      >
                         <TermIcon size={12} className="mr-2"/> Terminal
                      </Button>
                      <Button 
                        variant="ghost" size="sm" 
                        className={`h-7 text-xs ${activeTab==='preview'?'bg-zinc-800 text-zinc-100':'text-zinc-500'}`}
                        onClick={()=>setActiveTab('preview')}
                      >
                         <Globe size={12} className="mr-2"/> Preview
                      </Button>
                      <div className="ml-auto flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTerminalOutput("")} title="Clear Terminal"><div className="w-2 h-2 rounded-full border border-zinc-500"/></Button>
                      </div>
                   </div>
                   
                   <div className="flex-1 overflow-hidden relative">
                      {activeTab === 'terminal' ? (
                          <TerminalView output={terminalOutput} />
                      ) : (
                          previewUrl ? (
                              <iframe src={previewUrl} className="w-full h-full border-none bg-white" title="Preview" />
                          ) : (
                              <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                                  <Globe size={48} className="mb-4 opacity-20" />
                                  <p className="text-sm">No active preview running</p>
                                  <p className="text-xs mt-2">Try: "Run a python server on port 8000"</p>
                              </div>
                          )
                      )}
                   </div>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export default App;
