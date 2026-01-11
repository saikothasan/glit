import { useState, useEffect, useRef } from 'react';
import { useAgent } from "agents/react";
import { 
  Terminal as TermIcon, Globe, FileCode, Bot, User, Send, 
  PanelRightOpen, PanelRightClose, Cpu, Layout
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";

import './App.css';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function App() {
  const agent = useAgent({
    agent: "PolymathAgent",
    name: "default"
  });

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [activeTab, setActiveTab] = useState<'terminal' | 'preview'>('terminal');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRightOpen, setIsRightOpen] = useState(true);

  const termRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Listen for background events (Streaming Output)
  useEffect(() => {
    if (!agent) return;

    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "terminal_chunk") {
          setTerminalOutput(prev => prev + msg.data);
          setActiveTab('terminal'); // Switch focus to terminal on output
        } 
        else if (msg.type === "preview_ready") {
          setPreviewUrl(msg.data);
          setActiveTab('preview');
        }
      } catch (e) {
        // Not a JSON message, ignore
      }
    };

    // Attach listener to the agent's WebSocket
    if (agent.socket) {
      agent.socket.addEventListener("message", onMessage);
    }
    return () => {
      if (agent.socket) {
        agent.socket.removeEventListener("message", onMessage);
      }
    };
  }, [agent]);

  const handleSend = async () => {
    if (!input.trim() || !agent) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const response = await agent.onChatMessage(userMsg.content);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'system', content: "Error: Agent unreachable." }]);
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-md">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Polymath IDE</h1>
            <p className="text-xs text-zinc-500">Live Agent Environment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className={`border-zinc-700 ${agent ? 'text-green-400' : 'text-zinc-500'}`}>
             {agent ? '● Connected' : '○ Connecting...'}
           </Badge>
           <Button variant="ghost" size="icon" onClick={() => setIsRightOpen(!isRightOpen)}>
             {isRightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
           </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          
          {/* Left: Chat */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex flex-col h-full bg-zinc-950">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-6 max-w-2xl mx-auto pb-6">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-blue-600' : 'bg-zinc-800'}`}>
                        {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <Card className={`p-4 max-w-[85%] border-0 ${m.role === 'user' ? 'bg-blue-600/10 text-blue-100' : 'bg-zinc-900 text-zinc-300'}`}>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                      </Card>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
              
              <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                <div className="max-w-2xl mx-auto relative">
                  <Textarea 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Describe a task (e.g., 'Write a python script to calculate pi and run it')..."
                    className="bg-zinc-950 border-zinc-700 min-h-[50px] resize-none pr-12 focus-visible:ring-blue-600"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="absolute right-2 bottom-2 h-8 w-8 bg-blue-600 hover:bg-blue-500"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-zinc-800" />

          {/* Right: Output (Terminal/Preview) */}
          {isRightOpen && (
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800">
                {/* Tabs */}
                <div className="flex items-center h-10 bg-zinc-900 border-b border-zinc-800 px-2 gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setActiveTab('terminal')}
                    className={`h-7 text-xs gap-2 ${activeTab === 'terminal' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                  >
                    <TermIcon className="w-3 h-3" /> Terminal
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setActiveTab('preview')}
                    className={`h-7 text-xs gap-2 ${activeTab === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                  >
                    <Globe className="w-3 h-3" /> Preview
                  </Button>
                  <div className="ml-auto">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500" onClick={() => setTerminalOutput("")} title="Clear">
                      <div className="w-2 h-2 border border-current rounded-full" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                  {activeTab === 'terminal' ? (
                    <div ref={termRef} className="h-full w-full bg-[#0d0d0d] p-4 overflow-y-auto font-mono text-xs text-green-400 whitespace-pre-wrap leading-relaxed">
                      {terminalOutput || <span className="text-zinc-700">// Ready for output...</span>}
                    </div>
                  ) : (
                    previewUrl ? (
                      <iframe src={previewUrl} className="w-full h-full bg-white" title="Preview" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                        <Cpu className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">No active process</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </ResizablePanel>
          )}

        </ResizablePanelGroup>
      </div>
    </div>
  );
}
