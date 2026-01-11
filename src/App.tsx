import { useState, useEffect, useRef } from 'react';
import { useAgent } from "agents/react";
import { 
  Terminal, 
  Search, 
  Send, 
  Bot, 
  User, 
  Cpu, 
  FileCode, 
  Menu,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import './App.css';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'code' | 'research';
}

function App() {
  const agent = useAgent({
    agent: "PolymathAgent",
    name: "default"
  });

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'files'>('preview');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{ role: 'system', content: 'Connected to Polymath AI. Ready for research & code tasks.' }]);
    }
  }, []);

  // Listen for agent events (Research completion, etc.)
  useEffect(() => {
    if (agent && agent.onMessage) {
        // Hypothetical listener based on `agents` SDK capabilities for broadcasts
        // agent.onMessage((msg: any) => {
        //    if (msg.type === 'research_complete') {
        //        setMessages(prev => [...prev, { role: 'system', content: msg.content, type: 'research' }]);
        //    }
        // });
    }
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
        console.error("Error sending message:", e);
        setMessages(prev => [...prev, { role: 'system', content: "Error communicating with agent." }]);
    }
  };

  return (
    <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-14 border-b flex items-center px-4 justify-between bg-card">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
                <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
                <h1 className="font-semibold leading-none">Polymath Agent</h1>
                <p className="text-xs text-muted-foreground mt-1">Cloudflare Workers + Sandbox</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
                <div className={`w-2 h-2 rounded-full ${agent ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {agent ? 'Online' : 'Connecting...'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}>
                {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        
        {/* Left Sidebar (Optional - Navigation/History) */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25} className="hidden md:block border-r bg-muted/30">
            <div className="p-4">
                <div className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">Capabilities</div>
                <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                        <Terminal className="w-4 h-4" /> Code Interpreter
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                        <Search className="w-4 h-4" /> Deep Research
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                        <Cpu className="w-4 h-4" /> Workflows
                    </Button>
                </div>
                <Separator className="my-4" />
                <div className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">Session History</div>
                <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-1 pr-4">
                        <div className="p-2 text-sm rounded-md bg-accent/50 cursor-pointer truncate">
                            Project: Data Analysis
                        </div>
                        <div className="p-2 text-sm rounded-md hover:bg-accent/50 cursor-pointer text-muted-foreground truncate">
                            Research: AI Models
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </ResizablePanel>
        
        <ResizableHandle />

        {/* Chat Area */}
        <ResizablePanel defaultSize={isRightPanelOpen ? 50 : 80}>
            <div className="flex flex-col h-full relative">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-6 max-w-3xl mx-auto pb-4">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : (m.role === 'system' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground')}`}>
                                    {m.role === 'user' ? <User className="w-4 h-4" /> : (m.role === 'system' ? <Terminal className="w-4 h-4" /> : <Bot className="w-4 h-4" />)}
                                </div>
                                <Card className={`p-4 max-w-[80%] ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {m.content}
                                    </div>
                                    {m.type === 'research' && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                            <Badge variant="secondary" className="text-xs">Research Report Available</Badge>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
                    <div className="max-w-3xl mx-auto flex gap-2">
                        <Textarea 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask Polymath to research a topic or write Python code..."
                            className="min-h-[50px] max-h-[200px] resize-none"
                        />
                        <Button onClick={handleSend} disabled={!agent || !input.trim()} size="icon" className="h-[50px] w-[50px]">
                            <Send className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </ResizablePanel>

        {isRightPanelOpen && (
            <>
                <ResizableHandle />
                {/* Right Panel: Artifacts / State */}
                <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="flex flex-col h-full bg-muted/10">
                        <div className="border-b px-4 h-10 flex items-center gap-4 bg-card">
                            <button 
                                onClick={() => setActiveTab('preview')} 
                                className={`text-sm h-full border-b-2 px-2 ${activeTab === 'preview' ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
                            >
                                Preview
                            </button>
                            <button 
                                onClick={() => setActiveTab('files')} 
                                className={`text-sm h-full border-b-2 px-2 ${activeTab === 'files' ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
                            >
                                Sandbox Files
                            </button>
                        </div>

                        <div className="flex-1 p-4 overflow-hidden">
                            {activeTab === 'preview' ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg p-8 text-center">
                                    <FileCode className="w-12 h-12 mb-4 opacity-50" />
                                    <h3 className="font-medium mb-1">No Active Preview</h3>
                                    <p className="text-sm">Run code or research tasks to see outputs here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium mb-2">/home/sandbox</div>
                                    {/* Mock file list - ideally fetched via listFiles tool */}
                                    <Card className="p-2 flex items-center gap-2 text-sm hover:bg-accent cursor-pointer">
                                        <FileCode className="w-4 h-4 text-blue-500" />
                                        script.py
                                    </Card>
                                    <Card className="p-2 flex items-center gap-2 text-sm hover:bg-accent cursor-pointer">
                                        <FileCode className="w-4 h-4 text-yellow-500" />
                                        data.csv
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>
                </ResizablePanel>
            </>
        )}
      </ResizablePanelGroup>
      </div>
    </div>
  )
}

export default App
