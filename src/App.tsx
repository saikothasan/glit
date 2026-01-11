import { useState, useEffect, useRef } from 'react'
import { useAgent } from "agents/react";
import './App.css'

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function App() {
  // Connect to the "PolymathAgent" with a specific ID (or "default" for a singleton-like behavior)
  const agent = useAgent({
    agent: "PolymathAgent",
    name: "default"
  });

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (agent) {
        // Listen for messages from the agent (including research updates broadcasted via WebSocket)
        // The agents SDK might have a specific way to subscribe.
        // Based on typical useAgent hooks, it exposes messages or an event listener.
        // Assuming typical WebSocket behavior here if useAgent exposes the socket or messages directly.
        // If useAgent returns a state object with messages, we can sync it.
        // But typically useAgent returns { agent, lastMessage, connectionStatus, ... }
        // Let's assume we need to manage messages or use the ones from the hook.
        // For this demo, we'll assume we need to handle incoming messages if the hook exposes a listener.
        // NOTE: Without exact SDK docs for 'useAgent' return value, we assume it provides a way to send and receive.

        // Let's implement a listener if the SDK exposes `onMessage` or similar.
        // If not, we might rely on the return value `lastMessage` in a useEffect.
    }
  }, [agent]);

  // A helper to handle sending
  const handleSend = async () => {
    if (!input.trim() || !agent) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
        // Send message to agent. Expecting a response.
        // If the agent uses WebSockets, this might be void and we wait for onMessage.
        // If it uses HTTP (via the hook helper), it might return the response.
        // The PolymathAgent.onChatMessage returns the response string.
        const response = await agent.onChatMessage(userMsg.content);

        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
        console.error("Error sending message:", e);
        setMessages(prev => [...prev, { role: 'system', content: "Error communicating with agent." }]);
    }
  };

  return (
    <div className="chat-container">
      <header>
        <h1>Polymath AI Agent</h1>
        <p>Powered by Cloudflare Agents, Workflows, Workers AI & Sandbox</p>
      </header>

      <div className="messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="role-label">{m.role.toUpperCase()}</div>
            <div className="content">{m.content}</div>
          </div>
        ))}
      </div>

      <div className="input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask me to research something or write code..."
        />
        <button onClick={handleSend} disabled={!agent}>Send</button>
      </div>
    </div>
  )
}

export default App
